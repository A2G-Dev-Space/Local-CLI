/**
 * TODO Panel Component
 *
 * Displays TODO list at the bottom of the screen for Plan-and-Execute mode
 * Features:
 * - Visual progress bar
 * - Mini-map style progress
 * - Time tracking per task
 * - Token usage per task
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { TodoItem } from '../types/index.js';
import { logger } from '../utils/logger.js';

interface TodoPanelProps {
  todos: TodoItem[];
  currentTodoId?: string;
  isProcessing?: boolean;
}

// Notion-style checkbox icons
const STATUS_CONFIG = {
  pending: { icon: '☐', color: 'gray' as const },
  in_progress: { icon: '☐', color: 'white' as const },
  completed: { icon: '☑', color: 'gray' as const },
  failed: { icon: '☒', color: 'red' as const },
};

/**
 * Notion-style slim progress bar
 */
const ProgressBar: React.FC<{ completed: number; total: number; width?: number }> = ({
  completed,
  total,
  width = 20,
}) => {
  const filled = total > 0 ? Math.round((completed / total) * width) : 0;
  const empty = width - filled;

  return (
    <Box>
      <Text color="greenBright">{'▓'.repeat(filled)}</Text>
      <Text color="gray" dimColor>{'░'.repeat(empty)}</Text>
      <Text color="gray" dimColor> {completed} of {total}</Text>
    </Box>
  );
};



/**
 * TODO Panel Component
 */
export const TodoPanel: React.FC<TodoPanelProps> = ({
  todos,
  currentTodoId,
  isProcessing = false,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());

  // Log component lifecycle
  useEffect(() => {
    logger.enter('TodoPanel', {
      todoCount: todos.length,
      currentTodoId,
    });
    return () => {
      logger.exit('TodoPanel', { todoCount: todos.length });
    };
  }, []);

  // Update elapsed time
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isProcessing, startTime]);

  // Log when todos change
  useEffect(() => {
    const completed = todos.filter(t => t.status === 'completed').length;
    const inProgress = todos.filter(t => t.status === 'in_progress').length;

    logger.debug('TodoPanel todos updated', {
      total: todos.length,
      completed,
      inProgress,
      currentTodoId,
    });
  }, [todos, currentTodoId]);

  if (todos.length === 0) {
    return null;
  }

  // Calculate stats
  const completedCount = todos.filter(t => t.status === 'completed').length;

  // Format elapsed time as mm:ss or hh:mm:ss
  const formatElapsedTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* TODO Items - Notion style */}
      <Box flexDirection="column">
        {todos.map((todo) => {
          const config = STATUS_CONFIG[todo.status] || STATUS_CONFIG.pending;
          const isInProgress = todo.status === 'in_progress';
          const isCompleted = todo.status === 'completed';

          return (
            <Box key={todo.id} flexDirection="column">
              <Box>
                {/* Checkbox icon */}
                <Box width={2}>
                  {isInProgress ? (
                    <Text color="blueBright">
                      <Spinner type="dots2" />
                    </Text>
                  ) : (
                    <Text color={config.color}>{config.icon}</Text>
                  )}
                </Box>

                {/* Task title */}
                <Text
                  color={isCompleted ? 'gray' : isInProgress ? 'white' : 'gray'}
                  bold={isInProgress}
                  dimColor={isCompleted}
                  strikethrough={isCompleted}
                >
                  {todo.title}
                </Text>

                {/* Current indicator */}
                {isInProgress && (
                  <Text color="blueBright"> ←</Text>
                )}
              </Box>

              {/* Error message */}
              {todo.error && (
                <Box marginLeft={2}>
                  <Text color="red" dimColor>⚠ {todo.error}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Progress bar and time */}
      <Box marginTop={1} justifyContent="space-between">
        <ProgressBar completed={completedCount} total={todos.length} width={20} />
        {isProcessing && (
          <Text color="gray" dimColor>{formatElapsedTime(elapsedTime)}</Text>
        )}
      </Box>
    </Box>
  );
};

/**
 * Compact TODO Status Bar
 * Shows inline status for space-constrained layouts
 */
export const TodoStatusBar: React.FC<{ todos: TodoItem[] }> = ({ todos }) => {
  // Log component render
  useEffect(() => {
    logger.debug('TodoStatusBar rendered', { todoCount: todos.length });
  }, [todos.length]);

  if (todos.length === 0) {
    return null;
  }

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
  const currentTodo = todos.find(t => t.status === 'in_progress');
  const percentage = Math.round((completedCount / todos.length) * 100);

  return (
    <Box>
      {/* Notion-style inline progress */}
      <Text color="greenBright">{'▓'.repeat(Math.round(percentage / 10))}</Text>
      <Text color="gray" dimColor>{'░'.repeat(10 - Math.round(percentage / 10))}</Text>
      <Text color="gray" dimColor> {completedCount}/{todos.length}</Text>

      {currentTodo && (
        <>
          <Text color="gray" dimColor> │ </Text>
          <Text color="blueBright">
            <Spinner type="dots" />
          </Text>
          <Text color="white"> {currentTodo.title.slice(0, 30)}{currentTodo.title.length > 30 ? '...' : ''}</Text>
        </>
      )}

      {inProgressCount === 0 && completedCount === todos.length && (
        <>
          <Text color="gray" dimColor> │ </Text>
          <Text color="greenBright">Done</Text>
        </>
      )}
    </Box>
  );
};

export default TodoPanel;
