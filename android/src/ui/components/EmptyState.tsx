/**
 * EmptyState Component
 *
 * 새 대화 시작 시 보여지는 감동적인 빈 상태 화면
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
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
} from 'react-native-reanimated';
import { APP_VERSION } from '../../core/constants';

const { width } = Dimensions.get('window');

export default function EmptyState() {
  const { colors } = useTheme();

  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2000 }),
        withTiming(0.3, { duration: 2000 })
      ),
      -1
    );
  }, [pulseScale, glowOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const suggestions = [
    { icon: 'code-slash' as const, text: 'Write a Python script' },
    { icon: 'bug' as const, text: 'Debug this error' },
    { icon: 'git-branch' as const, text: 'Review my code' },
    { icon: 'bulb' as const, text: 'Explain this concept' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View entering={FadeIn.duration(800).delay(200)}>
        {/* Glowing logo */}
        <View style={styles.logoContainer}>
          <Animated.View style={[styles.glow, glowStyle]}>
            <LinearGradient
              colors={[colors.gradientStart + '40', colors.gradientEnd + '00']}
              style={styles.glowGradient}
            />
          </Animated.View>

          <Animated.View style={pulseStyle}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Ionicons name="terminal" size={40} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>LOCAL BOT</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your AI Coding Agent • v{APP_VERSION}
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeIn.duration(800).delay(600)}
        style={styles.suggestionsContainer}
      >
        {suggestions.map((suggestion, index) => (
          <Animated.View
            key={suggestion.text}
            entering={FadeIn.duration(400).delay(800 + index * 100)}
          >
            <View style={[styles.suggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name={suggestion.icon} size={18} color={colors.primary} />
              <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>
                {suggestion.text}
              </Text>
            </View>
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
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
  },
  glowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  suggestionsContainer: {
    marginTop: 48,
    width: '100%',
    gap: 10,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  suggestionText: {
    fontSize: 14,
    flex: 1,
  },
});
