/**
 * Interactive App - Ink UI
 *
 * React + Ink 기반 인터랙티브 터미널 UI
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { LLMClient } from '../../core/llm-client.js';
import { Message } from '../../types/index.js';
import { FileBrowser } from './FileBrowser.js';
import { detectAtTrigger, insertFilePaths } from '../hooks/atFileProcessor.js';
import { loadFileList, FileItem } from '../hooks/useFileList.js';

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
  const [currentThinking, setCurrentThinking] = useState('');

  // File browser state
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [atPosition, setAtPosition] = useState(-1);
  const [filterText, setFilterText] = useState('');
  const [inputKey, setInputKey] = useState(0); // Force TextInput re-render for cursor position

  // Pre-loaded file list cache (loaded once at startup)
  const [cachedFileList, setCachedFileList] = useState<FileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  // Load file list once on mount (background loading)
  useEffect(() => {
    let mounted = true;

    const preloadFiles = async () => {
      try {
        const files = await loadFileList();
        if (mounted) {
          setCachedFileList(files);
          setIsLoadingFiles(false);
        }
      } catch (error) {
        if (mounted) {
          console.error('Failed to preload file list:', error);
          setIsLoadingFiles(false);
        }
      }
    };

    preloadFiles();

    return () => {
      mounted = false;
    };
  }, []);

  // Monitor input for '@' trigger
  useEffect(() => {
    console.log('[DEBUG] @ trigger check - input:', JSON.stringify(input));
    console.log('[DEBUG] isProcessing:', isProcessing, 'showFileBrowser:', showFileBrowser);

    if (isProcessing) {
      console.log('[DEBUG] Skipping @ detection - isProcessing is true');
      return; // Don't trigger while processing
    }

    const triggerInfo = detectAtTrigger(input);
    console.log('[DEBUG] detectAtTrigger result:', triggerInfo);

    if (triggerInfo.detected && !showFileBrowser) {
      // '@' detected, show file browser
      console.log('[DEBUG] Showing file browser - @ detected at position', triggerInfo.position);
      setShowFileBrowser(true);
      setAtPosition(triggerInfo.position);
      setFilterText(triggerInfo.filter);
    } else if (triggerInfo.detected && showFileBrowser) {
      // Update filter as user types
      console.log('[DEBUG] Updating filter:', triggerInfo.filter);
      setFilterText(triggerInfo.filter);
    } else if (!triggerInfo.detected && showFileBrowser) {
      // '@' removed, hide file browser
      console.log('[DEBUG] Hiding file browser - @ removed');
      setShowFileBrowser(false);
      setAtPosition(-1);
      setFilterText('');
    } else {
      console.log('[DEBUG] No action taken - detected:', triggerInfo.detected, 'showFileBrowser:', showFileBrowser);
    }
  }, [input, isProcessing, showFileBrowser]);

  // 키보드 단축키
  useInput((inputChar: string, key: { ctrl: boolean; shift: boolean; meta: boolean }) => {
    if (key.ctrl && inputChar === 'c') {
      exit();
    }
  });

  // Handle file selection from browser
  const handleFileSelect = (filePaths: string[]) => {
    // Insert file paths into input at @ position
    // Note: insertFilePaths adds a trailing space for continued typing
    const newInput = insertFilePaths(input, atPosition, filterText.length, filePaths);
    setInput(newInput);

    // Force TextInput to re-render with new value and reset cursor to end
    setInputKey((prev) => prev + 1);

    // Close file browser
    setShowFileBrowser(false);
    setAtPosition(-1);
    setFilterText('');
  };

  // Handle file browser cancellation
  const handleFileBrowserCancel = () => {
    // Close file browser but keep '@' in input
    setShowFileBrowser(false);
    setAtPosition(-1);
    setFilterText('');
  };

  const handleSubmit = async (value: string) => {
    // Prevent message submission while file browser is open
    if (!value.trim() || isProcessing || showFileBrowser) {
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
    setCurrentThinking('');

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ];
    setMessages(newMessages);

    try {
      // FILE_TOOLS import (dynamic import for ESM)
      const { FILE_TOOLS } = await import('../../tools/file-tools.js');

      // Tool calling과 함께 LLM 호출 (Non-streaming for tool support)
      const result = await llmClient.chatCompletionWithTools(
        newMessages,
        FILE_TOOLS,
        5 // maxIterations
      );

      // Tool 사용 내역이 있으면 표시 (콘솔 로그로 - UI는 나중에 개선 가능)
      if (result.toolCalls.length > 0) {
        // Tool calls가 있었음을 메시지에 표시
        const toolCallsInfo = result.toolCalls.map((call, idx) =>
          `${idx + 1}. ${call.tool}(${JSON.stringify(call.args)})`
        ).join('\n');

        // 나중에 UI 개선 시 별도로 표시 가능
        console.log('🔧 Tools used:\n' + toolCallsInfo);
      }

      // 메시지 히스토리 업데이트 (allMessages에는 tool call/response 포함)
      setMessages(result.allMessages);
      setCurrentResponse('');
      setCurrentThinking('');
    } catch (error) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        },
      ]);
      setCurrentThinking('');
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
            Commands: /exit /clear /help | @file for file inclusion | Ctrl+C to quit
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

        {/* Current thinking (if any) */}
        {isProcessing && currentThinking && (
          <Box marginBottom={1}>
            <Box marginRight={1}>
              <Text bold color="magenta">
                💭 Thinking:
              </Text>
            </Box>
            <Text dimColor>{currentThinking}</Text>
          </Box>
        )}

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
            <TextInput
              key={inputKey}
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
            />
          </Box>
        )}
      </Box>

      {/* File Browser (shown when '@' is typed) */}
      {showFileBrowser && !isProcessing && (
        <Box>
          {isLoadingFiles ? (
            <Box borderStyle="single" borderColor="yellow" paddingX={1}>
              <Text color="yellow">Loading file list...</Text>
            </Box>
          ) : (
            <FileBrowser
              filter={filterText}
              onSelect={handleFileSelect}
              onCancel={handleFileBrowserCancel}
              cachedFiles={cachedFileList}
            />
          )}
        </Box>
      )}
    </Box>
  );
};
