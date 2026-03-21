/**
 * ChatBubble — iMessage-level quality
 *
 * - 유저: 오른쪽, tint 배경, iOS bubble tail
 * - AI: 왼쪽, 그레이 배경, iOS bubble tail
 * - 에러: 인라인 배너
 * - 롱프레스: 부드러운 스케일 + 햅틱 + 복사
 * - 연속 메시지: tail 제거, 간격 축소
 * - 그림자 기반 깊이 (border 없음)
 */

import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import type { Message } from '../../types';

interface Props {
  message: Message;
  isLatest?: boolean;
  isConsecutive?: boolean;
}

function Bubble({ message, isLatest, isConsecutive }: Props) {
  const { c } = useTheme();
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onLongPress = useCallback(async () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(message.content);
    setTimeout(() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }, 100);
  }, [message.content, scale]);

  if (isError) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.errorContainer}>
        <View style={[styles.errorBanner, { backgroundColor: c.destructive + '14' }]}>
          <Ionicons name="exclamationmark.triangle" size={13} color={c.destructive} />
          <Text style={[styles.errorText, { color: c.destructive }]} numberOfLines={4}>
            {message.content}
          </Text>
        </View>
      </Animated.View>
    );
  }

  const entering = isLatest
    ? FadeInUp.duration(280).springify().damping(20).stiffness(180)
    : FadeIn.duration(120);

  if (isUser) {
    return (
      <Animated.View entering={entering} style={[styles.row, styles.userRow, isConsecutive && styles.tight]}>
        <Animated.View style={animStyle}>
          <Pressable onLongPress={onLongPress} delayLongPress={300}>
            <View style={[
              styles.bubble, styles.userBubble,
              { backgroundColor: c.userBubble },
              !isConsecutive && styles.userTail,
            ]}>
              <Text style={[styles.text, { color: c.userBubbleText }]}>{message.content}</Text>
            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    );
  }

  // AI message
  return (
    <Animated.View entering={entering} style={[styles.row, styles.aiRow, isConsecutive && styles.tight]}>
      <Animated.View style={[animStyle, { maxWidth: '88%' }]}>
        <Pressable onLongPress={onLongPress} delayLongPress={300}>
          <View style={[
            styles.bubble, styles.aiBubble,
            { backgroundColor: c.aiBubble },
            !isConsecutive && styles.aiTail,
          ]}>
            <Text style={[styles.text, styles.aiText, { color: c.aiBubbleText }]} selectable>
              {message.content}
            </Text>
            {message.tool_calls && message.tool_calls.length > 0 && (
              <View style={styles.tools}>
                {message.tool_calls.map((tc, i) => (
                  <View key={tc.id || i} style={[styles.toolChip, { backgroundColor: c.tertiaryFill }]}>
                    <Ionicons name="terminal" size={10} color={c.tint} />
                    <Text style={[styles.toolName, { color: c.secondaryLabel }]}>{tc.function.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export default memo(Bubble);

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12 },
  userRow: { alignItems: 'flex-end', paddingVertical: 1 },
  aiRow: { alignItems: 'flex-start', paddingVertical: 1 },
  tight: { paddingVertical: 0.5 },

  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  userBubble: {
    maxWidth: 280,
    borderRadius: 18,
  },
  userTail: {
    borderBottomRightRadius: 4, // iMessage-style tail
  },
  aiBubble: {
    borderRadius: 18,
  },
  aiTail: {
    borderBottomLeftRadius: 4,
  },

  text: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.3, // SF Pro
  },
  aiText: {
    fontSize: 15,
    lineHeight: 21,
  },

  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  toolName: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'monospace',
  },

  errorContainer: { paddingHorizontal: 16, paddingVertical: 2 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  errorText: { fontSize: 13, lineHeight: 18, flex: 1 },
});
