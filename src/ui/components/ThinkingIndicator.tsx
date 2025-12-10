/**
 * ThinkingIndicator Component
 *
 * Displays AI thinking/processing status with detailed information
 * Similar to Claude Code's thinking indicator
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { logger } from '../../utils/logger.js';

export type ThinkingPhase =
  | 'analyzing'
  | 'planning'
  | 'generating'
  | 'executing'
  | 'validating'
  | 'tool_calling'
  | 'waiting';

interface ThinkingIndicatorProps {
  phase: ThinkingPhase;
  startTime: number;
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  tokenCount?: number;
  modelName?: string;
}

const PHASE_INFO: Record<ThinkingPhase, { icon: string; label: string; color: string }> = {
  analyzing: { icon: '🔍', label: 'Analyzing', color: 'yellow' },
  planning: { icon: '📋', label: 'Planning', color: 'blue' },
  generating: { icon: '✨', label: 'Generating', color: 'magenta' },
  executing: { icon: '⚡', label: 'Executing', color: 'green' },
  validating: { icon: '✓', label: 'Validating', color: 'cyan' },
  tool_calling: { icon: '🔧', label: 'Tool Call', color: 'yellow' },
  waiting: { icon: '⏳', label: 'Waiting', color: 'gray' },
};

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  phase,
  startTime,
  currentStep,
  totalSteps,
  completedSteps,
  tokenCount,
  modelName,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Log component mount
  useEffect(() => {
    logger.enter('ThinkingIndicator', { phase, startTime });
    return () => {
      logger.exit('ThinkingIndicator', { phase, elapsedSeconds });
    };
  }, []);

  // Log phase changes
  useEffect(() => {
    logger.flow(`ThinkingIndicator phase changed: ${phase}`);
    logger.vars(
      { name: 'phase', value: phase },
      { name: 'currentStep', value: currentStep },
      { name: 'completedSteps', value: completedSteps },
      { name: 'totalSteps', value: totalSteps }
    );
  }, [phase, currentStep, completedSteps, totalSteps]);

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const phaseInfo = PHASE_INFO[phase];
  const progressPercent = totalSteps && completedSteps
    ? Math.round((completedSteps / totalSteps) * 100)
    : null;

  // Generate progress bar
  const renderProgressBar = () => {
    if (!totalSteps || !completedSteps) return null;

    const barWidth = 20;
    const filledWidth = Math.round((completedSteps / totalSteps) * barWidth);
    const emptyWidth = barWidth - filledWidth;

    return (
      <Text>
        <Text color="green">{'█'.repeat(filledWidth)}</Text>
        <Text color="gray">{'░'.repeat(emptyWidth)}</Text>
        <Text color="gray"> {progressPercent}%</Text>
      </Text>
    );
  };

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={phaseInfo.color as any}
      paddingX={1}
      paddingY={0}
    >
      {/* Header with phase and spinner */}
      <Box>
        <Text color={phaseInfo.color as any} bold>
          {phaseInfo.icon} <Spinner type="dots" /> {phaseInfo.label}
        </Text>
        <Text color="gray"> ({formatTime(elapsedSeconds)})</Text>
      </Box>

      {/* Current step info */}
      {currentStep && (
        <Box marginTop={0} paddingLeft={2}>
          <Text color="gray" dimColor>├─ {currentStep}</Text>
        </Box>
      )}

      {/* Progress bar */}
      {totalSteps && completedSteps !== undefined && (
        <Box marginTop={0} paddingLeft={2}>
          <Text color="gray" dimColor>└─ Step {completedSteps}/{totalSteps} </Text>
          {renderProgressBar()}
        </Box>
      )}

      {/* Footer with tokens and model */}
      <Box marginTop={0} justifyContent="space-between">
        <Box>
          {tokenCount !== undefined && (
            <Text color="gray" dimColor>
              Tokens: ~{tokenCount.toLocaleString()}
            </Text>
          )}
        </Box>
        <Box>
          {modelName && (
            <Text color="gray" dimColor>
              Model: {modelName}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ThinkingIndicator;
