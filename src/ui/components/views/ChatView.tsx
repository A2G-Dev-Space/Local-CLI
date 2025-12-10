/**
 * ChatView Component
 *
 * Renders the chat message history in the interactive mode
 * Uses icons/emojis instead of "You:" / "AI:" labels
 */

import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import { Message } from '../../../types/index.js';
import { logger } from '../../../utils/logger.js';

// Message role icons
const ROLE_ICONS = {
  user: '👤',
  assistant: '🤖',
  system: '⚙️',
  error: '❌',
  tool: '🔧',
};

interface ChatViewProps {
  messages: Message[];
  currentResponse?: string;
  pendingUserMessage?: string;
  maxDisplayMessages?: number;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  currentResponse,
  pendingUserMessage,
  maxDisplayMessages = 10,
}) => {
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

  // Log when messages change
  useEffect(() => {
    logger.debug('ChatView messages updated', {
      totalMessages: messages.length,
      displayedMessages: Math.min(messages.length, maxDisplayMessages),
    });
  }, [messages.length, maxDisplayMessages]);

  // Get icon and color based on message role
  const getMessageStyle = (role: string) => {
    switch (role) {
      case 'user':
        return { icon: ROLE_ICONS.user, color: 'green' as const };
      case 'assistant':
        return { icon: ROLE_ICONS.assistant, color: 'cyan' as const };
      case 'system':
        return { icon: ROLE_ICONS.system, color: 'gray' as const };
      default:
        return { icon: '💬', color: 'white' as const };
    }
  };

  // Check if message contains error
  const isErrorMessage = (content: string) => {
    return content.includes('❌') ||
           content.toLowerCase().includes('error') ||
           content.toLowerCase().includes('failed');
  };

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
      {/* Existing messages */}
      {messages.slice(-maxDisplayMessages).map((msg, idx) => {
        const style = getMessageStyle(msg.role);
        const isError = msg.role === 'assistant' && isErrorMessage(msg.content);

        return (
          <Box key={idx} marginBottom={1}>
            <Box>
              <Text color={isError ? 'red' : style.color}>
                <Text>{isError ? ROLE_ICONS.error : style.icon} </Text>
                <Text>{msg.content}</Text>
              </Text>
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
        <Box>
          <Text color="cyan">
            <Text>{ROLE_ICONS.assistant} </Text>
            <Text>{currentResponse}</Text>
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ChatView;
