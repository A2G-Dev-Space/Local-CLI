/**
 * iOS-style Navigation Bar
 *
 * 반투명 배경 + 블러 효과 시뮬레이션
 * 얇은 하단 separator, SF-style 타이틀
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

interface HeaderProps {
  title: string;
  modelName?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon2?: keyof typeof Ionicons.glyphMap;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  onRightPress2?: () => void;
}

export default function GradientHeader({
  title, modelName, leftIcon, rightIcon, rightIcon2,
  onLeftPress, onRightPress, onRightPress2,
}: HeaderProps) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { backgroundColor: c.navBar, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <View style={styles.content}>
        {/* Left */}
        <View style={styles.side}>
          {leftIcon && (
            <TouchableOpacity onPress={onLeftPress} hitSlop={12} activeOpacity={0.6}>
              <Ionicons name={leftIcon} size={22} color={c.tint} />
            </TouchableOpacity>
          )}
        </View>

        {/* Center */}
        <View style={styles.center}>
          <Text style={[styles.title, { color: c.navBarTitle }]} numberOfLines={1}>
            {title}
          </Text>
          {modelName && (
            <Text style={[styles.subtitle, { color: c.secondaryLabel }]} numberOfLines={1}>
              {modelName}
            </Text>
          )}
        </View>

        {/* Right */}
        <View style={[styles.side, styles.rightSide]}>
          {rightIcon2 && (
            <TouchableOpacity onPress={onRightPress2} hitSlop={12} activeOpacity={0.6}>
              <Ionicons name={rightIcon2} size={22} color={c.tint} />
            </TouchableOpacity>
          )}
          {rightIcon && (
            <TouchableOpacity onPress={onRightPress} hitSlop={12} activeOpacity={0.6}>
              <Ionicons name={rightIcon} size={22} color={c.tint} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* iOS-style hairline separator */}
      <View style={[styles.separator, { backgroundColor: c.separator }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    // 그림자 없음 — iOS nav bar는 separator만 사용
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44, // iOS standard nav bar height
    paddingHorizontal: 16,
  },
  side: {
    width: 60,
  },
  rightSide: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4, // SF Pro 스타일
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
});
