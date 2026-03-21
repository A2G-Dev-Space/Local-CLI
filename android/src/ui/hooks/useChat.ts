/**
 * useChat Hook (Android)
 *
 * 채팅 상태 관리 및 LLM 통신 훅.
 * Tool 실행 지원 추가 — LLM이 tool_calls를 반환하면
 * 안드로이드 도구를 실행하고 결과를 다시 LLM에 전달.
 */

import { useState, useCallback, useRef } from 'react';
import type { Message } from '../../types';
import { LLMClient, type LLMStreamChunk } from '../../core/llm/llm-client';
import { configManager } from '../../core/config/config-manager';
import { sessionManager } from '../../core/session/session-manager';
import { logger } from '../../utils/logger';
import {
  getToolDefinitions,
  executeToolCalls,
  hasToolCalls,
  getToolSummary,
} from '../../tools/tool-executor';
import type { AndroidToolResult } from '../../tools/types';
import * as Haptics from 'expo-haptics';

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  streamingContent: string;
  currentTool: string | null; // Currently executing tool name
  toolsEnabled: boolean;
}

const MAX_TOOL_ROUNDS = 15; // Max consecutive tool call rounds

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    isStreaming: false,
    error: null,
    streamingContent: '',
    currentTool: null,
    toolsEnabled: true,
  });

  const llmClientRef = useRef<LLMClient | null>(null);
  const abortedRef = useRef(false);

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

  const setToolsEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, toolsEnabled: enabled }));
  }, []);

  const sendMessage = useCallback(async (content: string, systemPrompt?: string) => {
    const client = getClient();
    if (!client) return;

    abortedRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const userMessage: Message = { role: 'user', content };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      isStreaming: false,
      error: null,
      streamingContent: '',
      currentTool: null,
    }));

    try {
      const allMessages: Message[] = [];
      if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });

      // Include conversation history
      const history = [...state.messages, userMessage];
      allMessages.push(...history);

      // Get tool definitions if tools are enabled
      const tools = state.toolsEnabled ? getToolDefinitions() : undefined;
      const hasTools = tools && tools.length > 0;

      // Tool execution loop
      let round = 0;
      let currentMessages = allMessages;

      while (round < MAX_TOOL_ROUNDS) {
        if (abortedRef.current) break;
        round++;

        const useStreaming = configManager.getConfig().settings.streamResponse;

        if (useStreaming) {
          setState(prev => ({ ...prev, isStreaming: true }));
          let fullContent = '';
          let toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = [];

          for await (const chunk of client.chatCompletionStream({
            messages: currentMessages,
            tools: hasTools ? tools : undefined,
          })) {
            if (abortedRef.current) break;

            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              setState(prev => ({ ...prev, streamingContent: fullContent }));
            }

            // Accumulate tool calls from streaming
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCalls[idx]) {
                  toolCalls[idx] = {
                    id: tc.id || `call_${idx}`,
                    function: { name: tc.function?.name || '', arguments: '' },
                  };
                }
                if (tc.id) toolCalls[idx].id = tc.id;
                if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
                if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
              }
            }
          }

          if (abortedRef.current) break;

          // Check if we got tool calls
          const validToolCalls = toolCalls.filter(tc => tc.function.name);

          if (validToolCalls.length > 0 && hasTools) {
            // Add assistant message with tool_calls to history
            const assistantMsg: Message = {
              role: 'assistant',
              content: fullContent,
              tool_calls: validToolCalls.map(tc => ({
                id: tc.id,
                type: 'function' as const,
                function: tc.function,
              })),
            };

            setState(prev => ({
              ...prev,
              messages: [...prev.messages, assistantMsg],
              streamingContent: '',
              isStreaming: false,
            }));

            // Execute tools
            const toolMessages = await executeToolCalls(
              assistantMsg.tool_calls!,
              (name, args) => {
                const summary = getToolSummary(name, args);
                setState(prev => ({ ...prev, currentTool: summary }));
              },
              () => {
                setState(prev => ({ ...prev, currentTool: null }));
              },
            );

            // Add tool results to state and continue loop
            setState(prev => ({
              ...prev,
              messages: [...prev.messages, ...toolMessages],
            }));

            currentMessages = [...currentMessages, assistantMsg, ...toolMessages];
            continue; // Next round
          }

          // No tool calls — final response
          const assistantMessage: Message = { role: 'assistant', content: fullContent };
          setState(prev => ({
            ...prev,
            messages: [...prev.messages, assistantMessage],
            isLoading: false,
            isStreaming: false,
            streamingContent: '',
            currentTool: null,
          }));
          break; // Done
        } else {
          // Non-streaming mode
          const response = await client.chatCompletion({
            messages: currentMessages,
            tools: hasTools ? tools : undefined,
          });

          if (abortedRef.current) break;

          const choice = response.choices[0];
          const assistantContent = choice?.message.content || '';
          const responseToolCalls = choice?.message.tool_calls;

          if (responseToolCalls && responseToolCalls.length > 0 && hasTools) {
            const assistantMsg: Message = {
              role: 'assistant',
              content: assistantContent,
              tool_calls: responseToolCalls,
            };

            setState(prev => ({
              ...prev,
              messages: [...prev.messages, assistantMsg],
            }));

            const toolMessages = await executeToolCalls(
              responseToolCalls,
              (name, args) => {
                const summary = getToolSummary(name, args);
                setState(prev => ({ ...prev, currentTool: summary }));
              },
              () => {
                setState(prev => ({ ...prev, currentTool: null }));
              },
            );

            setState(prev => ({
              ...prev,
              messages: [...prev.messages, ...toolMessages],
            }));

            currentMessages = [...currentMessages, assistantMsg, ...toolMessages];
            continue;
          }

          const assistantMessage: Message = { role: 'assistant', content: assistantContent };
          setState(prev => ({
            ...prev,
            messages: [...prev.messages, assistantMessage],
            isLoading: false,
            error: null,
            currentTool: null,
          }));
          break;
        }
      }

      if (round >= MAX_TOOL_ROUNDS) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isStreaming: false,
          currentTool: null,
          error: 'Maximum tool execution rounds reached',
        }));
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

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
          currentTool: null,
        }));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isStreaming: false,
          streamingContent: '',
          currentTool: null,
        }));
      }
    }
  }, [getClient, state.messages, state.toolsEnabled]);

  const stopGeneration = useCallback(() => {
    abortedRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const client = llmClientRef.current;
    if (client) {
      client.abort();
      if (state.streamingContent) {
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, { role: 'assistant', content: prev.streamingContent }],
          isLoading: false,
          isStreaming: false,
          streamingContent: '',
          currentTool: null,
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
      currentTool: null,
      toolsEnabled: true,
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
    setToolsEnabled,
  };
}
