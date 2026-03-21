/**
 * ChatScreen — iOS Messages-level main screen
 *
 * Tool 실행 상태 표시 및 브라우저 버튼 추가
 */

import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useChat } from '../hooks/useChat';
import GradientHeader from '../components/GradientHeader';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import StreamingIndicator from '../components/StreamingIndicator';
import EmptyState from '../components/EmptyState';
import type { Message } from '../../types';
import { configManager } from '../../core/config/config-manager';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onOpenSettings: () => void;
  onOpenSessions: () => void;
  onOpenBrowser?: (url?: string) => void;
}

export default function ChatScreen({ onOpenSettings, onOpenSessions, onOpenBrowser }: Props) {
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
    const items: Message[] = [];
    for (const msg of chat.messages) {
      // Skip tool messages in visual display (they're internal)
      if (msg.role === 'tool') continue;
      // For assistant messages with tool_calls, show a summary
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        const toolNames = msg.tool_calls.map(tc => tc.function.name).join(', ');
        items.push({
          role: 'assistant',
          content: msg.content
            ? `${msg.content}\n\n_[Tools: ${toolNames}]_`
            : `_[Executing: ${toolNames}]_`,
        });
        continue;
      }
      items.push(msg);
    }
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

      {/* Tool execution status bar */}
      {chat.currentTool && (
        <View style={[styles.toolBar, { backgroundColor: c.secondaryBackground }]}>
          <Ionicons name="construct-outline" size={14} color={c.tint} />
          <Text style={[styles.toolText, { color: c.tint }]} numberOfLines={1}>{chat.currentTool}</Text>
        </View>
      )}

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

      {/* Bottom toolbar with browser button */}
      <View style={[styles.bottomBar, { borderTopColor: c.separator }]}>
        {onOpenBrowser && (
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={() => onOpenBrowser()}
          >
            <Ionicons name="globe-outline" size={22} color={c.tint} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.toolbarBtn,
            chat.toolsEnabled && styles.toolbarBtnActive,
          ]}
          onPress={() => chat.setToolsEnabled(!chat.toolsEnabled)}
        >
          <Ionicons
            name="construct-outline"
            size={20}
            color={chat.toolsEnabled ? c.tint : c.tertiaryLabel}
          />
        </TouchableOpacity>
        <View style={styles.flex}>
          <ChatInput
            onSend={chat.sendMessage}
            onStop={chat.stopGeneration}
            isLoading={chat.isLoading}
            isStreaming={chat.isStreaming}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  list: { paddingTop: 8, paddingBottom: 4 },
  toolBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  toolText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbarBtn: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarBtnActive: {
    opacity: 1,
  },
});
