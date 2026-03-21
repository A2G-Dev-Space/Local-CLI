/**
 * EmptyState — iOS Spotlight-inspired welcome
 *
 * 미니멀 아이콘 + 서브텍스트 + 탭 가능 suggestion chips
 * Apple의 "시작" 화면 미학
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

const W = Dimensions.get('window').width;

interface Props {
  onSuggestionPress?: (text: string) => void;
}

export default function EmptyState({ onSuggestionPress }: Props) {
  const { c } = useTheme();

  const chips = [
    { icon: 'code-slash' as const, label: 'Write code' },
    { icon: 'bug' as const, label: 'Debug error' },
    { icon: 'git-branch' as const, label: 'Review code' },
    { icon: 'bulb' as const, label: 'Explain concept' },
  ];

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(600)} style={styles.hero}>
        <View style={[styles.iconWrap, { backgroundColor: c.tertiaryFill }]}>
          <Ionicons name="terminal" size={32} color={c.tint} />
        </View>
        <Text style={[styles.title, { color: c.label }]}>LOCAL BOT</Text>
        <Text style={[styles.sub, { color: c.tertiaryLabel }]}>
          AI coding agent for any LLM
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.chips}>
        {chips.map((chip, i) => (
          <TouchableOpacity
            key={chip.label}
            style={[styles.chip, { backgroundColor: c.secondaryBackground }]}
            onPress={() => onSuggestionPress?.(chip.label)}
            activeOpacity={0.6}
          >
            <Ionicons name={chip.icon} size={15} color={c.tint} />
            <Text style={[styles.chipLabel, { color: c.label }]}>{chip.label}</Text>
            <Ionicons name="chevron-forward" size={13} color={c.quaternaryLabel} />
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: -50,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sub: {
    fontSize: 14,
    marginTop: 4,
  },
  chips: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  chipLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
});
