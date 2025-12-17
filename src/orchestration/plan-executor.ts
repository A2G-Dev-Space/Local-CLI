/**
 * Plan Executor
 *
 * Plan & Execute 워크플로우의 핵심 비즈니스 로직
 * React 의존성 없이 순수 로직만 포함
 *
 * 모든 실행은 Planning 기반 (Direct Mode 제거됨)
 */

import { Message, TodoItem } from '../types/index.js';
import { LLMClient } from '../core/llm/llm-client.js';
import { PlanningLLM } from '../agents/planner/index.js';
import { sessionManager } from '../core/session/session-manager.js';
import {
  CompactManager,
  CompactResult,
  contextTracker,
  buildCompactedMessages,
} from '../core/compact/index.js';
import { configManager } from '../core/config/config-manager.js';
import {
  setTodoWriteCallback,
  clearTodoCallbacks,
  TodoInput,
} from '../tools/llm/simple/todo-tools.js';
import {
  setDocsSearchLLMClientGetter,
  clearDocsSearchLLMClientGetter,
} from '../tools/llm/simple/docs-search-agent-tool.js';
import {
  emitPlanCreated,
  emitTodoStart,
  emitTodoComplete,
  emitTodoFail,
  emitCompact,
} from '../tools/llm/simple/file-tools.js';
import { toolRegistry } from '../tools/registry.js';
import { PLAN_EXECUTE_SYSTEM_PROMPT as PLAN_PROMPT } from '../prompts/system/plan-execute.js';
import { logger } from '../utils/logger.js';

import type { StateCallbacks } from './types.js';
import { formatErrorMessage, buildTodoContext, findActiveTodo, getTodoStats } from './utils.js';

/**
 * Plan Executor
 *
 * 모든 요청을 Planning 기반으로 실행
 * chatCompletionWithTools가 내부적으로 tool loop를 처리하므로 외부 루프 불필요
 */
export class PlanExecutor {
  private currentLLMClient: LLMClient | null = null;

  constructor() {
    // No configuration needed - chatCompletionWithTools handles the loop internally
  }

  /**
   * Plan Mode 실행 (TODO 기반 실행)
   * 병렬로 Planning과 Docs Search Decision을 수행
   */
  async executePlanMode(
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    isInterruptedRef: { current: boolean },
    callbacks: StateCallbacks
  ): Promise<void> {
    logger.enter('PlanExecutor.executePlanMode', { messageLength: userMessage.length });

    // Store LLM client for docs search agent tool
    this.currentLLMClient = llmClient;
    setDocsSearchLLMClientGetter(() => this.currentLLMClient);

    // Reset state
    isInterruptedRef.current = false;
    callbacks.setIsInterrupted(false);
    callbacks.setExecutionPhase('planning');
    callbacks.setCurrentActivity('Planning tasks');

    // Local TODO state
    let currentTodos: TodoItem[] = [];

    try {
      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      let currentMessages = messages;

      // 1. Generate TODO list with parallel docs search decision
      callbacks.setCurrentActivity('Creating plan');
      const planningLLM = new PlanningLLM(llmClient);
      const planResult = await planningLLM.generateTODOListWithDocsDecision(userMessage, currentMessages);
      currentTodos = planResult.todos;

      logger.vars(
        { name: 'todoCount', value: currentTodos.length },
        { name: 'docsSearchNeeded', value: planResult.docsSearchNeeded }
      );

      // Update UI with TODOs
      callbacks.setTodos(currentTodos);
      emitPlanCreated(currentTodos.map(t => t.title));

      const planMessage = planResult.docsSearchNeeded
        ? `📋 Created ${currentTodos.length} tasks (including docs search). Starting execution...`
        : `📋 Created ${currentTodos.length} tasks. Starting execution...`;
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

      // 3. Execute (single call - chatCompletionWithTools handles loop internally)
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

      if (isInterruptedRef.current) {
        throw new Error('INTERRUPTED');
      }

      // Update activity
      const activeTodo = findActiveTodo(currentTodos);
      callbacks.setCurrentActivity(activeTodo?.title || 'Working on tasks');

      // Build TODO context and inject into last user message
      const todoContext = buildTodoContext(currentTodos);
      const lastUserMsgIndex = currentMessages.map(m => m.role).lastIndexOf('user');
      const messagesForLLM = lastUserMsgIndex >= 0
        ? currentMessages.map((m, i) =>
            i === lastUserMsgIndex
              ? { ...m, content: m.content + todoContext }
              : m
          )
        : [...currentMessages, { role: 'user' as const, content: `Execute the TODO list.${todoContext}` }];

      // Single LLM call - continues internally until finish_reason: stop
      // Pass pending message callbacks for mid-execution user input injection
      const result = await llmClient.chatCompletionWithTools(messagesForLLM, tools, {
        getPendingMessage: callbacks.getPendingMessage,
        clearPendingMessage: callbacks.clearPendingMessage,
      });

      // Update messages (without TODO context)
      const newMessages = result.allMessages.slice(currentMessages.length);
      currentMessages = [...currentMessages, ...newMessages];
      callbacks.setMessages([...currentMessages]);
      sessionManager.autoSaveCurrentSession(currentMessages);

      // Check for auto-compact after completion
      await this.checkAndPerformAutoCompact(
        llmClient,
        currentMessages,
        currentTodos,
        callbacks,
        (updated) => { currentMessages = updated; }
      );

      // 4. Completion - LLM's final response is already in currentMessages
      const stats = getTodoStats(currentTodos);
      sessionManager.autoSaveCurrentSession(currentMessages);

      logger.exit('PlanExecutor.executePlanMode', { success: true, ...stats });
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
      clearDocsSearchLLMClientGetter();
      this.currentLLMClient = null;
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

    // Store LLM client for docs search agent tool
    this.currentLLMClient = llmClient;
    setDocsSearchLLMClientGetter(() => this.currentLLMClient);

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
        : [...currentMessages, { role: 'user' as const, content: `Resume the TODO list.${todoContext}` }];

      // Single LLM call - continues internally until finish_reason: stop
      // Pass pending message callbacks for mid-execution user input injection
      const result = await llmClient.chatCompletionWithTools(messagesForLLM, tools, {
        getPendingMessage: callbacks.getPendingMessage,
        clearPendingMessage: callbacks.clearPendingMessage,
      });

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

      // Completion - LLM's final response is already in currentMessages
      sessionManager.autoSaveCurrentSession(currentMessages);

      logger.exit('PlanExecutor.resumeTodoExecution', { success: true });
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
      clearDocsSearchLLMClientGetter();
      this.currentLLMClient = null;
    }
  }

  /**
   * Auto Mode 실행 (Planning 기반으로 직접 실행)
   * 분류 로직 제거됨 - 모든 요청을 Plan Mode로 처리
   */
  async executeAutoMode(
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    _todos: TodoItem[],
    isInterruptedRef: { current: boolean },
    callbacks: StateCallbacks
  ): Promise<void> {
    logger.enter('PlanExecutor.executeAutoMode', { messageLength: userMessage.length });

    // All requests are now handled via Plan Mode
    // Classification and Direct Mode have been removed
    await this.executePlanMode(userMessage, llmClient, messages, isInterruptedRef, callbacks);

    logger.exit('PlanExecutor.executeAutoMode');
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
   * write_todos: 전체 목록 교체 방식
   */
  private setupTodoCallbacks(
    currentTodos: TodoItem[],
    callbacks: StateCallbacks,
    updateLocalTodos: (todos: TodoItem[]) => void
  ): void {
    // write_todos callback: 전체 목록 교체
    setTodoWriteCallback(async (newTodos: TodoInput[]) => {
      // Find status changes for UI events
      const oldStatusMap = new Map(currentTodos.map(t => [t.id, t.status]));

      // Convert to TodoItem format
      const updatedTodos: TodoItem[] = newTodos.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
      }));

      // Emit events for status changes
      for (const todo of updatedTodos) {
        const oldStatus = oldStatusMap.get(todo.id);
        if (oldStatus !== todo.status) {
          if (todo.status === 'completed') {
            emitTodoComplete(todo.title);
          } else if (todo.status === 'failed') {
            emitTodoFail(todo.title);
          } else if (todo.status === 'in_progress') {
            emitTodoStart(todo.title);
          }
        }
      }

      updateLocalTodos(updatedTodos);
      callbacks.setTodos([...updatedTodos]);

      return true;
    });
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
