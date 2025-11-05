/**
 * TODO Panel Component
 *
 * Displays TODO list at the bottom of the screen for Plan-and-Execute mode
 */

import React from 'react';
import { Box, Text } from 'ink';
import { TodoItem } from '../types/index.js';

interface TodoPanelProps {
  todos: TodoItem[];
  currentTodoId?: string;
  showDetails?: boolean;
}

/**
 * Get status emoji and color
 */
function getStatusDisplay(status: TodoItem['status']): { emoji: string; color: string } {
  switch (status) {
    case 'pending':
      return { emoji: '⏳', color: 'gray' };
    case 'in_progress':
      return { emoji: '🔄', color: 'yellow' };
    case 'completed':
      return { emoji: '✅', color: 'green' };
    case 'failed':
      return { emoji: '❌', color: 'red' };
    default:
      return { emoji: '❓', color: 'gray' };
  }
}

/**
 * Format duration from ISO timestamps
 */
function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '';

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const duration = Math.floor((end - start) / 1000); // seconds

  if (duration < 60) {
    return `${duration}s`;
  } else if (duration < 3600) {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * TODO Panel Component
 */
export const TodoPanel: React.FC<TodoPanelProps> = ({
  todos,
  currentTodoId,
  showDetails = false,
}) => {
  if (todos.length === 0) {
    return null;
  }

  // Calculate completion stats
  const completedCount = todos.filter(t => t.status === 'completed').length;
  const failedCount = todos.filter(t => t.status === 'failed').length;
  const progressPercentage = Math.round((completedCount / todos.length) * 100);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          📋 TODO List ({completedCount}/{todos.length})
        </Text>
        <Text color="cyan">
          {progressPercentage}% Complete
        </Text>
      </Box>

      {/* TODO Items */}
      <Box flexDirection="column">
        {todos.map((todo, index) => {
          const { emoji, color } = getStatusDisplay(todo.status);
          const isCurrent = todo.id === currentTodoId;
          const duration = formatDuration(todo.startedAt, todo.completedAt);

          return (
            <Box key={todo.id} marginBottom={index < todos.length - 1 ? 0 : 0}>
              <Box width={3}>
                <Text>{emoji}</Text>
              </Box>
              <Box flexGrow={1}>
                <Text
                  color={color}
                  bold={isCurrent}
                  dimColor={todo.status === 'completed' || todo.status === 'failed'}
                >
                  {index + 1}. {todo.title}
                  {duration && <Text color="gray"> ({duration})</Text>}
                </Text>
                {showDetails && todo.status === 'in_progress' && (
                  <Box marginLeft={3}>
                    <Text color="gray" dimColor>
                      {todo.description}
                    </Text>
                  </Box>
                )}
                {showDetails && todo.error && (
                  <Box marginLeft={3}>
                    <Text color="red">
                      Error: {todo.error}
                    </Text>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Summary */}
      {failedCount > 0 && (
        <Box marginTop={1}>
          <Text color="red">
            ⚠️ {failedCount} task{failedCount > 1 ? 's' : ''} failed
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Compact TODO Status Bar
 * Shows inline status for space-constrained layouts
 */
export const TodoStatusBar: React.FC<{ todos: TodoItem[] }> = ({ todos }) => {
  if (todos.length === 0) {
    return null;
  }

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
  const currentTodo = todos.find(t => t.status === 'in_progress');

  return (
    <Box>
      <Text color="cyan">
        TODO: {completedCount}/{todos.length} complete
      </Text>
      {currentTodo && (
        <>
          <Text color="gray"> | </Text>
          <Text color="yellow">
            Current: {currentTodo.title}
          </Text>
        </>
      )}
      {inProgressCount === 0 && completedCount === todos.length && (
        <>
          <Text color="gray"> | </Text>
          <Text color="green">All tasks complete! ✨</Text>
        </>
      )}
    </Box>
  );
};

export default TodoPanel;