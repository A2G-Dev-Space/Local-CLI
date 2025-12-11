/**
 * Approval Prompt Component
 *
 * Ink-based approval UI for HITL (Human-in-the-Loop)
 * Avoids conflicts with the main Ink UI by being integrated within it
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TodoItem } from '../../../types/index.js';
import { RiskAssessment } from '../../../plan-and-execute/risk-analyzer.js';

export type ApprovalAction = 'approve' | 'reject' | 'approve_all' | 'reject_all' | 'stop';

interface PlanApprovalPromptProps {
  userRequest: string;
  todos: TodoItem[];
  onResponse: (action: ApprovalAction) => void;
}

interface TaskApprovalPromptProps {
  taskDescription: string;
  risk: RiskAssessment;
  context?: string;
  onResponse: (action: ApprovalAction) => void;
}

/**
 * Plan Approval Prompt
 */
export const PlanApprovalPrompt: React.FC<PlanApprovalPromptProps> = ({
  userRequest,
  todos,
  onResponse,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const options = [
    { label: '✅ Approve - Execute this plan', value: 'approve' as const },
    { label: '❌ Reject - Cancel execution', value: 'reject' as const },
    { label: '⏹  Stop - Stop and exit', value: 'stop' as const },
  ];

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onResponse(options[selectedIndex]!.value);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">📋 PLAN APPROVAL REQUIRED</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>User Request: "{userRequest}"</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="yellow">Generated {todos.length} task(s):</Text>
        {todos.map((todo, index) => (
          <Box key={todo.id} flexDirection="column" marginLeft={2}>
            <Text>
              {index + 1}. {todo.title}
            </Text>
            {todo.description && (
              <Text dimColor color="gray">   {todo.description}</Text>
            )}
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>What would you like to do? (↑↓ arrows, Enter to select)</Text>
        {options.map((option, index) => (
          <Text key={option.value} color={index === selectedIndex ? 'green' : 'white'}>
            {index === selectedIndex ? '❯ ' : '  '}
            {option.label}
          </Text>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Task Approval Prompt
 */
export const TaskApprovalPrompt: React.FC<TaskApprovalPromptProps> = ({
  taskDescription,
  risk,
  context,
  onResponse,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const options = [
    { label: '✅ Approve - Execute this task', value: 'approve' as const },
    { label: '⏭  Skip - Skip this task', value: 'reject' as const },
    { label: '✅✅ Approve All - Approve all remaining', value: 'approve_all' as const },
    { label: '⏭⏭ Skip All - Skip all remaining', value: 'reject_all' as const },
    { label: '⏹  Stop - Stop execution', value: 'stop' as const },
  ];

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onResponse(options[selectedIndex]!.value);
    }
  });

  const formatRiskLevel = (level: string): string => {
    const formats: Record<string, string> = {
      low: '🟢 LOW',
      medium: '🟡 MEDIUM',
      high: '🟠 HIGH',
      critical: '🔴 CRITICAL',
    };
    return formats[level] || level.toUpperCase();
  };

  const formatCategory = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">⚠️  APPROVAL REQUIRED - RISKY OPERATION</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>Task: {taskDescription}</Text>
        <Text>Risk Level: {formatRiskLevel(risk.level)}</Text>
        <Text>Category: {formatCategory(risk.category)}</Text>
        <Text dimColor color="gray">Reason: {risk.reason}</Text>
        {risk.detectedPatterns.length > 0 && (
          <Text dimColor color="gray">
            Patterns: {risk.detectedPatterns.slice(0, 3).join(', ')}
          </Text>
        )}
        {context && (
          <Text dimColor color="gray">Context: {context}</Text>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>What would you like to do? (↑↓ arrows, Enter to select)</Text>
        {options.map((option, index) => (
          <Text key={option.value} color={index === selectedIndex ? 'green' : 'white'}>
            {index === selectedIndex ? '❯ ' : '  '}
            {option.label}
          </Text>
        ))}
      </Box>
    </Box>
  );
};
