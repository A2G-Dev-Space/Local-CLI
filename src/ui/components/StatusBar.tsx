/**
 * StatusBar Component
 *
 * Bottom status bar showing:
 * - Session info (message count, token total)
 * - Context usage bar
 * - Current time
 * - Keyboard shortcuts
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { logger } from '../../utils/logger.js';

export interface StatusBarProps {
  // Model and endpoint
  model?: string;
  endpoint?: string;
  // Status
  status?: 'idle' | 'thinking' | 'executing' | 'error';
  message?: string;
  // Session info
  messageCount?: number;
  sessionTokens?: number;
  // Context usage
  contextUsage?: {
    current: number;
    max: number;
  };
  // TODO status
  todoCount?: number;
  todoCompleted?: number;
  // Planning mode
  planningMode?: string;
  // Health status
  healthStatus?: 'healthy' | 'unhealthy' | 'checking' | 'unknown';
}

/**
 * Format token count
 */
function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(2)}M`;
}

/**
 * Clock component with live time
 */
const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Text color="gray">
      {time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
    </Text>
  );
};

/**
 * Context usage mini bar
 */
const ContextMiniBar: React.FC<{ current: number; max: number }> = ({ current, max }) => {
  const percentage = Math.min(Math.round((current / max) * 100), 100);
  const barWidth = 8;
  const filled = Math.round((percentage / 100) * barWidth);
  const empty = barWidth - filled;

  // Color based on usage
  let color: string;
  if (percentage < 50) color = 'green';
  else if (percentage < 75) color = 'yellow';
  else if (percentage < 90) color = 'red';
  else color = 'redBright';

  return (
    <Box>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
      <Text color={color}> {percentage}%</Text>
    </Box>
  );
};

export const StatusBar: React.FC<StatusBarProps> = ({
  model,
  endpoint: _endpoint,
  status = 'idle',
  message: _message,
  messageCount = 0,
  sessionTokens = 0,
  contextUsage,
  todoCount,
  todoCompleted,
  planningMode,
  healthStatus,
}) => {
  // endpoint and message reserved for future enhanced display
  void _endpoint;
  void _message;
  useEffect(() => {
    logger.debug('StatusBar rendered', {
      status,
      messageCount,
      sessionTokens,
    });
  }, [status, messageCount, sessionTokens]);

  // Health indicator
  const getHealthIcon = () => {
    switch (healthStatus) {
      case 'healthy': return <Text color="green">●</Text>;
      case 'unhealthy': return <Text color="red">●</Text>;
      case 'checking': return <Text color="yellow">◐</Text>;
      default: return <Text color="gray">○</Text>;
    }
  };

  // Status indicator
  const getStatusIndicator = () => {
    switch (status) {
      case 'thinking':
        return <Text color="yellow">● THINK</Text>;
      case 'executing':
        return <Text color="green">● EXEC</Text>;
      case 'error':
        return <Text color="red">● ERR</Text>;
      default:
        return <Text color="gray">○ IDLE</Text>;
    }
  };

  return (
    <Box justifyContent="space-between" paddingX={1}>
      {/* Left section: Health, Status, Model */}
      <Box>
        {getHealthIcon()}
        <Text> </Text>
        {getStatusIndicator()}

        {/* Model name */}
        {model && (
          <>
            <Text color="gray"> | </Text>
            <Text color="cyan">{model.slice(0, 15)}</Text>
          </>
        )}

        {/* Planning mode */}
        {planningMode && (
          <Text color="gray" dimColor> [{planningMode}]</Text>
        )}
      </Box>

      {/* Center section: Stats */}
      <Box>
        {/* Message count */}
        {messageCount > 0 && (
          <Box marginRight={2}>
            <Text color="gray">💬 {messageCount}</Text>
          </Box>
        )}

        {/* Session tokens */}
        {sessionTokens > 0 && (
          <Box marginRight={2}>
            <Text color="cyan">⚡ {formatTokens(sessionTokens)}</Text>
          </Box>
        )}

        {/* Context usage */}
        {contextUsage && contextUsage.current > 0 && (
          <Box marginRight={2}>
            <Text color="gray">CTX </Text>
            <ContextMiniBar current={contextUsage.current} max={contextUsage.max} />
          </Box>
        )}

        {/* TODO mini status */}
        {todoCount !== undefined && todoCount > 0 && (
          <Box>
            <Text color="gray">TODO </Text>
            <Text color="green">{todoCompleted || 0}</Text>
            <Text color="gray">/{todoCount}</Text>
          </Box>
        )}
      </Box>

      {/* Right section: Shortcuts and time */}
      <Box>
        <Text color="gray" dimColor>
          /help
        </Text>
        <Text color="gray"> | </Text>
        <Clock />
      </Box>
    </Box>
  );
};

export default StatusBar;
