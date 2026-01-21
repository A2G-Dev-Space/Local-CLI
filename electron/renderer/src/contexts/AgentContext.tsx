/**
 * Agent Context - Isolates tool execution state from ChatPanel
 *
 * Performance optimization:
 * - Tool executions and progress messages are now in separate context
 * - ChatPanel doesn't re-render when only tool state changes
 * - Components that need tool state subscribe independently
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { AskUserResponse } from '../../../preload/index';
import type { ToolExecutionData, ToolCategory } from '../components/ToolExecution';
import type { ProgressMessageData } from '../components/ProgressMessage';
import type { TodoItem } from '../components/TodoList';

// Helper function to determine tool category
const getToolCategory = (toolName: string): ToolCategory => {
  const name = toolName.toLowerCase();
  if (name.includes('file') || name.includes('read') || name.includes('write') || name.includes('edit')) return 'file';
  if (name.includes('shell') || name.includes('powershell') || name.includes('command')) return 'shell';
  if (name.includes('browser') || name.includes('chrome') || name.includes('cdp')) return 'browser';
  if (name.includes('excel') || name.includes('word') || name.includes('powerpoint') || name.includes('office')) return 'office';
  if (name.includes('user') || name.includes('ask') || name.includes('tell')) return 'user';
  if (name.includes('todo')) return 'todo';
  return 'other';
};

// User Question Data
export interface UserQuestionData {
  id: string;
  question: string;
  options: { id: string; label: string }[];
  allowCustom: boolean;
}

// Approval Request
export interface ApprovalRequest {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  reason?: string;
}

interface AgentContextValue {
  // Tool executions
  toolExecutions: ToolExecutionData[];
  clearToolExecutions: () => void;

  // Progress messages
  progressMessages: ProgressMessageData[];
  dismissProgressMessage: (id: string) => void;
  clearProgressMessages: () => void;

  // TODOs
  todos: TodoItem[];
  clearTodos: () => void;

  // Execution state
  isExecuting: boolean;
  setIsExecuting: (value: boolean) => void;

  // User question
  currentQuestion: UserQuestionData | null;
  isQuestionOpen: boolean;
  handleQuestionAnswer: (questionId: string, answer: string) => Promise<void>;
  handleQuestionCancel: () => Promise<void>;

  // Approval modal
  approvalRequest: ApprovalRequest | null;
  isApprovalOpen: boolean;
  handleApprovalResponse: (result: 'approve' | 'always' | { reject: true; comment: string }) => Promise<void>;
  handleApprovalCancel: () => Promise<void>;

  // Setup listeners (call once from parent)
  setupAgentListeners: () => () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  // Tool executions - batched updates with useRef + state
  const [toolExecutions, setToolExecutions] = useState<ToolExecutionData[]>([]);
  const toolExecutionQueueRef = useRef<ToolExecutionData[]>([]);
  const toolUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Progress messages
  const [progressMessages, setProgressMessages] = useState<ProgressMessageData[]>([]);

  // TODOs
  const [todos, setTodos] = useState<TodoItem[]>([]);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);

  // User question state
  const [currentQuestion, setCurrentQuestion] = useState<UserQuestionData | null>(null);
  const [isQuestionOpen, setIsQuestionOpen] = useState(false);

  // Approval modal state
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);

  // Batch tool execution updates (throttle to 100ms)
  const flushToolExecutionQueue = useCallback(() => {
    if (toolExecutionQueueRef.current.length > 0) {
      setToolExecutions(prev => [...prev, ...toolExecutionQueueRef.current]);
      toolExecutionQueueRef.current = [];
    }
    toolUpdateTimerRef.current = null;
  }, []);

  const queueToolExecution = useCallback((execution: ToolExecutionData) => {
    toolExecutionQueueRef.current.push(execution);

    if (!toolUpdateTimerRef.current) {
      toolUpdateTimerRef.current = setTimeout(flushToolExecutionQueue, 100);
    }
  }, [flushToolExecutionQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toolUpdateTimerRef.current) {
        clearTimeout(toolUpdateTimerRef.current);
      }
    };
  }, []);

  // Clear functions
  const clearToolExecutions = useCallback(() => {
    setToolExecutions([]);
    toolExecutionQueueRef.current = [];
  }, []);

  const clearProgressMessages = useCallback(() => {
    setProgressMessages([]);
  }, []);

  const clearTodos = useCallback(() => {
    setTodos([]);
  }, []);

  const dismissProgressMessage = useCallback((id: string) => {
    setProgressMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  // User question handlers
  const handleQuestionAnswer = useCallback(async (questionId: string, answer: string) => {
    console.log('Question answered:', questionId, answer);
    setIsQuestionOpen(false);
    setCurrentQuestion(null);

    if (window.electronAPI?.agent) {
      const response: AskUserResponse = {
        selectedOption: { label: answer, value: answer },
        isOther: false,
      };
      await window.electronAPI.agent.respondToQuestion(response);
    }
  }, []);

  const handleQuestionCancel = useCallback(async () => {
    setIsQuestionOpen(false);
    setCurrentQuestion(null);

    if (window.electronAPI?.agent) {
      const response: AskUserResponse = {
        selectedOption: { label: 'Cancel', value: 'cancel' },
        isOther: true,
        customText: 'User cancelled',
      };
      await window.electronAPI.agent.respondToQuestion(response);
    }
  }, []);

  // Approval handlers
  const handleApprovalResponse = useCallback(async (result: 'approve' | 'always' | { reject: true; comment: string }) => {
    if (!approvalRequest || !window.electronAPI?.agent?.respondToApproval) return;

    setIsApprovalOpen(false);

    await window.electronAPI.agent.respondToApproval({
      id: approvalRequest.id,
      result,
    });

    setApprovalRequest(null);
  }, [approvalRequest]);

  const handleApprovalCancel = useCallback(async () => {
    if (!approvalRequest || !window.electronAPI?.agent?.respondToApproval) return;

    setIsApprovalOpen(false);

    await window.electronAPI.agent.respondToApproval({
      id: approvalRequest.id,
      result: { reject: true, comment: 'Cancelled by user' },
    });

    setApprovalRequest(null);
  }, [approvalRequest]);

  // Setup agent event listeners
  const setupAgentListeners = useCallback(() => {
    if (!window.electronAPI?.agent) return () => {};

    const unsubscribes: Array<() => void> = [];

    // Tool call event - queue for batched update
    unsubscribes.push(
      window.electronAPI.agent.onToolCall((data) => {
        const toolCategory = getToolCategory(data.toolName);
        const newExecution: ToolExecutionData = {
          id: `tool-${Date.now()}-${data.toolName}`,
          toolName: data.toolName,
          category: toolCategory,
          input: data.args,
          status: 'running',
          timestamp: Date.now(),
        };
        queueToolExecution(newExecution);
      })
    );

    // Tool result event - update existing execution
    unsubscribes.push(
      window.electronAPI.agent.onToolResult((data) => {
        // Flush any pending tool executions first
        flushToolExecutionQueue();

        setToolExecutions(prev => {
          const updated = [...prev];
          const lastIdx = updated.findIndex(t => t.toolName === data.toolName && t.status === 'running');
          if (lastIdx !== -1) {
            const startTime = updated[lastIdx].timestamp;
            updated[lastIdx] = {
              ...updated[lastIdx],
              status: data.success ? 'success' : 'error',
              output: data.success ? data.result : undefined,
              error: data.success ? undefined : data.result,
              duration: Date.now() - startTime,
            };
          }
          return updated;
        });
      })
    );

    // TODO update event
    unsubscribes.push(
      window.electronAPI.agent.onTodoUpdate((agentTodos) => {
        const uiTodos: TodoItem[] = agentTodos.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
        }));
        setTodos(uiTodos);
      })
    );

    // Tell user event - add progress message
    unsubscribes.push(
      window.electronAPI.agent.onTellUser((message) => {
        const progressMsg: ProgressMessageData = {
          id: `progress-${Date.now()}`,
          message,
          type: 'info',
          timestamp: Date.now(),
        };
        setProgressMessages(prev => [...prev, progressMsg]);
      })
    );

    // Ask user event
    unsubscribes.push(
      window.electronAPI.agent.onAskUser((request) => {
        const questionData: UserQuestionData = {
          id: `question-${Date.now()}`,
          question: request.question,
          options: request.options.map((opt, idx) => ({
            id: `option-${idx}`,
            label: typeof opt === 'string' ? opt : opt.label,
          })),
          allowCustom: request.allowCustom ?? true,
        };
        setCurrentQuestion(questionData);
        setIsQuestionOpen(true);
      })
    );

    // Approval request event
    if (window.electronAPI.agent.onApprovalRequest) {
      unsubscribes.push(
        window.electronAPI.agent.onApprovalRequest((request) => {
          setApprovalRequest(request);
          setIsApprovalOpen(true);
        })
      );
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [queueToolExecution, flushToolExecutionQueue]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<AgentContextValue>(() => ({
    toolExecutions,
    clearToolExecutions,
    progressMessages,
    dismissProgressMessage,
    clearProgressMessages,
    todos,
    clearTodos,
    isExecuting,
    setIsExecuting,
    currentQuestion,
    isQuestionOpen,
    handleQuestionAnswer,
    handleQuestionCancel,
    approvalRequest,
    isApprovalOpen,
    handleApprovalResponse,
    handleApprovalCancel,
    setupAgentListeners,
  }), [
    toolExecutions,
    clearToolExecutions,
    progressMessages,
    dismissProgressMessage,
    clearProgressMessages,
    todos,
    clearTodos,
    isExecuting,
    currentQuestion,
    isQuestionOpen,
    handleQuestionAnswer,
    handleQuestionCancel,
    approvalRequest,
    isApprovalOpen,
    handleApprovalResponse,
    handleApprovalCancel,
    setupAgentListeners,
  ]);

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within AgentProvider');
  }
  return context;
}

// Selective hooks for components that only need specific state
export function useToolExecutions() {
  const { toolExecutions, clearToolExecutions } = useAgent();
  return { toolExecutions, clearToolExecutions };
}

export function useProgressMessages() {
  const { progressMessages, dismissProgressMessage, clearProgressMessages } = useAgent();
  return { progressMessages, dismissProgressMessage, clearProgressMessages };
}

export function useTodos() {
  const { todos, clearTodos } = useAgent();
  return { todos, clearTodos };
}

export function useExecutionState() {
  const { isExecuting, setIsExecuting } = useAgent();
  return { isExecuting, setIsExecuting };
}

export default AgentContext;
