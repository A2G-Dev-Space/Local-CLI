/**
 * TODO List View Component
 *
 * Displays TODO items with status indicators and progress bar
 */

import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { TodoItem } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export interface TodoListViewProps {
  todos: TodoItem[];
  title?: string;
  showDescription?: boolean;
  showProgressBar?: boolean;
}

// Notion-style checkbox icons
const STATUS_CONFIG = {
  completed: { icon: '☑', color: 'gray' as const },
  in_progress: { icon: '☐', color: 'white' as const },
  failed: { icon: '☒', color: 'red' as const },
  pending: { icon: '☐', color: 'gray' as const },
};

// Notion-style slim progress bar
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

export const TodoListView: React.FC<TodoListViewProps> = ({
  todos,
  showProgressBar = true,
}) => {
  // Log component lifecycle
  useEffect(() => {
    logger.enter('TodoListView', {
      todoCount: todos.length,
      showProgressBar,
    });
    return () => {
      logger.exit('TodoListView', { todoCount: todos.length });
    };
  }, []);

  // Log when todos change
  useEffect(() => {
    const completed = todos.filter(t => t.status === 'completed').length;
    const inProgress = todos.filter(t => t.status === 'in_progress').length;
    const failed = todos.filter(t => t.status === 'failed').length;

    logger.debug('TodoListView todos updated', {
      total: todos.length,
      completed,
      inProgress,
      failed,
    });
  }, [todos]);

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const totalCount = todos.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* TODO Items - Notion style */}
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
                    <Spinner type="dots" />
                  </Text>
                ) : (
                  <Text color={config.color}>{config.icon}</Text>
                )}
              </Box>

              {/* Task title */}
              <Text
                color={isCompleted ? 'gray' : isInProgress ? 'white' : 'gray'}
                dimColor={isCompleted}
                strikethrough={isCompleted}
                bold={isInProgress}
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

      {/* Progress bar at bottom */}
      {showProgressBar && (
        <Box marginTop={1}>
          <ProgressBar completed={completedCount} total={totalCount} width={20} />
        </Box>
      )}
    </Box>
  );
};

export default TodoListView;
