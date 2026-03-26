import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Bot, AlertCircle } from 'lucide-react';
import type { WSEvent } from '@/lib/websocket';
import ToolCard from './ToolCard';

interface ChatMessageProps {
  event: WSEvent;
  onAskUserResponse?: (question: string, selectedOption: string) => void;
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden my-2">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e2e] text-xs text-gray-400">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check size={12} />
              {t('chat.copied')}
            </>
          ) : (
            <>
              <Copy size={12} />
              {t('chat.copyCode')}
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.85rem' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

export default function ChatMessage({ event, onAskUserResponse }: ChatMessageProps) {
  const { t } = useTranslation();

  const p = event.payload || {};

  // Tell user (message from agent during execution)
  if (event.type === 'tell_user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-start mb-4"
      >
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0">
            <Bot size={16} className="text-[var(--accent)]" />
          </div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] px-4 py-3 rounded-2xl rounded-tl-md">
            <div className="text-sm leading-relaxed markdown-content">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');
                    if (match) {
                      return <CodeBlock language={match[1]}>{codeString}</CodeBlock>;
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {(p.message as string) || ''}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Session complete (final response from agent)
  if (event.type === 'session:complete') {
    const content = (p.message as string) || '';
    if (!content) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-start mb-4"
      >
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0">
            <Bot size={16} className="text-[var(--accent)]" />
          </div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] px-4 py-3 rounded-2xl rounded-tl-md">
            <div className="text-sm leading-relaxed markdown-content">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');
                    if (match) {
                      return <CodeBlock language={match[1]}>{codeString}</CodeBlock>;
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Tool call / Tool result
  if (event.type === 'tool:call' || event.type === 'tool:result') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 ml-11"
      >
        <ToolCard event={event} />
      </motion.div>
    );
  }

  // Planning events
  if (event.type === 'planning:start' || event.type === 'planning:todo' || event.type === 'planning:complete') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 mb-4"
      >
        <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <Bot size={16} className="text-amber-400" />
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 px-4 py-3 rounded-2xl rounded-tl-md">
          <p className="text-xs font-medium text-amber-400 mb-1">{t('chat.planning')}</p>
          {event.type === 'planning:todo' && Array.isArray(p.titles) && (
            <ul className="text-sm text-[var(--text-secondary)] list-disc pl-4">
              {(p.titles as string[]).map((title: string, i: number) => (
                <li key={i}>{title}</li>
              ))}
            </ul>
          )}
          {event.type === 'planning:complete' && (
            <p className="text-sm text-[var(--text-secondary)]">
              {t('chat.planCreated', { count: p.count as number })}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  // Execution start
  if (event.type === 'execution:start') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex justify-center mb-3"
      >
        <span className="text-xs text-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1 rounded-full">
          {t('chat.executingTodo')}
        </span>
      </motion.div>
    );
  }

  // Error
  if (event.type === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 mb-4"
      >
        <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
          <AlertCircle size={16} className="text-red-400" />
        </div>
        <div className="bg-red-500/5 border border-red-500/20 px-4 py-3 rounded-2xl rounded-tl-md">
          <p className="text-xs font-medium text-red-400 mb-1">{t('chat.failed')}</p>
          <p className="text-sm text-red-300">{(p.message as string) || 'Unknown error'}</p>
        </div>
      </motion.div>
    );
  }

  // Compact events
  if (event.type === 'compact:start' || event.type === 'compact:complete') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex justify-center mb-3"
      >
        <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-3 py-1 rounded-full">
          Context compacted
        </span>
      </motion.div>
    );
  }

  // Session state
  if (event.type === 'session:state') {
    return null; // State snapshots are not displayed as messages
  }

  // Ask user (interactive question)
  if (event.type === 'ask_user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 mb-4"
      >
        <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
          <Bot size={16} className="text-blue-400" />
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 px-4 py-3 rounded-2xl rounded-tl-md">
          <p className="text-sm text-[var(--text-primary)] mb-2">{p.question as string}</p>
          {Array.isArray(p.options) && (
            <div className="flex flex-wrap gap-2">
              {(p.options as string[]).map((opt: string, i: number) => (
                <button
                  key={i}
                  onClick={() => onAskUserResponse?.(p.question as string, opt)}
                  className="btn-outline text-xs py-1 px-3 hover:bg-[var(--accent)] hover:text-white transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Subagent events
  if (event.type === 'subagent:start' || event.type === 'subagent:complete') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 mb-3 ml-11"
      >
        <div className="w-5 h-5 rounded bg-purple-500/15 flex items-center justify-center">
          <Bot size={12} className="text-purple-400" />
        </div>
        <span className="text-xs text-purple-400">
          {event.type === 'subagent:start'
            ? `Sub-agent: ${(p.name as string) || 'working'}`
            : 'Sub-agent completed'}
        </span>
      </motion.div>
    );
  }

  return null;
}
