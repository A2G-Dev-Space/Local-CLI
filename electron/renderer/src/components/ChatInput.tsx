/**
 * ChatInput Component
 * Extracted from ChatPanel.tsx for better code splitting
 * Handles user input with history navigation and keyboard shortcuts
 */

import React, { memo, useRef, useEffect, useCallback } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAbort: () => void;
  isLoading: boolean;
  isExecuting: boolean;
  inputHistory?: string[]; // Deprecated: kept for API compatibility
  allowAllPermissions: boolean;
  onAllowAllPermissionsChange?: (value: boolean) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onAbort,
  isLoading,
  isExecuting,
  // inputHistory removed - arrow history disabled for Electron
  allowAllPermissions,
  onAllowAllPermissionsChange,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [value]);

  // Handle keyboard events (arrow history disabled for Electron)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
      return;
    }

    // Arrow up/down history navigation disabled for Electron
    // Users can use normal text editing with arrow keys

    // Escape to abort execution
    if (e.key === 'Escape' && isExecuting) {
      e.preventDefault();
      onAbort();
    }
  }, [isExecuting, onSend, onAbort]);

  return (
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
            onClick={onAbort}
            title="Stop (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z"/>
            </svg>
          </button>
        ) : (
          <button
            className="chat-send-btn"
            onClick={onSend}
            disabled={!value.trim() || isLoading}
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
  );
};

export default memo(ChatInput);
