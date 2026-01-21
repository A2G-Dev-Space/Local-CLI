/**
 * Chat Panel Component (Optimized)
 *
 * Performance optimizations:
 * 1. Tool executions moved to AgentContext (prevents re-renders)
 * 2. Memoized message components
 * 3. Batched state updates
 * 4. Windowed message rendering
 */

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo, memo } from 'react';
import type {
  Session,
  ChatMessage,
  AgentConfig,
} from '../../../preload/index';

// Import optimized markdown hook
import { useMarkdownWorker } from '../hooks/useMarkdownWorker';

// Import AgentContext
import { useAgent } from '../contexts/AgentContext';

// Exposed methods via ref
export interface ChatPanelRef {
  clear: () => Promise<void>;
  compact: () => Promise<void>;
}

import TodoList from './TodoList';
import UserQuestion from './UserQuestion';
import ProgressMessage from './ProgressMessage';
import ToolExecution from './ToolExecution';
import ApprovalModal from './ApprovalModal';
import './ChatPanel.css';

// Import logo for assistant avatar
import logoImage from '/no_bg_logo.png';

import './TodoList.css';
import './UserQuestion.css';
import './ProgressMessage.css';
import './ToolExecution.css';

interface ChatPanelProps {
  session?: Session | null;
  onSessionChange?: (session: Session | null) => void;
  onClearSession?: () => void;
  currentDirectory?: string;
  allowAllPermissions?: boolean;
  onAllowAllPermissionsChange?: (value: boolean) => void;
}

// Memoized markdown content component - uses optimized hook
interface MemoizedMessageContentProps {
  content: string;
  role: 'user' | 'assistant' | 'system';
}

const MemoizedMessageContent = memo<MemoizedMessageContentProps>(({ content, role }) => {
  // Use optimized markdown hook with LRU cache
  const { content: workerContent, isLoading } = useMarkdownWorker(
    role === 'assistant' || role === 'system' ? content : ''
  );

  // For user messages, just return plain text
  if (role === 'user') {
    return <p>{content}</p>;
  }

  // Show loading state briefly
  if (isLoading && !workerContent.length) {
    return <p>{content.slice(0, 100)}...</p>;
  }

  return <>{workerContent}</>;
});
MemoizedMessageContent.displayName = 'MemoizedMessageContent';

// Memoized single message component
interface MessageItemProps {
  message: ChatMessage;
  isBatchLoad: boolean;
}

const MessageItem = memo<MessageItemProps>(({ message, isBatchLoad }) => {
  return (
    <div
      className={`chat-message ${message.role}${isBatchLoad ? ' no-animation' : ''}`}
    >
      {message.role === 'assistant' && (
        <div className="message-avatar">
          <img src={logoImage} alt="Assistant" width="18" height="18" />
        </div>
      )}
      <div className="message-content">
        <MemoizedMessageContent content={message.content} role={message.role} />
      </div>
    </div>
  );
});
MessageItem.displayName = 'MessageItem';

// Welcome message
const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `# Welcome to Local CLI Assistant

I'm here to help you with:

- **PowerShell commands** - Ask me about any PowerShell operations
- **Code assistance** - Get help with coding tasks
- **File operations** - Navigate and manage files
- **Troubleshooting** - Debug issues and errors

Type your question below to get started!`,
  timestamp: Date.now(),
};

const ChatPanel = forwardRef<ChatPanelRef, ChatPanelProps>(({
  session,
  onSessionChange,
  onClearSession,
  currentDirectory,
  allowAllPermissions = true,
  onAllowAllPermissionsChange,
}, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Track if we're doing a batch load (for animation disabling)
  const [isBatchLoad, setIsBatchLoad] = useState(true);

  // Message windowing for performance (only render recent messages)
  const MAX_VISIBLE_MESSAGES = 50;
  const [showAllMessages, setShowAllMessages] = useState(false);

  // Compute visible messages for rendering
  const visibleMessages = useMemo(() => {
    if (showAllMessages || messages.length <= MAX_VISIBLE_MESSAGES) {
      return messages;
    }
    return messages.slice(-MAX_VISIBLE_MESSAGES);
  }, [messages, showAllMessages]);

  const hasHiddenMessages = messages.length > MAX_VISIBLE_MESSAGES && !showAllMessages;
  const hiddenMessageCount = hasHiddenMessages ? messages.length - MAX_VISIBLE_MESSAGES : 0;

  // Use AgentContext for tool state (prevents re-renders)
  const {
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
    setOnFinalResponse,
    setupAgentListeners,
  } = useAgent();

  // Input history state
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load session messages when session changes
  useEffect(() => {
    setIsBatchLoad(true); // Disable animation for batch load
    if (session && session.messages.length > 0) {
      setMessages(session.messages);
    } else {
      setMessages([WELCOME_MESSAGE]);
    }
    // Reset windowing state when session changes
    setShowAllMessages(false);

    // Re-enable animation after batch load completes
    const timer = setTimeout(() => setIsBatchLoad(false), 100);
    return () => clearTimeout(timer);
  }, [session?.id]);

  // Setup agent listeners once
  useEffect(() => {
    const cleanup = setupAgentListeners();
    return cleanup;
  }, [setupAgentListeners]);

  // Save message to session (defined early for use in other hooks)
  const saveMessageToSession = useCallback(async (message: ChatMessage) => {
    if (!window.electronAPI?.session) return;

    try {
      await window.electronAPI.session.addMessage(message);
    } catch (error) {
      console.error('Failed to save message to session:', error);
    }
  }, []);

  // Setup final response callback - displays as chat message with markdown
  useEffect(() => {
    setOnFinalResponse((message: string) => {
      const assistantMessage: ChatMessage = {
        id: `final-${Date.now()}`,
        role: 'assistant',
        content: message,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      saveMessageToSession(assistantMessage);
    });

    return () => {
      setOnFinalResponse(null);
    };
  }, [setOnFinalResponse, saveMessageToSession]);

  // Handle agent completion/error (adds messages)
  useEffect(() => {
    if (!window.electronAPI?.agent) return;

    const unsubscribes: Array<() => void> = [];

    // Agent complete event
    unsubscribes.push(
      window.electronAPI.agent.onComplete((data) => {
        if (data.response) {
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.response,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, assistantMessage]);
          saveMessageToSession(assistantMessage);
        }
        setIsLoading(false);
        setIsExecuting(false);

        // Save session
        if (window.electronAPI?.session) {
          window.electronAPI.session.saveCurrent();
        }
      })
    );

    // Agent error event
    unsubscribes.push(
      window.electronAPI.agent.onError((data) => {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `Error: ${data.error}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        setIsExecuting(false);
      })
    );

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [setIsExecuting]);

  // Auto-scroll to bottom - optimized with throttle
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  // Auto-scroll when messages, tools, todos, or progress messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading, toolExecutions.length, todos.length, progressMessages.length, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Send message using agent
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Save to input history
    setInputHistory(prev => {
      const filtered = prev.filter(h => h !== input.trim());
      return [...filtered, input.trim()].slice(-50);
    });
    setHistoryIndex(-1);

    setInput('');
    setIsLoading(true);
    setIsExecuting(true);

    // Clear previous execution state
    clearToolExecutions();
    clearProgressMessages();

    // Save user message
    await saveMessageToSession(userMessage);

    // Check if agent API is available
    if (!window.electronAPI?.agent) {
      console.warn('electronAPI.agent not available, using fallback');
      setTimeout(async () => {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `I received your message: "${userMessage.content}"\n\n*Note: Agent not connected. Configure an endpoint in Settings.*`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        setIsExecuting(false);
        await saveMessageToSession(assistantMessage);
      }, 500);
      return;
    }

    // Build conversation history for agent
    const conversationMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Agent config
    const agentConfig: AgentConfig = {
      workingDirectory: currentDirectory,
      maxIterations: 50,
      autoMode: allowAllPermissions,
    };

    try {
      const result = await window.electronAPI.agent.run(
        userMessage.content,
        conversationMessages,
        agentConfig
      );

      if (!result.success && result.error) {
        console.error('Agent error:', result.error);
      }
    } catch (error) {
      console.error('Agent error:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      setIsExecuting(false);
    }
  }, [input, isLoading, messages, saveMessageToSession, currentDirectory, allowAllPermissions, clearToolExecutions, clearProgressMessages, setIsExecuting]);

  // Abort message state
  const [abortMessage, setAbortMessage] = useState<string | null>(null);

  // Abort agent execution
  const handleAbort = useCallback(async () => {
    if (window.electronAPI?.agent) {
      await window.electronAPI.agent.abort();
      setIsLoading(false);
      setIsExecuting(false);
      setAbortMessage('Agent execution aborted.');

      setTimeout(() => setAbortMessage(null), 5000);
    }
  }, [setIsExecuting]);

  // Handle keyboard events with input history
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      return;
    }

    if (e.key === 'ArrowUp' && inputHistory.length > 0) {
      const cursorPos = e.currentTarget.selectionStart;
      if (cursorPos === 0 || input === '') {
        e.preventDefault();
        const newIndex = historyIndex < inputHistory.length - 1 ? historyIndex + 1 : historyIndex;
        if (newIndex !== historyIndex) {
          setHistoryIndex(newIndex);
          setInput(inputHistory[inputHistory.length - 1 - newIndex]);
        }
      }
    }

    if (e.key === 'ArrowDown' && historyIndex >= 0) {
      const cursorPos = e.currentTarget.selectionStart;
      if (cursorPos === input.length) {
        e.preventDefault();
        const newIndex = historyIndex - 1;
        if (newIndex >= 0) {
          setHistoryIndex(newIndex);
          setInput(inputHistory[inputHistory.length - 1 - newIndex]);
        } else {
          setHistoryIndex(-1);
          setInput('');
        }
      }
    }

    if (e.key === 'Escape' && isExecuting) {
      e.preventDefault();
      handleAbort();
    }
  };

  // Retry failed tool execution
  const handleToolRetry = useCallback((id: string) => {
    console.log('Retrying tool:', id);
  }, []);

  // Compact conversation
  const [isCompacting, setIsCompacting] = useState(false);

  const handleCompact = useCallback(async () => {
    if (!window.electronAPI?.compact || isCompacting || isLoading) return;

    const checkResult = await window.electronAPI.compact.canCompact(
      messages.map(m => ({ role: m.role, content: m.content }))
    );

    if (!checkResult.canCompact) {
      const errorMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: `Compact not possible: ${checkResult.reason}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    setIsCompacting(true);

    try {
      const result = await window.electronAPI.compact.execute(
        messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system' | 'tool', content: m.content })),
        { workingDirectory: currentDirectory }
      );

      if (result.success && result.compactedMessages) {
        const newMessages: ChatMessage[] = result.compactedMessages.map((m, idx) => ({
          id: `compacted-${Date.now()}-${idx}`,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: Date.now(),
        }));

        newMessages.push({
          id: `compact-info-${Date.now()}`,
          role: 'system',
          content: `Conversation compacted: ${result.originalMessageCount} messages → ${result.newMessageCount} messages`,
          timestamp: Date.now(),
        });

        setIsBatchLoad(true);
        setMessages(newMessages);
        setTimeout(() => setIsBatchLoad(false), 100);

        if (session && onSessionChange) {
          const updatedSession: Session = {
            ...session,
            messages: newMessages,
            updatedAt: Date.now(),
          };
          onSessionChange(updatedSession);

          if (window.electronAPI?.session) {
            await window.electronAPI.session.save(updatedSession);
          }
        }
      } else {
        const errorMessage: ChatMessage = {
          id: `system-${Date.now()}`,
          role: 'system',
          content: `Compact failed: ${result.error || 'Unknown error'}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Compact error:', error);
      const errorMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: `Compact error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsCompacting(false);
    }
  }, [messages, isCompacting, isLoading, currentDirectory, session, onSessionChange]);

  // Clear chat
  const handleClear = useCallback(async () => {
    if (isExecuting && window.electronAPI?.agent) {
      await window.electronAPI.agent.abort();
    }

    setIsBatchLoad(true);
    setMessages([
      {
        id: 'cleared',
        role: 'system',
        content: 'Chat cleared. How can I help you?',
        timestamp: Date.now(),
      },
    ]);
    setTimeout(() => setIsBatchLoad(false), 100);

    // Clear execution state via context
    clearTodos();
    clearProgressMessages();
    clearToolExecutions();
    setIsExecuting(false);
    setIsLoading(false);

    if (session && onSessionChange) {
      const clearedSession: Session = {
        ...session,
        messages: [],
        updatedAt: Date.now(),
      };
      onSessionChange(clearedSession);

      if (window.electronAPI?.session) {
        await window.electronAPI.session.save(clearedSession);
      }
    }

    onClearSession?.();
  }, [session, onSessionChange, onClearSession, isExecuting, clearTodos, clearProgressMessages, clearToolExecutions, setIsExecuting]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    clear: handleClear,
    compact: handleCompact,
  }), [handleClear, handleCompact]);

  return (
    <div className="chat-panel" role="region" aria-label="Chat Assistant">
      {/* User Question Dialog */}
      <UserQuestion
        isOpen={isQuestionOpen}
        question={currentQuestion}
        onAnswer={handleQuestionAnswer}
        onCancel={handleQuestionCancel}
      />

      {/* Approval Modal (Supervised Mode) */}
      <ApprovalModal
        isOpen={isApprovalOpen}
        toolName={approvalRequest?.toolName || ''}
        args={approvalRequest?.args || {}}
        reason={approvalRequest?.reason}
        onResponse={handleApprovalResponse}
        onCancel={handleApprovalCancel}
      />

      {/* Current Directory Info */}
      {currentDirectory && (
        <div className="chat-directory-info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
          <span>{currentDirectory}</span>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages" role="log" aria-live="polite" aria-label="Chat messages">
        {/* Show earlier messages button */}
        {hasHiddenMessages && (
          <button
            className="show-earlier-btn"
            onClick={() => setShowAllMessages(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
            </svg>
            Show {hiddenMessageCount} earlier messages
          </button>
        )}
        {visibleMessages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isBatchLoad={isBatchLoad}
          />
        ))}

        {/* TODO List is now shown in the Editor area (TodoPanel) */}

        {/* Progress Messages - shown during execution */}
        {progressMessages.length > 0 && (
          <ProgressMessage
            messages={progressMessages}
            onDismiss={dismissProgressMessage}
          />
        )}

        {/* Tool Executions - shown during execution */}
        {toolExecutions.length > 0 && (
          <ToolExecution
            executions={toolExecutions}
            onRetry={handleToolRetry}
          />
        )}

        {isLoading && (
          <div className="chat-message assistant loading">
            <div className="message-avatar">
              <img src={logoImage} alt="Assistant" width="18" height="18" />
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        {/* Abort Message */}
        {abortMessage && (
          <div className="chat-message system abort-message">
            <div className="message-content">
              <p>{abortMessage}</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="chat-input-container" role="form" aria-label="Message input">
        <div className="chat-input-wrapper">
          <span className="chat-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z"/>
            </svg>
          </span>
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a command to the agent..."
            rows={1}
            disabled={isLoading}
            aria-label="Type your message"
            aria-describedby="chat-input-hint"
          />
          <span id="chat-input-hint" className="sr-only">Press Enter to send, Shift+Enter for new line</span>
          {isExecuting ? (
            <button
              className="chat-send-btn chat-abort-btn"
              onClick={handleAbort}
              title="Stop (Esc)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h12v12H6z"/>
              </svg>
            </button>
          ) : (
            <button
              className="chat-send-btn"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              title="Send (Enter)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/>
              </svg>
            </button>
          )}
        </div>
        <div className="chat-input-hints">
          <span className="chat-input-hint">Enter to submit, Shift+Enter for newline</span>
          <button
            className={`permission-toggle ${allowAllPermissions ? 'on' : 'off'}`}
            onClick={() => onAllowAllPermissionsChange?.(!allowAllPermissions)}
            title={allowAllPermissions ? 'Auto Mode (all permissions granted)' : 'Supervised Mode (ask for approval)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              {allowAllPermissions ? (
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              ) : (
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              )}
            </svg>
            <span>{allowAllPermissions ? 'Auto' : 'Supervised'}</span>
          </button>
        </div>
      </div>
    </div>
  );
});

ChatPanel.displayName = 'ChatPanel';

export default ChatPanel;
