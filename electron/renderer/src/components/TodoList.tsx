/**
 * TodoList Component
 * Displays the current TODO list from Planning/Execution LLM
 * Matches CLI's todo display style with status indicators
 */

import React, { memo, useMemo } from 'react';
import './TodoList.css';

export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

interface TodoListProps {
  todos: TodoItem[];
  isExecuting?: boolean;
  onRetry?: (todoId: string) => void;
}

const TodoList: React.FC<TodoListProps> = ({ todos, isExecuting, onRetry }) => {
  // Memoize progress calculations
  const { completedCount, totalCount, progress } = useMemo(() => {
    const completed = todos.filter(t => t.status === 'completed').length;
    const total = todos.length;
    return {
      completedCount: completed,
      totalCount: total,
      progress: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [todos]);

  if (todos.length === 0) {
    return null;
  }

  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="todo-icon completed" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        );
      case 'in_progress':
        return (
          <div className="todo-icon in-progress">
            <div className="spinner" />
          </div>
        );
      case 'failed':
        return (
          <svg className="todo-icon failed" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        );
      default:
        return (
          <div className="todo-icon pending">
            <div className="circle" />
          </div>
        );
    }
  };

  return (
    <div className="todo-list-container">
      {/* Header with Progress */}
      <div className="todo-list-header">
        <div className="todo-list-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
            <path d="M18 9l-1.4-1.4-6.6 6.6-2.6-2.6L6 13l4 4z"/>
          </svg>
          <span>Tasks</span>
          <span className="todo-count">{completedCount}/{totalCount}</span>
        </div>
        <div className="todo-progress-bar">
          <div
            className="todo-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* TODO Items */}
      <div className="todo-list-items">
        {todos.map((todo, index) => (
          <div
            key={todo.id}
            className={`todo-item ${todo.status}`}
          >
            <div className="todo-item-number">{index + 1}</div>
            {getStatusIcon(todo.status)}
            <div className="todo-item-content">
              <span className="todo-item-title">{todo.title}</span>
              {todo.status === 'in_progress' && (
                <span className="todo-current-indicator">←</span>
              )}
              {todo.error && (
                <span className="todo-item-error">{todo.error}</span>
              )}
            </div>
            {todo.status === 'failed' && onRetry && (
              <button
                className="todo-retry-btn"
                onClick={() => onRetry(todo.id)}
                title="Retry"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Execution Status */}
      {isExecuting && (
        <div className="todo-execution-status">
          <div className="execution-indicator" />
          <span>Executing...</span>
        </div>
      )}
    </div>
  );
};

export default memo(TodoList);
