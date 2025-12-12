/**
 * usePlanExecution Hook
 *
 * Manages Plan & Execute state and orchestration
 * Phase 1 Enhanced: Request classification, TODO management, auto-execution
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Message, TodoItem } from '../../types/index.js';
import { LLMClient } from '../../core/llm/llm-client.js';
import { RequestClassifier } from '../../core/llm/request-classifier.js';
import { PlanExecuteOrchestrator } from '../../orchestration/orchestrator.js';
import { sessionManager } from '../../core/session/session-manager.js';
import { performDocsSearchIfNeeded } from '../../core/agent-framework-handler.js';
import { BaseError } from '../../errors/base.js';
import { logger } from '../../utils/logger.js';
import {
  setTodoUpdateCallback,
  setTodoListCallback,
  clearTodoCallbacks,
} from '../../tools/llm/simple/todo-tools.js';
import {
  emitPlanCreated,
  emitTodoStart,
  emitTodoComplete,
  emitTodoFail,
  emitCompact,
} from '../../tools/llm/simple/file-tools.js';
import {
  setAskUserCallback,
  clearAskUserCallback,
  type AskUserRequest,
  type AskUserResponse,
} from '../../tools/llm/simple/ask-user-tool.js';
import { DEFAULT_SYSTEM_PROMPT } from '../../orchestration/llm-schemas.js';
import {
  CompactManager,
  CompactResult,
  contextTracker,
  buildCompactedMessages,
} from '../../core/compact/index.js';
import { configManager } from '../../core/config/config-manager.js';

export type ExecutionPhase = 'idle' | 'classifying' | 'planning' | 'executing' | 'compacting';

export interface PlanExecutionState {
  todos: TodoItem[];
  currentTodoId: string | undefined;
  executionPhase: ExecutionPhase;
  isInterrupted: boolean;
  currentActivity: string;  // LLM이 업데이트하는 현재 활동 (Claude Code style)
}

export interface AskUserState {
  askUserRequest: AskUserRequest | null;
}

export interface PlanExecutionActions {
  setTodos: React.Dispatch<React.SetStateAction<TodoItem[]>>;
  handleTodoUpdate: (todo: TodoItem) => void;
  handleAskUserResponse: (response: AskUserResponse) => void;
  handleInterrupt: () => void;
  executeAutoMode: (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => Promise<void>;
  executePlanMode: (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => Promise<void>;
  executeDirectMode: (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => Promise<void>;
  performCompact: (
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => Promise<CompactResult>;
  shouldAutoCompact: () => boolean;
  getContextRemainingPercent: () => number;
  getContextUsageInfo: () => { tokens: number; percent: number };
}

/**
 * Format error for display with all available details
 */
function formatErrorMessage(error: unknown): string {
  logger.enter('formatErrorMessage');

  if (error instanceof BaseError) {
    let message = `❌ ${error.getUserMessage()}\n`;
    message += `\n📋 Error Code: ${error.code}`;

    if (error.details && Object.keys(error.details).length > 0) {
      message += `\n\n🔍 Details:`;
      for (const [key, value] of Object.entries(error.details)) {
        if (key === 'fullError') continue;
        if (typeof value === 'object') {
          message += `\n  • ${key}: ${JSON.stringify(value, null, 2)}`;
        } else {
          message += `\n  • ${key}: ${value}`;
        }
      }
    }

    if (error.isRecoverable) {
      message += `\n\n💡 이 오류는 복구 가능합니다. 다시 시도해보세요.`;
    }

    message += `\n\n🕐 시간: ${error.timestamp.toLocaleString('ko-KR')}`;
    logger.exit('formatErrorMessage', { isBaseError: true });
    return message;
  }

  if (error instanceof Error) {
    let message = `❌ Error: ${error.message}\n`;
    if (error.stack) {
      message += `\n📚 Stack Trace:\n${error.stack}`;
    }
    logger.exit('formatErrorMessage', { isError: true });
    return message;
  }

  logger.exit('formatErrorMessage', { isUnknown: true });
  return `❌ Unknown Error: ${String(error)}`;
}

export function usePlanExecution(): PlanExecutionState & AskUserState & PlanExecutionActions {
  logger.enter('usePlanExecution');

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [currentTodoId, setCurrentTodoId] = useState<string | undefined>();
  const [executionPhase, setExecutionPhase] = useState<ExecutionPhase>('idle');
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string>('대기 중');

  // Ref for interrupt flag (allows checking in async callbacks)
  const isInterruptedRef = useRef(false);

  // Ref for orchestrator (maintained across executions, reset on compact)
  const orchestratorRef = useRef<PlanExecuteOrchestrator | null>(null);

  // Ask-user state
  const [askUserRequest, setAskUserRequest] = useState<AskUserRequest | null>(null);
  const [askUserResolver, setAskUserResolver] = useState<{
    resolve: (response: AskUserResponse) => void;
  } | null>(null);

  // Setup TODO tool callbacks
  useEffect(() => {
    logger.flow('Setting up TODO tool callbacks');

    // Callback for updating TODO status
    const updateCallback = async (
      todoId: string,
      status: 'in_progress' | 'completed' | 'failed',
      note?: string
    ): Promise<boolean> => {
      logger.enter('todoUpdateCallback', { todoId, status, note });

      setTodos(prev => {
        const todoIndex = prev.findIndex(t => t.id === todoId);
        if (todoIndex === -1) {
          logger.warn('TODO not found', { todoId });
          return prev;
        }

        const existingTodo = prev[todoIndex];
        if (!existingTodo) {
          return prev;
        }

        const updated = [...prev];
        updated[todoIndex] = {
          ...existingTodo,
          status,
          result: note || existingTodo.result,
        };

        logger.state('TODO status', existingTodo.status, status);
        return updated;
      });

      if (status === 'in_progress') {
        setCurrentTodoId(todoId);
      } else if (status === 'completed' || status === 'failed') {
        setCurrentTodoId(prev => prev === todoId ? undefined : prev);
      }

      logger.exit('todoUpdateCallback', { success: true });
      return true;
    };

    // Callback for getting TODO list
    const listCallback = () => {
      logger.flow('Getting TODO list for LLM');
      return todos.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
      }));
    };

    setTodoUpdateCallback(updateCallback);
    setTodoListCallback(listCallback);

    return () => {
      logger.flow('Cleaning up TODO tool callbacks');
      clearTodoCallbacks();
    };
  }, [todos]);

  // Setup ask-user callback
  useEffect(() => {
    logger.flow('Setting up ask-user callback');

    const askCallback = async (request: AskUserRequest): Promise<AskUserResponse> => {
      logger.enter('askUserCallback', { question: request.question });

      return new Promise((resolve) => {
        setAskUserRequest(request);
        setAskUserResolver({ resolve });
      });
    };

    setAskUserCallback(askCallback);

    return () => {
      logger.flow('Cleaning up ask-user callback');
      clearAskUserCallback();
    };
  }, []);

  const handleTodoUpdate = useCallback((todo: TodoItem) => {
    logger.enter('handleTodoUpdate', { todoId: todo.id, status: todo.status });

    setTodos(prev => prev.map(t => t.id === todo.id ? todo : t));
    if (todo.status === 'in_progress') {
      setCurrentTodoId(todo.id);
    } else if (todo.status === 'completed' || todo.status === 'failed') {
      setCurrentTodoId(prev => prev === todo.id ? undefined : prev);
    }

    logger.exit('handleTodoUpdate');
  }, []);

  /**
   * Handle ask-user response
   */
  const handleAskUserResponse = useCallback((response: AskUserResponse) => {
    logger.enter('handleAskUserResponse', { selectedOption: response.selectedOption, isOther: response.isOther });

    if (askUserResolver) {
      askUserResolver.resolve(response);
      setAskUserResolver(null);
    }
    setAskUserRequest(null);

    logger.exit('handleAskUserResponse');
  }, [askUserResolver]);

  /**
   * Handle execution interrupt (ESC key)
   */
  const handleInterrupt = useCallback(() => {
    logger.enter('handleInterrupt', { executionPhase });

    if (executionPhase !== 'idle') {
      logger.flow('Interrupting execution');
      setIsInterrupted(true);
      isInterruptedRef.current = true;
      setCurrentActivity('중단됨');
      logger.debug('Execution interrupted by user');
    }

    logger.exit('handleInterrupt');
  }, [executionPhase]);

  /**
   * Execute direct mode (simple response, no TODO)
   */
  const executeDirectMode = useCallback(async (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    logger.enter('executeDirectMode', { messageLength: userMessage.length });

    // Reset interrupt flag at start
    isInterruptedRef.current = false;
    setIsInterrupted(false);
    setCurrentActivity('요청 분석 중');

    // Clear todos when executing direct mode (simple response)
    // This hides the TODO panel after todos are completed
    setTodos([]);
    setCurrentTodoId(undefined);

    try {
      // Check for interrupt
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      setCurrentActivity('문서 검색 중');
      const { messages: messagesWithDocs } =
        await performDocsSearchIfNeeded(llmClient, userMessage, messages);

      // Check for interrupt
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      setCurrentActivity('응답 생성 중');

      const { FILE_TOOLS } = await import('../../tools/llm/simple/file-tools.js');

      // Prepare messages with system prompt if not already present
      const hasSystemMessage = messagesWithDocs.some(m => m.role === 'system');
      const messagesWithSystem = hasSystemMessage
        ? messagesWithDocs
        : [{ role: 'system' as const, content: DEFAULT_SYSTEM_PROMPT }, ...messagesWithDocs];

      const result = await llmClient.chatCompletionWithTools(
        messagesWithSystem.concat({ role: 'user', content: userMessage }),
        FILE_TOOLS
      );

      // Check for interrupt after LLM call
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      setMessages(result.allMessages);
      sessionManager.autoSaveCurrentSession(result.allMessages);

      logger.exit('executeDirectMode', { success: true });
    } catch (error) {
      // Handle interrupt specially
      if (error instanceof Error && error.message === 'INTERRUPTED') {
        logger.flow('Direct mode interrupted by user');
        const interruptedMessages: Message[] = [
          ...messages,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: '⚠️ 실행이 중단되었습니다.' }
        ];
        setMessages(interruptedMessages);
        sessionManager.autoSaveCurrentSession(interruptedMessages);
        return;
      }

      logger.error('Direct mode execution failed', error as Error);

      const errorMessage = formatErrorMessage(error);
      const updatedMessages: Message[] = [
        ...messages,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: errorMessage }
      ];
      setMessages(updatedMessages);
      sessionManager.autoSaveCurrentSession(updatedMessages);
    }
  }, []);

  /**
   * Execute plan mode (TODO-based execution)
   */
  const executePlanMode = useCallback(async (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    logger.enter('executePlanMode', { messageLength: userMessage.length });

    // Reset interrupt flag at start
    isInterruptedRef.current = false;
    setIsInterrupted(false);
    setExecutionPhase('planning');
    setCurrentActivity('계획 수립 중');

    try {
      // Check for interrupt
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      setCurrentActivity('문서 검색 중');
      const { messages: messagesWithDocs, performed: docsSearchPerformed } =
        await performDocsSearchIfNeeded(llmClient, userMessage, messages);

      // Check for interrupt
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      setCurrentActivity('계획 수립 중');

      if (docsSearchPerformed) {
        setMessages(messagesWithDocs);
      }

      // Reuse existing orchestrator or create new one (maintains conversation history)
      if (!orchestratorRef.current) {
        orchestratorRef.current = new PlanExecuteOrchestrator(llmClient, {
          maxDebugAttempts: 2,
          verbose: false,
        });
      }
      const orchestrator = orchestratorRef.current;

      // Sync external messages to orchestrator's conversation history
      // This ensures continuity between direct mode and plan mode
      const currentMessages = docsSearchPerformed ? messagesWithDocs : messages;
      orchestrator.setConversationHistory(currentMessages as any);

      // Remove existing listeners to prevent duplicates when reusing orchestrator
      orchestrator.removeAllListeners();

      orchestrator.on('planCreated', (newTodos: TodoItem[]) => {
        logger.flow('Plan created', { todoCount: newTodos.length });
        setTodos(newTodos);

        // Emit plan created event for Static log
        emitPlanCreated(newTodos.map(t => t.title));

        const planningMessage = `📋 ${newTodos.length}개의 작업을 생성했습니다. 자동으로 실행합니다...`;
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: planningMessage }
        ]);
      });

      orchestrator.on('todoStarted', (todo: TodoItem) => {
        // Check for interrupt before starting new TODO
        if (isInterruptedRef.current) {
          return;
        }
        logger.flow('TODO started', { todoId: todo.id });
        handleTodoUpdate({ ...todo, status: 'in_progress' as const });
        setExecutionPhase('executing');
        setCurrentActivity(todo.title);

        // Emit todo start event for Static log
        emitTodoStart(todo.title);
      });

      orchestrator.on('todoCompleted', (todo: TodoItem) => {
        logger.flow('TODO completed', { todoId: todo.id });
        handleTodoUpdate({ ...todo, status: 'completed' as const });

        // Emit todo complete event for Static log
        emitTodoComplete(todo.title);
      });

      orchestrator.on('todoFailed', (todo: TodoItem) => {
        logger.flow('TODO failed', { todoId: todo.id });
        handleTodoUpdate({ ...todo, status: 'failed' as const });

        // Emit todo fail event for Static log
        emitTodoFail(todo.title);
      });

      const summary = await orchestrator.execute(userMessage);

      // Check for interrupt after execution
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      // Sync orchestrator's conversation history back to external messages
      // This includes all tool calls and responses from task execution
      const orchestratorHistory = orchestrator.getConversationHistory();

      const completionMessage = `✅ 실행 완료\n` +
        `전체: ${summary.totalTasks} | 완료: ${summary.completedTasks} | 실패: ${summary.failedTasks}\n` +
        `소요 시간: ${(summary.duration / 1000).toFixed(2)}초`;

      // Use orchestrator's history as the new messages state
      const updatedMessages: Message[] = [
        ...orchestratorHistory as Message[],
        { role: 'assistant' as const, content: completionMessage }
      ];
      setMessages(updatedMessages);
      sessionManager.autoSaveCurrentSession(updatedMessages);

      logger.exit('executePlanMode', { success: true, summary });
    } catch (error) {
      // Handle interrupt specially
      if (error instanceof Error && error.message === 'INTERRUPTED') {
        logger.flow('Plan mode interrupted by user');
        setMessages(prev => {
          const updatedMessages: Message[] = [
            ...prev,
            { role: 'assistant' as const, content: '⚠️ 실행이 중단되었습니다.' }
          ];
          sessionManager.autoSaveCurrentSession(updatedMessages);
          return updatedMessages;
        });
        return;
      }

      logger.error('Plan mode execution failed', error as Error);

      const errorMessage = formatErrorMessage(error);

      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        const hasUserMessage = lastMessage?.role === 'user' && lastMessage.content === userMessage;

        const updatedMessages: Message[] = hasUserMessage
          ? [
              ...prev,
              { role: 'assistant' as const, content: `실행 중 오류 발생:\n\n${errorMessage}` }
            ]
          : [
              ...prev,
              { role: 'user' as const, content: userMessage },
              { role: 'assistant' as const, content: `실행 중 오류 발생:\n\n${errorMessage}` }
            ];

        sessionManager.autoSaveCurrentSession(updatedMessages);
        return updatedMessages;
      });
    } finally {
      setExecutionPhase('idle');
    }
  }, [handleTodoUpdate]);

  /**
   * Auto mode: Classify request and execute appropriately
   */
  const executeAutoMode = useCallback(async (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    logger.enter('executeAutoMode', { messageLength: userMessage.length });

    // Reset interrupt flag at start
    isInterruptedRef.current = false;
    setIsInterrupted(false);
    setExecutionPhase('classifying');
    setCurrentActivity('요청 분류 중');

    try {
      // Check for interrupt
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      const classifier = new RequestClassifier(llmClient);
      const classification = await classifier.classify(userMessage);

      // Check for interrupt after classification
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      logger.vars(
        { name: 'classificationType', value: classification.type },
        { name: 'confidence', value: classification.confidence }
      );

      if (classification.type === 'simple_response') {
        logger.flow('Executing as simple response');
        setExecutionPhase('idle');
        await executeDirectMode(userMessage, llmClient, messages, setMessages);
      } else {
        logger.flow('Executing as TODO-based task');
        await executePlanMode(userMessage, llmClient, messages, setMessages);
      }

      logger.exit('executeAutoMode', { classificationType: classification.type });
    } catch (error) {
      // Handle interrupt specially
      if (error instanceof Error && error.message === 'INTERRUPTED') {
        logger.flow('Auto mode interrupted by user');
        setMessages(prev => {
          const updatedMessages: Message[] = [
            ...prev,
            { role: 'user' as const, content: userMessage },
            { role: 'assistant' as const, content: '⚠️ 실행이 중단되었습니다.' }
          ];
          sessionManager.autoSaveCurrentSession(updatedMessages);
          return updatedMessages;
        });
        setExecutionPhase('idle');
        return;
      }

      logger.error('Auto mode execution failed', error as Error);

      // Fallback to direct mode on classification error
      logger.flow('Falling back to direct mode');
      setExecutionPhase('idle');
      await executeDirectMode(userMessage, llmClient, messages, setMessages);
    }
  }, [executeDirectMode, executePlanMode]);

  // Reset interrupt flag when execution completes
  useEffect(() => {
    if (executionPhase === 'idle' && isInterrupted) {
      setIsInterrupted(false);
      isInterruptedRef.current = false;
    }
  }, [executionPhase, isInterrupted]);

  /**
   * Perform conversation compaction
   */
  const performCompact = useCallback(async (
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ): Promise<CompactResult> => {
    logger.enter('performCompact', { messageCount: messages.length });
    setExecutionPhase('compacting');
    setCurrentActivity('대화 압축 중');

    try {
      const compactManager = new CompactManager(llmClient);

      const result = await compactManager.compact(messages, {
        todos,
        workingDirectory: process.cwd(),
        currentModel: configManager.getCurrentModel()?.name,
        recentFiles: contextTracker.getRecentFiles(),
      });

      if (result.success && result.compactedSummary) {
        const compactedMessages = buildCompactedMessages(result.compactedSummary, {
          workingDirectory: process.cwd(),
        });
        setMessages(compactedMessages);
        contextTracker.reset();
        sessionManager.autoSaveCurrentSession(compactedMessages);

        // Reset orchestrator conversation history on compact
        if (orchestratorRef.current) {
          orchestratorRef.current.resetConversationHistory();
          logger.flow('Orchestrator conversation history reset on compact');
        }

        // Emit compact event for Static log
        emitCompact(result.originalMessageCount, result.newMessageCount);

        logger.flow('Compact completed successfully');
      }

      logger.exit('performCompact', { success: result.success });
      return result;

    } catch (error) {
      logger.error('Compact failed', error as Error);
      return {
        success: false,
        originalMessageCount: messages.length,
        newMessageCount: messages.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      setExecutionPhase('idle');
      setCurrentActivity('대기 중');
    }
  }, [todos]);

  /**
   * Check if auto-compact should trigger
   */
  const shouldAutoCompact = useCallback((): boolean => {
    const model = configManager.getCurrentModel();
    const maxTokens = model?.maxTokens || 128000;
    return contextTracker.shouldTriggerAutoCompact(maxTokens);
  }, []);

  /**
   * Get context remaining percentage
   */
  const getContextRemainingPercent = useCallback((): number => {
    const model = configManager.getCurrentModel();
    const maxTokens = model?.maxTokens || 128000;
    const usage = contextTracker.getContextUsage(maxTokens);
    return usage.remainingPercentage;
  }, []);

  /**
   * Get context usage info (tokens + percentage)
   */
  const getContextUsageInfo = useCallback((): { tokens: number; percent: number } => {
    const model = configManager.getCurrentModel();
    const maxTokens = model?.maxTokens || 128000;
    const usage = contextTracker.getContextUsage(maxTokens);
    return {
      tokens: usage.currentTokens,
      percent: usage.usagePercentage,
    };
  }, []);

  logger.exit('usePlanExecution');

  return {
    todos,
    currentTodoId,
    executionPhase,
    isInterrupted,
    currentActivity,
    askUserRequest,
    setTodos,
    handleTodoUpdate,
    handleAskUserResponse,
    handleInterrupt,
    executeAutoMode,
    executePlanMode,
    executeDirectMode,
    performCompact,
    shouldAutoCompact,
    getContextRemainingPercent,
    getContextUsageInfo,
  };
}
