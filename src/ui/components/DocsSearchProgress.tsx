/**
 * Docs Search Progress Component
 *
 * Shows real-time progress of documentation search in the chat area.
 * Displays up to 8 most recent log lines.
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export interface DocsSearchLog {
  type: 'command' | 'file' | 'info' | 'result';
  message: string;
  timestamp: number;
}

interface DocsSearchProgressProps {
  logs: DocsSearchLog[];
  isSearching: boolean;
}

/**
 * Format log entry with appropriate icon
 */
function formatLogEntry(log: DocsSearchLog): { icon: string; color: string } {
  switch (log.type) {
    case 'command':
      return { icon: '⚡', color: 'yellow' };
    case 'file':
      return { icon: '📄', color: 'cyan' };
    case 'result':
      return { icon: '✓', color: 'green' };
    case 'info':
    default:
      return { icon: '→', color: 'gray' };
  }
}

export const DocsSearchProgress: React.FC<DocsSearchProgressProps> = ({
  logs,
  isSearching,
}) => {
  // Show only last 8 logs
  const visibleLogs = logs.slice(-8);

  if (!isSearching && logs.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={1}>
      {/* Header */}
      <Box>
        {isSearching ? (
          <>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text color="yellow" bold> 📚 Searching Local Documents...</Text>
          </>
        ) : (
          <Text color="green" bold>📚 Document Search Complete</Text>
        )}
      </Box>

      {/* Progress logs */}
      <Box flexDirection="column" paddingLeft={2} marginTop={0}>
        {visibleLogs.map((log, index) => {
          const { icon, color } = formatLogEntry(log);
          return (
            <Box key={`${log.timestamp}-${index}`}>
              <Text color={color}>{icon} </Text>
              <Text color={color} dimColor={log.type === 'info'}>
                {log.message}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default DocsSearchProgress;
