/**
 * ChatView Component
 *
 * Renders the chat message history in the interactive mode
 * Features:
 * - Icons/emojis for message roles
 * - Markdown rendering with syntax highlighting
 * - Timestamps
 * - Message folding for long content
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Message } from '../../../types/index.js';
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
  pendingUserMessage?: string;
  maxDisplayMessages?: number;
  showTimestamps?: boolean;
  enableMarkdown?: boolean;
}


export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  currentResponse,
  pendingUserMessage,
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
      hasPendingMessage: !!pendingUserMessage,
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
      {/* Existing messages */}
      {messages.slice(-maxDisplayMessages).map((msg, idx) => {
        const actualIdx = messages.length - maxDisplayMessages + idx;
        const style = getMessageStyle(msg.role);
        const isError = msg.role === 'error';
        const meta = messagesMeta.get(actualIdx >= 0 ? actualIdx : idx);

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
              ) : (
                // Assistant/other messages: potentially with markdown
                <Box flexDirection="column" flexGrow={1}>
                  {renderContent(msg.content, msg.role, meta?.timestamp)}
                </Box>
              )}
            </Box>
          </Box>
        );
      })}

      {/* Pending user message (shown immediately after Enter) */}
      {pendingUserMessage && (
        <Box marginBottom={1}>
          <Text color="green">
            <Text>{ROLE_ICONS.user} </Text>
            <Text>{pendingUserMessage}</Text>
          </Text>
        </Box>
      )}

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
