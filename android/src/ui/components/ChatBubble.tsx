/**
 * ChatBubble Component
 *
 * 감동적인 채팅 버블 — 유저/어시스턴트 메시지 렌더링
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import type { Message } from '../../types';

interface ChatBubbleProps {
  message: Message;
  isLatest?: boolean;
}

function ChatBubbleInner({ message, isLatest }: ChatBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  const handleLongPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(message.content);
  };

  const bubbleStyle = isUser
    ? {
        backgroundColor: colors.userBubble,
        borderBottomRightRadius: 4,
      }
    : isError
    ? {
        backgroundColor: colors.error + '20',
        borderBottomLeftRadius: 4,
        borderColor: colors.error + '40',
        borderWidth: 1,
      }
    : {
        backgroundColor: colors.assistantBubble,
        borderBottomLeftRadius: 4,
      };

  const textColor = isUser
    ? colors.userBubbleText
    : isError
    ? colors.error
    : colors.assistantBubbleText;

  return (
    <Animated.View
      entering={isLatest ? FadeInUp.duration(300).springify() : FadeIn.duration(150)}
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
    >
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.primaryGlow }]}>
          <Ionicons
            name={isError ? 'alert-circle' : 'sparkles'}
            size={16}
            color={isError ? colors.error : colors.primary}
          />
        </View>
      )}

      <Pressable
        onLongPress={handleLongPress}
        style={[styles.bubble, bubbleStyle]}
      >
        <Text style={[styles.messageText, { color: textColor }]}>
          {message.content}
        </Text>

        {message.tool_calls && message.tool_calls.length > 0 && (
          <View style={[styles.toolCallsContainer, { borderTopColor: colors.border }]}>
            {message.tool_calls.map((tc, idx) => (
              <View key={tc.id || idx} style={[styles.toolCall, { backgroundColor: colors.toolBackground }]}>
                <Ionicons name="code-slash" size={12} color={colors.toolIcon} />
                <Text style={[styles.toolCallText, { color: colors.textSecondary }]}>
                  {tc.function.name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>

      {isUser && (
        <View style={[styles.avatar, styles.userAvatar, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="person" size={16} color={colors.primary} />
        </View>
      )}
    </Animated.View>
  );
}

export default memo(ChatBubbleInner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    marginHorizontal: 12,
    alignItems: 'flex-end',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  assistantContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  userAvatar: {
    marginLeft: 8,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  toolCallsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 4,
  },
  toolCall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  toolCallText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
