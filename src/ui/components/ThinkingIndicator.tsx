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
  planning: { icon: '💭', label: 'Thinking', color: 'blue' },
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

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Main indicator - minimal Notion style */}
      <Box>
        <Text color="blueBright">
          <Spinner type="dots" />
        </Text>
        <Text color="white" bold> {phaseInfo.label}</Text>
        <Text color="gray" dimColor> {formatTime(elapsedSeconds)}</Text>
      </Box>

      {/* Current step info */}
      {currentStep && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>{currentStep}</Text>
        </Box>
      )}

      {/* Progress bar */}
      {totalSteps && completedSteps !== undefined && (
        <Box marginLeft={2}>
          <Text color="greenBright">{'▓'.repeat(Math.round((completedSteps / totalSteps) * 15))}</Text>
          <Text color="gray" dimColor>{'░'.repeat(15 - Math.round((completedSteps / totalSteps) * 15))}</Text>
          <Text color="gray" dimColor> {completedSteps}/{totalSteps}</Text>
        </Box>
      )}
    </Box>
  );
};

export default ThinkingIndicator;
