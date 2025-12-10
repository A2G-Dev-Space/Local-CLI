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

// Status icons with better visuals
const STATUS_CONFIG = {
  completed: { icon: '✓', color: 'green' as const, label: 'Done' },
  in_progress: { icon: '●', color: 'yellow' as const, label: 'Running' },
  failed: { icon: '✗', color: 'red' as const, label: 'Failed' },
  pending: { icon: '○', color: 'gray' as const, label: 'Pending' },
};

// Progress bar component
const ProgressBar: React.FC<{ completed: number; total: number; width?: number }> = ({
  completed,
  total,
  width = 20,
}) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const filled = Math.round((completed / total) * width) || 0;
  const empty = width - filled;

  return (
    <Box>
      <Text color="green">{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
      <Text color="gray"> {percentage}%</Text>
    </Box>
  );
};

export const TodoListView: React.FC<TodoListViewProps> = ({
  todos,
  title = 'TODO List',
  showDescription = false,
  showProgressBar = true,
}) => {
  // Log component lifecycle
  useEffect(() => {
    logger.enter('TodoListView', {
      todoCount: todos.length,
      showDescription,
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
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
  const failedCount = todos.filter(t => t.status === 'failed').length;
  const totalCount = todos.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      {/* Header with progress */}
      <Box flexDirection="column" marginBottom={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">📋 {title}</Text>
          <Text color="gray">
            {completedCount}/{totalCount}
            {failedCount > 0 && <Text color="red"> ({failedCount} failed)</Text>}
          </Text>
        </Box>

        {/* Progress bar */}
        {showProgressBar && (
          <Box marginTop={0}>
            <ProgressBar completed={completedCount} total={totalCount} width={25} />
          </Box>
        )}
      </Box>

      {/* TODO Items */}
      {todos.map((todo, index) => {
        const config = STATUS_CONFIG[todo.status] || STATUS_CONFIG.pending;
        const isLast = index === todos.length - 1;

        return (
          <Box key={todo.id} flexDirection="column" marginBottom={showDescription && !isLast ? 1 : 0}>
            <Box>
              {/* Tree-like connector */}
              <Text color="gray" dimColor>
                {isLast ? '└─' : '├─'}
              </Text>

              {/* Status icon with spinner for in_progress */}
              <Box width={2} marginLeft={1}>
                {todo.status === 'in_progress' ? (
                  <Text color={config.color}>
                    <Spinner type="dots" />
                  </Text>
                ) : (
                  <Text color={config.color}>{config.icon}</Text>
                )}
              </Box>

              {/* Task title */}
              <Text
                color={todo.status === 'completed' ? 'gray' : config.color}
                dimColor={todo.status === 'completed'}
                strikethrough={todo.status === 'completed'}
              >
                {todo.title}
              </Text>
            </Box>

            {/* Description for in_progress items */}
            {showDescription && todo.description && todo.status === 'in_progress' && (
              <Box marginLeft={5}>
                <Text color="gray" dimColor>
                  └─ {todo.description}
                </Text>
              </Box>
            )}

            {/* Error message */}
            {todo.error && (
              <Box marginLeft={5}>
                <Text color="red">└─ Error: {todo.error}</Text>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Summary footer */}
      {inProgressCount > 0 && (
        <Box marginTop={1} justifyContent="flex-end">
          <Text color="yellow" dimColor>
            <Spinner type="dots" /> {inProgressCount} task{inProgressCount > 1 ? 's' : ''} running...
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default TodoListView;
