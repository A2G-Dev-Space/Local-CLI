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
  if (name.includes('docs') || name.includes('documentation') || name.includes('search_agent')) return 'docs';
  return 'other';
};

// Sanitize string value by removing XML-like parameter syntax from display
const sanitizeDisplayString = (value: string): string => {
  if (typeof value !== 'string') return value;

  // Remove XML parameter tags: <parameter name="...">
  let sanitized = value.replace(/<parameter\s+name=["'][^"']*["']>/gi, '');

  // Remove closing parameter tags
  sanitized = sanitized.replace(/<\/parameter>/gi, '');

  // Remove truncated XML fragments like: font_name">value or text">value
  sanitized = sanitized.replace(/^[a-z_]+["']?>/i, '');

  // Clean up any remaining XML-like artifacts
  sanitized = sanitized.replace(/^["']?>/, '');

  return sanitized.trim();
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

// Final response callback type
export type FinalResponseCallback = (message: string) => void;

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

  // Final response callback (for displaying in chat instead of tool box)
  onFinalResponse: FinalResponseCallback | null;
  setOnFinalResponse: (callback: FinalResponseCallback | null) => void;

  // Setup listeners (call once from parent)
  setupAgentListeners: () => () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  // Tool executions - immediate updates (removed batching to fix visibility issues)
  const [toolExecutions, setToolExecutions] = useState<ToolExecutionData[]>([]);
  // Keep ref for stable access in callbacks
  const toolExecutionsRef = useRef<ToolExecutionData[]>([]);

  // Sync ref with state
  useEffect(() => {
    toolExecutionsRef.current = toolExecutions;
  }, [toolExecutions]);

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

  // Final response callback (stored in ref to avoid stale closures)
  const finalResponseCallbackRef = useRef<FinalResponseCallback | null>(null);
  const setOnFinalResponse = useCallback((callback: FinalResponseCallback | null) => {
    finalResponseCallbackRef.current = callback;
  }, []);

  // Add tool execution immediately (no batching - fixes visibility issues during resize)
  const addToolExecution = useCallback((execution: ToolExecutionData) => {
    setToolExecutions(prev => [...prev, execution]);
  }, []);

  // Clear functions
  const clearToolExecutions = useCallback(() => {
    setToolExecutions([]);
    toolExecutionsRef.current = [];
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

    // Tool call event - immediate update (skip final_response)
    unsubscribes.push(
      window.electronAPI.agent.onToolCall((data) => {
        // Skip final_response - it will be handled as a chat message
        if (data.toolName === 'final_response') return;

        const toolCategory = getToolCategory(data.toolName);

        // Sanitize the reason to remove any XML-like artifacts
        const rawReason = data.args?.reason ? String(data.args.reason) : undefined;
        const sanitizedReason = rawReason ? sanitizeDisplayString(rawReason) : undefined;

        const newExecution: ToolExecutionData = {
          id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${data.toolName}`,
          toolName: data.toolName,
          category: toolCategory,
          input: data.args,
          status: 'running',
          timestamp: Date.now(),
          reason: sanitizedReason,
        };
        addToolExecution(newExecution);
      })
    );

    // Tool result event - update existing execution
    unsubscribes.push(
      window.electronAPI.agent.onToolResult((data) => {
        // Handle final_response specially - display as chat message
        if (data.toolName === 'final_response' && data.success && data.result) {
          if (finalResponseCallbackRef.current) {
            finalResponseCallbackRef.current(data.result);
          }
          return;
        }

        // Update the matching tool execution
        setToolExecutions(prev => {
          const updated = [...prev];
          // Find the most recent running tool with this name
          const lastIdx = updated.findLastIndex(t => t.toolName === data.toolName && t.status === 'running');
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

    // Tell user event - now handled in ChatPanel as chat message for proper time ordering
    // Keeping empty listener to prevent errors if preload expects it
    unsubscribes.push(
      window.electronAPI.agent.onTellUser(() => {
        // Handled in ChatPanel.tsx for proper time-ordered display
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
  }, [addToolExecution]);

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
    onFinalResponse: finalResponseCallbackRef.current,
    setOnFinalResponse,
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
    setOnFinalResponse,
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
