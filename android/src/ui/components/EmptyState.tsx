/**
 * EmptyState — 감동적인 온보딩 화면
 *
 * 컴팩트 로고 + 2x2 탭 가능 suggestion grid
 * 화면 중앙보다 약간 위에 배치하여 키보드 올라와도 보이게
 * 숨쉬는 그라디언트 오브 + 파티클 효과
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  FadeIn,
  FadeInUp,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_W } = Dimensions.get('window');

interface EmptyStateProps {
  onSuggestionPress?: (text: string) => void;
}

export default function EmptyState({ onSuggestionPress }: EmptyStateProps) {
  const { colors } = useTheme();

  // 숨쉬는 오브
  const orbScale = useSharedValue(1);
  const orbRotate = useSharedValue(0);
  const ring1 = useSharedValue(0.4);
  const ring2 = useSharedValue(0.2);

  useEffect(() => {
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ), -1
    );
    orbRotate.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }), -1
    );
    ring1.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 2000 }),
        withTiming(0.3, { duration: 2000 })
      ), -1
    );
    ring2.value = withRepeat(
      withDelay(1000, withSequence(
        withTiming(0.5, { duration: 2000 }),
        withTiming(0.15, { duration: 2000 })
      )), -1
    );
  }, [orbScale, orbRotate, ring1, ring2]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: orbScale.value },
      { rotate: `${orbRotate.value}deg` },
    ],
  }));
  const ring1Style = useAnimatedStyle(() => ({ opacity: ring1.value }));
  const ring2Style = useAnimatedStyle(() => ({ opacity: ring2.value }));

  const suggestions = [
    { icon: 'code-slash' as const, text: 'Write code', desc: 'Any language' },
    { icon: 'bug' as const, text: 'Debug', desc: 'Fix errors fast' },
    { icon: 'git-branch' as const, text: 'Review', desc: 'Code review' },
    { icon: 'bulb' as const, text: 'Explain', desc: 'Learn concepts' },
  ];

  return (
    <View style={styles.container}>
      {/* Breathing orb — 컴팩트 56px */}
      <Animated.View entering={FadeIn.duration(1000)} style={styles.orbArea}>
        {/* Outer rings */}
        <Animated.View style={[styles.ring, styles.ringOuter, ring2Style, { borderColor: colors.gradientStart + '30' }]} />
        <Animated.View style={[styles.ring, styles.ringInner, ring1Style, { borderColor: colors.gradientStart + '50' }]} />

        {/* Core orb */}
        <Animated.View style={orbStyle}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orb}
          >
            <Ionicons name="terminal" size={26} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
      </Animated.View>

      {/* Title — 컴팩트 */}
      <Animated.View entering={FadeInUp.duration(600).delay(300)}>
        <Text style={[styles.title, { color: colors.text }]}>LOCAL BOT</Text>
        <Text style={[styles.desc, { color: colors.textTertiary }]}>
          AI Coding Agent
        </Text>
      </Animated.View>

      {/* 2x2 Suggestion grid — 탭 가능 */}
      <Animated.View
        entering={FadeInUp.duration(600).delay(500)}
        style={styles.grid}
      >
        {suggestions.map((s, i) => (
          <Animated.View
            key={s.text}
            entering={FadeInUp.duration(400).delay(600 + i * 80)}
            style={{ width: (SCREEN_W - 52) / 2 }}
          >
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => onSuggestionPress?.(s.text)}
              activeOpacity={0.7}
            >
              <View style={[styles.cardIcon, { backgroundColor: colors.primaryGlow }]}>
                <Ionicons name={s.icon} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{s.text}</Text>
              <Text style={[styles.cardDesc, { color: colors.textTertiary }]}>{s.desc}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: -40, // 키보드 올라와도 안 잘리게 위로
  },
  // Orb
  orbArea: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 999,
  },
  ringOuter: {
    width: 96,
    height: 96,
  },
  ringInner: {
    width: 72,
    height: 72,
  },
  orb: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Text
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
    textAlign: 'center',
  },
  desc: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 3,
    letterSpacing: 0.5,
  },
  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 28,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 12,
    gap: 4,
  },
  cardIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 10,
    lineHeight: 14,
  },
});
