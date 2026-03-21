/**
 * GradientHeader — Ultra-compact glass header
 *
 * 36px 콘텐츠 높이, 인라인 모델 뱃지, 블러 글래스 효과
 * 세로 공간을 극한까지 절약하면서 브랜드 임팩트를 유지
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface GradientHeaderProps {
  title: string;
  modelName?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon2?: keyof typeof Ionicons.glyphMap;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  onRightPress2?: () => void;
  isConnected?: boolean;
}

export default function GradientHeader({
  title,
  modelName,
  leftIcon,
  rightIcon,
  rightIcon2,
  onLeftPress,
  onRightPress,
  onRightPress2,
  isConnected = true,
}: GradientHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const PressableIcon = ({ icon, onPress, size = 18 }: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress?: () => void;
    size?: number;
  }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <Animated.View style={animStyle}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={() => { scale.value = withSpring(0.85); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          style={styles.iconBtn}
          activeOpacity={1}
        >
          <Ionicons name={icon} size={size} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid + 'EE', colors.gradientEnd + 'CC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.5 }}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
        {/* Left */}
        <View style={styles.leftGroup}>
          {leftIcon && <PressableIcon icon={leftIcon} onPress={onLeftPress} />}
        </View>

        {/* Center — title + inline model badge */}
        <View style={styles.centerGroup}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {modelName && (
            <View style={styles.modelBadge}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? '#34D399' : '#F87171' }]} />
              <Text style={styles.modelText} numberOfLines={1}>{modelName}</Text>
            </View>
          )}
        </View>

        {/* Right */}
        <View style={styles.rightGroup}>
          {rightIcon2 && <PressableIcon icon={rightIcon2} onPress={onRightPress2} />}
          {rightIcon && <PressableIcon icon={rightIcon} onPress={onRightPress} />}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  leftGroup: {
    flexDirection: 'row',
    width: 40,
  },
  centerGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rightGroup: {
    flexDirection: 'row',
    gap: 2,
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    maxWidth: 120,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  modelText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
