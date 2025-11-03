/**
 * Interactive App - Ink UI
 *
 * React + Ink 기반 인터랙티브 터미널 UI
 */

import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { LLMClient } from '../../core/llm-client.js';
import { Message } from '../../types/index.js';

interface InteractiveAppProps {
  llmClient: LLMClient;
  modelInfo: {
    model: string;
    endpoint: string;
  };
}

export const InteractiveApp: React.FC<InteractiveAppProps> = ({ llmClient, modelInfo }) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');

  // 키보드 단축키
  useInput((inputChar: string, key: { ctrl: boolean; shift: boolean; meta: boolean }) => {
    if (key.ctrl && inputChar === 'c') {
      exit();
    }
  });

  const handleSubmit = async (value: string) => {
    if (!value.trim() || isProcessing) {
      return;
    }

    const userMessage = value.trim();
    setInput('');

    // 메타 명령어 처리
    if (userMessage === '/exit' || userMessage === '/quit') {
      exit();
      return;
    }

    if (userMessage === '/clear') {
      setMessages([]);
      return;
    }

    if (userMessage === '/help') {
      // 도움말 표시 (간단히)
      return;
    }

    // LLM 호출
    setIsProcessing(true);
    setCurrentResponse('');

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ];
    setMessages(newMessages);

    try {
      // 스트리밍 응답
      let fullResponse = '';
      for await (const chunk of llmClient.chatCompletionStream({
        messages: newMessages,
      })) {
        fullResponse += chunk;
        setCurrentResponse(fullResponse);
      }

      // 최종 응답 저장
      setMessages([
        ...newMessages,
        { role: 'assistant', content: fullResponse },
      ]);
      setCurrentResponse('');
    } catch (error) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" paddingX={2} marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">
            OPEN-CLI Interactive Mode (Ink UI)
          </Text>
          <Text dimColor>
            Model: {modelInfo.model} | Endpoint: {modelInfo.endpoint}
          </Text>
          <Text dimColor>
            Commands: /exit /clear /help | Ctrl+C to quit
          </Text>
        </Box>
      </Box>

      {/* Message History */}
      <Box flexDirection="column" marginBottom={1}>
        {messages.map((msg, index) => (
          <Box key={index} marginBottom={1}>
            <Box marginRight={1}>
              <Text bold color={msg.role === 'user' ? 'green' : 'blue'}>
                {msg.role === 'user' ? '🧑 You:' : '🤖 Assistant:'}
              </Text>
            </Box>
            <Text>{msg.content}</Text>
          </Box>
        ))}

        {/* Current streaming response */}
        {isProcessing && currentResponse && (
          <Box marginBottom={1}>
            <Box marginRight={1}>
              <Text bold color="blue">
                🤖 Assistant:
              </Text>
            </Box>
            <Text>{currentResponse}</Text>
          </Box>
        )}
      </Box>

      {/* Input Box */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        {isProcessing ? (
          <Box>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text dimColor> Processing...</Text>
          </Box>
        ) : (
          <Box>
            <Text bold color="green">
              You:{' '}
            </Text>
            <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
          </Box>
        )}
      </Box>
    </Box>
  );
};
