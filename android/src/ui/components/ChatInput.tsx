/**
 * ChatInput — iOS Messages-style input bar
 *
 * 라운드 필드 + 원형 전송 버튼, 미니멀
 * 키보드 올라올 때 자연스럽게 따라감
 */

import React, { useState, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, ZoomIn, ZoomOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface Props {
  onSend: (msg: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  isStreaming?: boolean;
}

export default function ChatInput({ onSend, onStop, isLoading, isStreaming }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [h, setH] = useState(36);
  const inputRef = useRef<TextInput>(null);
  const btnScale = useSharedValue(1);

  const hasText = text.trim().length > 0;
  const active = isLoading || isStreaming;

  const send = useCallback(() => {
    if (!hasText || isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    btnScale.value = withSpring(0.8, { damping: 15 }, () => { btnScale.value = withSpring(1); });
    onSend(text.trim());
    setText('');
    setH(36);
  }, [text, hasText, isLoading, onSend, btnScale]);

  const stop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    onStop?.();
  }, [onStop]);

  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  return (
    <View style={[styles.container, {
      backgroundColor: c.background,
      paddingBottom: Math.max(insets.bottom, 8),
      borderTopColor: c.separator,
    }]}>
      <View style={styles.row}>
        <View style={[styles.field, { backgroundColor: c.searchBar }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: c.label, height: Math.min(h, 100) }]}
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={c.tertiaryLabel}
            multiline
            onContentSizeChange={e => setH(Math.max(36, e.nativeEvent.contentSize.height))}
            editable={!active}
            selectionColor={c.tint}
          />
        </View>

        {active ? (
          <Animated.View entering={ZoomIn.springify()} exiting={ZoomOut.duration(150)}>
            <TouchableOpacity onPress={stop} style={[styles.btn, { backgroundColor: c.destructive }]} activeOpacity={0.7}>
              <View style={styles.stopSquare} />
            </TouchableOpacity>
          </Animated.View>
        ) : hasText ? (
          <Animated.View style={btnStyle} entering={ZoomIn.springify()}>
            <TouchableOpacity onPress={send} style={[styles.btn, { backgroundColor: c.tint }]} activeOpacity={0.7}>
              <Ionicons name="arrow-up" size={20} color="#FFF" />
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  field: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.3,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    maxHeight: 100,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stopSquare: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
});
