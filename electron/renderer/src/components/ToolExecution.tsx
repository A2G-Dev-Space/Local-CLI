/**
 * ToolExecution Component
 * Displays tool call results from LLM execution
 * Shows file operations, shell commands, browser actions, etc.
 */

import React, { useState, memo, useCallback } from 'react';
import './ToolExecution.css';

export type ToolCategory = 'file' | 'shell' | 'browser' | 'office' | 'user' | 'todo' | 'docs' | 'other';

export interface ToolExecutionData {
  id: string;
  toolName: string;
  category: ToolCategory;
  status: 'pending' | 'running' | 'success' | 'error';
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  duration?: number;
  timestamp: number;
  reason?: string; // Reason for tool execution (shown by default)
}

interface ToolExecutionProps {
  executions: ToolExecutionData[];
  onRetry?: (id: string) => void;
  expanded?: boolean;
}

const ToolExecution: React.FC<ToolExecutionProps> = ({
  executions,
  onRetry,
  expanded = false,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const getCategoryIcon = (category: ToolCategory) => {
    switch (category) {
      case 'file':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
          </svg>
        );
      case 'shell':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z"/>
          </svg>
        );
      case 'browser':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        );
      case 'office':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
        );
      case 'user':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        );
      case 'todo':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
            <path d="M18 9l-1.4-1.4-6.6 6.6-2.6-2.6L6 13l4 4z"/>
          </svg>
        );
      case 'docs':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/>
          </svg>
        );
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
          </svg>
        );
    }
  };

  const getStatusIcon = (status: ToolExecutionData['status']) => {
    switch (status) {
      case 'success':
        return (
          <svg className="status-icon success" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        );
      case 'error':
        return (
          <svg className="status-icon error" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        );
      case 'running':
        return (
          <div className="status-icon running">
            <div className="spinner" />
          </div>
        );
      default:
        return (
          <div className="status-icon pending">
            <div className="dot" />
          </div>
        );
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatToolName = (name: string) => {
    // Convert snake_case or camelCase to Title Case
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();
  };

  // Get display text for tool - for tell_to_user, show the actual message
  const getToolDisplayText = (exec: ToolExecutionData) => {
    if (exec.toolName === 'tell_to_user' && exec.input?.message) {
      return String(exec.input.message);
    }
    return formatToolName(exec.toolName);
  };

  // Check if tool should show message inline (like tell_to_user)
  const isMessageTool = (toolName: string) => {
    return toolName === 'tell_to_user';
  };

  // Get reason from execution (explicit or from input)
  const getReason = (exec: ToolExecutionData): string | undefined => {
    if (exec.reason) return exec.reason;
    if (exec.input?.reason) return String(exec.input.reason);
    return undefined;
  };

  if (executions.length === 0) return null;

  return (
    <div className="tool-executions-container">
      {executions.map((exec) => {
        const isExpanded = expanded || expandedIds.has(exec.id);

        const reason = getReason(exec);

        return (
          <div key={exec.id} className={`tool-execution ${exec.status} ${isMessageTool(exec.toolName) ? 'message-tool' : ''}`}>
            <div
              className="tool-execution-header"
              onClick={() => toggleExpand(exec.id)}
            >
              <div className="tool-info">
                <span className={`tool-category ${exec.category}`}>
                  {getCategoryIcon(exec.category)}
                </span>
                <span className={`tool-name ${isMessageTool(exec.toolName) ? 'tool-message' : ''}`}>
                  {getToolDisplayText(exec)}
                </span>
                {/* Reason displayed by default */}
                {reason && (
                  <span className="tool-reason">{reason}</span>
                )}
              </div>
              <div className="tool-status">
                {exec.duration !== undefined && exec.status === 'success' && (
                  <span className="tool-duration">{formatDuration(exec.duration)}</span>
                )}
                {getStatusIcon(exec.status)}
                <svg
                  className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                </svg>
              </div>
            </div>

            {isExpanded && (
              <div className="tool-execution-details">
                {/* Input */}
                {exec.input && Object.keys(exec.input).length > 0 && (
                  <div className="tool-section">
                    <span className="section-label">Input</span>
                    <pre className="section-content">
                      {JSON.stringify(exec.input, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Output */}
                {exec.output && (
                  <div className="tool-section">
                    <span className="section-label">Output</span>
                    <pre className="section-content output">{exec.output}</pre>
                  </div>
                )}

                {/* Error */}
                {exec.error && (
                  <div className="tool-section error">
                    <span className="section-label">Error</span>
                    <pre className="section-content">{exec.error}</pre>
                    {onRetry && (
                      <button
                        className="retry-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(exec.id);
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                        </svg>
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default memo(ToolExecution);
