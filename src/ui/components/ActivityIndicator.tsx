/**
 * ActivityIndicator Component
 *
 * Unified component for displaying various AI activities:
 * - Thinking/Generating
 * - Local RAG (docs search)
 * - Tool execution (file read/write, etc.)
 * - Planning/Executing
 * - Token usage and performance metrics
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { logger } from '../../utils/logger.js';
import { useTerminalWidth, clampText } from '../hooks/useTerminalWidth.js';

// Activity types
export type ActivityType =
  | 'thinking'
  | 'planning'
  | 'executing'
  | 'docs_search'
  | 'file_read'
  | 'file_write'
  | 'file_search'
  | 'tool_call'
  | 'validating'
  | 'waiting';

// Activity details for display
interface ActivityInfo {
  icon: string;
  label: string;
  color: string;
  spinnerType: 'dots' | 'line' | 'pipe' | 'star';
}

const ACTIVITY_INFO: Record<ActivityType, ActivityInfo> = {
  thinking: { icon: '💭', label: 'Thinking', color: 'magenta', spinnerType: 'dots' },
  planning: { icon: '💭', label: 'Thinking', color: 'blue', spinnerType: 'dots' },
  executing: { icon: '⚡', label: 'Executing', color: 'green', spinnerType: 'line' },
  docs_search: { icon: '📚', label: 'Searching docs', color: 'yellow', spinnerType: 'dots' },
  file_read: { icon: '📖', label: 'Reading file', color: 'cyan', spinnerType: 'pipe' },
  file_write: { icon: '✏️', label: 'Writing file', color: 'green', spinnerType: 'pipe' },
  file_search: { icon: '🔍', label: 'Searching files', color: 'yellow', spinnerType: 'dots' },
  tool_call: { icon: '🔧', label: 'Tool call', color: 'yellow', spinnerType: 'star' },
  validating: { icon: '✓', label: 'Validating', color: 'cyan', spinnerType: 'dots' },
  waiting: { icon: '⏳', label: 'Waiting', color: 'gray', spinnerType: 'dots' },
};

// Sub-activity for nested display
export interface SubActivity {
  type: ActivityType;
  detail?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

interface ActivityIndicatorProps {
  activity: ActivityType;
  startTime: number;
  detail?: string;
  subActivities?: SubActivity[];
  // Token metrics
  tokenCount?: number;
  tokensPerSecond?: number;
  promptTokens?: number;
  completionTokens?: number;
  // Model info
  modelName?: string;
  // For planning/executing
  currentStep?: number;
  totalSteps?: number;
  stepName?: string;
  // Latency
  latencyMs?: number;
}

/**
 * Format token count for display
 */
function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(2)}M`;
}

/**
 * Mini progress bar component
 */
const MiniProgressBar: React.FC<{ value: number; max: number; width?: number; color?: string }> = ({
  value,
  max,
  width = 10,
  color = 'green',
}) => {
  const filled = Math.min(Math.round((value / max) * width), width);
  const empty = width - filled;

  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
    </Text>
  );
};

export const ActivityIndicator: React.FC<ActivityIndicatorProps> = ({
  activity,
  startTime,
  detail,
  subActivities = [],
  tokenCount,
  tokensPerSecond,
  currentStep,
  totalSteps,
  stepName,
}) => {
  const termWidth = useTerminalWidth();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Log component lifecycle
  useEffect(() => {
    logger.enter('ActivityIndicator', { activity, startTime });
    return () => {
      logger.exit('ActivityIndicator', { activity, elapsedSeconds });
    };
  }, []);

  // Log activity changes
  useEffect(() => {
    logger.flow(`Activity changed: ${activity}`);
    logger.vars(
      { name: 'activity', value: activity },
      { name: 'detail', value: detail },
      { name: 'subActivitiesCount', value: subActivities.length }
    );
  }, [activity, detail, subActivities.length]);

  // Update elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const activityInfo = ACTIVITY_INFO[activity];

  // Format time display
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Render progress bar for planning/executing
  const renderProgressBar = () => {
    if (!totalSteps || currentStep === undefined) return null;
    const percent = Math.round((currentStep / totalSteps) * 100);

    return (
      <Box marginLeft={1}>
        <MiniProgressBar value={currentStep} max={totalSteps} width={15} color="green" />
        <Text color="gray"> {percent}%</Text>
      </Box>
    );
  };

  // Render sub-activity status icon
  const getStatusIcon = (status: SubActivity['status']) => {
    switch (status) {
      case 'pending': return <Text color="gray">○</Text>;
      case 'running': return <Text color="yellow"><Spinner type="dots" /></Text>;
      case 'done': return <Text color="green">✓</Text>;
      case 'error': return <Text color="red">✗</Text>;
    }
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Main activity header - minimal Notion style */}
      <Box>
        <Text color="blueBright">
          <Spinner type={activityInfo.spinnerType} />
        </Text>
        <Text color="white" bold> {activityInfo.label}</Text>
        <Text color="gray" dimColor> {formatTime(elapsedSeconds)}</Text>
        {renderProgressBar()}
      </Box>

      {/* Detail line */}
      {detail && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>{clampText(detail, Math.max(20, termWidth - 4))}</Text>
        </Box>
      )}

      {/* Step info for planning/executing */}
      {stepName && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>{currentStep}/{totalSteps}: {clampText(stepName, Math.max(20, termWidth - 12))}</Text>
        </Box>
      )}

      {/* Sub-activities (e.g., tool calls during thinking) */}
      {subActivities.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {subActivities.map((sub, idx) => {
            const subInfo = ACTIVITY_INFO[sub.type];
            return (
              <Box key={idx}>
                {getStatusIcon(sub.status)}
                <Text color="gray" dimColor> {subInfo.label}</Text>
                {sub.detail && <Text color="gray" dimColor>: {clampText(sub.detail, Math.max(20, termWidth - 16))}</Text>}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Token metrics - simplified */}
      {tokenCount !== undefined && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            {formatTokens(tokenCount)} tokens
            {tokensPerSecond !== undefined && tokensPerSecond > 0 && ` · ${tokensPerSecond.toFixed(0)} tok/s`}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ActivityIndicator;
