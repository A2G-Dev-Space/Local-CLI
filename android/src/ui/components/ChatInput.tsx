/**
 * ChatInput — 세계 최고 수준의 입력 바
 *
 * 플로팅 글래스 바, 극한 컴팩트, 전송 버튼 모핑 애니메이션
 * 키보드 올라올 때 자연스러운 전환
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  onStop,
  isLoading,
  isStreaming,
  placeholder = 'Message...',
}: ChatInputProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [inputHeight, setInputHeight] = useState(36);
  const inputRef = useRef<TextInput>(null);

  const sendScale = useSharedValue(1);
  const hasText = text.trim().length > 0;
  const isActive = isLoading || isStreaming;

  const handleSend = useCallback(() => {
    if (!hasText || isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sendScale.value = withSpring(0.8, { damping: 15, stiffness: 300 }, () => {
      sendScale.value = withSpring(1, { damping: 12 });
    });
    onSend(text.trim());
    setText('');
    setInputHeight(36);
  }, [text, hasText, isLoading, onSend, sendScale]);

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    onStop?.();
  }, [onStop]);

  const sendBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const maxH = 100;
  const clampedHeight = Math.min(inputHeight, maxH);

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.background,
          paddingBottom: Math.max(insets.bottom, 6),
        },
      ]}
    >
      <View style={[styles.bar, {
        backgroundColor: colors.surface,
        borderColor: hasText ? colors.primary + '40' : colors.border,
        shadowColor: colors.primary,
      }]}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            { color: colors.text, height: clampedHeight },
          ]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          multiline
          onContentSizeChange={(e) => {
            setInputHeight(Math.max(36, e.nativeEvent.contentSize.height));
          }}
          editable={!isActive}
          selectionColor={colors.primary}
        />

        {/* Send / Stop 버튼 — 매끄러운 전환 */}
        {isActive ? (
          <Animated.View entering={ZoomIn.duration(200)} exiting={ZoomOut.duration(150)}>
            <TouchableOpacity onPress={handleStop} activeOpacity={0.7}>
              <View style={[styles.stopBtn, { backgroundColor: colors.error }]}>
                <View style={styles.stopSquare} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View style={sendBtnStyle}>
            <TouchableOpacity
              onPress={handleSend}
              disabled={!hasText}
              activeOpacity={0.7}
            >
              {hasText ? (
                <Animated.View entering={ZoomIn.duration(200)}>
                  <LinearGradient
                    colors={[colors.gradientStart, colors.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sendBtn}
                  >
                    <Ionicons name="arrow-up" size={18} color="#FFF" />
                  </LinearGradient>
                </Animated.View>
              ) : (
                <View style={[styles.sendBtn, { backgroundColor: colors.border + '80' }]}>
                  <Ionicons name="arrow-up" size={18} color={colors.placeholder} />
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 22,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 20,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    maxHeight: 100,
  },
  sendBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  stopBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  stopSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});
