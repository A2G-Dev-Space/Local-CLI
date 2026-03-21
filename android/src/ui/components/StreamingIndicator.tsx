/**
 * StreamingIndicator — iOS typing indicator style
 *
 * 콘텐츠 있으면 블링킹 커서, 없으면 bouncing dots
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withDelay, withSequence, Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

export default function StreamingIndicator({ content }: { content: string }) {
  const { c } = useTheme();

  const cursor = useSharedValue(1);
  const d1 = useSharedValue(0), d2 = useSharedValue(0), d3 = useSharedValue(0);

  useEffect(() => {
    cursor.value = withRepeat(withSequence(
      withTiming(0, { duration: 530 }), withTiming(1, { duration: 530 })
    ), -1);
    const bounce = (delay: number) => withRepeat(withDelay(delay, withSequence(
      withTiming(-4, { duration: 250, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 250, easing: Easing.in(Easing.quad) })
    )), -1);
    d1.value = bounce(0); d2.value = bounce(120); d3.value = bounce(240);
  }, [cursor, d1, d2, d3]);

  const cursorAnim = useAnimatedStyle(() => ({ opacity: cursor.value }));
  const a1 = useAnimatedStyle(() => ({ transform: [{ translateY: d1.value }] }));
  const a2 = useAnimatedStyle(() => ({ transform: [{ translateY: d2.value }] }));
  const a3 = useAnimatedStyle(() => ({ transform: [{ translateY: d3.value }] }));

  if (content) {
    return (
      <View style={[styles.row, styles.contentRow]}>
        <View style={[styles.bubble, { backgroundColor: c.aiBubble }]}>
          <Text style={[styles.text, { color: c.aiBubbleText }]}>
            {content}
            <Animated.Text style={[{ color: c.tint, fontWeight: '300' }, cursorAnim]}>{'|'}</Animated.Text>
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, styles.dotsRow]}>
      <View style={[styles.dotsBubble, { backgroundColor: c.aiBubble }]}>
        <Animated.View style={[styles.dot, { backgroundColor: c.secondaryLabel }, a1]} />
        <Animated.View style={[styles.dot, { backgroundColor: c.secondaryLabel }, a2]} />
        <Animated.View style={[styles.dot, { backgroundColor: c.secondaryLabel }, a3]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 1 },
  contentRow: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '88%',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  text: { fontSize: 15, lineHeight: 21 },
  dotsRow: { alignItems: 'flex-start' },
  dotsBubble: {
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: { width: 7, height: 7, borderRadius: 4, opacity: 0.5 },
});
