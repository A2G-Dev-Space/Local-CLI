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

// Import i18n
import { useTranslation } from '../i18n/LanguageContext';

// Exposed methods via ref
export interface ChatPanelRef {
  clear: () => Promise<void>;
  compact: () => Promise<void>;
}

import TodoList from './TodoList';
import UserQuestion from './UserQuestion';
import ProgressMessage from './ProgressMessage';
import ToolExecution, { ToolExecutionData } from './ToolExecution';
import ApprovalModal from './ApprovalModal';
import './ChatPanel.css';

// Timeline item for interleaved rendering
type TimelineItem =
  | { type: 'message'; data: ChatMessage; timestamp: number }
  | { type: 'tools'; data: ToolExecutionData[]; timestamp: number };

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
  onChangeDirectory?: () => void;
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

function formatMessageTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

const MessageItem = memo<MessageItemProps>(({ message, isBatchLoad }) => {
  const [copied, setCopied] = React.useState(false);
  const { t } = useTranslation();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      window.electronAPI?.log?.error('[MessageItem] Failed to copy', { error: err instanceof Error ? err.message : String(err) });
    }
  };

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
        {/* Copy button for all message types */}
        <button
          className={`message-copy-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          title={copied ? t('chat.copied') : t('chat.copyMessage')}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          )}
        </button>
      </div>
      {message.role !== 'system' && message.id !== 'welcome' && (
        <div className="message-timestamp">{formatMessageTime(message.timestamp)}</div>
      )}
    </div>
  );
});
MessageItem.displayName = 'MessageItem';

// Default welcome message (will be replaced by translated version inside component)
const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '', // Filled by useEffect with t('chat.welcome')
  timestamp: Date.now(),
};

const ChatPanel = forwardRef<ChatPanelRef, ChatPanelProps>(({
  session,
  onSessionChange,
  onClearSession,
  currentDirectory,
  onChangeDirectory,
  allowAllPermissions = true,
  onAllowAllPermissionsChange,
}, ref) => {
  const { t, language } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([{ ...DEFAULT_WELCOME_MESSAGE, content: '' }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Track if we're doing a batch load (for animation disabling)
  const [isBatchLoad, setIsBatchLoad] = useState(true);

  // Update welcome message when language changes
  useEffect(() => {
    setMessages(prev => {
      const hasWelcome = prev.some(m => m.id === 'welcome');
      if (!hasWelcome) return prev;
      return prev.map(msg =>
        msg.id === 'welcome' ? { ...msg, content: t('chat.welcome') } : msg
      );
    });
  }, [language, t]);

  // Message windowing for performance (only render recent messages)
  const MAX_VISIBLE_MESSAGES = 50;
  const [showAllMessages, setShowAllMessages] = useState(false);

  // Compute visible messages for rendering
  // Filter out tool messages and tool-call-only assistant messages for UI rendering
  // These are shown as ToolExecution cards, not as chat bubbles
  const renderableMessages = useMemo(() => {
    return messages.filter(m => {
      if (m.role === 'tool') return false;
      // Hide assistant messages that only have tool_calls but no visible content
      if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0 && !m.content?.trim()) return false;
      return true;
    });
  }, [messages]);

  const visibleMessages = useMemo(() => {
    if (showAllMessages || renderableMessages.length <= MAX_VISIBLE_MESSAGES) {
      return renderableMessages;
    }
    return renderableMessages.slice(-MAX_VISIBLE_MESSAGES);
  }, [renderableMessages, showAllMessages]);

  const hasHiddenMessages = renderableMessages.length > MAX_VISIBLE_MESSAGES && !showAllMessages;
  const hiddenMessageCount = hasHiddenMessages ? renderableMessages.length - MAX_VISIBLE_MESSAGES : 0;

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

  // Create unified timeline of messages and tool executions sorted by timestamp
  // Tool executions are split into groups between messages so they appear in the correct position
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    // Add messages to timeline
    visibleMessages.forEach(msg => {
      items.push({
        type: 'message',
        data: msg,
        timestamp: msg.timestamp,
      });
    });

    // Split tool executions into groups separated by user messages
    // Tools between message A and message B should appear between them in the timeline
    if (toolExecutions.length > 0) {
      const messageTimes = visibleMessages.map(m => m.timestamp).sort((a, b) => a - b);

      let currentGroup: ToolExecutionData[] = [];
      for (let i = 0; i < toolExecutions.length; i++) {
        const tool = toolExecutions[i];
        const prevTool = i > 0 ? toolExecutions[i - 1] : null;

        // Check if a message was sent between this tool and the previous one
        const hasMessageBetween = prevTool &&
          messageTimes.some(t => t > prevTool.timestamp && t <= tool.timestamp);

        if (hasMessageBetween && currentGroup.length > 0) {
          // Flush current group and start a new one
          items.push({
            type: 'tools',
            data: currentGroup,
            timestamp: currentGroup[0].timestamp,
          });
          currentGroup = [tool];
        } else {
          currentGroup.push(tool);
        }
      }

      // Flush remaining group
      if (currentGroup.length > 0) {
        items.push({
          type: 'tools',
          data: currentGroup,
          timestamp: currentGroup[0].timestamp,
        });
      }
    }

    // Sort by timestamp
    items.sort((a, b) => a.timestamp - b.timestamp);

    return items;
  }, [visibleMessages, toolExecutions]);

  // Input history state
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track if we're programmatically updating messages (sending or clearing)
  // This prevents session change effect from overwriting our messages
  const skipSessionLoadRef = useRef(false);

  // Refs for session/onSessionChange to avoid stale closures in async callbacks
  // sendMessage is async and agent.run() can take a long time - session may change during execution
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const onSessionChangeRef = useRef(onSessionChange);
  onSessionChangeRef.current = onSessionChange;

  // Load session messages when session changes
  // Skip if we're programmatically updating messages
  useEffect(() => {
    // Don't reset messages during send/clear operations
    if (skipSessionLoadRef.current) {
      window.electronAPI?.log?.debug?.('[ChatPanel] Session load SKIPPED (skipSessionLoadRef=true)', {
        sessionId: session?.id,
        sessionMsgCount: session?.messages?.length ?? 0,
      });
      return;
    }
    window.electronAPI?.log?.info?.('[ChatPanel] Session load effect RUNNING', {
      sessionId: session?.id,
      sessionMsgCount: session?.messages?.length ?? 0,
      currentMsgCount: messages.length,
      firstMsgId: messages[0]?.id,
    });

    setIsBatchLoad(true); // Disable animation for batch load
    if (session && session.messages.length > 0) {
      window.electronAPI?.log?.debug?.('[ChatPanel] Restoring session messages', { count: session.messages.length });
      setMessages(session.messages);
    } else {
      // New or empty session: reset to welcome
      setMessages([{ ...DEFAULT_WELCOME_MESSAGE, content: t('chat.welcome') }]);
    }
    // Reset windowing state when session changes
    setShowAllMessages(false);

    // Re-enable animation after batch load completes
    const timer = setTimeout(() => setIsBatchLoad(false), 100);
    return () => clearTimeout(timer);
  }, [session?.id]);

  // Setup agent listeners once
  useEffect(() => {
    window.electronAPI?.log?.debug?.('[ChatPanel] Setting up agent listeners');
    const cleanup = setupAgentListeners();
    return cleanup;
  }, [setupAgentListeners]);

  // Save message to session (defined early for use in other hooks)
  const saveMessageToSession = useCallback(async (message: ChatMessage) => {
    if (!window.electronAPI?.session) return;

    try {
      await window.electronAPI.session.addMessage(message);
    } catch (error) {
      window.electronAPI?.log?.error('[ChatPanel] Failed to save message to session', { error: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  // Setup final response callback - displays as chat message with markdown
  useEffect(() => {
    setOnFinalResponse((message: string) => {
      window.electronAPI?.log?.info?.('[ChatPanel] Final response received', { length: message.length });
      // Normalize escaped characters (LLM sometimes sends literal \n instead of newlines)
      const normalizedMessage = message
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');

      const assistantMessage: ChatMessage = {
        id: `final-${Date.now()}`,
        role: 'assistant',
        content: normalizedMessage,
        timestamp: Date.now(),
      };
      setMessages(prev => {
        window.electronAPI?.log?.debug?.('[ChatPanel] Adding final response to messages', { prevCount: prev.length });
        return [...prev, assistantMessage];
      });
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
        window.electronAPI?.log?.info?.('[ChatPanel] Agent complete', { hasResponse: !!data.response, responseLength: data.response?.length ?? 0 });
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
        window.electronAPI?.log?.error?.('[ChatPanel] Agent error event', { error: data.error });
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

    // Tell user event - now handled in AgentContext as tool execution
    // for unified UI design with other tools

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [setIsExecuting, saveMessageToSession]);

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

    window.electronAPI?.log?.info?.('[ChatPanel] sendMessage START', {
      inputLength: input.trim().length,
      sessionId: sessionRef.current?.id,
      hasSession: !!sessionRef.current,
      currentMsgCount: messages.length,
    });

    // Mark to skip session load effect (prevents user message from disappearing)
    skipSessionLoadRef.current = true;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => {
      window.electronAPI?.log?.debug?.('[ChatPanel] Adding user message', { prevCount: prev.length, msgId: userMessage.id });
      return [...prev, userMessage];
    });

    // Save to input history
    setInputHistory(prev => {
      const filtered = prev.filter(h => h !== input.trim());
      return [...filtered, input.trim()].slice(-50);
    });
    setHistoryIndex(-1);

    setInput('');
    setIsLoading(true);
    setIsExecuting(true);

    // Clear progress messages but keep tool executions visible
    // Tool executions are cleared only on explicit "Clear Chat", not between messages
    clearProgressMessages();

    // Auto-create session if none exists
    if (!sessionRef.current && window.electronAPI?.session) {
      window.electronAPI?.log?.info?.('[ChatPanel] Auto-creating session (no session exists)');
      try {
        const result = await window.electronAPI.session.create('New Chat', currentDirectory);
        if (result.success && result.session && onSessionChangeRef.current) {
          window.electronAPI?.log?.info?.('[ChatPanel] Session auto-created', { newSessionId: result.session.id });
          onSessionChangeRef.current(result.session);
        }
      } catch (error) {
        window.electronAPI?.log?.error('[ChatPanel] Failed to create session', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Save user message to session backend
    // Keep skipSessionLoadRef=true until agent.run() completes to prevent
    // session load effect from overwriting messages (auto-created session has empty messages)
    await saveMessageToSession(userMessage);

    // Check if agent API is available
    if (!window.electronAPI?.agent) {
      window.electronAPI?.log?.warn('[ChatPanel] electronAPI.agent not available, using fallback');
      skipSessionLoadRef.current = false;
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
    // Use session.messages (full history with tool_calls) if available,
    // otherwise fall back to UI messages (user/assistant text only)
    const sessionMessages = sessionRef.current?.messages;
    const conversationMessages = (sessionMessages && sessionMessages.length > 0)
      ? sessionMessages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role as 'user' | 'assistant' | 'tool',
            content: m.content || '',
            ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
            ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
          }))
      : messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Agent config
    // CLI parity: no iteration limit - runs until LLM stops calling tools
    const agentConfig: AgentConfig = {
      workingDirectory: currentDirectory,
      autoMode: allowAllPermissions,
    };

    try {
      window.electronAPI?.log?.info?.('[ChatPanel] agent.run() START', {
        conversationMsgCount: conversationMessages.length,
        autoMode: agentConfig.autoMode,
      });
      const result = await window.electronAPI.agent.run(
        userMessage.content,
        conversationMessages,
        agentConfig
      );
      window.electronAPI?.log?.info?.('[ChatPanel] agent.run() DONE', {
        success: result.success,
        resultMsgCount: result.messages?.length ?? 0,
        error: result.error,
      });

      // Save all messages (including tool messages) to session for proper compact support
      // result.messages includes: user, assistant (with tool_calls), tool responses
      // Works for both success AND abort - agent returns accumulated messages in both cases
      // Use refs to avoid stale closure (agent.run can take a long time)
      const currentSession = sessionRef.current;
      const currentOnSessionChange = onSessionChangeRef.current;
      if (result.messages && result.messages.length > 0 && currentSession && currentOnSessionChange) {
        const updatedMessages: ChatMessage[] = result.messages.map((m, idx) => ({
          id: `msg-${Date.now()}-${idx}`,
          role: m.role as 'user' | 'assistant' | 'system' | 'tool',
          content: m.content || '',
          tool_calls: (m as any).tool_calls,
          tool_call_id: (m as any).tool_call_id,
          timestamp: Date.now(),
        }));

        const updatedSession: Session = {
          ...currentSession,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };

        // Save to backend AND update React state so compact can access them
        if (window.electronAPI?.session) {
          await window.electronAPI.session.save(updatedSession);
        }
        // Update session prop so compact handler can read session.messages
        currentOnSessionChange(updatedSession);
      }

      if (!result.success && result.error) {
        window.electronAPI?.log?.error('[ChatPanel] Agent error', { error: result.error });
      }
    } catch (error) {
      window.electronAPI?.log?.error('[ChatPanel] Agent error', { error: error instanceof Error ? error.message : String(error) });
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      setIsExecuting(false);
    } finally {
      // Allow session load effect to run again now that agent is done
      window.electronAPI?.log?.debug?.('[ChatPanel] sendMessage FINALLY - resetting skipSessionLoadRef');
      skipSessionLoadRef.current = false;
    }
  }, [input, isLoading, messages, saveMessageToSession, currentDirectory, allowAllPermissions, clearProgressMessages, setIsExecuting]);

  // Abort message state
  const [abortMessage, setAbortMessage] = useState<string | null>(null);

  // Abort agent execution
  const handleAbort = useCallback(async () => {
    window.electronAPI?.log?.info?.('[ChatPanel] handleAbort called', { isExecuting, isLoading });
    if (window.electronAPI?.agent) {
      await window.electronAPI.agent.abort();
      window.electronAPI?.log?.info?.('[ChatPanel] Agent aborted, clearing state');
      setIsLoading(false);
      setIsExecuting(false);
      clearTodos(); // Clear UI todos so next message triggers fresh planning
      setAbortMessage(t('chat.aborted'));

      setTimeout(() => setAbortMessage(null), 5000);
    }
  }, [setIsExecuting, clearTodos, isExecuting, isLoading, t]);

  // Handle keyboard events (arrow up/down history disabled for Electron)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      return;
    }

    // Arrow up/down history navigation disabled for Electron
    // Users can use normal text editing with arrow keys

    if (e.key === 'Escape' && isExecuting) {
      e.preventDefault();
      handleAbort();
    }
  }, [sendMessage, isExecuting, handleAbort]);

  // Retry failed tool execution
  const handleToolRetry = useCallback((id: string) => {
    window.electronAPI?.log?.debug('[ChatPanel] Retrying tool', { toolId: id });
  }, []);

  // Compact conversation
  const [isCompacting, setIsCompacting] = useState(false);

  const handleCompact = useCallback(async () => {
    if (!window.electronAPI?.compact || isCompacting || isLoading) return;

    window.electronAPI?.log?.info?.('[ChatPanel] handleCompact START', {
      uiMsgCount: messages.length,
      sessionMsgCount: session?.messages?.length ?? 0,
    });

    // Use session.messages which includes tool messages (not just UI messages)
    // This ensures tool call history is considered for compaction
    // Note: empty array is truthy, so use length check to fall back to UI messages
    const sessionMessages = (session?.messages && session.messages.length > 0) ? session.messages : messages;
    const messagesForCompact = sessionMessages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system' | 'tool',
      content: m.content,
      tool_calls: (m as any).tool_calls,
      tool_call_id: (m as any).tool_call_id,
    }));

    const checkResult = await window.electronAPI.compact.canCompact(messagesForCompact);

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
        messagesForCompact,
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
      window.electronAPI?.log?.error('[ChatPanel] Compact error', { error: error instanceof Error ? error.message : String(error) });
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
    window.electronAPI?.log?.info?.('[ChatPanel] handleClear called', { isExecuting, sessionId: session?.id, msgCount: messages.length });
    if (isExecuting && window.electronAPI?.agent) {
      window.electronAPI?.log?.info?.('[ChatPanel] Aborting agent before clear');
      await window.electronAPI.agent.abort();
    }

    // Skip session load effect to prevent overwriting our cleared message
    // Keep it true until all session changes settle (prevents flickering)
    skipSessionLoadRef.current = true;

    setIsBatchLoad(true);
    setMessages([
      {
        id: 'cleared',
        role: 'system',
        content: t('chat.chatCleared'),
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

    // DO NOT call onClearSession here - it creates a circular call loop:
    // BottomPanel click → onClearSession → App.handleClearSession → chatPanelRef.clear()
    // → handleClear → onClearSession() → handleClearSession → clear() → infinite loop
    // The parent already knows about the clear since it initiated it via ref.

    // Reset skipSessionLoadRef after a delay to allow session state changes to settle
    setTimeout(() => {
      skipSessionLoadRef.current = false;
    }, 500);
  }, [session, onSessionChange, isExecuting, clearTodos, clearProgressMessages, clearToolExecutions, setIsExecuting, t]);

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
      <div className="chat-directory-info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
        </svg>
        <span>{currentDirectory || t('chat.noDirectory')}</span>
        {currentDirectory && (
          <button
            className="directory-open-btn"
            onClick={() => window.electronAPI?.shell?.openPath(currentDirectory)}
            title={t('chat.openExplorer')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
            </svg>
          </button>
        )}
        <button
          className="directory-open-btn directory-change-btn"
          onClick={onChangeDirectory}
          title={t('chat.changeDir')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10zM12.5 10l-5 4.5 1.41 1.41L11.5 13.5V18h2v-4.5l2.59 2.41L17.5 14.5z"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages" role="log" aria-live="polite" aria-label="Chat messages">
        {/* Show earlier messages button */}
        {hasHiddenMessages && (
          <button
            className="show-earlier-btn"
            onClick={() => setShowAllMessages(true)}
            title={t('chat.showEarlier', { count: hiddenMessageCount })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
            </svg>
            {t('chat.showEarlier', { count: hiddenMessageCount })}
          </button>
        )}
        {/* Unified timeline: messages and tool executions interleaved by timestamp */}
        {timeline.map((item, idx) => {
          if (item.type === 'message') {
            return (
              <MessageItem
                key={item.data.id}
                message={item.data}
                isBatchLoad={isBatchLoad}
              />
            );
          } else {
            // Tool executions group
            return (
              <ToolExecution
                key={`tools-${idx}`}
                executions={item.data}
                onRetry={handleToolRetry}
              />
            );
          }
        })}

        {/* TODO List is now shown in the Editor area (TodoPanel) */}

        {/* Progress Messages - shown during execution */}
        {progressMessages.length > 0 && (
          <ProgressMessage
            messages={progressMessages}
            onDismiss={dismissProgressMessage}
          />
        )}

        {isCompacting && (
          <div className="chat-message system">
            <div className="message-content">
              <div className="typing-indicator" style={{ display: 'inline-flex', marginRight: '8px' }}>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>{t('chat.compacting')}</span>
            </div>
          </div>
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
            placeholder={t('chat.inputPlaceholder')}
            rows={1}
            disabled={isLoading}
            aria-label={t('chat.inputPlaceholder')}
            aria-describedby="chat-input-hint"
          />
          <span id="chat-input-hint" className="sr-only">{t('chat.inputHint')}</span>
          {isExecuting ? (
            <button
              className="chat-send-btn chat-abort-btn"
              onClick={handleAbort}
              title={t('chat.stop')}
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
              title={t('chat.send')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/>
              </svg>
            </button>
          )}
        </div>
        <div className="chat-input-hints">
          <span className="chat-input-hint">{t('chat.inputHint')}</span>
          <button
            className={`permission-toggle ${allowAllPermissions ? 'on' : 'off'}`}
            onClick={() => onAllowAllPermissionsChange?.(!allowAllPermissions)}
            title={allowAllPermissions ? t('chat.autoMode') : t('chat.supervisedMode')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              {allowAllPermissions ? (
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              ) : (
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              )}
            </svg>
            <span>{allowAllPermissions ? t('chat.auto') : t('chat.supervised')}</span>
          </button>
        </div>
      </div>
    </div>
  );
});

ChatPanel.displayName = 'ChatPanel';

export default ChatPanel;
