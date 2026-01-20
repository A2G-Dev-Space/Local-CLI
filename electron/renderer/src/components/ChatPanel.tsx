/**
 * Chat Panel Component
 * AI Assistant chat interface with toolbar and markdown rendering
 * Integrated with session management
 * Includes TODO list, user questions, progress messages, and tool execution visualization
 */

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import type {
  Session,
  ChatMessage,
  AgentConfig,
  AskUserResponse,
} from '../../../preload/index';

// Exposed methods via ref
export interface ChatPanelRef {
  clear: () => Promise<void>;
  compact: () => Promise<void>;
}
import TodoList, { TodoItem } from './TodoList';
import UserQuestion, { UserQuestionData } from './UserQuestion';
import ProgressMessage, { ProgressMessageData } from './ProgressMessage';
import ToolExecution, { ToolExecutionData, ToolCategory } from './ToolExecution';
import './ChatPanel.css';

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
import './TodoList.css';
import './UserQuestion.css';
import './ProgressMessage.css';
import './ToolExecution.css';

interface ChatPanelProps {
  session?: Session | null;
  onSessionChange?: (session: Session | null) => void;
  onClearSession?: () => void;
  currentDirectory?: string;
}

// Simple markdown parser
const parseMarkdown = (text: string): React.ReactNode[] => {
  const elements: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;

      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }

      elements.push(
        <CodeBlock
          key={`code-${i}`}
          code={codeLines.join('\n')}
          language={language}
        />
      );
      i++;
      continue;
    }

    // Inline code
    if (line.includes('`')) {
      const parts = line.split(/(`[^`]+`)/g);
      const inlineElements = parts.map((part, idx) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={idx} className="inline-code">
              {part.slice(1, -1)}
            </code>
          );
        }
        return parseInlineMarkdown(part, idx);
      });

      elements.push(<p key={`line-${i}`}>{inlineElements}</p>);
      i++;
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(<h1 key={`h1-${i}`}>{line.slice(2)}</h1>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={`h2-${i}`}>{line.slice(3)}</h2>);
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={`h3-${i}`}>{line.slice(4)}</h3>);
      i++;
      continue;
    }

    // Unordered list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        listItems.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`}>
          {listItems.map((item, idx) => (
            <li key={idx}>{parseInlineMarkdown(item, idx)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`}>
          {listItems.map((item, idx) => (
            <li key={idx}>{parseInlineMarkdown(item, idx)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote key={`quote-${i}`}>
          {quoteLines.map((l, idx) => (
            <p key={idx}>{parseInlineMarkdown(l, idx)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Horizontal rule
    if (line === '---' || line === '***') {
      elements.push(<hr key={`hr-${i}`} />);
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(<p key={`p-${i}`}>{parseInlineMarkdown(line, i)}</p>);
    i++;
  }

  return elements;
};

// Sanitize URL to prevent javascript: and data: attacks
const sanitizeUrl = (url: string): string => {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
    return '#';
  }
  // Only allow http, https, mailto, and relative URLs
  if (!/^(https?:\/\/|mailto:|\/|#)/.test(trimmed) && trimmed.includes(':')) {
    return '#';
  }
  return url;
};

// Parse inline markdown (bold, italic, links) - XSS-safe implementation
const parseInlineMarkdown = (text: string, key: number): React.ReactNode => {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let partIndex = 0;

  // Pattern for bold, italic, and links
  const patterns = [
    { regex: /\*\*(.+?)\*\*/, render: (match: string, content: string) => <strong key={`b-${partIndex++}`}>{content}</strong> },
    { regex: /\*(.+?)\*/, render: (match: string, content: string) => <em key={`i-${partIndex++}`}>{content}</em> },
    { regex: /\[(.+?)\]\((.+?)\)/, render: (match: string, linkText: string, url: string) => (
      <a key={`a-${partIndex++}`} href={sanitizeUrl(url)} target="_blank" rel="noopener noreferrer">{linkText}</a>
    )},
  ];

  while (remaining.length > 0) {
    let earliestMatch: { index: number; match: RegExpMatchArray; pattern: typeof patterns[0] } | null = null;

    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex);
      if (match && match.index !== undefined) {
        if (!earliestMatch || match.index < earliestMatch.index) {
          earliestMatch = { index: match.index, match, pattern };
        }
      }
    }

    if (earliestMatch) {
      // Add text before the match
      if (earliestMatch.index > 0) {
        elements.push(remaining.slice(0, earliestMatch.index));
      }

      // Add the formatted element
      const { match, pattern } = earliestMatch;
      if (match.length === 3) {
        // Link pattern
        elements.push(pattern.render(match[0], match[1], match[2]));
      } else {
        // Bold or italic
        elements.push(pattern.render(match[0], match[1], ''));
      }

      remaining = remaining.slice(earliestMatch.index + match[0].length);
    } else {
      // No more matches, add remaining text
      elements.push(remaining);
      break;
    }
  }

  if (elements.length === 0) {
    return text;
  }

  if (elements.length === 1 && typeof elements[0] === 'string') {
    return text;
  }

  return <span key={key}>{elements}</span>;
};

// Code Block Component
interface CodeBlockProps {
  code: string;
  language: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-language">{language || 'plaintext'}</span>
        <button className="code-copy-btn" onClick={handleCopy}>
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="code-content">
        <code>{code}</code>
      </pre>
    </div>
  );
};

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
}, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Task execution state
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressMessages, setProgressMessages] = useState<ProgressMessageData[]>([]);
  const [toolExecutions, setToolExecutions] = useState<ToolExecutionData[]>([]);

  // User question dialog state
  const [currentQuestion, setCurrentQuestion] = useState<UserQuestionData | null>(null);
  const [isQuestionOpen, setIsQuestionOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load session messages when session changes
  useEffect(() => {
    if (session && session.messages.length > 0) {
      setMessages(session.messages);
    } else {
      setMessages([WELCOME_MESSAGE]);
    }
  }, [session?.id]);

  // Auto-scroll to bottom - triggers on any content change
  const scrollToBottom = useCallback(() => {
    // Use setTimeout to ensure DOM is fully updated before scrolling
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  // Auto-scroll when any content changes (using lengths for better change detection)
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, toolExecutions.length, progressMessages.length, todos.length, isLoading, isExecuting, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Save message to session
  const saveMessageToSession = useCallback(async (message: ChatMessage) => {
    if (!window.electronAPI?.session) return;

    try {
      // Add message to current session
      await window.electronAPI.session.addMessage(message);
    } catch (error) {
      console.error('Failed to save message to session:', error);
    }
  }, []);

  // Pending question resolver for agent ask_to_user (reserved for future IPC response)
  const _questionResolverRef = useRef<((response: AskUserResponse) => void) | null>(null);
  void _questionResolverRef; // Reserved for future use

  // Setup agent event listeners
  useEffect(() => {
    if (!window.electronAPI?.agent) return;

    const unsubscribes: Array<() => void> = [];

    // Tool call event - show tool being executed
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
        setToolExecutions(prev => [...prev, newExecution]);
      })
    );

    // Tool result event - update tool execution status
    unsubscribes.push(
      window.electronAPI.agent.onToolResult((data) => {
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
        // Convert agent todos to UI todos
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

    // Ask user event - show question dialog
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
  }, [saveMessageToSession]);

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
    setInput('');
    setIsLoading(true);
    setIsExecuting(true);

    // Clear previous execution state
    setToolExecutions([]);
    setProgressMessages([]);

    // Save user message
    await saveMessageToSession(userMessage);

    // Check if agent API is available
    if (!window.electronAPI?.agent) {
      // Fallback: simulate response if API not available
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
    };

    try {
      // Run agent - events will be received via listeners
      const result = await window.electronAPI.agent.run(
        userMessage.content,
        conversationMessages,
        agentConfig
      );

      // Result is also handled by onComplete/onError listeners
      // But we can handle additional logic here if needed
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
  }, [input, isLoading, messages, saveMessageToSession, currentDirectory]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Handle user question answer
  const handleQuestionAnswer = useCallback(async (questionId: string, answer: string) => {
    console.log('Question answered:', questionId, answer);
    setIsQuestionOpen(false);
    setCurrentQuestion(null);

    // Add answer as a system message
    const answerMessage: ChatMessage = {
      id: `answer-${Date.now()}`,
      role: 'system',
      content: `You answered: **${answer}**`,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, answerMessage]);

    // Send response to agent
    if (window.electronAPI?.agent) {
      const response: AskUserResponse = {
        selectedOption: { label: answer, value: answer },
        isOther: false,
      };
      await window.electronAPI.agent.respondToQuestion(response);
    }
  }, []);

  // Handle user question cancel
  const handleQuestionCancel = useCallback(async () => {
    setIsQuestionOpen(false);
    setCurrentQuestion(null);

    // Send cancel response to agent
    if (window.electronAPI?.agent) {
      const response: AskUserResponse = {
        selectedOption: { label: 'Cancel', value: 'cancel' },
        isOther: true,
        customText: 'User cancelled',
      };
      await window.electronAPI.agent.respondToQuestion(response);
    }
  }, []);

  // Abort message state (shown at the very bottom)
  const [abortMessage, setAbortMessage] = useState<string | null>(null);

  // Abort agent execution
  const handleAbort = useCallback(async () => {
    if (window.electronAPI?.agent) {
      await window.electronAPI.agent.abort();
      setIsLoading(false);
      setIsExecuting(false);
      setAbortMessage('Agent execution aborted.');

      // Auto-clear abort message after 5 seconds
      setTimeout(() => setAbortMessage(null), 5000);
    }
  }, []);

  // Dismiss progress message
  const dismissProgressMessage = useCallback((id: string) => {
    setProgressMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  // Retry failed tool execution
  const handleToolRetry = useCallback((id: string) => {
    console.log('Retrying tool:', id);
    // In a real implementation, this would trigger re-execution
  }, []);

  // Compact conversation
  const [isCompacting, setIsCompacting] = useState(false);

  const handleCompact = useCallback(async () => {
    if (!window.electronAPI?.compact || isCompacting || isLoading) return;

    // Check if compact is possible
    const checkResult = await window.electronAPI.compact.canCompact(
      messages.map(m => ({ role: m.role, content: m.content }))
    );

    if (!checkResult.canCompact) {
      // Show error message
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
        // Replace messages with compacted version
        const newMessages: ChatMessage[] = result.compactedMessages.map((m, idx) => ({
          id: `compacted-${Date.now()}-${idx}`,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: Date.now(),
        }));

        // Add a system message indicating compression
        newMessages.push({
          id: `compact-info-${Date.now()}`,
          role: 'system',
          content: `Conversation compacted: ${result.originalMessageCount} messages → ${result.newMessageCount} messages`,
          timestamp: Date.now(),
        });

        setMessages(newMessages);

        // Update session if available
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
        // Show error
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
    // Abort agent if running
    if (isExecuting && window.electronAPI?.agent) {
      await window.electronAPI.agent.abort();
    }

    setMessages([
      {
        id: 'cleared',
        role: 'system',
        content: 'Chat cleared. How can I help you?',
        timestamp: Date.now(),
      },
    ]);

    // Clear execution state
    setTodos([]);
    setProgressMessages([]);
    setToolExecutions([]);
    setIsExecuting(false);
    setIsLoading(false);

    // Clear current session messages
    if (session && onSessionChange) {
      const clearedSession: Session = {
        ...session,
        messages: [],
        updatedAt: Date.now(),
      };
      onSessionChange(clearedSession);

      // Save cleared session
      if (window.electronAPI?.session) {
        await window.electronAPI.session.save(clearedSession);
      }
    }

    onClearSession?.();
  }, [session, onSessionChange, onClearSession, isExecuting]);

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
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-message ${message.role}`}
          >
            {message.role === 'assistant' && (
              <div className="message-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM7.5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S9.83 13 9 13s-1.5-.67-1.5-1.5zM16 17H8v-2h8v2zm-1-4c-.83 0-1.5-.67-1.5-1.5S14.17 10 15 10s1.5.67 1.5 1.5S15.83 13 15 13z"/>
                </svg>
              </div>
            )}
            <div className="message-content">
              {message.role === 'assistant' || message.role === 'system'
                ? parseMarkdown(message.content)
                : <p>{message.content}</p>
              }
            </div>
          </div>
        ))}

        {/* TODO List - shown during execution */}
        {todos.length > 0 && (
          <TodoList
            todos={todos}
            isExecuting={isExecuting}
          />
        )}

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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM7.5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S9.83 13 9 13s-1.5-.67-1.5-1.5zM16 17H8v-2h8v2zm-1-4c-.83 0-1.5-.67-1.5-1.5S14.17 10 15 10s1.5.67 1.5 1.5S15.83 13 15 13z"/>
              </svg>
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

        {/* Abort Message - always at the very bottom */}
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
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything... (Enter to send, Shift+Enter for new line)"
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});

ChatPanel.displayName = 'ChatPanel';

export default ChatPanel;
