/**
 * ChatView Component
 *
 * Renders the chat message history in the interactive mode
 * Features:
 * - Icons/emojis for message roles
 * - Markdown rendering with syntax highlighting
 * - Timestamps
 * - Message folding for long content
 * - Claude-style tool call display
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Message, ToolCall } from '../../../types/index.js';
import { logger } from '../../../utils/logger.js';
import { MarkdownRenderer } from '../MarkdownRenderer.js';

// Message role icons
const ROLE_ICONS = {
  user: '👤',
  assistant: '🤖',
  system: '⚙️',
  error: '❌',
  tool: '🔧',
};

// Role colors
const ROLE_COLORS = {
  user: 'green',
  assistant: 'cyan',
  system: 'gray',
  error: 'red',
  tool: 'yellow',
} as const;

interface ChatViewProps {
  messages: Message[];
  currentResponse?: string;
  maxDisplayMessages?: number;
  showTimestamps?: boolean;
  enableMarkdown?: boolean;
}


export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  currentResponse,
  maxDisplayMessages = 10,
  showTimestamps = false,
  enableMarkdown = true,
}) => {
  // Track message timestamps
  const [messagesMeta, setMessagesMeta] = useState<Map<number, { timestamp: Date; folded: boolean }>>(new Map());

  // Log component render
  useEffect(() => {
    logger.enter('ChatView', {
      messageCount: messages.length,
      hasCurrentResponse: !!currentResponse,
    });
    return () => {
      logger.exit('ChatView', { messageCount: messages.length });
    };
  }, []);

  // Update timestamps for new messages
  useEffect(() => {
    const newMeta = new Map(messagesMeta);
    messages.forEach((_, idx) => {
      if (!newMeta.has(idx)) {
        newMeta.set(idx, { timestamp: new Date(), folded: false });
      }
    });
    setMessagesMeta(newMeta);

    logger.debug('ChatView messages updated', {
      totalMessages: messages.length,
      displayedMessages: Math.min(messages.length, maxDisplayMessages),
    });
  }, [messages.length, maxDisplayMessages]);

  // Get icon and color based on message role
  const getMessageStyle = (role: string) => {
    switch (role) {
      case 'user':
        return { icon: ROLE_ICONS.user, color: ROLE_COLORS.user };
      case 'assistant':
        return { icon: ROLE_ICONS.assistant, color: ROLE_COLORS.assistant };
      case 'system':
        return { icon: ROLE_ICONS.system, color: ROLE_COLORS.system };
      case 'error':
        return { icon: ROLE_ICONS.error, color: ROLE_COLORS.error };
      case 'tool':
        return { icon: ROLE_ICONS.tool, color: ROLE_COLORS.tool };
      default:
        return { icon: '💬', color: 'white' as const };
    }
  };

  // Check if content should use markdown rendering
  const shouldRenderMarkdown = (content: string): boolean => {
    if (!enableMarkdown) return false;
    // Check for markdown patterns
    return content.includes('```') ||
           content.includes('**') ||
           content.includes('# ') ||
           content.includes('- ') ||
           content.includes('`');
  };

  // Tool icons (Claude Code style)
  const TOOL_ICONS: Record<string, string> = {
    'read_file': '📖',
    'Read': '📖',
    'create_file': '📝',
    'Create': '📝',
    'edit_file': '✏️',
    'Edit': '✏️',
    'search_files': '🔍',
    'Search': '🔍',
    'Grep': '🔍',
    'grep_search': '🔍',
    'list_files': '📁',
    'list_directory': '📁',
    'Glob': '📁',
    'find_files': '🔎',
    'execute_command': '⚡',
    'Bash': '⚡',
  };

  // Normalize tool name to display name
  const normalizeToolName = (name: string): string => {
    const nameMap: Record<string, string> = {
      'read_file': 'Read',
      'create_file': 'Create',
      'edit_file': 'Edit',
      'search_files': 'Search',
      'list_files': 'List',
      'list_directory': 'Glob',
      'find_files': 'Find',
      'execute_command': 'Bash',
      'grep_search': 'Grep',
    };
    return nameMap[name] || name;
  };

  // Get tool icon
  const getToolIcon = (toolName: string): string => {
    return TOOL_ICONS[toolName] || TOOL_ICONS[normalizeToolName(toolName)] || '🔧';
  };

  // Format tool arguments for display
  const formatToolArgs = (toolName: string, argsStr: string): string => {
    try {
      const args = JSON.parse(argsStr) as Record<string, unknown>;

      switch (toolName) {
        case 'read_file':
        case 'Read':
          return (args['path'] as string) || (args['file_path'] as string) || '';
        case 'create_file':
        case 'Create':
          return (args['path'] as string) || (args['file_path'] as string) || '';
        case 'edit_file':
        case 'Edit':
          return (args['path'] as string) || (args['file_path'] as string) || '';
        case 'search_files':
        case 'Search':
        case 'Grep':
        case 'grep_search': {
          const pattern = (args['pattern'] as string) || '';
          const glob = (args['glob'] as string) || (args['path'] as string) || '';
          return `pattern: "${pattern}"${glob ? `, glob: "${glob}"` : ''}`;
        }
        case 'list_files':
        case 'list_directory':
        case 'Glob':
          return (args['directory_path'] as string) || (args['pattern'] as string) || (args['path'] as string) || '.';
        case 'find_files':
        case 'Find':
          return (args['pattern'] as string) || '';
        case 'execute_command':
        case 'Bash': {
          const cmd = (args['command'] as string) || '';
          return cmd.length > 50 ? cmd.substring(0, 47) + '...' : cmd;
        }
        default: {
          const entries = Object.entries(args).slice(0, 2);
          return entries.map(([k, v]) => {
            const val = typeof v === 'string'
              ? (v.length > 30 ? v.substring(0, 27) + '...' : v)
              : JSON.stringify(v);
            return `${k}: ${val}`;
          }).join(', ');
        }
      }
    } catch {
      return argsStr.length > 50 ? argsStr.substring(0, 47) + '...' : argsStr;
    }
  };

  // Parse edit_file result to extract diff info
  interface EditResult {
    action: string;
    file: string;
    additions: number;
    deletions: number;
    message: string;
    diff?: string[];
  }

  interface CreateResult {
    action: string;
    file: string;
    lines: number;
    message: string;
  }

  // Format tool result summary
  const formatToolResultSummary = (toolName: string, result: string): string => {
    if (!result) return '';

    // Count lines for read operations
    if (toolName === 'read_file' || toolName === 'Read') {
      const lines = result.split('\n').length;
      return `Read ${lines} lines`;
    }

    // Count matches for search
    if (['search_files', 'Search', 'Grep', 'grep_search'].includes(toolName)) {
      const lines = result.split('\n').filter(l => l.trim()).length;
      return `Found ${lines} matches`;
    }

    // For create_file, parse JSON result
    if (['create_file', 'Create'].includes(toolName)) {
      try {
        const parsed = JSON.parse(result) as CreateResult;
        return `Created ${parsed.file} (${parsed.lines} lines)`;
      } catch {
        return result;
      }
    }

    // For edit_file, parse JSON result
    if (['edit_file', 'Edit'].includes(toolName)) {
      try {
        const parsed = JSON.parse(result) as EditResult;
        return parsed.message;
      } catch {
        return result;
      }
    }

    // For browser/office/bash tools, summarize if more than 3 lines
    if (toolName.startsWith('browser_') || toolName.startsWith('word_') ||
        toolName.startsWith('excel_') || toolName.startsWith('powerpoint_') ||
        toolName.startsWith('bash')) {
      const lines = result.split('\n');
      if (lines.length > 3) {
        const preview = lines.slice(0, 2).join('\n');
        return `${preview}\n... (${lines.length - 2} more lines)`;
      }
      return result;
    }

    // Default: show truncated first line
    const firstLine = result.split('\n')[0] || '';
    return firstLine.length > 60 ? firstLine.substring(0, 57) + '...' : firstLine;
  };

  // Parse and render diff from edit_file result
  const renderDiff = (result: string): React.ReactNode => {
    try {
      const parsed = JSON.parse(result) as EditResult;
      if (!parsed.diff || parsed.diff.length === 0) return null;

      return (
        <Box flexDirection="column" paddingLeft={4}>
          {parsed.diff.map((line, idx) => {
            // Parse line number and content
            const match = line.match(/^(\d+)\s*([+-])\s*(.*)$/);
            if (!match) return <Text key={idx} color="gray">{line}</Text>;

            const [, lineNumStr, sign, content] = match;
            const lineNum = lineNumStr || '';

            if (sign === '+') {
              return (
                <Box key={idx}>
                  <Text color="gray">{lineNum.padStart(4)} </Text>
                  <Text color="green">+ {content}</Text>
                </Box>
              );
            } else {
              return (
                <Box key={idx}>
                  <Text color="gray">{lineNum.padStart(4)} </Text>
                  <Text color="red">- {content}</Text>
                </Box>
              );
            }
          })}
        </Box>
      );
    } catch {
      return null;
    }
  };

  // Render tool calls in Claude style with icons
  const renderToolCalls = (toolCalls: ToolCall[], allMessages: Message[], reason?: string) => {
    return (
      <Box flexDirection="column" marginTop={0}>
        {/* Show reason if present (LLM's explanation before tool calls) */}
        {reason && (
          <Box marginBottom={0}>
            <Text color="gray">{reason}</Text>
          </Box>
        )}
        {toolCalls.map((tc, tcIdx) => {
          const displayName = normalizeToolName(tc.function.name);
          const toolIcon = getToolIcon(tc.function.name);
          const argsDisplay = formatToolArgs(tc.function.name, tc.function.arguments);
          const isEditTool = ['edit_file', 'Edit'].includes(tc.function.name);

          // Find corresponding tool result
          const toolResult = allMessages.find(
            m => m.role === 'tool' && m.tool_call_id === tc.id
          );
          const resultSummary = toolResult
            ? formatToolResultSummary(tc.function.name, toolResult.content)
            : '';

          return (
            <Box key={tc.id || tcIdx} flexDirection="column" marginBottom={0}>
              {/* Tool call header: 📖 Read(src/file.ts) */}
              <Box>
                <Text>{toolIcon} </Text>
                <Text color="cyan" bold>{displayName}</Text>
                <Text color="gray">(</Text>
                <Text color="white">{argsDisplay}</Text>
                <Text color="gray">)</Text>
              </Box>
              {/* Result summary: ⎿  Read 80 lines */}
              {resultSummary && (
                <Box paddingLeft={2}>
                  <Text color="gray">⎿  </Text>
                  <Text color="gray" dimColor>{resultSummary}</Text>
                </Box>
              )}
              {/* Show diff for edit_file */}
              {isEditTool && toolResult && renderDiff(toolResult.content)}
            </Box>
          );
        })}
      </Box>
    );
  };

  // Render message content
  const renderContent = (content: string, role: string, timestamp?: Date) => {
    if (role === 'assistant' && shouldRenderMarkdown(content)) {
      return (
        <MarkdownRenderer
          content={content}
          showTimestamp={showTimestamps}
          timestamp={timestamp}
        />
      );
    }

    return (
      <Box flexDirection="column">
        {showTimestamps && timestamp && (
          <Text color="gray" dimColor>
            {timestamp.toLocaleTimeString('ko-KR')}
          </Text>
        )}
        <Text>{content}</Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
      {/* Existing messages (filter out system and tool messages - they should not be visible to user) */}
      {messages.slice(-maxDisplayMessages)
        .filter((msg) => msg.role !== 'system' && msg.role !== 'tool')
        .map((msg, idx) => {
        const actualIdx = messages.length - maxDisplayMessages + idx;
        const style = getMessageStyle(msg.role);
        const isError = msg.role === 'error';
        const meta = messagesMeta.get(actualIdx >= 0 ? actualIdx : idx);
        const hasToolCalls = msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0;

        return (
          <Box key={idx} marginBottom={1} flexDirection="column">
            {/* Message header with icon */}
            <Box>
              <Text color={isError ? 'red' : style.color}>
                {isError ? ROLE_ICONS.error : style.icon}{' '}
              </Text>
              {msg.role === 'user' ? (
                // User messages: simple text
                <Text color={style.color}>{msg.content}</Text>
              ) : hasToolCalls ? (
                // Assistant message with tool calls - show reasoning + tool calls
                <Box flexDirection="column" flexGrow={1}>
                  {renderToolCalls(msg.tool_calls!, messages, msg.content || undefined)}
                </Box>
              ) : (
                // Assistant/other messages: potentially with markdown
                <Box flexDirection="column" flexGrow={1}>
                  {/* Render content if exists */}
                  {msg.content && renderContent(msg.content, msg.role, meta?.timestamp)}
                </Box>
              )}
            </Box>
          </Box>
        );
      })}


      {/* Current streaming response */}
      {currentResponse && (
        <Box flexDirection="column">
          <Box>
            <Text color="cyan">
              <Text>{ROLE_ICONS.assistant} </Text>
            </Text>
          </Box>
          <Box paddingLeft={2}>
            {shouldRenderMarkdown(currentResponse) ? (
              <MarkdownRenderer content={currentResponse} />
            ) : (
              <Text color="cyan">{currentResponse}</Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ChatView;
