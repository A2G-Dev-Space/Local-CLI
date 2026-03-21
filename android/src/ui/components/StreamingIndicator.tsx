/**
 * StreamingIndicator — 타이핑 커서 + 실시간 텍스트
 *
 * 아바타 없음, accent bar 스타일 (ChatBubble과 동일)
 * 블링킹 커서 + wave 도트 = 이중 시각 피드백
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
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

interface StreamingIndicatorProps {
  content: string;
}

export default function StreamingIndicator({ content }: StreamingIndicatorProps) {
  const { colors } = useTheme();

  // 블링킹 커서
  const cursorOpacity = useSharedValue(1);
  // 웨이브 도트
  const d1 = useSharedValue(0);
  const d2 = useSharedValue(0);
  const d3 = useSharedValue(0);

  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
      ), -1
    );
    const wave = (delay: number) => withRepeat(
      withDelay(delay, withSequence(
        withTiming(-3, { duration: 300 }),
        withTiming(0, { duration: 300 })
      )), -1
    );
    d1.value = wave(0);
    d2.value = wave(100);
    d3.value = wave(200);
  }, [cursorOpacity, d1, d2, d3]);

  const cursorStyle = useAnimatedStyle(() => ({ opacity: cursorOpacity.value }));
  const dot1 = useAnimatedStyle(() => ({ transform: [{ translateY: d1.value }] }));
  const dot2 = useAnimatedStyle(() => ({ transform: [{ translateY: d2.value }] }));
  const dot3 = useAnimatedStyle(() => ({ transform: [{ translateY: d3.value }] }));

  return (
    <View style={styles.container}>
      <View style={[styles.accentBar, { backgroundColor: colors.primary }]} />
      <View style={styles.content}>
        {content ? (
          <Text style={[styles.text, { color: colors.text }]}>
            {content}
            <Animated.Text style={[styles.cursor, { color: colors.primary }, cursorStyle]}>
              |
            </Animated.Text>
          </Text>
        ) : (
          <View style={styles.dotsRow}>
            <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dot1]} />
            <Animated.View style={[styles.dot, { backgroundColor: colors.primary + 'AA' }, dot2]} />
            <Animated.View style={[styles.dot, { backgroundColor: colors.primary + '66' }, dot3]} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  accentBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 10,
    minHeight: 16,
  },
  content: {
    flex: 1,
    paddingVertical: 2,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
  },
  cursor: {
    fontWeight: '300',
    fontSize: 15,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
