/**
 * Plan Executor
 *
 * Plan & Execute 워크플로우의 핵심 비즈니스 로직
 * React 의존성 없이 순수 로직만 포함
 */

import { Message, TodoItem } from '../types/index.js';
import { LLMClient } from '../core/llm/llm-client.js';
import { RequestClassifier } from '../agents/classifier/index.js';
import { PlanningLLM } from '../agents/planner/index.js';
import { sessionManager } from '../core/session/session-manager.js';
import { performDocsSearchIfNeeded } from '../agents/docs-search/executor.js';
import {
  CompactManager,
  CompactResult,
  contextTracker,
  buildCompactedMessages,
} from '../core/compact/index.js';
import { configManager } from '../core/config/config-manager.js';
import {
  setTodoUpdateCallback,
  setTodoListCallback,
  clearTodoCallbacks,
} from '../tools/llm/simple/todo-tools.js';
import {
  emitPlanCreated,
  emitTodoStart,
  emitTodoComplete,
  emitTodoFail,
  emitCompact,
} from '../tools/llm/simple/file-tools.js';
import { toolRegistry } from '../tools/registry.js';
import { DEFAULT_SYSTEM_PROMPT } from '../prompts/system/default.js';
import { PLAN_EXECUTE_SYSTEM_PROMPT as PLAN_PROMPT } from '../prompts/system/plan-execute.js';
import { logger } from '../utils/logger.js';

import type { StateCallbacks } from './types.js';
import { formatErrorMessage, buildTodoContext, areAllTodosCompleted, findActiveTodo, getTodoStats } from './utils.js';

/**
 * Plan Executor 설정
 */
export interface PlanExecutorConfig {
  maxIterations: number;
}

const DEFAULT_CONFIG: PlanExecutorConfig = {
  maxIterations: 50,
};

/**
 * Plan Executor
 *
 * 실행 모드별 비즈니스 로직을 담당
 */
export class PlanExecutor {
  private config: PlanExecutorConfig;

  constructor(config: Partial<PlanExecutorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Direct Mode 실행 (단순 응답, TODO 없음)
   */
  async executeDirectMode(
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    _todos: TodoItem[],
    isInterruptedRef: { current: boolean },
    callbacks: StateCallbacks
  ): Promise<void> {
    logger.enter('PlanExecutor.executeDirectMode', { messageLength: userMessage.length });

    // Reset state
    isInterruptedRef.current = false;
    callbacks.setIsInterrupted(false);
    callbacks.setCurrentActivity('Analyzing request');

    // Clear todos when executing direct mode
    callbacks.setTodos([]);
    callbacks.setCurrentTodoId(undefined);

    try {
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      callbacks.setCurrentActivity('Generating response');

      const tools = toolRegistry.getLLMToolDefinitions();

      // Prepare messages with system prompt
      const hasSystemMessage = messages.some(m => m.role === 'system');
      const messagesWithSystem = hasSystemMessage
        ? messages
        : [{ role: 'system' as const, content: DEFAULT_SYSTEM_PROMPT }, ...messages];

      // Check if userMessage is already in messages (avoid duplicate)
      const lastMessage = messagesWithSystem[messagesWithSystem.length - 1];
      const needsUserMessage = !lastMessage || lastMessage.role !== 'user' || lastMessage.content !== userMessage;

      logger.debug('Direct mode message check', {
        messagesCount: messagesWithSystem.length,
        lastMessageRole: lastMessage?.role,
        lastMessageContent: lastMessage?.content?.substring(0, 50),
        userMessage: userMessage.substring(0, 50),
        needsUserMessage,
      });

      const finalMessages = needsUserMessage
        ? messagesWithSystem.concat({ role: 'user', content: userMessage })
        : messagesWithSystem;

      const result = await llmClient.chatCompletionWithTools(
        finalMessages,
        tools
      );

      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      callbacks.setMessages(result.allMessages);
      sessionManager.autoSaveCurrentSession(result.allMessages);

      logger.exit('PlanExecutor.executeDirectMode', { success: true });
    } catch (error) {
      if (error instanceof Error && error.message === 'INTERRUPTED') {
        logger.flow('Direct mode interrupted by user');

        // Check if userMessage is already in messages
        const lastMessage = messages[messages.length - 1];
        const hasUserMessage = lastMessage?.role === 'user' && lastMessage.content === userMessage;

        const interruptedMessages: Message[] = hasUserMessage
          ? [...messages, { role: 'assistant', content: '⚠️ 실행이 중단되었습니다.' }]
          : [...messages, { role: 'user', content: userMessage }, { role: 'assistant', content: '⚠️ 실행이 중단되었습니다.' }];

        callbacks.setMessages(interruptedMessages);
        sessionManager.autoSaveCurrentSession(interruptedMessages);
        return;
      }

      logger.error('Direct mode execution failed', error as Error);

      // Check if userMessage is already in messages
      const lastMessage = messages[messages.length - 1];
      const hasUserMessage = lastMessage?.role === 'user' && lastMessage.content === userMessage;

      const errorMessage = formatErrorMessage(error);
      const updatedMessages: Message[] = hasUserMessage
        ? [...messages, { role: 'assistant', content: errorMessage }]
        : [...messages, { role: 'user', content: userMessage }, { role: 'assistant', content: errorMessage }];

      callbacks.setMessages(updatedMessages);
      sessionManager.autoSaveCurrentSession(updatedMessages);
    }
  }

  /**
   * Plan Mode 실행 (TODO 기반 실행)
   */
  async executePlanMode(
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    isInterruptedRef: { current: boolean },
    callbacks: StateCallbacks
  ): Promise<void> {
    logger.enter('PlanExecutor.executePlanMode', { messageLength: userMessage.length });

    // Reset state
    isInterruptedRef.current = false;
    callbacks.setIsInterrupted(false);
    callbacks.setExecutionPhase('planning');
    callbacks.setCurrentActivity('Planning tasks');

    // Local TODO state
    let currentTodos: TodoItem[] = [];
    const startTime = Date.now();

    try {
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      let currentMessages = messages;

      // 1. Generate TODO list
      callbacks.setCurrentActivity('Creating plan');
      const planningLLM = new PlanningLLM(llmClient);
      const planResult = await planningLLM.generateTODOList(userMessage, currentMessages);
      currentTodos = planResult.todos;

      // Update UI with TODOs
      callbacks.setTodos(currentTodos);
      emitPlanCreated(currentTodos.map(t => t.title));

      const planMessage = `📋 Created ${currentTodos.length} tasks. Starting execution...`;
      currentMessages = [
        ...currentMessages,
        { role: 'user' as const, content: userMessage },
        { role: 'assistant' as const, content: planMessage }
      ];
      callbacks.setMessages(currentMessages);

      // 2. Setup TODO callbacks
      this.setupTodoCallbacks(currentTodos, callbacks, (updated) => {
        currentTodos = updated;
      });

      // 3. Execute loop
      callbacks.setExecutionPhase('executing');
      const tools = toolRegistry.getLLMToolDefinitions();

      // Prepare system message
      const hasSystemMessage = currentMessages.some(m => m.role === 'system');
      if (!hasSystemMessage) {
        currentMessages = [
          { role: 'system' as const, content: PLAN_PROMPT },
          ...currentMessages
        ];
      }

      let iterations = 0;

      while (!areAllTodosCompleted(currentTodos) && iterations < this.config.maxIterations) {
        iterations++;

        if (isInterruptedRef.current) {
          throw new Error('INTERRUPTED');
        }

        // Update activity
        const activeTodo = findActiveTodo(currentTodos);
        callbacks.setCurrentActivity(activeTodo?.title || 'Working on tasks');

        // Build TODO context
        const todoContext = buildTodoContext(currentTodos);

        // Create messages with TODO context
        const lastUserMsgIndex = currentMessages.map(m => m.role).lastIndexOf('user');
        const messagesForLLM = lastUserMsgIndex >= 0
          ? currentMessages.map((m, i) =>
              i === lastUserMsgIndex
                ? { ...m, content: m.content + todoContext }
                : m
            )
          : [...currentMessages, { role: 'user' as const, content: `Continue with the TODO list.${todoContext}` }];

        // Call LLM
        const result = await llmClient.chatCompletionWithTools(messagesForLLM, tools);

        // Update messages (without TODO context)
        const newMessages = result.allMessages.slice(currentMessages.length);
        currentMessages = [...currentMessages, ...newMessages];
        callbacks.setMessages([...currentMessages]);
        sessionManager.autoSaveCurrentSession(currentMessages);

        // Check for auto-compact
        await this.checkAndPerformAutoCompact(
          llmClient,
          currentMessages,
          currentTodos,
          callbacks,
          (updated) => { currentMessages = updated; }
        );
      }

      // 4. Completion
      const duration = Date.now() - startTime;
      const stats = getTodoStats(currentTodos);

      const completionMessage = iterations >= this.config.maxIterations
        ? `⚠️ Execution stopped (max iterations reached)\nTotal: ${stats.total} | Completed: ${stats.completed} | Failed: ${stats.failed}`
        : `✅ Execution complete\nTotal: ${stats.total} | Completed: ${stats.completed} | Failed: ${stats.failed}\nDuration: ${(duration / 1000).toFixed(2)}s`;

      const finalMessages: Message[] = [
        ...currentMessages,
        { role: 'assistant' as const, content: completionMessage }
      ];
      callbacks.setMessages(finalMessages);
      sessionManager.autoSaveCurrentSession(finalMessages);

      logger.exit('PlanExecutor.executePlanMode', { success: true, iterations, ...stats });
    } catch (error) {
      if (error instanceof Error && error.message === 'INTERRUPTED') {
        logger.flow('Plan mode interrupted by user');
        callbacks.setMessages((prev: Message[]) => {
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

      callbacks.setMessages((prev: Message[]) => {
        const updatedMessages: Message[] = [
          ...prev,
          { role: 'assistant' as const, content: `Execution error:\n\n${errorMessage}` }
        ];
        sessionManager.autoSaveCurrentSession(updatedMessages);
        return updatedMessages;
      });
    } finally {
      callbacks.setExecutionPhase('idle');
      clearTodoCallbacks();
    }
  }

  /**
   * TODO 실행 재개
   */
  async resumeTodoExecution(
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    todos: TodoItem[],
    isInterruptedRef: { current: boolean },
    callbacks: StateCallbacks
  ): Promise<void> {
    logger.enter('PlanExecutor.resumeTodoExecution', { messageLength: userMessage.length, todoCount: todos.length });

    // Reset state
    isInterruptedRef.current = false;
    callbacks.setIsInterrupted(false);
    callbacks.setExecutionPhase('executing');
    callbacks.setCurrentActivity('Resuming execution');

    let currentTodos = [...todos];

    try {
      // Add user message
      let currentMessages: Message[] = [
        ...messages,
        { role: 'user' as const, content: userMessage }
      ];
      callbacks.setMessages(currentMessages);

      // Setup TODO callbacks
      this.setupTodoCallbacks(currentTodos, callbacks, (updated) => {
        currentTodos = updated;
      });

      // Get tools from registry
      const tools = toolRegistry.getLLMToolDefinitions();

      // Ensure system message
      const hasSystemMessage = currentMessages.some(m => m.role === 'system');
      if (!hasSystemMessage) {
        currentMessages = [
          { role: 'system' as const, content: PLAN_PROMPT },
          ...currentMessages
        ];
      }

      let iterations = 0;

      while (!areAllTodosCompleted(currentTodos) && iterations < this.config.maxIterations) {
        iterations++;

        if (isInterruptedRef.current) {
          throw new Error('INTERRUPTED');
        }

        const activeTodo = findActiveTodo(currentTodos);
        callbacks.setCurrentActivity(activeTodo?.title || 'Working on tasks');

        // Build TODO context
        const todoContext = buildTodoContext(currentTodos);

        // Create messages with TODO context
        const lastUserMsgIndex = currentMessages.map(m => m.role).lastIndexOf('user');
        const messagesForLLM = lastUserMsgIndex >= 0
          ? currentMessages.map((m, i) =>
              i === lastUserMsgIndex
                ? { ...m, content: m.content + todoContext }
                : m
            )
          : [...currentMessages, { role: 'user' as const, content: `Continue with the TODO list.${todoContext}` }];

        // Call LLM
        const result = await llmClient.chatCompletionWithTools(messagesForLLM, tools);

        // Update messages
        const newMessages = result.allMessages.slice(currentMessages.length);
        currentMessages = [...currentMessages, ...newMessages];
        callbacks.setMessages([...currentMessages]);
        sessionManager.autoSaveCurrentSession(currentMessages);

        // Check for auto-compact
        await this.checkAndPerformAutoCompact(
          llmClient,
          currentMessages,
          currentTodos,
          callbacks,
          (updated) => { currentMessages = updated; }
        );
      }

      // Completion
      const stats = getTodoStats(currentTodos);
      const completionMessage = `✅ Execution complete\nTotal: ${stats.total} | Completed: ${stats.completed} | Failed: ${stats.failed}`;

      const finalMessages: Message[] = [
        ...currentMessages,
        { role: 'assistant' as const, content: completionMessage }
      ];
      callbacks.setMessages(finalMessages);
      sessionManager.autoSaveCurrentSession(finalMessages);

      logger.exit('PlanExecutor.resumeTodoExecution', { success: true, iterations });
    } catch (error) {
      if (error instanceof Error && error.message === 'INTERRUPTED') {
        logger.flow('Resume interrupted by user');
        return;
      }

      logger.error('Resume execution failed', error as Error);
      callbacks.setMessages((prev: Message[]) => [...prev, {
        role: 'assistant' as const,
        content: `Execution error:\n\n${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
    } finally {
      callbacks.setExecutionPhase('idle');
      clearTodoCallbacks();
    }
  }

  /**
   * Auto Mode 실행 (요청 분류 후 적절한 모드 실행)
   */
  async executeAutoMode(
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    todos: TodoItem[],
    isInterruptedRef: { current: boolean },
    callbacks: StateCallbacks
  ): Promise<void> {
    logger.enter('PlanExecutor.executeAutoMode', { messageLength: userMessage.length });

    // Reset state
    isInterruptedRef.current = false;
    callbacks.setIsInterrupted(false);
    callbacks.setExecutionPhase('classifying');
    callbacks.setCurrentActivity('Classifying request');

    try {
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      // 1. Docs search decision
      callbacks.setCurrentActivity('Checking documentation');
      const { messages: messagesWithDocs, performed: docsSearchPerformed } =
        await performDocsSearchIfNeeded(llmClient, userMessage, messages);

      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      // Update messages if docs search was performed
      let currentMessages = messages;
      if (docsSearchPerformed) {
        currentMessages = messagesWithDocs;
        callbacks.setMessages(messagesWithDocs);
      }

      // 2. Request classification
      callbacks.setCurrentActivity('Classifying request');
      const classifier = new RequestClassifier(llmClient);
      const classification = await classifier.classify(userMessage);

      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      logger.vars(
        { name: 'classificationType', value: classification.type },
        { name: 'confidence', value: classification.confidence },
        { name: 'docsSearchPerformed', value: docsSearchPerformed }
      );

      // 3. Execute based on classification
      if (classification.type === 'simple_response') {
        logger.flow('Executing as simple response');
        callbacks.setExecutionPhase('idle');
        await this.executeDirectMode(userMessage, llmClient, currentMessages, todos, isInterruptedRef, callbacks);
      } else {
        logger.flow('Executing as TODO-based task');
        await this.executePlanMode(userMessage, llmClient, currentMessages, isInterruptedRef, callbacks);
      }

      logger.exit('PlanExecutor.executeAutoMode', { classificationType: classification.type, docsSearchPerformed });
    } catch (error) {
      if (error instanceof Error && error.message === 'INTERRUPTED') {
        logger.flow('Auto mode interrupted by user');
        callbacks.setMessages((prev: Message[]) => {
          // Check if userMessage is already in messages
          const lastMessage = prev[prev.length - 1];
          const hasUserMessage = lastMessage?.role === 'user' && lastMessage.content === userMessage;

          const updatedMessages: Message[] = hasUserMessage
            ? [...prev, { role: 'assistant' as const, content: '⚠️ 실행이 중단되었습니다.' }]
            : [...prev, { role: 'user' as const, content: userMessage }, { role: 'assistant' as const, content: '⚠️ 실행이 중단되었습니다.' }];

          sessionManager.autoSaveCurrentSession(updatedMessages);
          return updatedMessages;
        });
        callbacks.setExecutionPhase('idle');
        return;
      }

      logger.error('Auto mode execution failed', error as Error);

      // Fallback to direct mode
      logger.flow('Falling back to direct mode');
      callbacks.setExecutionPhase('idle');
      await this.executeDirectMode(userMessage, llmClient, messages, todos, isInterruptedRef, callbacks);
    }
  }

  /**
   * 대화 압축 수행
   */
  async performCompact(
    llmClient: LLMClient,
    messages: Message[],
    todos: TodoItem[],
    callbacks: StateCallbacks
  ): Promise<CompactResult> {
    logger.enter('PlanExecutor.performCompact', { messageCount: messages.length });
    callbacks.setExecutionPhase('compacting');
    callbacks.setCurrentActivity('Compacting conversation');

    try {
      const compactManager = new CompactManager(llmClient);

      const result = await compactManager.compact(messages, {
        todos,
        workingDirectory: process.cwd(),
        currentModel: configManager.getCurrentModel()?.name,
        recentFiles: contextTracker.getRecentFiles(),
      });

      if (result.success && result.compactedSummary) {
        const lastTwoMessages = messages.slice(-2);

        const compactedBase = buildCompactedMessages(result.compactedSummary, {
          workingDirectory: process.cwd(),
        });

        const finalMessages = [...compactedBase, ...lastTwoMessages];

        callbacks.setMessages(finalMessages);
        contextTracker.reset();
        sessionManager.autoSaveCurrentSession(finalMessages);

        emitCompact(result.originalMessageCount, finalMessages.length);

        logger.flow('Compact completed successfully', { preservedMessages: 2 });
      }

      logger.exit('PlanExecutor.performCompact', { success: result.success });
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
      callbacks.setExecutionPhase('idle');
      callbacks.setCurrentActivity('Idle');
    }
  }

  /**
   * 자동 압축이 필요한지 확인
   */
  shouldAutoCompact(): boolean {
    const model = configManager.getCurrentModel();
    const maxTokens = model?.maxTokens || 128000;
    return contextTracker.shouldTriggerAutoCompact(maxTokens);
  }

  /**
   * 컨텍스트 남은 비율 반환
   */
  getContextRemainingPercent(): number {
    const model = configManager.getCurrentModel();
    const maxTokens = model?.maxTokens || 128000;
    const usage = contextTracker.getContextUsage(maxTokens);
    return usage.remainingPercentage;
  }

  /**
   * 컨텍스트 사용 정보 반환
   */
  getContextUsageInfo(): { tokens: number; percent: number } {
    const model = configManager.getCurrentModel();
    const maxTokens = model?.maxTokens || 128000;
    const usage = contextTracker.getContextUsage(maxTokens);
    return {
      tokens: usage.currentTokens,
      percent: usage.usagePercentage,
    };
  }

  /**
   * TODO 콜백 설정 (내부 헬퍼)
   */
  private setupTodoCallbacks(
    currentTodos: TodoItem[],
    callbacks: StateCallbacks,
    updateLocalTodos: (todos: TodoItem[]) => void
  ): void {
    setTodoUpdateCallback(async (todoId, status, note) => {
      const todo = currentTodos.find(t => t.id === todoId);
      if (!todo) return false;

      const todoTitle = todo.title;
      const updatedTodos = currentTodos.map(t =>
        t.id === todoId ? { ...t, status, result: note } : t
      );
      updateLocalTodos(updatedTodos);
      callbacks.setTodos([...updatedTodos]);

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
  }

  /**
   * 자동 압축 체크 및 수행 (내부 헬퍼)
   */
  private async checkAndPerformAutoCompact(
    llmClient: LLMClient,
    currentMessages: Message[],
    currentTodos: TodoItem[],
    callbacks: StateCallbacks,
    updateLocalMessages: (messages: Message[]) => void
  ): Promise<void> {
    const model = configManager.getCurrentModel();
    const maxTokens = model?.maxTokens || 128000;

    if (contextTracker.shouldTriggerAutoCompact(maxTokens)) {
      logger.flow('Auto-compact triggered during execution');
      callbacks.setExecutionPhase('compacting');
      callbacks.setCurrentActivity('Compacting context');

      const compactManager = new CompactManager(llmClient);
      const compactResult = await compactManager.compact(currentMessages, {
        todos: currentTodos,
        workingDirectory: process.cwd(),
      });

      if (compactResult.success && compactResult.compactedSummary) {
        const lastTwoMessages = currentMessages.slice(-2);
        const newMessages = [
          ...buildCompactedMessages(compactResult.compactedSummary, {
            workingDirectory: process.cwd(),
          }),
          ...lastTwoMessages,
        ];
        updateLocalMessages(newMessages);
        callbacks.setMessages([...newMessages]);
        emitCompact(compactResult.originalMessageCount, compactResult.newMessageCount);
      }

      callbacks.setExecutionPhase('executing');
    }
  }
}

// 싱글톤 인스턴스 (선택적 사용)
export const planExecutor = new PlanExecutor();
