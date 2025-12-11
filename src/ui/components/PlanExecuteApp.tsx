/**
 * Plan & Execute Interactive App
 *
 * Enhanced interactive mode with Plan-and-Execute Architecture
 * Refactored to use modular hooks and components
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp, Static } from 'ink';
import Spinner from 'ink-spinner';

/**
 * Log entry types for Static scrollable output
 */
export type LogEntryType =
  | 'logo'
  | 'user_input'
  | 'assistant_message'
  | 'tool_start'
  | 'tool_result'
  | 'tell_user'
  | 'plan_created'
  | 'todo_start'
  | 'todo_complete'
  | 'todo_fail'
  | 'compact';

export interface LogEntry {
  id: string;
  type: LogEntryType;
  content: string;
  details?: string;
  toolArgs?: Record<string, unknown>;  // For tool_start (all args)
  success?: boolean;
  items?: string[];  // For plan_created (todo list)
  diff?: string[];   // For tool_result with diff
}
import { CustomTextInput } from './CustomTextInput.js';
import { LLMClient, createLLMClient } from '../../core/llm/llm-client.js';
import { Message } from '../../types/index.js';
import { TodoPanel, TodoStatusBar } from '../TodoPanel.js';
import { sessionManager } from '../../core/session/session-manager.js';
import { initializeDocsDirectory } from '../../core/knowledge/docs-search-agent.js';
import { FileBrowser } from './FileBrowser.js';
import { SessionBrowser } from './panels/SessionPanel.js';
import { SettingsBrowser } from './dialogs/SettingsDialog.js';
import { LLMSetupWizard } from './LLMSetupWizard.js';
import { ModelSelector } from './ModelSelector.js';
import { AskUserDialog } from './dialogs/AskUserDialog.js';
import { DocsBrowser } from './dialogs/DocsBrowser.js';
import { CommandBrowser } from './CommandBrowser.js';
// ChatView removed - using Static log instead
import { Logo } from './Logo.js';
import { ActivityIndicator, type ActivityType, type SubActivity } from './ActivityIndicator.js';
import { useFileBrowserState } from '../hooks/useFileBrowserState.js';
import { useCommandBrowserState } from '../hooks/useCommandBrowserState.js';
import { usePlanExecution } from '../hooks/usePlanExecution.js';
import { isValidCommand } from '../hooks/slashCommandProcessor.js';
import {
  executeSlashCommand,
  isSlashCommand,
  type CommandHandlerContext,
  type PlanningMode,
} from '../../core/slash-command-handler.js';
import { closeJsonStreamLogger } from '../../utils/json-stream-logger.js';
import { configManager } from '../../core/config/config-manager.js';
import { logger } from '../../utils/logger.js';
import { usageTracker } from '../../core/usage-tracker.js';
import {
  setToolExecutionCallback,
  setTellToUserCallback,
  setToolResponseCallback,
  setPlanCreatedCallback,
  setTodoStartCallback,
  setTodoCompleteCallback,
  setTodoFailCallback,
  setCompactCallback,
} from '../../tools/llm/simple/file-tools.js';
import { createRequire } from 'module';

// Get version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../../../package.json') as { version: string };
const VERSION = pkg.version;

// Initialization steps for detailed progress display
type InitStep = 'docs' | 'config' | 'health' | 'done';

// Helper functions for status bar
function formatElapsedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatTokensCompact(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(2)}M`;
}

interface PlanExecuteAppProps {
  llmClient: LLMClient | null;
  modelInfo: {
    model: string;
    endpoint: string;
  };
}

export const PlanExecuteApp: React.FC<PlanExecuteAppProps> = ({ llmClient: initialLlmClient, modelInfo }) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // Planning mode is always 'auto' - mode selection has been removed
  const planningMode: PlanningMode = 'auto';

  // LLM Client state - 모델 변경 시 새로운 클라이언트로 교체
  const [llmClient, setLlmClient] = useState<LLMClient | null>(initialLlmClient);

  // Activity tracking for detailed status display
  const [activityType, setActivityType] = useState<ActivityType>('thinking');
  const [activityStartTime, setActivityStartTime] = useState<number>(Date.now());
  const [activityDetail, setActivityDetail] = useState<string>('');
  const [subActivities, setSubActivities] = useState<SubActivity[]>([]);

  // Session usage tracking for Claude Code style status bar
  const [sessionTokens, setSessionTokens] = useState(0);
  const [sessionElapsed, setSessionElapsed] = useState(0);

  // Session browser state
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);

  // Settings browser state
  const [showSettings, setShowSettings] = useState(false);

  // LLM Setup Wizard state
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStep, setInitStep] = useState<InitStep>('docs');
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'unhealthy' | 'unknown'>('checking');

  // Model Selector state
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModelInfo, setCurrentModelInfo] = useState(modelInfo);

  // Docs Browser state
  const [showDocsBrowser, setShowDocsBrowser] = useState(false);

  // TODO Panel details toggle state
  const [showTodoDetails, setShowTodoDetails] = useState(true);

  // Static log entries for scrollable history
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const logIdCounter = React.useRef(0);

  // Helper: add log entry
  const addLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    const id = `log-${++logIdCounter.current}`;
    setLogEntries(prev => [...prev, { ...entry, id }]);
  }, []);

  // Helper: clear logs (for compact)
  const clearLogs = useCallback(() => {
    setLogEntries([]);
    logIdCounter.current = 0;
  }, []);

  // Use modular hooks
  const fileBrowserState = useFileBrowserState(input, isProcessing);
  const commandBrowserState = useCommandBrowserState(input, isProcessing);
  const planExecutionState = usePlanExecution();

  // Print logo at startup
  useEffect(() => {
    addLog({
      type: 'logo',
      content: `v${VERSION} │ ${modelInfo.model}`,
    });
  }, []);

  // Log component mount
  useEffect(() => {
    logger.enter('PlanExecuteApp', { modelInfo });
    return () => {
      logger.exit('PlanExecuteApp', { messageCount: messages.length });
    };
  }, []);

  // Setup tool execution callback - adds to Static log
  useEffect(() => {
    setToolExecutionCallback((toolName, reason, args) => {
      addLog({
        type: 'tool_start',
        content: toolName,
        details: reason,  // reason은 축약하지 않음
        toolArgs: args,
      });
      logger.debug('Tool execution started', { toolName, reason, args });
    });

    return () => {
      setToolExecutionCallback(null);
    };
  }, [addLog]);

  // Setup tool response callback - adds to Static log
  useEffect(() => {
    setToolResponseCallback((toolName, success, result) => {
      // diff 내용 파싱 시도
      let diff: string[] | undefined;
      try {
        const parsed = JSON.parse(result);
        if (parsed.diff && Array.isArray(parsed.diff)) {
          diff = parsed.diff;
        }
      } catch {
        // not JSON, use as-is
      }

      addLog({
        type: 'tool_result',
        content: toolName,
        details: result,  // 전체 내용 보존
        success,
        diff,
      });
      logger.debug('Tool execution completed', { toolName, success, result });
    });

    return () => {
      setToolResponseCallback(null);
    };
  }, [addLog]);

  // Setup tell_to_user callback - adds to Static log
  useEffect(() => {
    setTellToUserCallback((message) => {
      addLog({
        type: 'tell_user',
        content: message,  // 축약하지 않음
      });
      logger.debug('Message to user', { message });
    });

    return () => {
      setTellToUserCallback(null);
    };
  }, [addLog]);

  // Setup plan/todo callbacks - adds to Static log
  useEffect(() => {
    setPlanCreatedCallback((todoTitles) => {
      addLog({
        type: 'plan_created',
        content: `${todoTitles.length}개의 작업을 생성했습니다`,
        items: todoTitles,
      });
    });

    setTodoStartCallback((title) => {
      addLog({
        type: 'todo_start',
        content: title,
      });
    });

    setTodoCompleteCallback((title) => {
      addLog({
        type: 'todo_complete',
        content: title,
      });
    });

    setTodoFailCallback((title) => {
      addLog({
        type: 'todo_fail',
        content: title,
      });
    });

    setCompactCallback((originalCount, newCount) => {
      // Clear existing logs and add compact entry
      clearLogs();
      addLog({
        type: 'compact',
        content: `Conversation compacted: ${originalCount} → ${newCount} messages`,
      });
    });

    return () => {
      setPlanCreatedCallback(null);
      setTodoStartCallback(null);
      setTodoCompleteCallback(null);
      setTodoFailCallback(null);
      setCompactCallback(null);
    };
  }, [addLog, clearLogs]);

  // Update session usage and elapsed time in real-time
  useEffect(() => {
    if (!isProcessing) {
      return;
    }

    const interval = setInterval(() => {
      const sessionUsage = usageTracker.getSessionUsage();
      setSessionTokens(sessionUsage.totalTokens);
      setSessionElapsed(usageTracker.getSessionElapsedSeconds());
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [isProcessing]);

  // Initialize on startup: check LLM configuration and run health check
  useEffect(() => {
    const initialize = async () => {
      logger.flow('Starting initialization');
      logger.startTimer('app-init');

      try {
        // Step 1: Initialize docs directory
        setInitStep('docs');
        logger.flow('Initializing docs directory');
        await initializeDocsDirectory().catch((err) => {
          logger.warn('Docs directory initialization warning', { error: err });
        });

        // Step 2: Check config
        setInitStep('config');
        logger.flow('Checking configuration');
        if (!configManager.hasEndpoints()) {
          logger.debug('No endpoints configured, showing setup wizard');
          setShowSetupWizard(true);
          setIsInitializing(false);
          setHealthStatus('unknown');
          logger.endTimer('app-init');
          return;
        }

        // Step 3: Run health check
        setInitStep('health');
        logger.flow('Running health check');
        setHealthStatus('checking');
        const healthResults = await LLMClient.healthCheckAll();

        // Check if any model is healthy
        let hasHealthy = false;
        for (const [endpointId, modelResults] of healthResults) {
          logger.vars(
            { name: 'endpointId', value: endpointId },
            { name: 'healthyModels', value: modelResults.filter(r => r.healthy).length }
          );
          if (modelResults.some((r) => r.healthy)) {
            hasHealthy = true;
          }
        }

        logger.state('Health status', 'checking', hasHealthy ? 'healthy' : 'unhealthy');
        setHealthStatus(hasHealthy ? 'healthy' : 'unhealthy');

        // Update health status in config
        await configManager.updateAllHealthStatus(healthResults);

        setInitStep('done');
      } catch (error) {
        logger.error('Initialization failed', error as Error);
        setHealthStatus('unknown');
      } finally {
        setIsInitializing(false);
        logger.endTimer('app-init');
      }
    };

    initialize();
  }, []);

  // Wrapped exit function to ensure cleanup
  const handleExit = useCallback(async () => {
    logger.flow('Exiting application');
    await closeJsonStreamLogger();
    exit();
  }, [exit]);

  // Keyboard shortcuts
  useInput((inputChar: string, key: { ctrl: boolean; shift: boolean; meta: boolean; escape: boolean; tab?: boolean }) => {
    // Ctrl+C: Exit application
    if (key.ctrl && inputChar === 'c') {
      handleExit().catch(console.error);
    }
    // Ctrl+T: Toggle TODO details
    if (key.ctrl && inputChar === 't') {
      setShowTodoDetails(prev => !prev);
      logger.debug('TODO details toggled', { showTodoDetails: !showTodoDetails });
    }
    // ESC: Interrupt current execution
    if (key.escape && isProcessing) {
      logger.flow('ESC pressed - interrupting execution');
      planExecutionState.handleInterrupt();
    }
    // Tab key mode cycling has been removed - always use auto mode
  }, { isActive: !fileBrowserState.showFileBrowser && !commandBrowserState.showCommandBrowser });

  // Handle file selection from browser
  const handleFileSelect = useCallback((filePaths: string[]) => {
    logger.debug('File selected', { filePaths });
    const newInput = fileBrowserState.handleFileSelect(filePaths, input);
    setInput(newInput);
  }, [fileBrowserState, input]);

  // Handle command selection from browser
  const handleCommandSelect = useCallback((command: string, shouldSubmit: boolean) => {
    logger.debug('Command selected', { command, shouldSubmit });
    const result = commandBrowserState.handleCommandSelect(command, shouldSubmit, input, handleSubmit);
    if (result !== null) {
      setInput(result);
    }
  }, [commandBrowserState, input]);

  // Handle session selection from browser
  const handleSessionSelect = useCallback(async (sessionId: string) => {
    logger.enter('handleSessionSelect', { sessionId });
    setShowSessionBrowser(false);

    try {
      const sessionData = await sessionManager.loadSession(sessionId);

      if (!sessionData) {
        const errorMessage = `세션을 찾을 수 없습니다: ${sessionId}`;
        logger.warn('Session not found', { sessionId });
        setMessages(prev => [
          ...prev,
          { role: 'assistant' as const, content: errorMessage },
        ]);
        return;
      }

      logger.debug('Session loaded', { sessionId, messageCount: sessionData.messages.length });
      setMessages(sessionData.messages);
    } catch (error) {
      const errorMessage = `세션 로드 실패: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(`Session load failed (sessionId: ${sessionId})`, error as Error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant' as const, content: errorMessage },
      ]);
    }
    logger.exit('handleSessionSelect', { sessionId });
  }, []);

  // Planning mode change handler removed - always auto mode
  // Kept for backward compatibility with SettingsBrowser interface
  const handleSettingsPlanningModeChange = useCallback((_mode: PlanningMode) => {
    // No-op: planning mode is always 'auto'
    logger.debug('Planning mode change ignored - always auto');
  }, []);

  // Handle settings close
  const handleSettingsClose = useCallback(() => {
    logger.debug('Settings closed');
    setShowSettings(false);
  }, []);

  // Handle setup wizard completion
  const handleSetupComplete = useCallback(() => {
    logger.debug('Setup wizard completed');
    setShowSetupWizard(false);

    // Reload config and create LLMClient
    try {
      const endpoint = configManager.getCurrentEndpoint();
      const model = configManager.getCurrentModel();

      if (endpoint && model) {
        setCurrentModelInfo({
          model: model.name,
          endpoint: endpoint.baseUrl,
        });

        const newClient = createLLMClient();
        setLlmClient(newClient);
        logger.debug('LLMClient created after setup', { modelId: model.id, modelName: model.name });
      }
    } catch (error) {
      logger.error('Failed to create LLMClient after setup', error as Error);
    }
  }, []);

  // Handle setup wizard skip
  const handleSetupSkip = useCallback(() => {
    logger.debug('Setup wizard skipped');
    setShowSetupWizard(false);
  }, []);

  // Handle model selection
  const handleModelSelect = useCallback(
    (endpointId: string, modelId: string) => {
      logger.enter('handleModelSelect', { endpointId, modelId });
      const endpoint = configManager.getAllEndpoints().find((ep) => ep.id === endpointId);
      const model = endpoint?.models.find((m) => m.id === modelId);

      if (endpoint && model) {
        logger.state('Current model', currentModelInfo.model, model.name);
        setCurrentModelInfo({
          model: model.name,
          endpoint: endpoint.baseUrl,
        });

        // 새로운 LLMClient 생성 (configManager에 이미 저장되어 있으므로 새로 생성하면 됨)
        try {
          const newClient = createLLMClient();
          setLlmClient(newClient);
          logger.debug('LLMClient recreated with new model', { modelId, modelName: model.name });
        } catch (error) {
          logger.error('Failed to create new LLMClient', error as Error);
        }
      }

      setShowModelSelector(false);

      // Add confirmation message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant' as const,
          content: `모델이 변경되었습니다: ${model?.name || modelId} (${endpoint?.name || endpointId})`,
        },
      ]);
      logger.exit('handleModelSelect', { model: model?.name });
    },
    [currentModelInfo.model]
  );

  // Handle model selector cancel
  const handleModelSelectorCancel = useCallback(() => {
    logger.debug('Model selector cancelled');
    setShowModelSelector(false);
  }, []);

  const handleSubmit = useCallback(async (value: string) => {
    if (!value.trim() || isProcessing || fileBrowserState.showFileBrowser || showSessionBrowser || showSettings || showSetupWizard || showDocsBrowser) {
      return;
    }

    logger.enter('handleSubmit', { valueLength: value.length });

    const userMessage = value.trim();

    // Allow /settings command even without LLM configured
    const isSettingsCommand = userMessage === '/settings';

    if (!llmClient && !isSettingsCommand) {
      logger.warn('LLM client not configured');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant' as const, content: 'LLM이 설정되지 않았습니다. /settings → LLMs에서 설정해주세요.' },
      ]);
      return;
    }

    if (commandBrowserState.showCommandBrowser && !isValidCommand(userMessage)) {
      return;
    }

    if (commandBrowserState.showCommandBrowser) {
      commandBrowserState.resetCommandBrowser();
    }

    setInput('');

    // Handle slash commands
    if (isSlashCommand(userMessage)) {
      logger.flow('Executing slash command');
      const commandContext: CommandHandlerContext = {
        planningMode,
        messages,
        todos: planExecutionState.todos,
        setPlanningMode: () => {}, // No-op: planning mode is always 'auto'
        setMessages,
        setTodos: planExecutionState.setTodos,
        exit: handleExit,
        onShowSessionBrowser: () => setShowSessionBrowser(true),
        onShowSettings: () => setShowSettings(true),
        onShowModelSelector: () => setShowModelSelector(true),
        onShowDocsBrowser: () => setShowDocsBrowser(true),
        onCompact: llmClient
          ? () => planExecutionState.performCompact(llmClient, messages, setMessages)
          : undefined,
      };

      const result = await executeSlashCommand(userMessage, commandContext);

      if (result.handled) {
        logger.exit('handleSubmit', { handled: true });
        return;
      }
    }

    // Add user input to Static log
    addLog({
      type: 'user_input',
      content: userMessage,
    });

    // Add user message to messages immediately
    const updatedMessages: Message[] = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(updatedMessages);

    setIsProcessing(true);
    setActivityStartTime(Date.now());
    setSubActivities([]);

    // Reset session usage for new task
    usageTracker.resetSession();
    setSessionTokens(0);
    setSessionElapsed(0);

    logger.startTimer('message-processing');

    try {
      // Check for auto-compact before processing (80% threshold)
      if (planExecutionState.shouldAutoCompact()) {
        logger.flow('Auto-compact triggered');
        setActivityType('thinking');
        setActivityDetail('Compacting conversation...');

        const compactResult = await planExecutionState.performCompact(llmClient!, updatedMessages, setMessages);
        if (compactResult.success) {
          logger.debug('Auto-compact completed', {
            originalCount: compactResult.originalMessageCount,
            newCount: compactResult.newMessageCount,
          });
        } else {
          logger.warn('Auto-compact failed, continuing without compact', { error: compactResult.error });
        }
      }

      // Phase 1: Use auto mode with LLM-based request classification
      setActivityType('thinking');
      setActivityDetail('Analyzing request...');

      logger.vars(
        { name: 'planningMode', value: planningMode },
        { name: 'messageLength', value: userMessage.length }
      );

      // Use executeAutoMode which handles classification internally
      await planExecutionState.executeAutoMode(userMessage, llmClient!, updatedMessages, setMessages);

    } catch (error) {
      logger.error('Message processing failed', error as Error);
    } finally {
      setIsProcessing(false);
      logger.endTimer('message-processing');
      logger.exit('handleSubmit', { success: true });
    }
  }, [
    isProcessing,
    fileBrowserState.showFileBrowser,
    showSessionBrowser,
    showSettings,
    showSetupWizard,
    showDocsBrowser,
    commandBrowserState,
    planningMode,
    messages,
    planExecutionState,
    llmClient,
    handleExit,
  ]);

  // Show loading screen with logo during initialization
  if (isInitializing) {
    const getInitStepInfo = () => {
      switch (initStep) {
        case 'docs':
          return { icon: '📚', text: 'Initializing docs directory...', progress: 1 };
        case 'config':
          return { icon: '⚙️', text: 'Checking configuration...', progress: 2 };
        case 'health':
          return { icon: '🏥', text: 'Running health check...', progress: 3 };
        default:
          return { icon: '✓', text: 'Ready!', progress: 4 };
      }
    };

    const stepInfo = getInitStepInfo();

    return (
      <Box flexDirection="column" alignItems="center" paddingY={2}>
        <Logo showVersion={true} showTagline={true} />

        <Box marginTop={2} flexDirection="column" alignItems="center">
          <Box>
            <Spinner type="dots" />
            <Text color="yellow"> {stepInfo.icon} {stepInfo.text}</Text>
          </Box>

          {/* Progress indicator */}
          <Box marginTop={1}>
            <Text color={stepInfo.progress >= 1 ? 'green' : 'gray'}>●</Text>
            <Text color="gray"> → </Text>
            <Text color={stepInfo.progress >= 2 ? 'green' : 'gray'}>●</Text>
            <Text color="gray"> → </Text>
            <Text color={stepInfo.progress >= 3 ? 'green' : 'gray'}>●</Text>
            <Text color="gray"> → </Text>
            <Text color={stepInfo.progress >= 4 ? 'green' : 'gray'}>●</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Show setup wizard if no endpoints configured
  if (showSetupWizard) {
    return (
      <Box flexDirection="column" padding={1}>
        <LLMSetupWizard onComplete={handleSetupComplete} onSkip={handleSetupSkip} />
      </Box>
    );
  }

  // Get health status indicator
  const getHealthIndicator = () => {
    switch (healthStatus) {
      case 'checking':
        return <Text color="yellow">⋯</Text>;
      case 'healthy':
        return <Text color="green">●</Text>;
      case 'unhealthy':
        return <Text color="red">●</Text>;
      default:
        return <Text color="gray">○</Text>;
    }
  };

  // Get activity type based on execution phase
  const getCurrentActivityType = (): ActivityType => {
    if (planExecutionState.executionPhase === 'planning') return 'planning';
    if (planExecutionState.executionPhase === 'executing') return 'executing';
    return activityType;
  };

  // Render a single log entry
  const renderLogEntry = (entry: LogEntry) => {
    switch (entry.type) {
      case 'logo':
        return (
          <Box key={entry.id} flexDirection="column" marginBottom={1}>
            <Text>{' '}</Text>
            <Text>{' '}</Text>
            <Text>{' '}</Text>
            <Text bold><Text color="cyanBright">   ____  </Text><Text color="cyan">_____  </Text><Text color="cyanBright">______ </Text><Text color="cyan">_   _   </Text><Text color="greenBright">     _____ </Text><Text color="green">_      </Text><Text color="greenBright">_____ </Text></Text>
            <Text bold><Text color="cyanBright">  / __ \ </Text><Text color="cyan">|  __ \</Text><Text color="cyanBright">|  ____</Text><Text color="cyan">| \ | |  </Text><Text color="greenBright">    / ____</Text><Text color="green">| |    </Text><Text color="greenBright">|_   _|</Text></Text>
            <Text bold><Text color="cyanBright"> | |  | |</Text><Text color="cyan"> |__) </Text><Text color="cyanBright">| |__  </Text><Text color="cyan">|  \| |</Text><Text color="yellow">_____</Text><Text color="greenBright">| |    </Text><Text color="green">| |      </Text><Text color="greenBright">| |  </Text></Text>
            <Text bold><Text color="cyan"> | |  | |</Text><Text color="blue"> ___/ </Text><Text color="cyan">|  __| </Text><Text color="blue">| . ` |</Text><Text color="yellow">_____</Text><Text color="green">| |    </Text><Text color="greenBright">| |      </Text><Text color="green">| |  </Text></Text>
            <Text bold><Text color="blue"> | |__| |</Text><Text color="blueBright"> |    </Text><Text color="blue">| |____</Text><Text color="blueBright">| |\  |  </Text><Text color="green">   | |____</Text><Text color="greenBright">| |____ </Text><Text color="green">_| |_ </Text></Text>
            <Text bold><Text color="blueBright">  \____/</Text><Text color="magenta">|_|    </Text><Text color="blueBright">|______</Text><Text color="magenta">|_| \_|  </Text><Text color="greenBright">    \_____</Text><Text color="green">|______</Text><Text color="greenBright">|_____|</Text></Text>
            <Text color="gray">                    {entry.content}</Text>
          </Box>
        );

      case 'user_input':
        return (
          <Box key={entry.id} marginTop={1}>
            <Text color="green" bold>❯ </Text>
            <Text>{entry.content}</Text>
          </Box>
        );

      case 'assistant_message':
        return (
          <Box key={entry.id} marginTop={1}>
            <Text color="magenta" bold>● </Text>
            <Text>{entry.content}</Text>
          </Box>
        );

      case 'tool_start': {
        // Tool별 핵심 파라미터 추출
        const getToolParams = (toolName: string, args: Record<string, unknown> | undefined): string => {
          if (!args) return '';
          switch (toolName) {
            case 'read_file':
              return args['file_path'] as string || '';
            case 'create_file':
              return args['file_path'] as string || '';
            case 'edit_file': {
              const filePath = args['file_path'] as string || '';
              const edits = args['edits'] as Array<unknown> || [];
              return `${filePath}, ${edits.length} edits`;
            }
            case 'list_files': {
              const dir = args['directory_path'] as string || '.';
              const recursive = args['recursive'] ? ', recursive' : '';
              return `${dir}${recursive}`;
            }
            case 'find_files': {
              const pattern = args['pattern'] as string || '';
              const dir = args['directory_path'] as string;
              return dir ? `${pattern} in ${dir}` : pattern;
            }
            case 'tell_to_user':
              return '';  // tell_to_user는 파라미터 표시 안함
            default:
              return '';
          }
        };

        const params = getToolParams(entry.content, entry.toolArgs);

        return (
          <Box key={entry.id} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="cyan" bold>● {entry.content}</Text>
              {params && <Text color="gray">({params})</Text>}
            </Box>
            {entry.details && (
              <Box marginLeft={2}>
                <Text color="gray">⎿  </Text>
                <Text>{entry.details}</Text>
              </Box>
            )}
          </Box>
        );
      }

      case 'tool_result': {
        // diff가 있으면 전체 diff 표시
        if (entry.diff && entry.diff.length > 0) {
          return (
            <Box key={entry.id} flexDirection="column" marginLeft={2}>
              <Box>
                <Text color="gray">⎿  </Text>
                <Text color={entry.success ? 'green' : 'red'}>{entry.success ? '✓' : '✗'} </Text>
                <Text color="gray">{entry.success ? 'Updated' : 'Failed'}</Text>
              </Box>
              {entry.diff.map((line, idx) => (
                <Box key={idx} marginLeft={3}>
                  <Text color={line.includes(' + ') ? 'green' : line.includes(' - ') ? 'red' : 'gray'}>
                    {line}
                  </Text>
                </Box>
              ))}
            </Box>
          );
        }

        // tell_to_user 결과는 표시하지 않음 (tell_user 로그에서 이미 표시)
        if (entry.content === 'tell_to_user') {
          return null;
        }

        // list_files, find_files 결과 축약
        let displayText = entry.details || '';
        if (entry.content === 'list_files' || entry.content === 'find_files') {
          try {
            const parsed = JSON.parse(displayText);
            if (Array.isArray(parsed)) {
              const count = parsed.length;
              const preview = parsed.slice(0, 3).map((f: { name?: string; path?: string }) => f.name || f.path || '').join(', ');
              displayText = `${count}개 항목${count > 3 ? ` (${preview}, ...)` : count > 0 ? ` (${preview})` : ''}`;
            }
          } catch {
            // JSON 파싱 실패시 원본 텍스트 축약
            if (displayText.length > 100) {
              displayText = displayText.substring(0, 100) + '...';
            }
          }
        }

        // 일반 결과
        return (
          <Box key={entry.id} marginLeft={2}>
            <Text color="gray">⎿  </Text>
            <Text color={entry.success ? 'green' : 'red'}>{entry.success ? '✓' : '✗'} </Text>
            <Text color={entry.success ? 'gray' : 'red'}>{displayText}</Text>
          </Box>
        );
      }

      case 'tell_user':
        return (
          <Box key={entry.id} marginTop={1}>
            <Text color="yellow" bold>● </Text>
            <Text>{entry.content}</Text>
          </Box>
        );

      case 'plan_created':
        return (
          <Box key={entry.id} flexDirection="column" marginTop={1}>
            <Text color="magenta" bold>● 📋 {entry.content}</Text>
            {entry.items?.map((item, idx) => (
              <Box key={idx} marginLeft={2}>
                <Text color="gray">⎿  </Text>
                <Text>{idx + 1}. {item}</Text>
              </Box>
            ))}
          </Box>
        );

      case 'todo_start':
        return (
          <Box key={entry.id} marginTop={1}>
            <Text color="blue" bold>● ▶ </Text>
            <Text bold>{entry.content}</Text>
          </Box>
        );

      case 'todo_complete':
        return (
          <Box key={entry.id} marginLeft={2}>
            <Text color="gray">⎿  </Text>
            <Text color="green">✓ 완료</Text>
          </Box>
        );

      case 'todo_fail':
        return (
          <Box key={entry.id} marginLeft={2}>
            <Text color="gray">⎿  </Text>
            <Text color="red">✗ 실패</Text>
          </Box>
        );

      case 'compact':
        return (
          <Box key={entry.id} flexDirection="column" marginTop={1}>
            <Text>{' '}</Text>
            <Text>{' '}</Text>
            <Text>{' '}</Text>
            <Text bold><Text color="cyanBright">   ____  </Text><Text color="cyan">_____  </Text><Text color="cyanBright">______ </Text><Text color="cyan">_   _   </Text><Text color="greenBright">     _____ </Text><Text color="green">_      </Text><Text color="greenBright">_____ </Text></Text>
            <Text bold><Text color="cyanBright">  / __ \ </Text><Text color="cyan">|  __ \</Text><Text color="cyanBright">|  ____</Text><Text color="cyan">| \ | |  </Text><Text color="greenBright">    / ____</Text><Text color="green">| |    </Text><Text color="greenBright">|_   _|</Text></Text>
            <Text bold><Text color="cyanBright"> | |  | |</Text><Text color="cyan"> |__) </Text><Text color="cyanBright">| |__  </Text><Text color="cyan">|  \| |</Text><Text color="yellow">_____</Text><Text color="greenBright">| |    </Text><Text color="green">| |      </Text><Text color="greenBright">| |  </Text></Text>
            <Text bold><Text color="cyan"> | |  | |</Text><Text color="blue"> ___/ </Text><Text color="cyan">|  __| </Text><Text color="blue">| . ` |</Text><Text color="yellow">_____</Text><Text color="green">| |    </Text><Text color="greenBright">| |      </Text><Text color="green">| |  </Text></Text>
            <Text bold><Text color="blue"> | |__| |</Text><Text color="blueBright"> |    </Text><Text color="blue">| |____</Text><Text color="blueBright">| |\  |  </Text><Text color="green">   | |____</Text><Text color="greenBright">| |____ </Text><Text color="green">_| |_ </Text></Text>
            <Text bold><Text color="blueBright">  \____/</Text><Text color="magenta">|_|    </Text><Text color="blueBright">|______</Text><Text color="magenta">|_| \_|  </Text><Text color="greenBright">    \_____</Text><Text color="green">|______</Text><Text color="greenBright">|_____|</Text></Text>
            <Text color="gray">── {entry.content} ──</Text>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Static: Scrollable log history (logo, user input, tool calls, etc.) */}
      <Static items={logEntries}>
        {(entry) => renderLogEntry(entry)}
      </Static>

      {/* Activity Indicator (shown when processing, but NOT when TODO panel is visible) */}
      {isProcessing && planExecutionState.todos.length === 0 && (
        <Box marginY={0}>
          <ActivityIndicator
            activity={getCurrentActivityType()}
            startTime={activityStartTime}
            detail={activityDetail}
            subActivities={subActivities}
            modelName={currentModelInfo.model}
          />
        </Box>
      )}

      {/* TODO Panel (always visible when there are todos) */}
      {planExecutionState.todos.length > 0 && (
        <Box marginY={1}>
          <TodoPanel
            todos={planExecutionState.todos}
            currentTodoId={planExecutionState.currentTodoId}
            showDetails={showTodoDetails}
            modelName={currentModelInfo.model}
            isProcessing={isProcessing}
          />
        </Box>
      )}

      {/* Input Area */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
        <Box>
          <Text color="green">👤 </Text>
          <Box flexGrow={1}>
            <CustomTextInput
              value={input}
              onChange={(value) => {
                if (showSessionBrowser || showSettings || showDocsBrowser) {
                  return;
                }
                setInput(value);
              }}
              onSubmit={handleSubmit}
              placeholder={
                isProcessing
                  ? "AI is working..."
                  : showSessionBrowser
                  ? "Select a session or press ESC..."
                  : showSettings
                  ? "Press ESC to close settings..."
                  : showDocsBrowser
                  ? "Select a doc source or press ESC..."
                  : "Type your message... (@ for files, / for commands)"
              }
              focus={!showSessionBrowser && !showSettings && !showDocsBrowser}
            />
          </Box>
          {/* Character counter */}
          {input.length > 0 && (
            <Text color={input.length > 4000 ? 'red' : input.length > 2000 ? 'yellow' : 'gray'} dimColor>
              {input.length.toLocaleString()}
            </Text>
          )}
        </Box>
      </Box>

      {/* File Browser (shown when '@' is typed) */}
      {fileBrowserState.showFileBrowser && !isProcessing && (
        <Box marginTop={0}>
          {fileBrowserState.isLoadingFiles ? (
            <Box borderStyle="single" borderColor="yellow" paddingX={1}>
              <Spinner type="dots" />
              <Text color="yellow"> Loading files...</Text>
            </Box>
          ) : (
            <FileBrowser
              filter={fileBrowserState.filterText}
              onSelect={handleFileSelect}
              onCancel={fileBrowserState.handleFileBrowserCancel}
              cachedFiles={fileBrowserState.cachedFileList}
            />
          )}
        </Box>
      )}

      {/* Command Browser (shown when '/' is typed at start) */}
      {commandBrowserState.showCommandBrowser && !isProcessing && !fileBrowserState.showFileBrowser && (
        <Box marginTop={0}>
          <CommandBrowser
            partialCommand={commandBrowserState.partialCommand}
            args={commandBrowserState.commandArgs}
            onSelect={handleCommandSelect}
            onCancel={commandBrowserState.handleCommandBrowserCancel}
          />
        </Box>
      )}

      {/* Session Browser (shown when /load command is submitted) */}
      {showSessionBrowser && !isProcessing && (
        <Box marginTop={0}>
          <SessionBrowser
            onSelect={handleSessionSelect}
            onCancel={() => setShowSessionBrowser(false)}
          />
        </Box>
      )}

      {/* Settings Browser (shown when /settings command is submitted) */}
      {showSettings && !isProcessing && (
        <Box marginTop={0}>
          <SettingsBrowser
            currentPlanningMode={planningMode}
            onPlanningModeChange={handleSettingsPlanningModeChange}
            onClose={handleSettingsClose}
          />
        </Box>
      )}

      {/* Model Selector (shown when /model command is submitted) */}
      {showModelSelector && !isProcessing && (
        <Box marginTop={0}>
          <ModelSelector
            onSelect={handleModelSelect}
            onCancel={handleModelSelectorCancel}
          />
        </Box>
      )}

      {/* Docs Browser (shown when /docs command is submitted) */}
      {showDocsBrowser && !isProcessing && (
        <Box marginTop={0}>
          <DocsBrowser
            onClose={() => setShowDocsBrowser(false)}
          />
        </Box>
      )}

      {/* Ask User Dialog */}
      {planExecutionState.askUserRequest && (
        <Box marginTop={1}>
          <AskUserDialog
            request={planExecutionState.askUserRequest}
            onResponse={planExecutionState.handleAskUserResponse}
          />
        </Box>
      )}

      {/* Status Bar - Claude Code style when processing */}
      <Box justifyContent="space-between" paddingX={1}>
        {isProcessing ? (
          // Claude Code style: "✶ ~ 하는 중… (esc to interrupt · 2m 7s · ↑ 3.6k tokens)"
          <>
            <Box>
              <Text color="magenta" bold>✶ </Text>
              <Text color="white">
                {planExecutionState.currentActivity || '처리 중'}…
              </Text>
              <Text color="gray">
                {' '}(esc to interrupt · {formatElapsedTime(sessionElapsed)}
                {sessionTokens > 0 && ` · ↑ ${formatTokensCompact(sessionTokens)} tokens`})
              </Text>
            </Box>
            <Box>
              {/* Context remaining indicator (also shown during processing) */}
              {(() => {
                const ctxPercent = planExecutionState.getContextRemainingPercent();
                const ctxColor = ctxPercent > 50 ? 'green' : ctxPercent > 20 ? 'yellow' : 'red';
                return (
                  <>
                    <Text color={ctxColor}>Context {ctxPercent}%</Text>
                    <Text color="gray"> │ </Text>
                  </>
                );
              })()}
              <Text color="cyan">{currentModelInfo.model}</Text>
            </Box>
          </>
        ) : (
          // Default status bar
          <>
            <Box>
              {/* Context remaining indicator */}
              {(() => {
                const ctxPercent = planExecutionState.getContextRemainingPercent();
                const ctxColor = ctxPercent > 50 ? 'green' : ctxPercent > 20 ? 'yellow' : 'red';
                return (
                  <>
                    <Text color={ctxColor}>Context {ctxPercent}%</Text>
                    <Text color="gray"> │ </Text>
                  </>
                );
              })()}
              {/* Model info - always visible */}
              <Text color="gray">{getHealthIndicator()} </Text>
              <Text color="cyan">{currentModelInfo.model}</Text>
              {planExecutionState.todos.length > 0 && (
                <>
                  <Text color="gray"> │ </Text>
                  <TodoStatusBar todos={planExecutionState.todos} />
                </>
              )}
            </Box>
            <Text color="gray" dimColor>
              /help
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
};

export default PlanExecuteApp;
