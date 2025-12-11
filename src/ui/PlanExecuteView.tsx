/**
 * Plan-Execute View
 *
 * Main UI for Plan-and-Execute workflow with real-time progress
 */

import React from 'react';
import { Box, Text } from 'ink';
import { TodoItem } from '../types/index.js';
import {
  TodoListView,
  StatusBar,
  ProgressBar,
} from './components/index.js';

export interface PlanExecuteViewProps {
  todos: TodoItem[];
  currentTodo?: TodoItem;
  model?: string;
  endpoint?: string;
  onExit?: () => void;
}

export const PlanExecuteView: React.FC<PlanExecuteViewProps> = ({
  todos,
  currentTodo,
  model,
  endpoint,
}) => {
  const completedTodos = todos.filter(t => t.status === 'completed').length;
  const totalTodos = todos.length;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Title */}
      <Box marginBottom={1} justifyContent="center">
        <Text bold color="cyan">
          ====== OPEN-CLI Plan-and-Execute Mode ======
        </Text>
      </Box>

      {/* Overall Progress */}
      <Box marginBottom={1}>
        <ProgressBar
          current={completedTodos}
          total={totalTodos}
          label="Overall Progress"
          width={50}
          showPercentage
        />
      </Box>

      {/* Two Column Layout */}
      <Box gap={2}>
        {/* Left Column - TODO List */}
        <Box width="50%">
          <TodoListView
            todos={todos}
            title="Task List"
            showDescription={false}
          />
        </Box>

        {/* Right Column - Current Task Status */}
        <Box width="50%">
          {currentTodo ? (
            <Box
              borderStyle="round"
              borderColor="yellow"
              padding={1}
              flexDirection="column"
            >
              <Text bold color="yellow">Current Task:</Text>
              <Text>{currentTodo.title}</Text>
              <Box marginTop={1}>
                <Text color="gray">Status: </Text>
                <Text color={currentTodo.status === 'in_progress' ? 'yellow' : 'green'}>
                  {currentTodo.status}
                </Text>
              </Box>
            </Box>
          ) : (
            <Box
              borderStyle="round"
              borderColor="green"
              padding={1}
              justifyContent="center"
              alignItems="center"
            >
              <Text bold color="green">
                All tasks completed!
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Status Bar */}
      <Box marginTop={1}>
        <StatusBar
          model={model}
          endpoint={endpoint}
          status={currentTodo ? (currentTodo.status === 'in_progress' ? 'executing' : 'idle') : 'idle'}
          message={currentTodo ? `Working on: ${currentTodo.title}` : 'All tasks complete'}
        />
      </Box>

      {/* Instructions */}
      <Box marginTop={1} justifyContent="center">
        <Text dimColor>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
};
