/**
 * useChat Hook (Android)
 *
 * 채팅 상태 관리 및 LLM 통신 훅
 */

import { useState, useCallback, useRef } from 'react';
import type { Message } from '../../types';
import { LLMClient, type LLMStreamChunk } from '../../core/llm/llm-client';
import { configManager } from '../../core/config/config-manager';
import { sessionManager } from '../../core/session/session-manager';
import { logger } from '../../utils/logger';
import * as Haptics from 'expo-haptics';

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  streamingContent: string;
}

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    isStreaming: false,
    error: null,
    streamingContent: '',
  });

  const llmClientRef = useRef<LLMClient | null>(null);

  const getClient = useCallback(() => {
    if (!llmClientRef.current) {
      try {
        llmClientRef.current = new LLMClient();
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to initialize LLM client',
        }));
        return null;
      }
    }
    return llmClientRef.current;
  }, []);

  const sendMessage = useCallback(async (content: string, systemPrompt?: string) => {
    const client = getClient();
    if (!client) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const userMessage: Message = { role: 'user', content };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      isStreaming: false,
      error: null,
      streamingContent: '',
    }));

    try {
      const allMessages: Message[] = [];
      if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });

      // Include conversation history
      const history = [...state.messages, userMessage];
      allMessages.push(...history);

      const useStreaming = configManager.getConfig().settings.streamResponse;

      if (useStreaming) {
        setState(prev => ({ ...prev, isStreaming: true }));
        let fullContent = '';

        for await (const chunk of client.chatCompletionStream({ messages: allMessages })) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            setState(prev => ({ ...prev, streamingContent: fullContent }));
          }
        }

        const assistantMessage: Message = { role: 'assistant', content: fullContent };
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
          isStreaming: false,
          streamingContent: '',
        }));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        const response = await client.chatCompletion({ messages: allMessages });
        const assistantContent = response.choices[0]?.message.content || '';
        const assistantMessage: Message = { role: 'assistant', content: assistantContent };

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
          error: null,
        }));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      // Auto-save session
      const endpoint = configManager.getCurrentEndpoint();
      const model = configManager.getCurrentModel();
      if (endpoint && model) {
        sessionManager.saveSession(
          [...state.messages, userMessage],
          model.name,
          endpoint.name
        ).catch(() => {});
      }
    } catch (error) {
      logger.error('Chat error', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage !== 'INTERRUPTED') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isStreaming: false,
          error: errorMessage,
          streamingContent: '',
        }));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isStreaming: false,
          streamingContent: '',
        }));
      }
    }
  }, [getClient, state.messages]);

  const stopGeneration = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const client = llmClientRef.current;
    if (client) {
      client.abort();
      // Save any partial streaming content
      if (state.streamingContent) {
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, { role: 'assistant', content: prev.streamingContent }],
          isLoading: false,
          isStreaming: false,
          streamingContent: '',
        }));
      }
    }
  }, [state.streamingContent]);

  const clearMessages = useCallback(() => {
    setState({
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
      streamingContent: '',
    });
    llmClientRef.current = null;
    sessionManager.startNewSession();
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    const data = await sessionManager.loadSession(sessionId);
    if (data) {
      setState(prev => ({
        ...prev,
        messages: data.messages,
        error: null,
      }));
      llmClientRef.current = null;
    }
  }, []);

  return {
    ...state,
    sendMessage,
    stopGeneration,
    clearMessages,
    loadSession,
  };
}
