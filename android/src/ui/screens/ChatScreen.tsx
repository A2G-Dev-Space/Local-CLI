/**
 * ChatScreen — iOS Messages-level main screen
 */

import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useChat } from '../hooks/useChat';
import GradientHeader from '../components/GradientHeader';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import StreamingIndicator from '../components/StreamingIndicator';
import EmptyState from '../components/EmptyState';
import type { Message } from '../../types';
import { configManager } from '../../core/config/config-manager';

interface Props {
  onOpenSettings: () => void;
  onOpenSessions: () => void;
}

export default function ChatScreen({ onOpenSettings, onOpenSessions }: Props) {
  const { c } = useTheme();
  const listRef = useRef<FlatList>(null);
  const chat = useChat();
  const model = configManager.getCurrentModel();

  useEffect(() => {
    if (chat.messages.length > 0 || chat.isStreaming) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    }
  }, [chat.messages.length, chat.isStreaming, chat.streamingContent]);

  const data = useMemo(() => {
    const items = [...chat.messages];
    if (chat.error) items.push({ role: 'error', content: chat.error });
    return items.map((msg, i) => ({
      msg, isConsecutive: i > 0 && items[i - 1]!.role === msg.role, isLatest: i === items.length - 1,
    }));
  }, [chat.messages, chat.error]);

  const renderItem = useCallback(({ item }: any) => (
    <ChatBubble message={item.msg} isLatest={item.isLatest} isConsecutive={item.isConsecutive} />
  ), []);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <GradientHeader
        title="LOCAL BOT"
        modelName={model?.name}
        leftIcon="time-outline"
        rightIcon="ellipsis-horizontal"
        rightIcon2="create-outline"
        onLeftPress={onOpenSessions}
        onRightPress={onOpenSettings}
        onRightPress2={chat.clearMessages}
      />

      {data.length === 0 && !chat.isLoading ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.flex}><EmptyState onSuggestionPress={chat.sendMessage} /></View>
        </TouchableWithoutFeedback>
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          renderItem={renderItem}
          keyExtractor={(_, i) => `m${i}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            (chat.isStreaming || (chat.isLoading && !chat.isStreaming))
              ? <StreamingIndicator content={chat.streamingContent} />
              : <View style={{ height: 6 }} />
          }
        />
      )}

      <ChatInput
        onSend={chat.sendMessage}
        onStop={chat.stopGeneration}
        isLoading={chat.isLoading}
        isStreaming={chat.isStreaming}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  list: { paddingTop: 8, paddingBottom: 4 },
});
