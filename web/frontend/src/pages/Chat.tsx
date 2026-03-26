import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Square,
  PanelLeftClose,
  PanelLeftOpen,
  Wifi,
  WifiOff,
  Loader2,
  Paperclip,
  ChevronRight,
  Timer,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useSessionStore } from '@/stores/session.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useAuthStore } from '@/stores/auth.store';
import ChatMessage from '@/components/ChatMessage';
import TodoPanel, { type TodoItem } from '@/components/TodoPanel';

/* ------------------------------------------------------------------ */
/*  Progress Ring SVG                                                  */
/* ------------------------------------------------------------------ */
function ProgressRing({ progress, size = 36, stroke = 3 }: { progress: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--bg-tertiary)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="progress-ring-circle"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text-secondary)"
        fontSize={size * 0.28}
        fontWeight={600}
      >
        {Math.round(progress)}%
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Duration Timer                                                     */
/* ------------------------------------------------------------------ */
function DurationTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  return (
    <span className="flex items-center gap-1 text-xs text-[var(--accent)] tabular-nums">
      <Timer size={12} />
      {min}:{sec.toString().padStart(2, '0')}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Chat Component                                                */
/* ------------------------------------------------------------------ */
export default function Chat() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const { currentSession, getSession } = useSessionStore();
  const {
    events,
    isConnected,
    isReconnecting,
    reconnectFailed,
    connect,
    disconnect,
    sendMessage,
    sendInterrupt,
    manualReconnect,
  } = useWebSocketStore();

  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [execStartTime, setExecStartTime] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Responsive: detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Connect to session
  useEffect(() => {
    if (sessionId && token) {
      getSession(sessionId);
      connect(sessionId, token);
    }
    return () => {
      disconnect();
    };
  }, [sessionId, token, getSession, connect, disconnect]);

  // Process events for todos and execution state
  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];

    if (latest.type === 'todo:update') {
      const p = latest.payload;
      if (p.todos) setTodos(p.todos as TodoItem[]);
    }

    if (latest.type === 'planning:start') {
      setIsExecuting(true);
      setExecStartTime(Date.now());
    }

    if (latest.type === 'llm:token') {
      setStreamingText((prev) => prev + (latest.payload.content as string));
    }

    if (latest.type === 'session:complete' || latest.type === 'execution:complete') {
      setStreamingText('');
      setIsExecuting(false);
      setExecStartTime(null);
    }

    if (latest.type === 'error') {
      setIsExecuting(false);
      setExecStartTime(null);
    }
  }, [events]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events, streamingText]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !isConnected) return;
    sendMessage(trimmed);
    setInput('');
    setIsExecuting(true);
    setExecStartTime(Date.now());
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, isConnected, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter = new line (default textarea behavior)
  };

  const handleStop = () => {
    sendInterrupt();
    setIsExecuting(false);
    setExecStartTime(null);
  };

  // Filter displayable events
  const displayEvents = events.filter(
    (e) => e.type !== 'llm:token' && e.type !== 'todo:update' && e.type !== 'llm:reasoning',
  );

  // TODO progress
  const todoProgress = useMemo(() => {
    if (todos.length === 0) return 0;
    const done = todos.filter((t) => t.status === 'completed' || t.status === 'failed').length;
    return (done / todos.length) * 100;
  }, [todos]);

  const statusBadge = () => {
    if (!currentSession) return null;
    const status = currentSession.status;
    const colors: Record<string, string> = {
      RUNNING: 'bg-green-500/15 text-green-400 border-green-500/30',
      STOPPED: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      CREATING: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      DELETED: 'bg-red-500/15 text-red-400 border-red-500/30',
    };
    return (
      <span className={clsx('badge border', colors[status])}>
        {status === 'RUNNING' && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse-soft" />
        )}
        {t(`session.status.${status?.toLowerCase()}`)}
      </span>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Sidebar content (reused in desktop sidebar & mobile drawer)      */
  /* ---------------------------------------------------------------- */
  const sidebarContent = (
    <div className="w-full h-full flex flex-col">
      {/* Session info */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {currentSession?.name || 'Session'}
          </h2>
          <div className="flex items-center gap-2">
            {statusBadge()}
            {isMobile && (
              <button onClick={() => setMobileDrawer(false)} className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]">
                <X size={16} className="text-[var(--text-secondary)]" />
              </button>
            )}
          </div>
        </div>
        {currentSession?.agentName && (
          <p className="text-xs text-[var(--text-secondary)]">{currentSession.agentName}</p>
        )}
      </div>

      {/* Connection status */}
      <div className="px-4 py-2.5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs text-[var(--success)]">{t('chat.connected')}</span>
            </>
          ) : isReconnecting ? (
            <>
              <Loader2 size={14} className="text-[var(--warning)] animate-spin" />
              <span className="text-xs text-[var(--warning)]">{t('chat.reconnecting')}</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-[var(--error)]" />
              <span className="text-xs text-[var(--error)]">
                {reconnectFailed ? t('chat.connectionLost', 'Connection lost') : t('chat.disconnected')}
              </span>
              {reconnectFailed && (
                <button onClick={manualReconnect} className="text-xs text-[var(--accent)] hover:underline ml-2">
                  {t('chat.reconnect', 'Reconnect')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* TODO panel with progress ring */}
      <div className="flex-1 overflow-y-auto p-4">
        {todos.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <ProgressRing progress={todoProgress} />
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                {todos.filter((t) => t.status === 'completed').length}/{todos.length} completed
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {todos.filter((t) => t.status === 'in_progress').length} in progress
              </p>
            </div>
          </div>
        )}
        <TodoPanel todos={todos} />
      </div>
    </div>
  );

  return (
    <div className="h-full flex relative">
      {/* Execution progress bar — thin line at very top */}
      {isExecuting && (
        <div className="absolute top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-[var(--bg-tertiary)]">
          <motion.div
            className="h-full bg-gradient-to-r from-[var(--accent)] via-purple-500 to-[var(--accent)] animate-gradient-shift"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 30, ease: 'linear' }}
          />
        </div>
      )}

      {/* Desktop sidebar */}
      {!isMobile && (
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r border-[var(--border)] bg-[var(--bg-secondary)] flex-shrink-0 overflow-hidden"
            >
              <div className="w-[320px] h-full">{sidebarContent}</div>
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <AnimatePresence>
          {mobileDrawer && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="drawer-overlay fixed inset-0 z-40"
                onClick={() => setMobileDrawer(false)}
              />
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed left-0 top-0 bottom-0 w-[300px] bg-[var(--bg-secondary)] border-r border-[var(--border)] z-50 shadow-2xl"
              >
                {sidebarContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-[var(--border)] flex items-center px-4 bg-[var(--bg-secondary)] flex-shrink-0">
          <button
            onClick={() => (isMobile ? setMobileDrawer(!mobileDrawer) : setSidebarOpen(!sidebarOpen))}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] mr-3"
          >
            {sidebarOpen && !isMobile ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mr-auto min-w-0">
            <span className="hidden sm:inline">{t('nav.sessions', 'Sessions')}</span>
            <ChevronRight size={12} className="hidden sm:inline flex-shrink-0" />
            <span className="text-[var(--text-primary)] font-medium truncate">
              {currentSession?.name || 'Session'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isExecuting && execStartTime && <DurationTimer startTime={execStartTime} />}
            {isExecuting && (
              <div className="flex items-center gap-1.5">
                <Loader2 size={14} className="text-[var(--accent)] animate-spin" />
                <span className="text-xs text-[var(--accent)] hidden sm:inline">{t('chat.executing')}</span>
              </div>
            )}
            {isConnected ? (
              <Wifi size={14} className="text-[var(--success)]" />
            ) : (
              <WifiOff size={14} className="text-[var(--error)]" />
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-6">
          {displayEvents.length === 0 && !isExecuting && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-5">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-purple-600 opacity-20 animate-float" />
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent)]/15 to-purple-500/15 flex items-center justify-center backdrop-blur-sm border border-[var(--accent)]/20">
                    <span className="text-3xl font-bold bg-gradient-to-br from-[var(--accent)] to-purple-400 bg-clip-text text-transparent">
                      H
                    </span>
                  </div>
                </div>
                <p className="text-[var(--text-secondary)] text-sm mb-1">{t('chat.placeholder')}</p>
                <p className="text-[var(--text-secondary)]/50 text-xs">Enter to send, Shift+Enter for new line</p>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto space-y-2">
            {displayEvents.map((event, i) => (
              <motion.div
                key={`${event._seq || i}-${event.type}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2) }}
              >
                <ChatMessage
                  event={event}
                  onAskUserResponse={(_question, option) => {
                    const ws = useWebSocketStore.getState().ws;
                    if (ws) {
                      ws.send({
                        id: crypto.randomUUID(),
                        type: 'ask_user_response',
                        payload: { selectedOption: option, isOther: false },
                      });
                    }
                  }}
                />
              </motion.div>
            ))}

            {/* Streaming text with cursor */}
            {streamingText && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start mb-4"
              >
                <div className="flex items-start gap-3 max-w-[85%] sm:max-w-[80%]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)]/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 ring-1 ring-[var(--accent)]/20">
                    <Loader2 size={16} className="text-[var(--accent)] animate-spin" />
                  </div>
                  <div className="bg-[var(--bg-secondary)] border border-[var(--border)] px-4 py-3 rounded-2xl rounded-tl-md shadow-lg shadow-[var(--shadow)]">
                    <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                      {streamingText}
                      <span className="inline-block w-0.5 h-4 bg-[var(--accent)] ml-0.5 align-middle animate-cursor-blink" />
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] p-3 sm:p-4">
          <div className="max-w-4xl mx-auto">
            <div className="chat-input-wrapper">
              <div className="chat-input-inner flex items-end gap-2 p-2 sm:p-3">
                {/* Attachment placeholder */}
                <button
                  className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex-shrink-0 opacity-50 cursor-default"
                  title="File attachments coming soon"
                  disabled
                >
                  <Paperclip size={18} />
                </button>

                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={t('chat.placeholder')}
                    disabled={!isConnected}
                    rows={1}
                    className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none outline-none text-sm min-h-[36px] max-h-[200px] py-1.5 px-1 transition-[height] duration-150"
                  />
                </div>

                {/* Character count */}
                {input.length > 0 && (
                  <span className="text-[10px] text-[var(--text-secondary)]/60 tabular-nums self-end pb-1.5 flex-shrink-0">
                    {input.length}
                  </span>
                )}

                {isExecuting ? (
                  <button
                    onClick={handleStop}
                    className="btn-danger flex items-center gap-1.5 py-2 px-3 text-sm flex-shrink-0 rounded-xl"
                  >
                    <Square size={14} />
                    <span className="hidden sm:inline">{t('chat.stop')}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || !isConnected}
                    className={clsx(
                      'flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 flex-shrink-0',
                      input.trim() && isConnected
                        ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-md shadow-[var(--accent)]/20'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed opacity-50',
                    )}
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Hint */}
            <p className="text-[10px] text-[var(--text-secondary)]/40 mt-1.5 text-center">
              <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)]/50 text-[9px]">Enter</kbd>
              {' 전송 · '}
              <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)]/50 text-[9px]">Shift+Enter</kbd>
              {' 줄바꿈'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
