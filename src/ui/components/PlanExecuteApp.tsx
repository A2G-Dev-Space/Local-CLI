/**
 * Plan & Execute Interactive App
 *
 * Enhanced interactive mode with Plan-and-Execute Architecture
 * Refactored to use modular hooks and components
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { CustomTextInput } from './CustomTextInput.js';
import { LLMClient, createLLMClient } from '../../core/llm-client.js';
import { Message } from '../../types/index.js';
import { TodoPanel, TodoStatusBar } from '../TodoPanel.js';
import { sessionManager } from '../../core/session-manager.js';
import { initializeDocsDirectory } from '../../core/docs-search-agent.js';
import { FileBrowser } from './FileBrowser.js';
import { SessionBrowser } from './panels/SessionPanel.js';
import { SettingsBrowser } from './dialogs/SettingsDialog.js';
import { LLMSetupWizard } from './LLMSetupWizard.js';
import { ModelSelector } from './ModelSelector.js';
import { PlanApprovalPrompt, TaskApprovalPrompt } from './dialogs/ApprovalDialog.js';
import { CommandBrowser } from './CommandBrowser.js';
import { ChatView } from './views/ChatView.js';
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
import { configManager } from '../../core/config-manager.js';
import { logger } from '../../utils/logger.js';

// Initialization steps for detailed progress display
type InitStep = 'docs' | 'config' | 'health' | 'done';

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
  const [currentResponse, setCurrentResponse] = useState('');
  // Planning mode is always 'auto' - mode selection has been removed
  const planningMode: PlanningMode = 'auto';

  // LLM Client state - 모델 변경 시 새로운 클라이언트로 교체
  const [llmClient, setLlmClient] = useState<LLMClient | null>(initialLlmClient);

  // Pending user message (shown immediately after Enter)
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);

  // Activity tracking for detailed status display
  const [activityType, setActivityType] = useState<ActivityType>('thinking');
  const [activityStartTime, setActivityStartTime] = useState<number>(Date.now());
  const [activityDetail, setActivityDetail] = useState<string>('');
  const [subActivities, setSubActivities] = useState<SubActivity[]>([]);

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

  // Use modular hooks
  const fileBrowserState = useFileBrowserState(input, isProcessing);
  const commandBrowserState = useCommandBrowserState(input, isProcessing);
  const planExecutionState = usePlanExecution();

  // Log component mount
  useEffect(() => {
    logger.enter('PlanExecuteApp', { modelInfo });
    return () => {
      logger.exit('PlanExecuteApp', { messageCount: messages.length });
    };
  }, []);

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
          logger.info('No endpoints configured, showing setup wizard');
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
    if (key.ctrl && inputChar === 'c') {
      handleExit().catch(console.error);
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

      logger.info('Session loaded', { sessionId, messageCount: sessionData.messages.length });
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
    logger.info('Setup wizard completed');
    setShowSetupWizard(false);
    // Exit and let user restart
    exit();
  }, [exit]);

  // Handle setup wizard skip
  const handleSetupSkip = useCallback(() => {
    logger.info('Setup wizard skipped');
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
          logger.info('LLMClient recreated with new model', { modelId, modelName: model.name });
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
    if (!value.trim() || isProcessing || fileBrowserState.showFileBrowser || showSessionBrowser || showSettings || showSetupWizard) {
      return;
    }

    logger.enter('handleSubmit', { valueLength: value.length });

    if (!llmClient) {
      logger.warn('LLM client not configured');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant' as const, content: 'LLM이 설정되지 않았습니다. /settings → LLMs에서 설정해주세요.' },
      ]);
      return;
    }

    if (commandBrowserState.showCommandBrowser && !isValidCommand(value.trim())) {
      return;
    }

    const userMessage = value.trim();

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
      };

      const result = await executeSlashCommand(userMessage, commandContext);

      if (result.handled) {
        logger.exit('handleSubmit', { handled: true });
        return;
      }
    }

    // Show pending user message immediately
    setPendingUserMessage(userMessage);

    setIsProcessing(true);
    setCurrentResponse('');
    setActivityStartTime(Date.now());
    setSubActivities([]);

    logger.startTimer('message-processing');

    try {
      // Auto mode: determine whether to use planning based on task complexity
      const complexKeywords = [
        'create', 'build', 'implement', 'develop', 'make',
        'setup', 'configure', 'install', 'deploy', 'design',
        'refactor', 'optimize', 'debug', 'test', 'analyze',
        'multiple', 'several', 'tasks', 'steps'
      ];

      const lowerMessage = userMessage.toLowerCase();
      const usePlanning = complexKeywords.some(keyword => lowerMessage.includes(keyword));

      logger.vars(
        { name: 'usePlanning', value: usePlanning },
        { name: 'planningMode', value: planningMode }
      );

      if (usePlanning) {
        setActivityType('planning');
        setActivityDetail('Analyzing request and creating plan...');
        await planExecutionState.executePlanMode(userMessage, llmClient, messages, setMessages);
      } else {
        setActivityType('thinking');
        setActivityDetail('Processing your request...');
        await planExecutionState.executeDirectMode(userMessage, llmClient, messages, setMessages);
      }

    } catch (error) {
      logger.error('Message processing failed', error as Error);
    } finally {
      setIsProcessing(false);
      setCurrentResponse('');
      setPendingUserMessage(null);
      logger.endTimer('message-processing');
      logger.exit('handleSubmit', { success: true });
    }
  }, [
    isProcessing,
    fileBrowserState.showFileBrowser,
    showSessionBrowser,
    showSettings,
    showSetupWizard,
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

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Box justifyContent="space-between" width="100%">
          <Box>
            <Text bold color="cyan">OPEN-CLI </Text>
            {getHealthIndicator()}
          </Box>
          <Text color="gray">
            {currentModelInfo.model}
          </Text>
        </Box>
      </Box>

      {/* Messages Area */}
      <ChatView
        messages={messages}
        currentResponse={currentResponse}
        pendingUserMessage={pendingUserMessage || undefined}
      />

      {/* Activity Indicator (shown when processing) */}
      {isProcessing && (
        <Box marginY={0}>
          <ActivityIndicator
            activity={getCurrentActivityType()}
            startTime={activityStartTime}
            detail={activityDetail}
            subActivities={subActivities}
            modelName={currentModelInfo.model}
            currentStep={planExecutionState.todos.filter(t => t.status === 'completed').length}
            totalSteps={planExecutionState.todos.length || undefined}
            stepName={planExecutionState.currentTodoId ?
              planExecutionState.todos.find(t => t.id === planExecutionState.currentTodoId)?.title
              : undefined
            }
          />
        </Box>
      )}

      {/* TODO Panel (always visible when there are todos) */}
      {planExecutionState.todos.length > 0 && (
        <Box marginY={1}>
          <TodoPanel
            todos={planExecutionState.todos}
            currentTodoId={planExecutionState.currentTodoId}
            showDetails={true}
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
                if (showSessionBrowser || showSettings) {
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
                  : "Type your message... (@ for files, / for commands)"
              }
              focus={!showSessionBrowser && !showSettings && !planExecutionState.planApprovalRequest && !planExecutionState.taskApprovalRequest}
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

      {/* HITL Plan Approval Prompt */}
      {planExecutionState.planApprovalRequest && (
        <Box marginTop={1}>
          <PlanApprovalPrompt
            userRequest={planExecutionState.planApprovalRequest.userRequest}
            todos={planExecutionState.planApprovalRequest.todos}
            onResponse={planExecutionState.handleApprovalResponse}
          />
        </Box>
      )}

      {/* HITL Task Approval Prompt */}
      {planExecutionState.taskApprovalRequest && (
        <Box marginTop={1}>
          <TaskApprovalPrompt
            taskDescription={planExecutionState.taskApprovalRequest.taskDescription}
            risk={planExecutionState.taskApprovalRequest.risk}
            context={planExecutionState.taskApprovalRequest.context}
            onResponse={planExecutionState.handleApprovalResponse}
          />
        </Box>
      )}

      {/* Status Bar - Always visible with model info */}
      <Box justifyContent="space-between" paddingX={1}>
        <Box>
          {/* Model info - always visible */}
          <Text color="gray">{getHealthIndicator()} </Text>
          <Text color="cyan">{currentModelInfo.model}</Text>
          <Text color="gray"> │ </Text>
          <Text color="magenta">🤖 auto</Text>
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
      </Box>
    </Box>
  );
};

export default PlanExecuteApp;
