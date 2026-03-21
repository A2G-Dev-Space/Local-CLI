/**
 * ChatBubble — 세계 최고 수준의 채팅 버블
 *
 * 아바타 제거 → 가로 공간 극대화 (모바일 핵심)
 * 유저: 오른쪽 정렬 + 그라디언트 배경
 * 어시스턴트: 왼쪽 정렬 + 풀폭 활용 + 미니멀 배경
 * 에러: 왼쪽 인라인 아이콘
 * 롱프레스 → 스케일 + 햅틱 + 클립보드
 */

import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Message } from '../../types';

interface ChatBubbleProps {
  message: Message;
  isLatest?: boolean;
  isConsecutive?: boolean;
}

function ChatBubbleInner({ message, isLatest, isConsecutive }: ChatBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const isError = message.role === 'error';
  const isTool = message.role === 'tool';

  const scale = useSharedValue(1);
  const copied = useSharedValue(0);

  const longPress = Gesture.LongPress()
    .minDuration(350)
    .onStart(() => {
      scale.value = withSequence(
        withSpring(0.95),
        withSpring(1, { damping: 12 })
      );
      copied.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(1, { duration: 800 }),
        withTiming(0, { duration: 300 })
      );
    });

  const handleLongPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(message.content);
  }, [message.content]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const copiedStyle = useAnimatedStyle(() => ({
    opacity: copied.value,
    transform: [{ translateY: -20 * copied.value }],
  }));

  // 어시스턴트 메시지: 풀폭, 미니멀, 좌측 accent bar
  if (!isUser && !isError) {
    return (
      <Animated.View
        entering={isLatest ? FadeInDown.duration(250).springify().damping(18) : FadeIn.duration(100)}
        style={[styles.assistantRow, isConsecutive && styles.consecutiveRow]}
      >
        <GestureDetector gesture={longPress}>
          <Animated.View
            style={[styles.assistantBubble, animStyle]}
            onTouchEnd={handleLongPress}
          >
            <View style={[styles.accentBar, { backgroundColor: colors.primary + '60' }]} />
            <View style={styles.assistantContent}>
              <Text
                style={[styles.assistantText, { color: colors.text }]}
                selectable
              >
                {message.content}
              </Text>

              {message.tool_calls && message.tool_calls.length > 0 && (
                <View style={styles.toolCalls}>
                  {message.tool_calls.map((tc, idx) => (
                    <View key={tc.id || idx} style={[styles.toolChip, { backgroundColor: colors.toolBackground, borderColor: colors.toolBorder }]}>
                      <Ionicons name="terminal-outline" size={10} color={colors.toolIcon} />
                      <Text style={[styles.toolChipText, { color: colors.toolIcon }]}>
                        {tc.function.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Copied tooltip */}
            <Animated.View style={[styles.copiedBadge, copiedStyle]}>
              <Text style={styles.copiedText}>Copied</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    );
  }

  // 에러 메시지: 인라인 아이콘
  if (isError) {
    return (
      <Animated.View entering={FadeInDown.duration(200)} style={styles.errorRow}>
        <View style={[styles.errorBubble, { backgroundColor: colors.error + '12', borderColor: colors.error + '30' }]}>
          <Ionicons name="warning" size={13} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]} numberOfLines={3}>
            {message.content}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // 유저 메시지: 오른쪽, 그라디언트
  return (
    <Animated.View
      entering={isLatest ? FadeInDown.duration(250).springify().damping(18) : FadeIn.duration(100)}
      style={[styles.userRow, isConsecutive && styles.consecutiveRow]}
    >
      <GestureDetector gesture={longPress}>
        <Animated.View style={animStyle} onTouchEnd={handleLongPress}>
          <View style={[styles.userBubble, { backgroundColor: colors.userBubble }]}>
            <Text style={[styles.userText, { color: colors.userBubbleText }]}>
              {message.content}
            </Text>
          </View>
          <Animated.View style={[styles.copiedBadge, styles.copiedBadgeRight, copiedStyle]}>
            <Text style={styles.copiedText}>Copied</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export default memo(ChatBubbleInner);

const styles = StyleSheet.create({
  // 어시스턴트
  assistantRow: {
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  assistantBubble: {
    flexDirection: 'row',
    position: 'relative',
  },
  accentBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 10,
    minHeight: 16,
  },
  assistantContent: {
    flex: 1,
    paddingVertical: 2,
  },
  assistantText: {
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  toolCalls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    gap: 4,
  },
  toolChipText: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  // 유저
  userRow: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    alignItems: 'flex-end',
  },
  userBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  userText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // 에러
  errorRow: {
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  errorBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 0.5,
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  // 연속 메시지일 때 간격 축소
  consecutiveRow: {
    paddingVertical: 1,
  },
  // 복사 알림
  copiedBadge: {
    position: 'absolute',
    top: -8,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  copiedBadgeRight: {
    left: undefined,
    right: 16,
  },
  copiedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
