/**
 * ChatScreen — 메인 채팅 화면
 *
 * CLI의 PlanExecuteApp + Electron의 ChatApp에 대응하는 Android 메인 화면
 */

import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useChat } from '../hooks/useChat';
import GradientHeader from '../components/GradientHeader';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import StreamingIndicator from '../components/StreamingIndicator';
import EmptyState from '../components/EmptyState';
import type { Message } from '../../types';
import { configManager } from '../../core/config/config-manager';

interface ChatScreenProps {
  onOpenSettings: () => void;
  onOpenSessions: () => void;
}

export default function ChatScreen({ onOpenSettings, onOpenSessions }: ChatScreenProps) {
  const { colors } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    streamingContent,
    sendMessage,
    stopGeneration,
    clearMessages,
  } = useChat();

  const endpoint = configManager.getCurrentEndpoint();
  const model = configManager.getCurrentModel();
  const subtitle = model ? `${model.name}` : 'No model selected';

  // Auto scroll to bottom
  useEffect(() => {
    if (messages.length > 0 || isStreaming) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isStreaming, streamingContent]);

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => (
    <ChatBubble
      message={item}
      isLatest={index === messages.length - 1}
    />
  ), [messages.length]);

  const keyExtractor = useCallback((_item: Message, index: number) => `msg-${index}`, []);

  // Build display items (messages + error if any)
  const displayMessages = [...messages];
  if (error) {
    displayMessages.push({ role: 'error', content: error });
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <GradientHeader
        title="LOCAL BOT"
        subtitle={subtitle}
        leftIcon="time-outline"
        rightIcon="settings-outline"
        onLeftPress={onOpenSessions}
        onRightPress={onOpenSettings}
      />

      {displayMessages.length === 0 && !isLoading ? (
        <EmptyState />
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isStreaming || (isLoading && !isStreaming) ? (
              <StreamingIndicator content={streamingContent} />
            ) : null
          }
        />
      )}

      <ChatInput
        onSend={(msg) => sendMessage(msg)}
        onStop={stopGeneration}
        isLoading={isLoading}
        isStreaming={isStreaming}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    paddingVertical: 8,
    flexGrow: 1,
  },
});
