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
// PlanExecuteOrchestrator removed - now using unified execution loop
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
import { DEFAULT_SYSTEM_PROMPT, PLAN_EXECUTE_SYSTEM_PROMPT } from '../../orchestration/llm-schemas.js';
import { PlanningLLM } from '../../core/llm/planning-llm.js';
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

/**
 * Build TODO context to append to user message (not stored in history)
 * This provides LLM with current TODO state without polluting conversation history
 */
function buildTodoContext(todos: TodoItem[]): string {
  if (todos.length === 0) return '';

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
  const pendingCount = todos.filter(t => t.status === 'pending').length;

  const todoList = todos.map((todo, idx) => {
    const statusIcon = todo.status === 'completed' ? '✅' :
                       todo.status === 'in_progress' ? '🔄' :
                       todo.status === 'failed' ? '❌' : '⏳';
    const detail = todo.status === 'in_progress' || todo.status === 'pending'
      ? `\n   Description: ${todo.description || 'No description'}`
      : '';
    return `${idx + 1}. ${statusIcon} [${todo.status.toUpperCase()}] ${todo.title}${detail}`;
  }).join('\n');

  return `
---
## 📋 Current TODO List (${completedCount}/${todos.length} completed)

${todoList}

${pendingCount > 0 || inProgressCount > 0
  ? '**Continue working on the TODO list. Update status using update_todos tool.**'
  : '**All TODOs are completed! Provide a brief summary of what was accomplished.**'}
---`;
}

/**
 * Check if all TODOs are completed (empty array is considered completed)
 */
function areAllTodosCompleted(todos: TodoItem[]): boolean {
  return todos.every(t => t.status === 'completed' || t.status === 'failed');
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

  // Ask-user state
  const [askUserRequest, setAskUserRequest] = useState<AskUserRequest | null>(null);
  const [askUserResolver, setAskUserResolver] = useState<{
    resolve: (response: AskUserResponse) => void;
  } | null>(null);

  // Ref to track if executePlanMode has set its own callbacks
  // This prevents useEffect from overwriting executePlanMode's callbacks
  const isPlanModeActiveRef = useRef(false);

  // Setup TODO tool callbacks (only when NOT in plan mode)
  useEffect(() => {
    // Skip if executePlanMode has set its own callbacks
    if (isPlanModeActiveRef.current) {
      logger.flow('Skipping TODO callback setup - plan mode is active');
      return;
    }

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
   * New unified workflow: same as direct mode but with TODO context injection
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
    setCurrentActivity('Planning tasks');

    // Mark plan mode as active to prevent useEffect from overwriting callbacks
    isPlanModeActiveRef.current = true;

    // Local TODO state for this execution
    let currentTodos: TodoItem[] = [];
    const startTime = Date.now();

    try {
      // Check for interrupt
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      // 1. Docs search (same as direct mode)
      setCurrentActivity('Searching docs');
      const { messages: messagesWithDocs, performed: docsSearchPerformed } =
        await performDocsSearchIfNeeded(llmClient, userMessage, messages);

      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      let currentMessages = docsSearchPerformed ? messagesWithDocs : messages;
      if (docsSearchPerformed) {
        setMessages(messagesWithDocs);
      }

      // 2. Generate TODO list using PlanningLLM
      setCurrentActivity('Creating plan');
      const planningLLM = new PlanningLLM(llmClient);
      const planResult = await planningLLM.generateTODOList(userMessage);
      currentTodos = planResult.todos;

      // Update UI with TODOs
      setTodos(currentTodos);
      emitPlanCreated(currentTodos.map(t => t.title));

      const planMessage = `📋 Created ${currentTodos.length} tasks. Starting execution...`;
      currentMessages = [
        ...currentMessages,
        { role: 'user' as const, content: userMessage },
        { role: 'assistant' as const, content: planMessage }
      ];
      setMessages(currentMessages);

      // 3. Setup TODO callbacks for tool updates
      setTodoUpdateCallback(async (todoId, status, note) => {
        const todo = currentTodos.find(t => t.id === todoId);
        if (!todo) return false;

        const todoTitle = todo.title;
        currentTodos = currentTodos.map(t =>
          t.id === todoId ? { ...t, status, result: note } : t
        );
        setTodos([...currentTodos]);

        // Emit events for UI
        if (status === 'completed') {
          emitTodoComplete(todoTitle);
        } else if (status === 'failed') {
          emitTodoFail(todoTitle);
        } else if (status === 'in_progress') {
          emitTodoStart(todoTitle);
        }

        return true;
      });

      setTodoListCallback(() => currentTodos.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
      })));

      // 4. Execute loop until all TODOs completed
      setExecutionPhase('executing');
      const { FILE_TOOLS } = await import('../../tools/llm/simple/file-tools.js');

      // Prepare system message
      const hasSystemMessage = currentMessages.some(m => m.role === 'system');
      if (!hasSystemMessage) {
        currentMessages = [
          { role: 'system' as const, content: PLAN_EXECUTE_SYSTEM_PROMPT },
          ...currentMessages
        ];
      }

      // Max iterations to prevent infinite loops
      const MAX_ITERATIONS = 50;
      let iterations = 0;

      while (!areAllTodosCompleted(currentTodos) && iterations < MAX_ITERATIONS) {
        iterations++;

        // Check for interrupt
        if (isInterruptedRef.current) {
          throw new Error('INTERRUPTED');
        }

        // Update activity display
        const inProgressTodo = currentTodos.find(t => t.status === 'in_progress');
        const pendingTodo = currentTodos.find(t => t.status === 'pending');
        setCurrentActivity(inProgressTodo?.title || pendingTodo?.title || 'Working on tasks');

        // Build TODO context (NOT stored in history)
        const todoContext = buildTodoContext(currentTodos);

        // Create temporary message with TODO context appended
        const lastUserMsgIndex = currentMessages.map(m => m.role).lastIndexOf('user');
        const messagesForLLM = lastUserMsgIndex >= 0
          ? currentMessages.map((m, i) =>
              i === lastUserMsgIndex
                ? { ...m, content: m.content + todoContext }
                : m
            )
          : [...currentMessages, { role: 'user' as const, content: `Continue with the TODO list.${todoContext}` }];

        // Call LLM with tools
        const result = await llmClient.chatCompletionWithTools(
          messagesForLLM,
          FILE_TOOLS
        );

        // Update messages (WITHOUT TODO context - use original messages + new responses)
        // Extract only the new messages from result
        const newMessages = result.allMessages.slice(currentMessages.length);
        currentMessages = [...currentMessages, ...newMessages];
        setMessages([...currentMessages]);
        sessionManager.autoSaveCurrentSession(currentMessages);

        // Check for auto-compact
        const model = configManager.getCurrentModel();
        const maxTokens = model?.maxTokens || 128000;
        if (contextTracker.shouldTriggerAutoCompact(maxTokens)) {
          logger.flow('Auto-compact triggered during plan execution');
          setExecutionPhase('compacting');
          setCurrentActivity('Compacting context');

          const compactManager = new CompactManager(llmClient);
          const compactResult = await compactManager.compact(currentMessages, {
            todos: currentTodos,
            workingDirectory: process.cwd(),
          });

          if (compactResult.success && compactResult.compactedSummary) {
            // Build new messages preserving last 2 history items
            const lastTwoMessages = currentMessages.slice(-2);
            currentMessages = [
              ...buildCompactedMessages(compactResult.compactedSummary, {
                workingDirectory: process.cwd(),
              }),
              ...lastTwoMessages,
            ];
            setMessages([...currentMessages]);
            emitCompact(compactResult.originalMessageCount, compactResult.newMessageCount);
            // Note: contextTracker.reset() is already called inside compactManager.compact()
          }

          setExecutionPhase('executing');
        }
      }

      // 5. Completion
      const duration = Date.now() - startTime;
      const completedCount = currentTodos.filter(t => t.status === 'completed').length;
      const failedCount = currentTodos.filter(t => t.status === 'failed').length;

      const completionMessage = iterations >= MAX_ITERATIONS
        ? `⚠️ Execution stopped (max iterations reached)\nTotal: ${currentTodos.length} | Completed: ${completedCount} | Failed: ${failedCount}`
        : `✅ Execution complete\nTotal: ${currentTodos.length} | Completed: ${completedCount} | Failed: ${failedCount}\nDuration: ${(duration / 1000).toFixed(2)}s`;

      const finalMessages: Message[] = [
        ...currentMessages,
        { role: 'assistant' as const, content: completionMessage }
      ];
      setMessages(finalMessages);
      sessionManager.autoSaveCurrentSession(finalMessages);

      logger.exit('executePlanMode', { success: true, iterations, completedCount, failedCount });
    } catch (error) {
      // Handle interrupt specially
      if (error instanceof Error && error.message === 'INTERRUPTED') {
        logger.flow('Plan mode interrupted by user');
        setMessages(prev => {
          const updatedMessages: Message[] = [
            ...prev,
            { role: 'assistant' as const, content: '⚠️ Execution interrupted.' }
          ];
          sessionManager.autoSaveCurrentSession(updatedMessages);
          return updatedMessages;
        });
        return;
      }

      logger.error('Plan mode execution failed', error as Error);
      const errorMessage = formatErrorMessage(error);

      setMessages(prev => {
        const updatedMessages: Message[] = [
          ...prev,
          { role: 'assistant' as const, content: `Execution error:\n\n${errorMessage}` }
        ];
        sessionManager.autoSaveCurrentSession(updatedMessages);
        return updatedMessages;
      });
    } finally {
      setExecutionPhase('idle');
      clearTodoCallbacks();
      // Reset plan mode flag so useEffect can manage callbacks again
      isPlanModeActiveRef.current = false;
    }
  }, []);

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
        // Preserve last 2 messages from original history
        const lastTwoMessages = messages.slice(-2);

        const compactedBase = buildCompactedMessages(result.compactedSummary, {
          workingDirectory: process.cwd(),
        });

        // Combine: compacted summary + last 2 messages
        const finalMessages = [...compactedBase, ...lastTwoMessages];

        setMessages(finalMessages);
        contextTracker.reset();
        sessionManager.autoSaveCurrentSession(finalMessages);

        // Emit compact event for Static log
        emitCompact(result.originalMessageCount, finalMessages.length);

        logger.flow('Compact completed successfully', { preservedMessages: 2 });
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
