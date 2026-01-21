/**
 * TodoPanel Component - Compact Design
 * Displays todos in the editor area with last/current/next view
 *
 * Features:
 * - Single-line compact cards
 * - Smooth transition animation when tasks change
 * - No scrolling - everything fits in view
 * - Clear visual distinction between states
 */

import React, { useState, useMemo, memo, useCallback, useEffect, useRef } from 'react';
import type { TodoItem } from './TodoList';
import './TodoPanel.css';

interface TodoPanelProps {
  todos: TodoItem[];
  onRetry?: (id: string) => void;
}

const TodoPanel: React.FC<TodoPanelProps> = ({ todos, onRetry }) => {
  const [expanded, setExpanded] = useState(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const prevCurrentIdRef = useRef<string | null>(null);

  // Categorize todos - find the previous (completed/failed), current in_progress, and next pending
  const { prevTodo, currentTodo, nextTodo, completedCount, failedCount, totalCount, pendingCount } = useMemo(() => {
    let prev: TodoItem | null = null;
    let current: TodoItem | null = null;
    let next: TodoItem | null = null;
    let doneCount = 0;
    let failCount = 0;
    let pendingCnt = 0;

    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];
      if (todo.status === 'completed') {
        prev = todo;  // Track last completed as previous
        doneCount++;
      } else if (todo.status === 'failed') {
        prev = todo;  // Track failed as previous too (important!)
        failCount++;
      } else if (todo.status === 'in_progress' && !current) {
        current = todo;
      } else if ((todo.status === 'pending') && current && !next) {
        next = todo;
        pendingCnt++;
      } else if (todo.status === 'pending') {
        pendingCnt++;
      }
    }

    return {
      prevTodo: prev,
      currentTodo: current,
      nextTodo: next,
      completedCount: doneCount,
      failedCount: failCount,
      totalCount: todos.length,
      pendingCount: pendingCnt + (next ? 1 : 0),
    };
  }, [todos]);

  // Trigger animation when current task changes
  useEffect(() => {
    const currentId = currentTodo?.id || null;
    if (prevCurrentIdRef.current && currentId && prevCurrentIdRef.current !== currentId) {
      // Current task changed - trigger animation
      setAnimatingId(currentId);
      const timer = setTimeout(() => setAnimatingId(null), 500);
      return () => clearTimeout(timer);
    }
    prevCurrentIdRef.current = currentId;
  }, [currentTodo?.id]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Get todo index in original list
  const getTodoIndex = useCallback((todo: TodoItem) => {
    return todos.findIndex(t => t.id === todo.id) + 1;
  }, [todos]);

  const getStatusIcon = (status: TodoItem['status'], small = false) => {
    const size = small ? 14 : 16;
    switch (status) {
      case 'completed':
        return (
          <svg className="status-icon completed" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        );
      case 'in_progress':
        return (
          <div className="status-icon in-progress">
            <div className="spinner" style={{ width: size - 2, height: size - 2 }} />
          </div>
        );
      case 'failed':
        return (
          <svg className="status-icon failed" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        );
      default:
        return (
          <div className="status-icon pending" style={{ width: size, height: size }}>
            <div className="circle" style={{ width: size - 6, height: size - 6 }} />
          </div>
        );
    }
  };

  if (todos.length === 0) {
    return (
      <div className="todo-panel todo-panel-empty-state">
        <div className="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
            <path d="M18 9l-1.4-1.4-6.6 6.6-2.6-2.6L6 13l4 4z" />
          </svg>
        </div>
        <h3>No Tasks</h3>
        <p>Tasks will appear here when the agent creates a plan</p>
      </div>
    );
  }

  const progressPercent = (completedCount / totalCount) * 100;

  return (
    <div className="todo-panel">
      {/* Header with progress */}
      <div className="todo-header">
        <div className="todo-header-left">
          <div className="todo-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
              <path d="M18 9l-1.4-1.4-6.6 6.6-2.6-2.6L6 13l4 4z" />
            </svg>
          </div>
          <span className="todo-title">Task Progress</span>
        </div>
        <div className="todo-header-right">
          <span className="todo-count">
            <span className="done">{completedCount}</span>
            <span className="sep">/</span>
            <span className="total">{totalCount}</span>
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="todo-progress-bar">
        <div
          className="todo-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Compact View - 3 rows max */}
      {!expanded && (
        <div className="todo-compact" onClick={toggleExpanded}>
          {/* Previous (Completed or Failed) */}
          {prevTodo && (
            <div className={`todo-row ${prevTodo.status}`}>
              <span className="row-label">
                {prevTodo.status === 'completed' ? (
                  <><span className="check">✓</span> DONE</>
                ) : (
                  <><span className="fail">✗</span> FAIL</>
                )}
              </span>
              <div className={`todo-card ${prevTodo.status}`}>
                <span className="card-num">{getTodoIndex(prevTodo)}</span>
                {getStatusIcon(prevTodo.status, true)}
                <span className="card-title">{prevTodo.title}</span>
              </div>
            </div>
          )}

          {/* Current */}
          {currentTodo && (
            <div className={`todo-row current ${animatingId === currentTodo.id ? 'slide-in' : ''}`}>
              <span className="row-label">
                <span className="pulse">●</span> CURRENT
              </span>
              <div className="todo-card current">
                <span className="card-num">{getTodoIndex(currentTodo)}</span>
                {getStatusIcon('in_progress', true)}
                <span className="card-title">{currentTodo.title}</span>
              </div>
            </div>
          )}

          {/* Next */}
          {nextTodo && (
            <div className="todo-row next">
              <span className="row-label">
                <span className="arrow">→</span> NEXT{pendingCount > 1 ? ` (+${pendingCount - 1})` : ''}
              </span>
              <div className="todo-card next">
                <span className="card-num">{getTodoIndex(nextTodo)}</span>
                {getStatusIcon('pending', true)}
                <span className="card-title">{nextTodo.title}</span>
              </div>
            </div>
          )}

          {/* All Done */}
          {!currentTodo && !nextTodo && completedCount > 0 && (
            <div className="todo-row all-done">
              <span className="row-label done-label">🎉 All Tasks Completed!</span>
            </div>
          )}

          {/* Expand hint */}
          <div className="todo-expand-hint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
            </svg>
            Click to view all {totalCount} tasks
          </div>
        </div>
      )}

      {/* Expanded View */}
      {expanded && (
        <div className="todo-expanded">
          <button className="todo-collapse-btn" onClick={toggleExpanded}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
            </svg>
            Collapse
          </button>
          <div className="todo-all-list">
            {todos.map((todo, index) => (
              <div
                key={todo.id}
                className={`todo-card full ${todo.status} ${
                  todo.status === 'in_progress' ? 'highlight' : ''
                }`}
              >
                <span className="card-num">{index + 1}</span>
                {getStatusIcon(todo.status, true)}
                <span className="card-title">{todo.title}</span>
                {todo.status === 'failed' && onRetry && (
                  <button
                    className="retry-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetry(todo.id);
                    }}
                    title="Retry"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(TodoPanel);
