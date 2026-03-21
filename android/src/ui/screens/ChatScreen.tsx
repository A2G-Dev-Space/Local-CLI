/**
 * ChatScreen — 메인 채팅 화면 (세계 최고 수준)
 *
 * - 극한 컴팩트 헤더 (36px)
 * - 메시지 사이 간격 자동 최적화 (연속 메시지 감지)
 * - 플로팅 글래스 입력 바
 * - Suggestion 탭 → 바로 전송
 * - 새 대화 버튼 (헤더 좌측)
 */

import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
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

  const model = configManager.getCurrentModel();

  // Auto scroll
  useEffect(() => {
    if (messages.length > 0 || isStreaming) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [messages.length, isStreaming, streamingContent]);

  // 연속 메시지 감지를 위한 전처리
  const displayData = useMemo(() => {
    const items = [...messages];
    if (error) items.push({ role: 'error', content: error });
    return items.map((msg, i) => ({
      msg,
      isConsecutive: i > 0 && items[i - 1]!.role === msg.role,
      isLatest: i === items.length - 1,
    }));
  }, [messages, error]);

  const renderMessage = useCallback(({ item }: {
    item: { msg: Message; isConsecutive: boolean; isLatest: boolean }
  }) => (
    <ChatBubble
      message={item.msg}
      isLatest={item.isLatest}
      isConsecutive={item.isConsecutive}
    />
  ), []);

  const keyExtractor = useCallback((_: any, index: number) => `m-${index}`, []);

  const handleSuggestion = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <GradientHeader
        title="LOCAL BOT"
        modelName={model?.name}
        leftIcon="time-outline"
        rightIcon="settings-outline"
        rightIcon2="add-outline"
        onLeftPress={onOpenSessions}
        onRightPress={onOpenSettings}
        onRightPress2={clearMessages}
        isConnected={!!model}
      />

      {displayData.length === 0 && !isLoading ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.emptyFlex}>
            <EmptyState onSuggestionPress={handleSuggestion} />
          </View>
        </TouchableWithoutFeedback>
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayData}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            (isStreaming || (isLoading && !isStreaming))
              ? <StreamingIndicator content={streamingContent} />
              : <View style={styles.listFooter} />
          }
        />
      )}

      <ChatInput
        onSend={sendMessage}
        onStop={stopGeneration}
        isLoading={isLoading}
        isStreaming={isStreaming}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  emptyFlex: {
    flex: 1,
  },
  list: {
    paddingTop: 6,
    paddingBottom: 4,
  },
  listFooter: {
    height: 4,
  },
});
