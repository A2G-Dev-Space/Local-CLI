/**
 * StreamingIndicator Component
 *
 * LLM 응답 스트리밍 시 표시되는 애니메이션
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

interface StreamingIndicatorProps {
  content: string;
}

export default function StreamingIndicator({ content }: StreamingIndicatorProps) {
  const { colors } = useTheme();

  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    dot1.value = withRepeat(
      withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })),
      -1
    );
    dot2.value = withRepeat(
      withDelay(150, withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 }))),
      -1
    );
    dot3.value = withRepeat(
      withDelay(300, withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 }))),
      -1
    );
  }, [dot1, dot2, dot3]);

  const animDot1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const animDot2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const animDot3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <View style={[styles.container, { marginHorizontal: 12 }]}>
      <View style={[styles.avatar, { backgroundColor: colors.primaryGlow }]}>
        <Ionicons name="sparkles" size={16} color={colors.primary} />
      </View>

      <View style={[styles.bubble, { backgroundColor: colors.assistantBubble }]}>
        {content ? (
          <Text style={[styles.text, { color: colors.assistantBubbleText }]}>
            {content}
          </Text>
        ) : null}

        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, animDot1]} />
          <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, animDot2]} />
          <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, animDot3]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
