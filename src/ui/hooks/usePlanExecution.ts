/**
 * usePlanExecution Hook
 *
 * Plan & Execute 상태 관리 React Hook
 * 비즈니스 로직은 orchestration/plan-executor.ts에서 처리
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Message, TodoItem } from '../../types/index.js';
import { LLMClient } from '../../core/llm/llm-client.js';
import { logger } from '../../utils/logger.js';
import {
  setTodoUpdateCallback,
  setTodoListCallback,
  clearTodoCallbacks,
} from '../../tools/llm/simple/todo-tools.js';
import {
  setAskUserCallback,
  clearAskUserCallback,
  type AskUserRequest,
  type AskUserResponse,
} from '../../tools/llm/simple/ask-user-tool.js';
import { CompactResult } from '../../core/compact/index.js';

import {
  ExecutionPhase,
  PlanExecutionState,
  AskUserState,
  PlanExecutionActions,
  PlanExecutor,
  StateCallbacks,
} from '../../orchestration/index.js';

// Re-export types for backward compatibility
export type { ExecutionPhase, PlanExecutionState, AskUserState, PlanExecutionActions };

export function usePlanExecution(): PlanExecutionState & AskUserState & PlanExecutionActions {
  logger.enter('usePlanExecution');

  // State
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [currentTodoId, setCurrentTodoId] = useState<string | undefined>();
  const [executionPhase, setExecutionPhase] = useState<ExecutionPhase>('idle');
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string>('Idle');

  // Ask-user state
  const [askUserRequest, setAskUserRequest] = useState<AskUserRequest | null>(null);
  const [askUserResolver, setAskUserResolver] = useState<{
    resolve: (response: AskUserResponse) => void;
  } | null>(null);

  // Refs
  const isInterruptedRef = useRef(false);
  const isPlanModeActiveRef = useRef(false);

  // Memoized executor instance
  const executor = useMemo(() => new PlanExecutor(), []);

  // State callbacks for executor
  const stateCallbacks: StateCallbacks = useMemo(() => ({
    setTodos,
    setCurrentTodoId,
    setExecutionPhase,
    setIsInterrupted: (interrupted: boolean) => {
      setIsInterrupted(interrupted);
      isInterruptedRef.current = interrupted;
    },
    setCurrentActivity,
    setMessages: () => {}, // Will be provided per-call
    setAskUserRequest,
  }), []);

  // Setup TODO tool callbacks (only when NOT in plan mode)
  useEffect(() => {
    if (isPlanModeActiveRef.current) {
      logger.flow('Skipping TODO callback setup - plan mode is active');
      return;
    }

    logger.flow('Setting up TODO tool callbacks');

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

  // Handle TODO update
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

  // Handle ask-user response
  const handleAskUserResponse = useCallback((response: AskUserResponse) => {
    logger.enter('handleAskUserResponse', { selectedOption: response.selectedOption, isOther: response.isOther });

    if (askUserResolver) {
      askUserResolver.resolve(response);
      setAskUserResolver(null);
    }
    setAskUserRequest(null);

    logger.exit('handleAskUserResponse');
  }, [askUserResolver]);

  // Handle interrupt (ESC key)
  const handleInterrupt = useCallback((): 'paused' | 'stopped' | 'none' => {
    logger.enter('handleInterrupt', { executionPhase, isInterrupted });

    const hasPendingTodos = todos.some(t => t.status === 'pending' || t.status === 'in_progress');

    if (isInterrupted && (executionPhase !== 'idle' || hasPendingTodos)) {
      logger.flow('Second ESC - stopping execution completely');

      setTodos([]);
      setExecutionPhase('idle');
      setCurrentTodoId(undefined);
      setCurrentActivity('Idle');
      setIsInterrupted(false);
      isInterruptedRef.current = false;

      logger.debug('Execution stopped completely, all todos cleared');
      logger.exit('handleInterrupt', { result: 'stopped' });
      return 'stopped';
    }

    if (executionPhase !== 'idle' || hasPendingTodos) {
      logger.flow('First ESC - pausing execution');
      setIsInterrupted(true);
      isInterruptedRef.current = true;
      setCurrentActivity('Paused');

      logger.debug('Execution paused (can resume or press ESC again to stop)');
      logger.exit('handleInterrupt', { result: 'paused' });
      return 'paused';
    }

    logger.exit('handleInterrupt', { result: 'none' });
    return 'none';
  }, [executionPhase, isInterrupted, todos]);

  // Execute Direct Mode
  const executeDirectMode = useCallback(async (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    const callbacks: StateCallbacks = {
      ...stateCallbacks,
      setMessages: setMessages as StateCallbacks['setMessages'],
    };
    await executor.executeDirectMode(userMessage, llmClient, messages, todos, isInterruptedRef, callbacks);
  }, [executor, stateCallbacks, todos]);

  // Execute Plan Mode
  const executePlanMode = useCallback(async (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    isPlanModeActiveRef.current = true;
    const callbacks: StateCallbacks = {
      ...stateCallbacks,
      setMessages: setMessages as StateCallbacks['setMessages'],
    };
    try {
      await executor.executePlanMode(userMessage, llmClient, messages, isInterruptedRef, callbacks);
    } finally {
      isPlanModeActiveRef.current = false;
    }
  }, [executor, stateCallbacks]);

  // Resume TODO Execution
  const resumeTodoExecution = useCallback(async (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    isPlanModeActiveRef.current = true;
    const callbacks: StateCallbacks = {
      ...stateCallbacks,
      setMessages: setMessages as StateCallbacks['setMessages'],
    };
    try {
      await executor.resumeTodoExecution(userMessage, llmClient, messages, todos, isInterruptedRef, callbacks);
    } finally {
      isPlanModeActiveRef.current = false;
    }
  }, [executor, stateCallbacks, todos]);

  // Execute Auto Mode
  const executeAutoMode = useCallback(async (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    isPlanModeActiveRef.current = true;
    const callbacks: StateCallbacks = {
      ...stateCallbacks,
      setMessages: setMessages as StateCallbacks['setMessages'],
    };
    try {
      await executor.executeAutoMode(userMessage, llmClient, messages, todos, isInterruptedRef, callbacks);
    } finally {
      isPlanModeActiveRef.current = false;
    }
  }, [executor, stateCallbacks, todos]);

  // Perform Compact
  const performCompact = useCallback(async (
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ): Promise<CompactResult> => {
    const callbacks: StateCallbacks = {
      ...stateCallbacks,
      setMessages: setMessages as StateCallbacks['setMessages'],
    };
    return executor.performCompact(llmClient, messages, todos, callbacks);
  }, [executor, stateCallbacks, todos]);

  // Utility methods
  const shouldAutoCompact = useCallback((): boolean => {
    return executor.shouldAutoCompact();
  }, [executor]);

  const getContextRemainingPercent = useCallback((): number => {
    return executor.getContextRemainingPercent();
  }, [executor]);

  const getContextUsageInfo = useCallback((): { tokens: number; percent: number } => {
    return executor.getContextUsageInfo();
  }, [executor]);

  // Reset interrupt flag when execution completes
  useEffect(() => {
    if (executionPhase === 'idle' && isInterrupted) {
      const hasPendingTodos = todos.some(t => t.status === 'pending' || t.status === 'in_progress');
      if (!hasPendingTodos) {
        setIsInterrupted(false);
        isInterruptedRef.current = false;
      }
    }
  }, [executionPhase, isInterrupted, todos]);

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
    resumeTodoExecution,
    executeDirectMode,
    performCompact,
    shouldAutoCompact,
    getContextRemainingPercent,
    getContextUsageInfo,
  };
}
