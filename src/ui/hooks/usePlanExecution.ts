/**
 * usePlanExecution Hook
 *
 * Manages Plan & Execute state and orchestration
 */

import { useState, useCallback } from 'react';
import { Message, TodoItem } from '../../types/index.js';
import { LLMClient } from '../../core/llm-client.js';
import { PlanExecuteOrchestrator } from '../../plan-and-execute/orchestrator.js';
import { sessionManager } from '../../core/session-manager.js';
import { performDocsSearchIfNeeded } from '../../core/agent-framework-handler.js';
import { ApprovalAction } from '../components/ApprovalPrompt.js';
import { BaseError } from '../../errors/base.js';

export type ExecutionPhase = 'idle' | 'planning' | 'executing';

export interface PlanExecutionState {
  todos: TodoItem[];
  currentTodoId: string | undefined;
  executionPhase: ExecutionPhase;
}

export interface ApprovalState {
  planApprovalRequest: {
    userRequest: string;
    todos: TodoItem[];
  } | null;
  taskApprovalRequest: {
    taskDescription: string;
    risk: any;
    context?: string;
  } | null;
}

export interface PlanExecutionActions {
  setTodos: React.Dispatch<React.SetStateAction<TodoItem[]>>;
  handleTodoUpdate: (todo: TodoItem) => void;
  handleApprovalResponse: (action: ApprovalAction) => void;
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
}

/**
 * Format error for display with all available details
 */
function formatErrorMessage(error: unknown): string {
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
    return message;
  }

  if (error instanceof Error) {
    let message = `❌ Error: ${error.message}\n`;
    if (error.stack) {
      message += `\n📚 Stack Trace:\n${error.stack}`;
    }
    return message;
  }

  return `❌ Unknown Error: ${String(error)}`;
}

export function usePlanExecution(): PlanExecutionState & ApprovalState & PlanExecutionActions {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [currentTodoId, setCurrentTodoId] = useState<string | undefined>();
  const [executionPhase, setExecutionPhase] = useState<ExecutionPhase>('idle');

  // Approval state
  const [planApprovalRequest, setPlanApprovalRequest] = useState<{
    userRequest: string;
    todos: TodoItem[];
  } | null>(null);
  const [taskApprovalRequest, setTaskApprovalRequest] = useState<{
    taskDescription: string;
    risk: any;
    context?: string;
  } | null>(null);
  const [approvalResolver, setApprovalResolver] = useState<{
    resolve: (action: string) => void;
  } | null>(null);

  const handleTodoUpdate = useCallback((todo: TodoItem) => {
    setTodos(prev => prev.map(t => t.id === todo.id ? todo : t));
    if (todo.status === 'in_progress') {
      setCurrentTodoId(todo.id);
    } else if (todo.status === 'completed' || todo.status === 'failed') {
      setCurrentTodoId(prev => prev === todo.id ? undefined : prev);
    }
  }, []);

  const handlePlanApprovalRequest = useCallback(async (request: {
    todos: TodoItem[];
    userRequest: string;
  }): Promise<ApprovalAction> => {
    return new Promise((resolve) => {
      setPlanApprovalRequest(request);
      setApprovalResolver({ resolve: resolve as (action: string) => void });
    });
  }, []);

  const handleTaskApprovalRequest = useCallback(async (request: {
    taskId: string;
    taskDescription: string;
    risk: any;
    context?: string;
  }): Promise<ApprovalAction> => {
    return new Promise((resolve) => {
      setTaskApprovalRequest({
        taskDescription: request.taskDescription,
        risk: request.risk,
        context: request.context,
      });
      setApprovalResolver({ resolve: resolve as (action: string) => void });
    });
  }, []);

  const handleApprovalResponse = useCallback((action: ApprovalAction) => {
    if (approvalResolver) {
      approvalResolver.resolve(action);
      setApprovalResolver(null);
    }
    setPlanApprovalRequest(null);
    setTaskApprovalRequest(null);
  }, [approvalResolver]);

  const executeDirectMode = useCallback(async (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    try {
      const { messages: messagesWithDocs } =
        await performDocsSearchIfNeeded(llmClient, userMessage, messages);

      const { FILE_TOOLS } = await import('../../tools/file-tools.js');

      const result = await llmClient.chatCompletionWithTools(
        messagesWithDocs.concat({ role: 'user', content: userMessage }),
        FILE_TOOLS,
        5
      );

      setMessages(result.allMessages);
      sessionManager.autoSaveCurrentSession(result.allMessages);
    } catch (error) {
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

  const executePlanMode = useCallback(async (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ) => {
    setExecutionPhase('planning');

    try {
      const { messages: messagesWithDocs, performed: docsSearchPerformed } =
        await performDocsSearchIfNeeded(llmClient, userMessage, messages);

      if (docsSearchPerformed) {
        setMessages(messagesWithDocs);
      }

      const orchestrator = new PlanExecuteOrchestrator(llmClient, {
        maxDebugAttempts: 2,
        verbose: false,
        hitl: {
          enabled: true,
          approvePlan: true,
          riskConfig: {
            approvalThreshold: 'medium',
          },
        },
      });

      const approvalManager = orchestrator.getApprovalManager();
      approvalManager.setPlanApprovalCallback(handlePlanApprovalRequest);
      approvalManager.setTaskApprovalCallback(handleTaskApprovalRequest);

      orchestrator.on('planCreated', (newTodos: TodoItem[]) => {
        setTodos(newTodos);
        const planningMessage = `📋 Created ${newTodos.length} tasks to complete your request`;
        setMessages(prev => [
          ...prev,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: planningMessage }
        ]);
      });

      orchestrator.on('todoStarted', (todo: TodoItem) => {
        handleTodoUpdate({ ...todo, status: 'in_progress' as const });
        setExecutionPhase('executing');
      });

      orchestrator.on('todoCompleted', (todo: TodoItem) => {
        handleTodoUpdate({ ...todo, status: 'completed' as const });
      });

      orchestrator.on('todoFailed', (todo: TodoItem) => {
        handleTodoUpdate({ ...todo, status: 'failed' as const });
      });

      const summary = await orchestrator.execute(userMessage);

      const completionMessage = `✅ Execution completed\n` +
        `Total: ${summary.totalTasks} | Completed: ${summary.completedTasks} | Failed: ${summary.failedTasks}\n` +
        `Duration: ${(summary.duration / 1000).toFixed(2)}s`;

      setMessages(prev => {
        const updatedMessages: Message[] = [
          ...prev,
          { role: 'assistant' as const, content: completionMessage }
        ];
        sessionManager.autoSaveCurrentSession(updatedMessages);
        return updatedMessages;
      });

    } catch (error) {
      const errorMessage = formatErrorMessage(error);

      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        const hasUserMessage = lastMessage?.role === 'user' && lastMessage.content === userMessage;

        const updatedMessages: Message[] = hasUserMessage
          ? [
              ...prev,
              { role: 'assistant' as const, content: `Plan & Execute 모드 실행 중 오류 발생:\n\n${errorMessage}` }
            ]
          : [
              ...prev,
              { role: 'user' as const, content: userMessage },
              { role: 'assistant' as const, content: `Plan & Execute 모드 실행 중 오류 발생:\n\n${errorMessage}` }
            ];

        sessionManager.autoSaveCurrentSession(updatedMessages);
        return updatedMessages;
      });
    } finally {
      setExecutionPhase('idle');
    }
  }, [handleTodoUpdate, handlePlanApprovalRequest, handleTaskApprovalRequest]);

  return {
    todos,
    currentTodoId,
    executionPhase,
    planApprovalRequest,
    taskApprovalRequest,
    setTodos,
    handleTodoUpdate,
    handleApprovalResponse,
    executePlanMode,
    executeDirectMode,
  };
}
