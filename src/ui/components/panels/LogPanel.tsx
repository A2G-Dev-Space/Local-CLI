/**
 * Log Browser Component for CLI
 *
 * Displays session logs with interactive selection and content viewing
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { readFile, readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { PROJECTS_DIR } from '../../../constants.js';
import { getStreamLogger } from '../../../utils/json-stream-logger.js';
import type { StreamLogEntry } from '../../../utils/json-stream-logger.js';

interface LogBrowserProps {
  onClose: () => void;
}

type LogSource = 'current' | 'list' | 'content';

interface LogFile {
  name: string;
  path: string;
  size: number;
  modifiedAt: number;
}

const MAX_LOG_LINES = 50;
const LOG_LEVEL_COLORS: Record<string, string> = {
  error: 'red',
  tool_error: 'red',
  tool_start: 'cyan',
  tool_end: 'green',
  assistant_response: 'blue',
  user_input: 'yellow',
  planning_start: 'magenta',
  planning_end: 'magenta',
  info: 'gray',
  debug: 'gray',
};

export const LogBrowser: React.FC<LogBrowserProps> = ({ onClose }) => {
  const [logSource, setLogSource] = useState<LogSource>('current');
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<StreamLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Get current working directory log path
  const getCurrentLogDir = useCallback(() => {
    const cwd = process.cwd();
    const safeCwd = cwd.replace(/[/\\:]/g, '-').replace(/^-/, '');
    return join(PROJECTS_DIR, safeCwd);
  }, []);

  // Load log files list
  const loadLogFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const logDir = getCurrentLogDir();
      const files = await readdir(logDir);
      const logFileList: LogFile[] = [];

      for (const file of files) {
        if (file.endsWith('_log.json')) {
          const filePath = join(logDir, file);
          const stats = await stat(filePath);
          logFileList.push({
            name: file,
            path: filePath,
            size: stats.size,
            modifiedAt: stats.mtimeMs,
          });
        }
      }

      // Sort by modified time (newest first)
      logFileList.sort((a, b) => b.modifiedAt - a.modifiedAt);
      setLogFiles(logFileList);
    } catch (err) {
      setError(`Failed to load log files: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [getCurrentLogDir]);

  // Load log content from file
  const loadLogContent = useCallback(async (filePath: string, isCurrentSession = false) => {
    setLoading(true);
    setError(null);
    try {
      let content = await readFile(filePath, 'utf-8');

      // For current session, the file might not have closing bracket yet
      // because the logger is still writing to it
      if (isCurrentSession) {
        const trimmed = content.trimEnd();
        if (!trimmed.endsWith(']')) {
          // Add closing bracket to make valid JSON
          content = trimmed + '\n]';
        }
      }

      // Parse JSON array
      const entries: StreamLogEntry[] = JSON.parse(content);
      setLogEntries(entries);
      setScrollOffset(Math.max(0, entries.length - MAX_LOG_LINES));
    } catch (err) {
      setError(`Failed to load log: ${err instanceof Error ? err.message : String(err)}`);
      setLogEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load current session log
  const loadCurrentSessionLog = useCallback(async () => {
    const streamLogger = getStreamLogger();
    if (!streamLogger) {
      setError('No active session log');
      return;
    }

    const logPath = streamLogger.getFilePath();
    if (!logPath) {
      setError('Session log path not available');
      return;
    }

    await loadLogContent(logPath, true);
  }, [loadLogContent]);

  // Initial load
  useEffect(() => {
    if (logSource === 'current') {
      loadCurrentSessionLog();
    } else if (logSource === 'list') {
      loadLogFiles();
    }
  }, [logSource, loadCurrentSessionLog, loadLogFiles]);

  // Handle keyboard input
  useInput((inputChar, key) => {
    if (key.escape) {
      if (logSource === 'content') {
        setLogSource('list');
        setLogEntries([]);
      } else {
        onClose();
      }
      return;
    }

    // Tab to switch between current/list
    if (key.tab && logSource !== 'content') {
      setLogSource(logSource === 'current' ? 'list' : 'current');
      return;
    }

    // Scroll in content view
    if (logSource === 'current' || logSource === 'content') {
      if (key.upArrow || inputChar === 'k') {
        setScrollOffset(prev => Math.max(0, prev - 1));
      } else if (key.downArrow || inputChar === 'j') {
        setScrollOffset(prev => Math.min(Math.max(0, logEntries.length - MAX_LOG_LINES), prev + 1));
      } else if (inputChar === 'g') {
        setScrollOffset(0);
      } else if (inputChar === 'G') {
        setScrollOffset(Math.max(0, logEntries.length - MAX_LOG_LINES));
      }
    }
  });

  // Handle log file selection
  const handleFileSelect = (item: { label: string; value: string }) => {
    setSelectedFile(item.value);
    setLogSource('content');
    loadLogContent(item.value);
  };

  // Format timestamp
  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // Render log entry
  const renderLogEntry = (entry: StreamLogEntry, index: number) => {
    const color = LOG_LEVEL_COLORS[entry.type] || 'white';
    const time = formatTimestamp(entry.timestamp);
    const typeLabel = entry.type.replace(/_/g, ' ').toUpperCase().padEnd(12);
    const content = entry.content.length > 80
      ? entry.content.substring(0, 77) + '...'
      : entry.content;

    return (
      <Box key={index} flexDirection="row">
        <Text color="gray" dimColor>{time} </Text>
        <Text color={color}>[{typeLabel}] </Text>
        <Text>{content}</Text>
      </Box>
    );
  };

  // Visible entries
  const visibleEntries = logEntries.slice(scrollOffset, scrollOffset + MAX_LOG_LINES);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>Log Browser</Text>
        <Text color="gray"> - </Text>
        <Text
          color={logSource === 'current' ? 'cyan' : 'gray'}
          bold={logSource === 'current'}
        >
          [Current]
        </Text>
        <Text color="gray"> / </Text>
        <Text
          color={logSource === 'list' || logSource === 'content' ? 'cyan' : 'gray'}
          bold={logSource === 'list' || logSource === 'content'}
        >
          [All Logs]
        </Text>
        <Text color="gray" dimColor>  (Tab: switch, ESC: close)</Text>
      </Box>

      {/* Loading state */}
      {loading && (
        <Text color="yellow">Loading...</Text>
      )}

      {/* Error state */}
      {error && (
        <Text color="red">{error}</Text>
      )}

      {/* Log file list view */}
      {logSource === 'list' && !loading && !error && (
        <>
          {logFiles.length === 0 ? (
            <Text color="yellow">No log files found</Text>
          ) : (
            <SelectInput
              items={logFiles.map(file => ({
                label: `${file.name} (${formatSize(file.size)}) - ${new Date(file.modifiedAt).toLocaleString()}`,
                value: file.path,
              }))}
              onSelect={handleFileSelect}
              limit={10}
            />
          )}
        </>
      )}

      {/* Current session log or content view */}
      {(logSource === 'current' || logSource === 'content') && !loading && !error && (
        <>
          {logEntries.length === 0 ? (
            <Text color="yellow">No log entries</Text>
          ) : (
            <>
              <Box flexDirection="column" height={MAX_LOG_LINES}>
                {visibleEntries.map((entry, idx) => renderLogEntry(entry, idx))}
              </Box>
              <Box marginTop={1}>
                <Text color="gray" dimColor>
                  Showing {scrollOffset + 1}-{Math.min(scrollOffset + MAX_LOG_LINES, logEntries.length)} of {logEntries.length} entries
                  {' '}(↑↓/jk: scroll, g/G: top/bottom)
                </Text>
              </Box>
            </>
          )}
        </>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>
          {logSource === 'current' && 'Current session log'}
          {logSource === 'list' && 'Select a log file to view'}
          {logSource === 'content' && selectedFile && `Viewing: ${basename(selectedFile)}`}
        </Text>
      </Box>
    </Box>
  );
};
