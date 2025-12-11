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
  planning: { icon: '📋', label: 'Planning', color: 'blue', spinnerType: 'dots' },
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
  promptTokens,
  completionTokens,
  modelName,
  currentStep,
  totalSteps,
  stepName,
  latencyMs,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [animFrame, setAnimFrame] = useState(0);

  // Animation frames for token counter
  const tokenAnimFrames = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

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

  // Update elapsed time and animation
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      setAnimFrame(prev => (prev + 1) % tokenAnimFrames.length);
    }, 100);
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

  // Render token metrics
  const renderTokenMetrics = () => {
    const hasTokens = tokenCount !== undefined || promptTokens !== undefined || completionTokens !== undefined;
    if (!hasTokens && !tokensPerSecond && !latencyMs) return null;

    return (
      <Box marginTop={0} flexDirection="row" gap={2}>
        {/* Token count with animation */}
        {tokenCount !== undefined && (
          <Box>
            <Text color="cyan">
              <Text color="cyan">{tokenAnimFrames[animFrame]}</Text>
              {' '}Tokens: {formatTokens(tokenCount)}
            </Text>
          </Box>
        )}

        {/* Prompt/Completion breakdown */}
        {promptTokens !== undefined && completionTokens !== undefined && (
          <Box>
            <Text color="gray" dimColor>
              (↑{formatTokens(promptTokens)} ↓{formatTokens(completionTokens)})
            </Text>
          </Box>
        )}

        {/* Tokens per second */}
        {tokensPerSecond !== undefined && tokensPerSecond > 0 && (
          <Box>
            <Text color="yellow">
              ⚡ {tokensPerSecond.toFixed(1)} tok/s
            </Text>
          </Box>
        )}

        {/* Latency */}
        {latencyMs !== undefined && (
          <Box>
            <Text color={latencyMs > 1000 ? 'red' : latencyMs > 500 ? 'yellow' : 'green'}>
              📡 {latencyMs}ms
            </Text>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={activityInfo.color as any}
      paddingX={1}
    >
      {/* Main activity header */}
      <Box>
        <Text color={activityInfo.color as any} bold>
          {activityInfo.icon}{' '}
          <Spinner type={activityInfo.spinnerType} />{' '}
          {activityInfo.label}
        </Text>
        <Text color="gray"> ({formatTime(elapsedSeconds)})</Text>
        {renderProgressBar()}
      </Box>

      {/* Detail line */}
      {detail && (
        <Box paddingLeft={2}>
          <Text color="gray" dimColor>
            └─ {detail}
          </Text>
        </Box>
      )}

      {/* Step info for planning/executing */}
      {stepName && (
        <Box paddingLeft={2}>
          <Text color="gray" dimColor>
            └─ {currentStep}/{totalSteps}: {stepName}
          </Text>
        </Box>
      )}

      {/* Sub-activities (e.g., tool calls during thinking) */}
      {subActivities.length > 0 && (
        <Box flexDirection="column" paddingLeft={2} marginTop={0}>
          {subActivities.map((sub, idx) => {
            const subInfo = ACTIVITY_INFO[sub.type];
            const isLast = idx === subActivities.length - 1;
            const prefix = isLast ? '└─' : '├─';

            return (
              <Box key={idx}>
                <Text color="gray" dimColor>
                  {prefix} {getStatusIcon(sub.status)} {subInfo.icon} {subInfo.label}
                  {sub.detail && `: ${sub.detail}`}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Token metrics */}
      {renderTokenMetrics()}

      {/* Footer with model name */}
      {modelName && (
        <Box marginTop={0} justifyContent="flex-end">
          <Text color="gray" dimColor>
            {modelName}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ActivityIndicator;
