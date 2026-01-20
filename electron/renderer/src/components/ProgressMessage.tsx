/**
 * ProgressMessage Component
 * Displays progress messages from LLM (tell_to_user equivalent)
 * Shows status updates during task execution
 */

import React from 'react';
import './ProgressMessage.css';

export type ProgressType = 'info' | 'success' | 'warning' | 'error' | 'working';

export interface ProgressMessageData {
  id: string;
  type: ProgressType;
  message: string;
  timestamp: number;
  details?: string;
  progress?: number; // 0-100 for progress bar
}

interface ProgressMessageProps {
  messages: ProgressMessageData[];
  onDismiss?: (id: string) => void;
  showTimestamp?: boolean;
  compact?: boolean;
}

const ProgressMessage: React.FC<ProgressMessageProps> = ({
  messages,
  onDismiss,
  showTimestamp = false,
  compact = false,
}) => {
  if (messages.length === 0) return null;

  const getIcon = (type: ProgressType) => {
    switch (type) {
      case 'success':
        return (
          <svg className="progress-icon success" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        );
      case 'warning':
        return (
          <svg className="progress-icon warning" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        );
      case 'error':
        return (
          <svg className="progress-icon error" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        );
      case 'working':
        return (
          <div className="progress-icon working">
            <div className="spinner" />
          </div>
        );
      default:
        return (
          <svg className="progress-icon info" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        );
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className={`progress-messages-container ${compact ? 'compact' : ''}`}>
      {messages.map((msg) => (
        <div key={msg.id} className={`progress-message ${msg.type}`}>
          <div className="progress-message-content">
            {getIcon(msg.type)}
            <div className="progress-message-text">
              <span className="progress-message-main">{msg.message}</span>
              {msg.details && (
                <span className="progress-message-details">{msg.details}</span>
              )}
              {showTimestamp && (
                <span className="progress-message-time">{formatTime(msg.timestamp)}</span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {msg.progress !== undefined && msg.progress >= 0 && (
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${Math.min(100, Math.max(0, msg.progress))}%` }}
              />
            </div>
          )}

          {/* Dismiss Button */}
          {onDismiss && msg.type !== 'working' && (
            <button
              className="progress-dismiss-btn"
              onClick={() => onDismiss(msg.id)}
              title="Dismiss"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ProgressMessage;
