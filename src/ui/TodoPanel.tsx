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
  showDetails?: boolean;
  tokenUsage?: Map<string, number>;
  modelName?: string;
  isProcessing?: boolean;
}

// Status configuration
const STATUS_CONFIG = {
  pending: { emoji: '○', color: 'gray' as const },
  in_progress: { emoji: '●', color: 'yellow' as const },
  completed: { emoji: '✓', color: 'green' as const },
  failed: { emoji: '✗', color: 'red' as const },
};

/**
 * Progress bar component
 */
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

/**
 * Mini-map style progress indicator
 * Shows each task as a single character
 */
const MiniMap: React.FC<{ todos: TodoItem[] }> = ({ todos }) => {
  if (todos.length === 0) return null;

  return (
    <Box>
      <Text color="gray">[</Text>
      {todos.map((todo, idx) => {
        const config = STATUS_CONFIG[todo.status] || STATUS_CONFIG.pending;
        return (
          <Text key={idx} color={config.color}>
            {todo.status === 'in_progress' ? '▶' : config.emoji}
          </Text>
        );
      })}
      <Text color="gray">]</Text>
    </Box>
  );
};

/**
 * Format duration from ISO timestamps
 */
function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '';

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const duration = Math.floor((end - start) / 1000);

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
 * Format token count
 */
function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  return `${(count / 1000).toFixed(1)}k`;
}


/**
 * TODO Panel Component
 */
export const TodoPanel: React.FC<TodoPanelProps> = ({
  todos,
  currentTodoId,
  showDetails = false,
  tokenUsage,
  modelName,
  isProcessing = false,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());

  // Log component lifecycle
  useEffect(() => {
    logger.enter('TodoPanel', {
      todoCount: todos.length,
      currentTodoId,
      showDetails,
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
  const failedCount = todos.filter(t => t.status === 'failed').length;
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;

  // Calculate total tokens used
  let totalTokens = 0;
  if (tokenUsage) {
    tokenUsage.forEach(count => totalTokens += count);
  }

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
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      {/* Header with progress bar and mini-map */}
      <Box flexDirection="column" marginBottom={1}>
        <Box justifyContent="space-between">
          <Box>
            <Text bold color="cyan">📋 TODO </Text>
            <MiniMap todos={todos} />
          </Box>
          <Box>
            <Text color="gray">
              {completedCount}/{todos.length}
            </Text>
            {failedCount > 0 && <Text color="red"> ({failedCount} failed)</Text>}
          </Box>
        </Box>
        <Box marginTop={0} justifyContent="space-between">
          <ProgressBar completed={completedCount} total={todos.length} width={30} />
          <Box>
            {isProcessing && (
              <Text color="yellow">({formatElapsedTime(elapsedTime)}) </Text>
            )}
            {modelName && (
              <Text color="magenta">{modelName}</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* TODO Items */}
      <Box flexDirection="column">
        {todos.map((todo, index) => {
          const config = STATUS_CONFIG[todo.status] || STATUS_CONFIG.pending;
          const isCurrent = todo.id === currentTodoId;
          const duration = formatDuration(todo.startedAt, todo.completedAt);
          const isLast = index === todos.length - 1;
          const taskTokens = tokenUsage?.get(todo.id);

          return (
            <Box key={todo.id} flexDirection="column">
              <Box>
                {/* Tree connector */}
                <Text color="gray" dimColor>
                  {isLast ? '└─' : '├─'}
                </Text>

                {/* Status icon */}
                <Box width={2} marginLeft={1}>
                  {todo.status === 'in_progress' ? (
                    <Text color={config.color}>
                      <Spinner type="dots" />
                    </Text>
                  ) : (
                    <Text color={config.color}>{config.emoji}</Text>
                  )}
                </Box>

                {/* Task title */}
                <Text
                  color={todo.status === 'completed' ? 'gray' : config.color}
                  bold={isCurrent}
                  dimColor={todo.status === 'completed'}
                  strikethrough={todo.status === 'completed'}
                >
                  {todo.title}
                </Text>

                {/* Duration */}
                {duration && (
                  <Text color="gray" dimColor> ({duration})</Text>
                )}

                {/* Token usage for this task */}
                {taskTokens && (
                  <Text color="cyan" dimColor> [{formatTokens(taskTokens)}]</Text>
                )}
              </Box>

              {/* Description for in_progress */}
              {showDetails && todo.description && todo.status === 'in_progress' && (
                <Box marginLeft={5}>
                  <Text color="gray" dimColor>
                    └─ {todo.description}
                  </Text>
                </Box>
              )}

              {/* Error message */}
              {showDetails && todo.error && (
                <Box marginLeft={5}>
                  <Text color="red">└─ Error: {todo.error}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Running tasks indicator */}
      {inProgressCount > 0 && (
        <Box marginTop={1} justifyContent="flex-end">
          <Text color="yellow" dimColor>
            <Spinner type="dots" /> {inProgressCount} task{inProgressCount > 1 ? 's' : ''} running...
          </Text>
        </Box>
      )}

      {/* All complete message */}
      {completedCount === todos.length && todos.length > 0 && (
        <Box marginTop={1} justifyContent="center">
          <Text color="green">✨ All tasks complete!</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Compact TODO Status Bar
 * Shows inline status for space-constrained layouts
 */
export const TodoStatusBar: React.FC<{ todos: TodoItem[]; tokenCount?: number }> = ({ todos, tokenCount }) => {
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
      {/* Mini progress bar */}
      <Text color="green">{'█'.repeat(Math.round(percentage / 10))}</Text>
      <Text color="gray">{'░'.repeat(10 - Math.round(percentage / 10))}</Text>
      <Text color="cyan"> {completedCount}/{todos.length}</Text>

      {currentTodo && (
        <>
          <Text color="gray"> | </Text>
          <Text color="yellow">
            <Spinner type="dots" /> {currentTodo.title.slice(0, 30)}{currentTodo.title.length > 30 ? '...' : ''}
          </Text>
        </>
      )}

      {tokenCount && tokenCount > 0 && (
        <>
          <Text color="gray"> | </Text>
          <Text color="cyan">{formatTokens(tokenCount)} tok</Text>
        </>
      )}

      {inProgressCount === 0 && completedCount === todos.length && (
        <>
          <Text color="gray"> | </Text>
          <Text color="green">✨ Done!</Text>
        </>
      )}
    </Box>
  );
};

export default TodoPanel;
