/**
 * ChatInput Component
 *
 * 감동적인 메시지 입력 영역 — 그라디언트 전송 버튼, 부드러운 애니메이션
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
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
  interpolateColor,
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
  placeholder = 'Ask anything...',
}: ChatInputProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [inputHeight, setInputHeight] = useState(44);
  const inputRef = useRef<TextInput>(null);

  const sendScale = useSharedValue(1);
  const hasText = text.trim().length > 0;

  const handleSend = useCallback(() => {
    if (!hasText || isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sendScale.value = withSpring(0.85, { damping: 15 }, () => {
      sendScale.value = withSpring(1);
    });

    onSend(text.trim());
    setText('');
    setInputHeight(44);
  }, [text, hasText, isLoading, onSend, sendScale]);

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onStop?.();
  }, [onStop]);

  const sendButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const maxInputHeight = 120;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <View style={[styles.inputRow, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              color: colors.text,
              height: Math.min(inputHeight, maxInputHeight),
            },
          ]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          multiline
          onContentSizeChange={(e) => {
            setInputHeight(Math.max(44, e.nativeEvent.contentSize.height));
          }}
          returnKeyType="default"
          editable={!isLoading}
        />

        {(isLoading || isStreaming) ? (
          <TouchableOpacity onPress={handleStop} style={styles.stopButton}>
            <View style={[styles.stopIcon, { backgroundColor: colors.error }]}>
              <Ionicons name="stop" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        ) : (
          <Animated.View style={sendButtonStyle}>
            <TouchableOpacity
              onPress={handleSend}
              disabled={!hasText}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={
                  hasText
                    ? [colors.gradientStart, colors.gradientEnd]
                    : [colors.border, colors.border]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButton}
              >
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={hasText ? '#FFFFFF' : colors.placeholder}
                />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: 8,
    maxHeight: 120,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stopButton: {
    marginBottom: 2,
  },
  stopIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
