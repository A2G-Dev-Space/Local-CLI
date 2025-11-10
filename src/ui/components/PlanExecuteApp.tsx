/**
 * Plan & Execute Interactive App
 *
 * Enhanced interactive mode with Plan-and-Execute Architecture
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { LLMClient } from '../../core/llm-client.js';
import { Message, TodoItem } from '../../types/index.js';
import { PlanningLLM } from '../../core/planning-llm.js';
import { TodoExecutor } from '../../core/todo-executor.js';
import { TodoPanel, TodoStatusBar } from '../TodoPanel.js';
import { sessionManager } from '../../core/session-manager.js';
import { initializeDocsDirectory } from '../../core/docs-search-agent.js';
import { performDocsSearchIfNeeded } from '../../core/agent-framework-handler.js';
import { FileBrowser } from './FileBrowser.js';
import { SessionBrowser } from './SessionBrowser.js';
import { detectAtTrigger, insertFilePaths } from '../hooks/atFileProcessor.js';
import { loadFileList, FileItem } from '../hooks/useFileList.js';
import { BaseError } from '../../errors/base.js';
import { CommandBrowser } from './CommandBrowser.js';
import {
  detectSlashTrigger,
  insertSlashCommand,
  isValidCommand,
} from '../hooks/slashCommandProcessor.js';
import {
  executeSlashCommand,
  isSlashCommand,
  type CommandHandlerContext,
  type AppMode,
} from '../../core/slash-command-handler.js';

interface PlanExecuteAppProps {
  llmClient: LLMClient;
  modelInfo: {
    model: string;
    endpoint: string;
  };
}

/**
 * Format error for display with all available details
 */
function formatErrorMessage(error: unknown): string {
  if (error instanceof BaseError) {
    // Use custom error's userMessage which is designed for end users
    let message = `❌ ${error.getUserMessage()}\n`;

    // Add error code
    message += `\n📋 Error Code: ${error.code}`;

    // Add details if available and not empty
    if (error.details && Object.keys(error.details).length > 0) {
      message += `\n\n🔍 Details:`;
      for (const [key, value] of Object.entries(error.details)) {
        // Skip fullError as it's too verbose
        if (key === 'fullError') continue;

        if (typeof value === 'object') {
          message += `\n  • ${key}: ${JSON.stringify(value, null, 2)}`;
        } else {
          message += `\n  • ${key}: ${value}`;
        }
      }
    }

    // Add recovery hint
    if (error.isRecoverable) {
      message += `\n\n💡 이 오류는 복구 가능합니다. 다시 시도해보세요.`;
    }

    // Add timestamp
    message += `\n\n🕐 시간: ${error.timestamp.toLocaleString('ko-KR')}`;

    return message;
  }

  // Regular Error
  if (error instanceof Error) {
    let message = `❌ Error: ${error.message}\n`;

    if (error.stack) {
      message += `\n📚 Stack Trace:\n${error.stack}`;
    }

    return message;
  }

  // Unknown error type
  return `❌ Unknown Error: ${String(error)}`;
}

export const PlanExecuteApp: React.FC<PlanExecuteAppProps> = ({ llmClient, modelInfo }) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [mode, setMode] = useState<AppMode>('auto');

  // Plan & Execute specific state
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [currentTodoId, setCurrentTodoId] = useState<string | undefined>();
  const [showTodoPanel, setShowTodoPanel] = useState(true);
  const [executionPhase, setExecutionPhase] = useState<'idle' | 'planning' | 'executing'>('idle');

  // File browser state
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [atPosition, setAtPosition] = useState(-1);
  const [filterText, setFilterText] = useState('');
  const [inputKey, setInputKey] = useState(0); // Force TextInput re-render for cursor position

  // Pre-loaded file list cache (loaded once at startup)
  const [cachedFileList, setCachedFileList] = useState<FileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  // Command browser state
  const [showCommandBrowser, setShowCommandBrowser] = useState(false);
  const [partialCommand, setPartialCommand] = useState('');
  const [commandArgs, setCommandArgs] = useState('');

  // Session browser state
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);

  // Initialize docs directory on startup
  useEffect(() => {
    initializeDocsDirectory().catch(console.warn);
  }, []);

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
    if (isProcessing) {
      return; // Don't trigger while processing
    }

    const triggerInfo = detectAtTrigger(input);

    if (triggerInfo.detected && !showFileBrowser) {
      // '@' detected, show file browser
      setShowFileBrowser(true);
      setAtPosition(triggerInfo.position);
      setFilterText(triggerInfo.filter);
    } else if (triggerInfo.detected && showFileBrowser) {
      // Update filter as user types
      setFilterText(triggerInfo.filter);
    } else if (!triggerInfo.detected && showFileBrowser) {
      // '@' removed, hide file browser
      setShowFileBrowser(false);
      setAtPosition(-1);
      setFilterText('');
    }
  }, [input, isProcessing, showFileBrowser]);

  // Monitor input for '/' slash command trigger
  useEffect(() => {
    if (isProcessing) {
      return; // Don't trigger while processing
    }

    // Don't process empty input (happens after submit)
    if (!input) {
      return;
    }

    const slashInfo = detectSlashTrigger(input);

    if (slashInfo.detected && !showCommandBrowser) {
      // '/' detected at start, show command browser
      setShowCommandBrowser(true);
      setPartialCommand(slashInfo.partialCommand);
      setCommandArgs(slashInfo.args);
    } else if (slashInfo.detected && showCommandBrowser) {
      // Update partial command as user types
      setPartialCommand(slashInfo.partialCommand);
      setCommandArgs(slashInfo.args);
    } else if (!slashInfo.detected && showCommandBrowser) {
      // '/' removed or input doesn't match pattern, hide command browser
      setShowCommandBrowser(false);
      setPartialCommand('');
      setCommandArgs('');
    }
  }, [input, isProcessing, showCommandBrowser]);

  // Keyboard shortcuts
  useInput((inputChar: string, key: { ctrl: boolean; shift: boolean; meta: boolean; escape: boolean }) => {
    if (key.ctrl && inputChar === 'c') {
      exit();
    }
    // Toggle TODO panel with Ctrl+T
    if (key.ctrl && inputChar === 't') {
      setShowTodoPanel(!showTodoPanel);
    }
    // Switch modes with Tab
    if (inputChar === '\t' && !isProcessing) {
      const modes: AppMode[] = ['auto', 'direct', 'plan-execute'];
      const currentIndex = modes.indexOf(mode);
      const nextIndex = (currentIndex + 1) % modes.length;
      setMode(modes[nextIndex]!);
    }
  });

  // Handle file selection from browser
  const handleFileSelect = (filePaths: string[]) => {
    // Insert file paths into input at @ position
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

  // Handle command selection from browser
  const handleCommandSelect = (command: string, shouldSubmit: boolean) => {
    // Close command browser
    setShowCommandBrowser(false);
    setPartialCommand('');
    setCommandArgs('');

    if (shouldSubmit) {
      // Enter key: Submit the command directly
      handleSubmit(command);
    } else {
      // Tab key: Insert command into input for further editing (e.g., adding arguments)
      const newInput = insertSlashCommand(input, command);
      setInput(newInput);
      setInputKey((prev) => prev + 1);
    }
  };

  // Handle command browser cancellation
  const handleCommandBrowserCancel = () => {
    // Close command browser
    setShowCommandBrowser(false);
    setPartialCommand('');
    setCommandArgs('');
  };

  // Handle session selection from browser
  const handleSessionSelect = async (sessionId: string) => {
    // Close session browser
    setShowSessionBrowser(false);

    try {
      // Load session
      const sessionData = await sessionManager.loadSession(sessionId);
      
      if (!sessionData) {
        const errorMessage = `세션을 찾을 수 없습니다: ${sessionId}`;
        const updatedMessages = [
          ...messages,
          { role: 'assistant' as const, content: errorMessage },
        ];
        setMessages(updatedMessages);
        return;
      }

      const loadedMessages = sessionData.messages;
      setMessages(loadedMessages);
    } catch (error) {
      const errorMessage = `세션 로드 실패: ${error instanceof Error ? error.message : 'Unknown error'}`;
      const updatedMessages = [
        ...messages,
        { role: 'assistant' as const, content: errorMessage },
      ];
      setMessages(updatedMessages);
    }
  };

  // Handle session browser cancellation
  const handleSessionBrowserCancel = () => {
    // Close session browser
    setShowSessionBrowser(false);
  };

  // TODO update callback
  const handleTodoUpdate = useCallback((todo: TodoItem) => {
    setTodos(prev => prev.map(t => t.id === todo.id ? todo : t));
    if (todo.status === 'in_progress') {
      setCurrentTodoId(todo.id);
    } else if (todo.status === 'completed' || todo.status === 'failed') {
      if (currentTodoId === todo.id) {
        setCurrentTodoId(undefined);
      }
    }
  }, [currentTodoId]);

  const handleDirectMode = async (userMessage: string) => {
    // Direct mode - same as original InteractiveApp
    try {
      // Perform docs search if framework keywords detected
      const { messages: messagesWithDocs } =
        await performDocsSearchIfNeeded(llmClient, userMessage, messages);

      const { FILE_TOOLS } = await import('../../tools/file-tools.js');

      const result = await llmClient.chatCompletionWithTools(
        messagesWithDocs.concat({ role: 'user', content: userMessage }),
        FILE_TOOLS,
        5
      );

      setMessages(result.allMessages);
      setCurrentResponse('');

      // Auto-save current session (fire-and-forget)
      sessionManager.autoSaveCurrentSession(result.allMessages);
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      const updatedMessages: Message[] = [
        ...messages,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: errorMessage }
      ];
      setMessages(updatedMessages);

      // Auto-save even on error (fire-and-forget)
      sessionManager.autoSaveCurrentSession(updatedMessages);
    }
  };

  const handlePlanExecuteMode = async (userMessage: string) => {
    // Plan & Execute mode
    setExecutionPhase('planning');

    try {
      // 1. Generate TODO list
      const planningLLM = new PlanningLLM(llmClient);
      const planResult = await planningLLM.generateTODOList(userMessage);

      // Validate and sort TODOs
      if (planningLLM.validateDependencies(planResult.todos)) {
        const sortedTodos = planningLLM.sortByDependencies(planResult.todos);
        setTodos(sortedTodos);
      } else {
        setTodos(planResult.todos); // Use as-is if validation fails
      }

      // Add planning message
      const planningMessage = `📋 Created ${planResult.todos.length} tasks to complete your request\n` +
        `Estimated time: ${planResult.estimatedTime}\n` +
        `Complexity: ${planResult.complexity}`;

      setMessages([
        ...messages,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: planningMessage }
      ]);

      // 2. Execute TODOs
      setExecutionPhase('executing');

      const executor = new TodoExecutor(llmClient, handleTodoUpdate);
      const executionResult = await executor.executeAll(
        planResult.todos,
        [
          ...messages,
          { role: 'user', content: userMessage }
        ]
      );

      // Update with final messages
      setMessages(executionResult.messages);
      setTodos(executionResult.todos);

      // Auto-save current session (fire-and-forget)
      sessionManager.autoSaveCurrentSession(executionResult.messages);

    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      const updatedMessages: Message[] = [
        ...messages,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: `Plan & Execute 모드 실행 중 오류 발생:\n\n${errorMessage}` }
      ];
      setMessages(updatedMessages);

      // Auto-save even on error (fire-and-forget)
      sessionManager.autoSaveCurrentSession(updatedMessages);
    } finally {
      setExecutionPhase('idle');
    }
  };

  const handleSubmit = async (value: string) => {
    // Prevent message submission while file browser or session browser is open
    if (!value.trim() || isProcessing || showFileBrowser || showSessionBrowser) {
      return;
    }

    // Allow submission if command browser is open but command is valid
    if (showCommandBrowser && !isValidCommand(value.trim())) {
      return;
    }

    const userMessage = value.trim();

    // Close command browser if open (before clearing input)
    if (showCommandBrowser) {
      setShowCommandBrowser(false);
      setPartialCommand('');
      setCommandArgs('');
    }

    setInput('');
    setInputKey((prev) => prev + 1);

    if (isSlashCommand(userMessage)) {
      const commandContext: CommandHandlerContext = {
        mode,
        messages,
        todos,
        setMode,
        setMessages,
        setTodos,
        exit,
        // Provide UI control callback for SessionBrowser
        onShowSessionBrowser: () => {
          setShowSessionBrowser(true);
        },
      };

      const result = await executeSlashCommand(userMessage, commandContext);

      if (result.handled) {
        return;
      }
    }

    setIsProcessing(true);

    try {
      // Determine whether to use Plan & Execute based on mode and request complexity
      let usePlanExecute = false;

      if (mode === 'plan-execute') {
        usePlanExecute = true;
      } else if (mode === 'auto') {
        // Auto-detect based on keywords or complexity
        const complexKeywords = [
          'create', 'build', 'implement', 'develop', 'make',
          'setup', 'configure', 'install', 'deploy', 'design',
          'refactor', 'optimize', 'debug', 'test', 'analyze',
          'multiple', 'several', 'tasks', 'steps'
        ];

        const lowerMessage = userMessage.toLowerCase();
        usePlanExecute = complexKeywords.some(keyword => lowerMessage.includes(keyword));
      }

      if (usePlanExecute) {
        await handlePlanExecuteMode(userMessage);
      } else {
        await handleDirectMode(userMessage);
      }

    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Box justifyContent="space-between" width="100%">
          <Text bold color="cyan">
            OPEN-CLI Interactive Mode
          </Text>
          <Text color="gray">
            Model: {modelInfo.model} | Mode: {mode}
          </Text>
        </Box>
      </Box>

      {/* Messages Area */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {messages.slice(-10).map((msg, idx) => (
          <Box key={idx} marginBottom={1}>
            {msg.role === 'user' ? (
              <Text color="green">
                <Text bold>You: </Text>{msg.content}
              </Text>
            ) : msg.role === 'assistant' ? (
              <Text color="cyan">
                <Text bold>AI: </Text>{msg.content}
              </Text>
            ) : null}
          </Box>
        ))}

        {currentResponse && (
          <Box>
            <Text color="cyan">
              <Text bold>AI: </Text>{currentResponse}
            </Text>
          </Box>
        )}
      </Box>

      {/* TODO Panel (if in Plan & Execute mode) */}
      {showTodoPanel && todos.length > 0 && (
        <Box marginY={1}>
          <TodoPanel
            todos={todos}
            currentTodoId={currentTodoId}
            showDetails={executionPhase === 'executing'}
          />
        </Box>
      )}

      {/* Input Area */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Box>
          <Text color="green" bold>You: </Text>
          <Box flexGrow={1}>
            <TextInput
              key={inputKey}
              value={input}
              onChange={(value) => {
                // Block input while SessionBrowser is open
                if (showSessionBrowser) {
                  return;
                }
                setInput(value);
              }}
              onSubmit={handleSubmit}
              placeholder={
                isProcessing 
                  ? "Processing..." 
                  : showSessionBrowser 
                  ? "Select a session or press ESC to cancel..."
                  : "Type your message..."
              }
            />
          </Box>
        </Box>
      </Box>

      {/* File Browser (shown when '@' is typed) */}
      {showFileBrowser && !isProcessing && (
        <Box marginTop={0}>
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

      {/* Command Browser (shown when '/' is typed at start) */}
      {showCommandBrowser && !isProcessing && !showFileBrowser && (
        <Box marginTop={0}>
          <CommandBrowser
            partialCommand={partialCommand}
            args={commandArgs}
            onSelect={handleCommandSelect}
            onCancel={handleCommandBrowserCancel}
          />
        </Box>
      )}

      {/* Session Browser (shown when /load command is submitted) */}
      {showSessionBrowser && !isProcessing && (
        <Box marginTop={0}>
          <SessionBrowser
            onSelect={handleSessionSelect}
            onCancel={handleSessionBrowserCancel}
          />
        </Box>
      )}

      {/* Status Bar */}
      <Box justifyContent="space-between" paddingX={1}>
        <Box>
          {isProcessing && (
            <Text color="yellow">
              <Spinner type="dots" />
              {executionPhase === 'planning' ? ' Planning...' :
               executionPhase === 'executing' ? ' Executing...' : ' Processing...'}
            </Text>
          )}
        </Box>
        <Box>
          {todos.length > 0 && (
            <TodoStatusBar todos={todos} />
          )}
        </Box>
        <Text color="gray" dimColor>
          Tab: switch mode | Ctrl+T: toggle TODOs | /help: commands
        </Text>
      </Box>
    </Box>
  );
};

export default PlanExecuteApp;