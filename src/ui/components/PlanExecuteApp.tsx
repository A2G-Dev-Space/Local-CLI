/**
 * Plan & Execute Interactive App
 *
 * Enhanced interactive mode with Plan-and-Execute Architecture
 * Refactored to use modular hooks and components
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useApp, Static } from 'ink';
import Spinner from 'ink-spinner';
import os from 'os';
import { detectGitRepo } from '../../utils/git-utils.js';

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
  | 'compact'
  | 'approval_request'
  | 'approval_response'
  | 'interrupt'
  | 'session_restored'
  | 'docs_search'
  | 'reasoning'
  | 'git_info'
  | 'star_request';

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
import { initializeDocsDirectory, setDocsSearchProgressCallback } from '../../agents/docs-search/index.js';
import { DocsSearchProgress, type DocsSearchLog } from './DocsSearchProgress.js';
import { FileBrowser } from './FileBrowser.js';
import { SessionBrowser } from './panels/SessionPanel.js';
import { SettingsBrowser } from './dialogs/SettingsDialog.js';
import { LLMSetupWizard } from './LLMSetupWizard.js';
import { ModelSelector } from './ModelSelector.js';
import { ToolSelector } from './ToolSelector.js';
import { AskUserDialog } from './dialogs/AskUserDialog.js';
import { ApprovalDialog } from './dialogs/ApprovalDialog.js';
import { DocsBrowser } from './dialogs/DocsBrowser.js';
import { RatingDialog } from './dialogs/RatingDialog.js';
import { notificationManager, type RatingNotification } from '../../core/notification-manager.js';
import { CommandBrowser } from './CommandBrowser.js';
// ChatView removed - using Static log instead
import { Logo } from './Logo.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import { ActivityIndicator, type ActivityType, type SubActivity } from './ActivityIndicator.js';
import { useFileBrowserState } from '../hooks/useFileBrowserState.js';
import { useCommandBrowserState } from '../hooks/useCommandBrowserState.js';
import { usePlanExecution } from '../hooks/usePlanExecution.js';
import { useInputHistory } from '../hooks/useInputHistory.js';
import { isValidCommand } from '../hooks/slashCommandProcessor.js';
import { processFileReferences } from '../hooks/atFileProcessor.js';
import {
  executeSlashCommand,
  isSlashCommand,
  type CommandHandlerContext,
  type PlanningMode,
} from '../../core/slash-command-handler.js';
import { closeJsonStreamLogger, getStreamLogger } from '../../utils/json-stream-logger.js';
import { configManager } from '../../core/config/config-manager.js';
import { GitAutoUpdater, UpdateStatus } from '../../core/git-auto-updater.js';
import { isRunningAsBinary } from '../../core/binary-auto-updater.js';
import { authManager } from '../../core/auth/index.js';
import { setupNexusModels } from '../../core/nexus-setup.js';
import open from 'open';
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
  setAssistantResponseCallback,
  setToolApprovalCallback,
  setReasoningCallback,
  type ToolApprovalResult,
} from '../../tools/llm/simple/file-tools.js';
import { APP_VERSION } from '../../constants.js';

const VERSION = APP_VERSION;

// Initialization steps for detailed progress display
type InitStep = 'git_update' | 'login' | 'models' | 'health' | 'docs' | 'config' | 'done';

// Tools that require user approval in Supervised Mode
// File-modifying tools and bash commands need approval (read-only and internal tools are auto-approved)
const TOOLS_REQUIRING_APPROVAL = new Set(['create_file', 'edit_file', 'bash']);

// Helper function to shorten path with ~ for home directory
function shortenPath(fullPath: string): string {
  const homeDir = os.homedir();
  if (fullPath.startsWith(homeDir)) {
    return fullPath.replace(homeDir, '~');
  }
  return fullPath;
}

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

// Helper function for status bar text
interface StatusTextParams {
  phase: string;
  todos: { status: string }[];
  currentToolName: string | null;
}

function getStatusText({ phase, todos, currentToolName }: StatusTextParams): string {
  const completedCount = todos.filter(t => t.status === 'completed').length;
  const totalCount = todos.length;
  const allTodosCompleted = totalCount > 0 && todos.every(t => t.status === 'completed' || t.status === 'failed');

  // Build progress prefix (only show when tasks exist)
  const progressPrefix = totalCount > 0 ? `${completedCount}/${totalCount} tasks · ` : '';

  // Compacting
  if (phase === 'compacting') {
    return 'Compacting conversation';
  }
  // All TODOs completed, generating final response
  if (phase === 'executing' && allTodosCompleted) {
    return `${progressPrefix}Generating response`;
  }
  // Planning/Thinking
  if (phase === 'planning') {
    return 'Thinking';
  }
  // Tool is running - show tool name
  if (currentToolName) {
    return `${progressPrefix}${currentToolName}`;
  }
  // Default: processing
  return `${progressPrefix}Processing`;
}

// Status bar uses ink-spinner for animation (avoids custom render issues)

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
  const { input, setInput, handleHistoryPrev, handleHistoryNext, addToHistory } = useInputHistory();
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

  // Current tool being executed (for status bar)
  const [currentToolName, setCurrentToolName] = useState<string | null>(null);

  // Session browser state
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);

  // Settings browser state
  const [showSettings, setShowSettings] = useState(false);

  // LLM Setup Wizard state
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStep, setInitStep] = useState<InitStep>('git_update');
  const [gitUpdateStatus, setGitUpdateStatus] = useState<UpdateStatus | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [ssoUrl, setSsoUrl] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'unhealthy' | 'unknown'>('checking');

  // Model Selector state
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModelInfo, setCurrentModelInfo] = useState(modelInfo);

  // Docs Browser state
  const [showDocsBrowser, setShowDocsBrowser] = useState(false);

  // Tool Selector state
  const [showToolSelector, setShowToolSelector] = useState(false);

  // Log files visibility (Ctrl+O toggle)
  const [showLogFiles, setShowLogFiles] = useState(false);

  // Execution mode: 'auto' (autonomous) or 'supervised' (requires user approval)
  const [executionMode, setExecutionMode] = useState<'auto' | 'supervised'>('auto');

  // Auto-approved tools for this session (only in supervised mode)
  const [autoApprovedTools, setAutoApprovedTools] = useState<Set<string>>(new Set());

  // Pending tool approval state
  const [pendingToolApproval, setPendingToolApproval] = useState<{
    toolName: string;
    args: Record<string, unknown>;
    reason?: string;
    resolve: (result: 'approve' | 'always' | { reject: true; comment: string }) => void;
  } | null>(null);

  // Rating notification state
  const [pendingRatingNotification, setPendingRatingNotification] = useState<RatingNotification | null>(null);

  // Static log entries for scrollable history
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const logIdCounter = React.useRef(0);
  const lastToolArgsRef = React.useRef<Record<string, unknown> | null>(null);

  // Docs search progress state
  const [docsSearchLogs, setDocsSearchLogs] = useState<DocsSearchLog[]>([]);
  const [isDocsSearching, setIsDocsSearching] = useState(false);

  // Pending user message queue (for messages entered during LLM processing)
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const pendingUserMessageRef = React.useRef<string | null>(null);

  // Keep ref in sync with state for synchronous access in LLM loop
  useEffect(() => {
    pendingUserMessageRef.current = pendingUserMessage;
  }, [pendingUserMessage]);

  // Pending message callbacks for mid-execution injection
  const pendingMessageCallbacks = useMemo(() => ({
    getPendingMessage: () => pendingUserMessageRef.current,
    clearPendingMessage: () => {
      pendingUserMessageRef.current = null;
      setPendingUserMessage(null);
    },
  }), []);

  // Ctrl+C double-tap tracking for exit
  const lastCtrlCTimeRef = React.useRef<number>(0);
  const DOUBLE_TAP_THRESHOLD = 1500; // 1.5 seconds

  // Helper: add log entry (skip if content is empty/whitespace only)
  const addLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    // Skip empty content to prevent blank lines
    if (!entry.content || entry.content.trim() === '') {
      return;
    }
    const id = `log-${++logIdCounter.current}`;
    setLogEntries(prev => [...prev, { ...entry, id }]);
  }, []);

  // Helper: clear logs (for compact)
  const clearLogs = useCallback(() => {
    setLogEntries([]);
    logIdCounter.current = 0;
  }, []);

  // Sync log entries to session manager for auto-save
  useEffect(() => {
    sessionManager.setLogEntries(logEntries);
  }, [logEntries]);

  // Use modular hooks
  const fileBrowserState = useFileBrowserState(input, isProcessing);
  const commandBrowserState = useCommandBrowserState(input, isProcessing);
  const planExecutionState = usePlanExecution(pendingMessageCallbacks);

  // Sync todos to session manager for auto-save (only in-progress/pending)
  useEffect(() => {
    sessionManager.setTodos(planExecutionState.todos);
  }, [planExecutionState.todos]);

  // Print logo at startup
  useEffect(() => {
    addLog({
      type: 'logo',
      content: `v${VERSION} │ ${modelInfo.model}`,
    });

    // Check for .git and show notification
    const isGitRepo = detectGitRepo();
    if (isGitRepo) {
      addLog({
        type: 'git_info',
        content: 'Git repository detected! Commit assistance enabled.',
      });
    }
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
      // Save args for tool_result to use (for create_file content display)
      lastToolArgsRef.current = args;
      // Track current tool for status bar
      setCurrentToolName(toolName);
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
      // Clear current tool when done
      setCurrentToolName(null);

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

      // Get saved args for create_file content display
      const savedArgs = lastToolArgsRef.current;
      lastToolArgsRef.current = null;

      addLog({
        type: 'tool_result',
        content: toolName,
        details: result,  // 전체 내용 보존
        success,
        diff,
        toolArgs: savedArgs || undefined,  // Pass args for create_file
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

  // Setup assistant response callback - adds to Static log
  useEffect(() => {
    setAssistantResponseCallback((content) => {
      addLog({
        type: 'assistant_message',
        content,
      });
      logger.debug('Assistant response received', { contentLength: content.length });
    });

    return () => {
      setAssistantResponseCallback(null);
    };
  }, [addLog]);

  // Setup reasoning callback - adds to Static log (non-streaming only)
  // Note: Streaming updates to Static items cause render issues, so we only support non-streaming
  useEffect(() => {
    setReasoningCallback((content, _isStreaming) => {
      // Always add as new entry (don't update existing Static items)
      addLog({
        type: 'reasoning',
        content,
      });
      logger.debug('Reasoning received', { contentLength: content.length });
    });

    return () => {
      setReasoningCallback(null);
    };
  }, [addLog]);

  // Setup notification callbacks (rating dialog & star message)
  useEffect(() => {
    // Rating notification - shows dialog
    // Note: checkNotifications() is only called in finally block after processing
    notificationManager.setRatingCallback((notification) => {
      setPendingRatingNotification(notification);
    });

    // Star message - adds to log (scrolls naturally)
    notificationManager.setStarMessageCallback((message) => {
      addLog({
        type: 'star_request',
        content: message,
      });
    });

    return () => {
      notificationManager.setRatingCallback(null);
      notificationManager.setStarMessageCallback(null);
    };
  }, [addLog]);

  // Setup tool approval callback (Supervised Mode)
  useEffect(() => {
    setToolApprovalCallback(async (toolName, args, reason) => {
      // Auto mode: no approval needed
      if (executionMode === 'auto') {
        return 'approve';
      }

      // Only file-modifying tools require approval
      if (!TOOLS_REQUIRING_APPROVAL.has(toolName)) {
        return 'approve';
      }

      // Check if this tool is already auto-approved for this session
      if (autoApprovedTools.has(toolName)) {
        logger.debug('Tool auto-approved from session', { toolName });
        return 'approve';
      }

      // Add approval request to log
      addLog({
        type: 'approval_request',
        content: toolName,
        details: reason,
        toolArgs: args,
      });

      // Request approval from user via dialog
      return new Promise<ToolApprovalResult>((resolve) => {
        setPendingToolApproval({
          toolName,
          args,
          reason,
          resolve,
        });
      });
    });

    return () => {
      setToolApprovalCallback(null);
    };
  }, [executionMode, autoApprovedTools, addLog]);

  // Setup docs search progress callback
  useEffect(() => {
    setDocsSearchProgressCallback((type, message, data) => {
      // Handle completion
      if (type === 'complete') {
        // Add result to static log with summary
        addLog({
          type: 'docs_search',
          content: data?.summary || message,
          details: data?.findings,
        });

        // Clear progress state
        setIsDocsSearching(false);
        setDocsSearchLogs([]);
        return;
      }

      // Start docs search on first log
      setIsDocsSearching(true);

      // Map callback type to log type
      const logType: DocsSearchLog['type'] = type === 'tell_user' ? 'result' : 'info';

      // Add log entry (max 8, remove oldest if exceeding)
      setDocsSearchLogs(prev => {
        const newLog: DocsSearchLog = {
          type: logType,
          message,
          timestamp: Date.now(),
        };
        const updated = [...prev, newLog];
        return updated.slice(-8); // Keep only last 8
      });
    });

    return () => {
      setDocsSearchProgressCallback(null);
    };
  }, [addLog]);

  // Handle approval dialog response
  const handleApprovalResponse = useCallback((result: ToolApprovalResult) => {
    if (!pendingToolApproval) return;

    const { toolName, resolve } = pendingToolApproval;

    // Log the approval response
    if (result === 'approve') {
      addLog({
        type: 'approval_response',
        content: toolName,
        details: 'approved',
        success: true,
      });
    } else if (result === 'always') {
      setAutoApprovedTools(prev => new Set([...prev, toolName]));
      addLog({
        type: 'approval_response',
        content: toolName,
        details: 'always_approved',
        success: true,
      });
    } else if (typeof result === 'object' && result.reject) {
      addLog({
        type: 'approval_response',
        content: toolName,
        details: result.comment || 'rejected',
        success: false,
      });
    }

    // Resolve the promise
    resolve(result);
    setPendingToolApproval(null);

    logger.debug('Approval response', { toolName, result });
  }, [pendingToolApproval, addLog]);

  // Setup plan/todo callbacks - adds to Static log
  useEffect(() => {
    setPlanCreatedCallback((todoTitles) => {
      // Reset session time and tokens when new TODO plan is created
      // Note: /usage still shows cumulative total (stored in usageTracker.data)
      usageTracker.resetSession();
      setSessionTokens(0);
      setSessionElapsed(0);

      addLog({
        type: 'plan_created',
        content: `Created ${todoTitles.length} task${todoTitles.length > 1 ? 's' : ''}`,
        items: todoTitles,
      });
    });

    setTodoStartCallback((title) => {
      addLog({
        type: 'todo_start',
        content: title,
      });
    });

    // todo_complete 로그 제거 - TodoPanel에서 이미 상태 표시 중이므로 중복
    setTodoCompleteCallback(() => {
      // No-op: TodoPanel handles visual feedback
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

  // Initialize on startup: git_update → login → models → health → docs → config
  useEffect(() => {
    const initialize = async () => {
      logger.flow('Starting initialization');
      logger.startTimer('app-init');

      try {
        // Step 1: Auto-update (highest priority)
        // Use binary updater if running as pkg binary, otherwise use git updater
        setInitStep('git_update');
        let needsRestart = false;

        // Always use GitAutoUpdater - it handles both Node.js and binary modes
        // Binary mode: git pull → copy bin/nexus, bin/yoga.wasm
        // Node.js mode: git pull → npm install → build → link
        logger.flow('Checking for git updates', { isBinaryMode: isRunningAsBinary() });
        const gitUpdater = new GitAutoUpdater({
          onStatus: setGitUpdateStatus,
        });
        needsRestart = await gitUpdater.run();

        if (needsRestart) {
          // Exit immediately so user can restart with new version
          process.exit(0);
        }

        // Step 2: SSO Login
        setInitStep('login');
        logger.flow('Checking authentication');
        await authManager.initialize();

        if (!authManager.isAuthenticated()) {
          logger.flow('Starting SSO login flow');
          try {
            await authManager.login(async (url) => {
              setSsoUrl(url);  // Store URL for manual access (shown in UI)
              // Try to open browser, but don't fail if it doesn't work
              // User can manually open the URL shown in UI
              open(url).catch(() => {
                logger.warn('Failed to open browser - user can use URL shown in UI');
              });
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            setLoginError(errorMsg);
            logger.error('SSO login failed', error as Error);
            setIsInitializing(false);
            return;
          }
        }

        // Step 3: Fetch models from Admin Server
        setInitStep('models');
        logger.flow('Fetching models from Admin Server');
        try {
          await setupNexusModels();
        } catch (error) {
          logger.error('Failed to fetch models', error as Error);
          // Continue anyway - will show setup wizard if no endpoints
        }

        // Step 4: Create LLM Client
        if (configManager.hasEndpoints()) {
          try {
            const newClient = createLLMClient();
            setLlmClient(newClient);
            setCurrentModelInfo(newClient.getModelInfo());
          } catch {
            // LLMClient 생성 실패 시 null 유지
          }
        }

        // Step 5: Run health check (only if endpoints configured)
        setInitStep('health');
        logger.flow('Running health check');
        setHealthStatus('checking');

        if (configManager.hasEndpoints()) {
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
        } else {
          setHealthStatus('unknown');
        }

        // Step 6: Initialize docs directory
        setInitStep('docs');
        logger.flow('Initializing docs directory');
        await initializeDocsDirectory().catch((err) => {
          logger.warn('Docs directory initialization warning', { error: err });
        });

        // Step 7: Check config (show setup wizard if no endpoints)
        setInitStep('config');
        logger.flow('Checking configuration');
        if (!configManager.hasEndpoints()) {
          logger.debug('No endpoints configured, showing setup wizard');
          setShowSetupWizard(true);
          setIsInitializing(false);
          logger.endTimer('app-init');
          return;
        }

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
    // Ctrl+C: Smart handling (clear input / cancel task / double-tap exit)
    if (key.ctrl && inputChar === 'c') {
      const now = Date.now();
      const timeSinceLastCtrlC = now - lastCtrlCTimeRef.current;

      // Case 1: AI is processing - interrupt the task
      if (isProcessing) {
        logger.flow('Ctrl+C pressed - interrupting execution');

        // Abort any active LLM request
        if (llmClient) {
          llmClient.abort();
        }

        // Set interrupt flag
        planExecutionState.handleInterrupt();

        // Add red "Interrupted" message to log immediately
        addLog({
          type: 'interrupt',
          content: '⎿ Interrupted',
        });

        // Force stop processing state
        setIsProcessing(false);
        lastCtrlCTimeRef.current = now;
        return;
      }

      // Case 2: Input has content - clear the input
      if (input.length > 0) {
        logger.debug('Ctrl+C pressed - clearing input');
        setInput('');
        lastCtrlCTimeRef.current = now;
        return;
      }

      // Case 3: Input is empty - check for double-tap to exit
      if (timeSinceLastCtrlC < DOUBLE_TAP_THRESHOLD) {
        // Double-tap detected - exit
        logger.flow('Ctrl+C double-tap detected - exiting');
        handleExit().catch(console.error);
        return;
      }

      // First tap with empty input - show exit hint
      lastCtrlCTimeRef.current = now;
      addLog({
        type: 'assistant_message',
        content: '^C again to exit',
      });
      logger.debug('Ctrl+C pressed - waiting for double-tap to exit');
      return;
    }
    // ESC: First = pause, Second = complete stop
    if (key.escape && (isProcessing || planExecutionState.isInterrupted)) {
      logger.flow('ESC pressed');

      // Abort any active LLM request
      if (llmClient) {
        llmClient.abort();
      }

      // Handle interrupt (returns 'paused', 'stopped', or 'none')
      const result = planExecutionState.handleInterrupt();

      if (result === 'paused') {
        // First ESC - pause
        addLog({
          type: 'interrupt',
          content: '⏸️ Paused (type message to resume, ESC to stop completely)',
        });
      } else if (result === 'stopped') {
        // Second ESC - complete stop
        addLog({
          type: 'interrupt',
          content: '⏹️ Stopped - TODO list cleared',
        });
      }

      // Force stop processing state
      setIsProcessing(false);
    }
    // Tab key: toggle execution mode (auto/supervised)
    if (key.tab && !isProcessing && !pendingToolApproval) {
      const newMode = executionMode === 'auto' ? 'supervised' : 'auto';
      setExecutionMode(newMode);
      // Clear auto-approved tools when switching to auto mode
      if (newMode === 'auto') {
        setAutoApprovedTools(new Set());
      }
      addLog({
        type: 'assistant_message',
        content: `실행 모드 변경: ${newMode === 'auto' ? '🚀 Auto Mode (자율 실행)' : '👁️ Supervised Mode (승인 필요)'}`,
      });
      logger.debug('Execution mode toggled', { newMode });
    }
    // Ctrl+O: toggle log files visibility
    if (key.ctrl && inputChar === 'o') {
      setShowLogFiles(prev => !prev);
    }
  }, { isActive: !fileBrowserState.showFileBrowser && !commandBrowserState.showCommandBrowser && !pendingToolApproval });

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

      const hasTodos = sessionData.todos && sessionData.todos.length > 0;

      logger.debug('Session loaded', {
        sessionId,
        messageCount: sessionData.messages.length,
        logEntryCount: sessionData.logEntries?.length || 0,
        todoCount: hasTodos ? sessionData.todos!.length : 0,
      });

      // Restore messages
      setMessages(sessionData.messages);

      // Reset auto-approved tools (Supervised mode security)
      setAutoApprovedTools(new Set());
      logger.debug('Auto-approved tools cleared on session load');

      // Restore in-progress TODOs if available
      if (hasTodos) {
        // Convert SessionTodoItem to TodoItem format (add required fields with defaults)
        const restoredTodos = sessionData.todos!.map(todo => ({
          id: todo.id,
          title: todo.title,
          description: todo.description || '',
          status: todo.status,
          requiresDocsSearch: todo.requiresDocsSearch ?? false,
          dependencies: todo.dependencies ?? [],
          result: todo.result,
          error: todo.error,
        }));
        planExecutionState.setTodos(restoredTodos);
        logger.debug('Restored in-progress TODOs', { count: restoredTodos.length });
      }

      // Build restore details message
      const detailParts: string[] = [];
      detailParts.push(`${sessionData.messages.length}개 메시지`);
      if (sessionData.logEntries?.length) {
        detailParts.push(`${sessionData.logEntries.length}개 로그`);
      }
      if (hasTodos) {
        detailParts.push(`${sessionData.todos!.length}개 TODO 복구`);
      }

      // Restore log entries if available
      if (sessionData.logEntries && sessionData.logEntries.length > 0) {
        // Clear current logs and add session restored header
        const restoredLogs: LogEntry[] = [
          {
            id: `log-restored-header`,
            type: 'session_restored',
            content: `세션 복구됨: ${new Date(sessionData.metadata.updatedAt).toLocaleString('ko-KR')}`,
            details: detailParts.join(', '),
          },
          ...sessionData.logEntries.map((entry, idx) => ({
            ...entry,
            id: `log-restored-${idx}`,
          })) as LogEntry[],
        ];
        setLogEntries(restoredLogs);
        logIdCounter.current = restoredLogs.length;
      } else {
        // No log entries saved, show session restored message only
        clearLogs();
        addLog({
          type: 'session_restored',
          content: `세션 복구됨: ${new Date(sessionData.metadata.updatedAt).toLocaleString('ko-KR')}`,
          details: detailParts.join(', ') + (sessionData.logEntries?.length ? '' : ' (로그 히스토리 없음)'),
        });
      }
    } catch (error) {
      const errorMessage = `세션 로드 실패: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(`Session load failed (sessionId: ${sessionId})`, error as Error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant' as const, content: errorMessage },
      ]);
    }
    logger.exit('handleSessionSelect', { sessionId });
  }, [addLog, clearLogs]);

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

      setShowModelSelector(false);

      // 새로운 LLMClient 생성 (ModelSelector에서 이미 configManager에 저장됨)
      // Single source of truth: client에서 model info 가져옴
      try {
        const newClient = createLLMClient();
        const newModelInfo = newClient.getModelInfo();

        logger.state('Current model', currentModelInfo.model, newModelInfo.model);
        setLlmClient(newClient);
        setCurrentModelInfo(newModelInfo);

        // Add confirmation message
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant' as const,
            content: `모델이 변경되었습니다: ${newModelInfo.model}`,
          },
        ]);

        logger.debug('LLMClient recreated with new model', { modelId, modelName: newModelInfo.model });
        logger.exit('handleModelSelect', { model: newModelInfo.model });
      } catch (error) {
        logger.error('Failed to create new LLMClient', error as Error);
        logger.exit('handleModelSelect', { error: true });
      }
    },
    [currentModelInfo.model]
  );

  // Handle model selector cancel
  const handleModelSelectorCancel = useCallback(() => {
    logger.debug('Model selector cancelled');
    setShowModelSelector(false);
  }, []);

  // Handle tool selector close
  const handleToolSelectorClose = useCallback(() => {
    logger.debug('Tool selector closed');
    setShowToolSelector(false);
  }, []);

  const handleSubmit = useCallback(async (value: string) => {
    // If processing and user submits a message, queue it for injection at next LLM invoke
    if (isProcessing && value.trim()) {
      const queuedMessage = value.trim();
      setPendingUserMessage(queuedMessage);
      logger.flow('User message queued for mid-execution injection', { message: queuedMessage });
      addLog({
        type: 'user_input',
        content: `(→ 다음 호출에 전달) ${queuedMessage}`,
      });
      setInput('');
      return;
    }

    if (!value.trim() || fileBrowserState.showFileBrowser || showSessionBrowser || showSettings || showSetupWizard || showDocsBrowser) {
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
    addToHistory(userMessage);

    // Handle slash commands
    if (isSlashCommand(userMessage)) {
      logger.flow('Executing slash command');

      // Add user input to log for slash commands
      addLog({
        type: 'user_input',
        content: userMessage,
      });

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
        onShowToolSelector: () => setShowToolSelector(true),
        onCompact: llmClient
          ? () => planExecutionState.performCompact(llmClient, messages, setMessages)
          : undefined,
      };

      const result = await executeSlashCommand(userMessage, commandContext);

      if (result.handled) {
        // If the command added an assistant message, display it in the log
        if (result.updatedContext?.messages) {
          const lastMessage = result.updatedContext.messages[result.updatedContext.messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            addLog({
              type: 'assistant_message',
              content: lastMessage.content,
            });
          }
        }
        logger.exit('handleSubmit', { handled: true });
        return;
      }
    }

    // Add user input to Static log (show original message)
    addLog({
      type: 'user_input',
      content: userMessage,
    });

    // Process @file references - read file contents and include in message
    const processedResult = await processFileReferences(userMessage);
    const processedMessage = processedResult.content;

    // Log if files were included
    if (processedResult.includedFiles.length > 0) {
      logger.debug('Files included in message', {
        files: processedResult.includedFiles,
        failedFiles: processedResult.failedFiles,
      });
    }

    // Add processed message to messages (with file contents for LLM)
    let updatedMessages: Message[] = [...messages, { role: 'user' as const, content: processedMessage }];
    setMessages(updatedMessages);

    setIsProcessing(true);
    setActivityStartTime(Date.now());
    setSubActivities([]);

    // Reset interrupt flag for new operation
    if (llmClient) {
      llmClient.resetInterrupt();
    }

    // Reset session usage for new task
    usageTracker.resetSession();
    setSessionTokens(0);
    setSessionElapsed(0);

    logger.startTimer('message-processing');

    try {
      // Check for auto-compact before processing (70% threshold)
      if (planExecutionState.shouldAutoCompact()) {
        logger.flow('Auto-compact triggered');
        setActivityType('thinking');
        setActivityDetail('Compacting conversation...');

        const compactResult = await planExecutionState.performCompact(llmClient!, updatedMessages, setMessages);
        if (compactResult.success && compactResult.compactedMessages) {
          // Update local variable with compacted messages for subsequent LLM calls
          updatedMessages = compactResult.compactedMessages;
          logger.debug('Auto-compact completed', {
            originalCount: compactResult.originalMessageCount,
            newCount: compactResult.newMessageCount,
          });
        } else if (!compactResult.success) {
          logger.warn('Auto-compact failed, continuing without compact', { error: compactResult.error });
        }
      }

      // Check if we should resume TODO execution instead of starting fresh
      const hasPendingTodos = planExecutionState.todos.some(
        t => t.status === 'pending' || t.status === 'in_progress'
      );

      if (hasPendingTodos && planExecutionState.isInterrupted) {
        // Resume TODO execution with the new message
        logger.flow('Resuming TODO execution after pause');
        setActivityType('executing');
        setActivityDetail('Resuming...');
        await planExecutionState.resumeTodoExecution(processedMessage, llmClient!, messages, setMessages);
      } else {
        // Phase 1: Use auto mode with LLM-based request classification
        setActivityType('thinking');
        setActivityDetail('Analyzing request...');

        logger.vars(
          { name: 'planningMode', value: planningMode },
          { name: 'messageLength', value: processedMessage.length }
        );

        // Use executeAutoMode which handles classification internally
        await planExecutionState.executeAutoMode(processedMessage, llmClient!, updatedMessages, setMessages);
      }

    } catch (error) {
      logger.error('Message processing failed', error as Error);
    } finally {
      setIsProcessing(false);
      logger.endTimer('message-processing');
      logger.exit('handleSubmit', { success: true });

      // Check for periodic notifications (rating, star)
      notificationManager.checkNotifications();
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
    addLog,
  ]);

  // Process pending user message after LLM processing completes
  // This handles the edge case where execution finishes before the pending message could be injected
  useEffect(() => {
    if (!isProcessing && pendingUserMessage && llmClient) {
      logger.flow('Processing remaining pending user message after execution complete');

      // Clear the pending message
      const queuedMessage = pendingUserMessage;
      setPendingUserMessage(null);
      pendingUserMessageRef.current = null;

      // Check if we have pending TODOs to resume
      const hasPendingTodos = planExecutionState.todos.some(
        t => t.status === 'pending' || t.status === 'in_progress'
      );

      // Add to log
      addLog({
        type: 'user_input',
        content: `📩 ${queuedMessage}`,
      });

      // Process @file references and then execute
      const processAndExecute = async () => {
        // Process file references
        const processedResult = await processFileReferences(queuedMessage);
        const processedMessage = processedResult.content;

        // Start processing
        setIsProcessing(true);
        setActivityStartTime(Date.now());

        try {
          if (hasPendingTodos) {
            // Resume TODO execution with the new message
            logger.flow('Resuming TODO execution with user message');
            await planExecutionState.resumeTodoExecution(processedMessage, llmClient, messages, setMessages);
          } else {
            // No pending TODOs - start fresh with executeAutoMode
            logger.flow('No pending TODOs - starting fresh execution');
            const updatedMessages: Message[] = [...messages, { role: 'user' as const, content: processedMessage }];
            setMessages(updatedMessages);
            await planExecutionState.executeAutoMode(processedMessage, llmClient, updatedMessages, setMessages);
          }
        } catch (error) {
          logger.error('Queued message processing failed', error as Error);
        } finally {
          setIsProcessing(false);

          // Check for periodic notifications (rating, star)
          notificationManager.checkNotifications();
        }
      };

      processAndExecute();
    }
  }, [isProcessing, pendingUserMessage, llmClient, messages, planExecutionState, addLog]);

  // Show loading screen with logo during initialization
  if (isInitializing) {
    // Get update status text (git-based for both Node.js and binary modes)
    const getUpdateStatusText = (): string => {
      if (!gitUpdateStatus) return 'Checking for updates...';
      switch (gitUpdateStatus.type) {
        case 'checking':
          return 'Checking for updates...';
        case 'no_update':
          return 'Up to date';
        case 'first_run':
          return `${gitUpdateStatus.message} (${gitUpdateStatus.step}/${gitUpdateStatus.totalSteps})`;
        case 'updating':
          return `${gitUpdateStatus.message} (${gitUpdateStatus.step}/${gitUpdateStatus.totalSteps})`;
        case 'complete':
          return gitUpdateStatus.message;
        case 'error':
          return gitUpdateStatus.message;
        case 'skipped':
          return `Skipped: ${gitUpdateStatus.reason}`;
        default:
          return (((_: never): string => 'Checking for updates...')(gitUpdateStatus));
      }
    };

    // Get login status text
    const getLoginStatusText = (): string => {
      if (loginError) return `Login failed: ${loginError}`;
      const user = authManager.getCurrentUser();
      if (user) return `Logged in as ${user.username}`;
      return 'Waiting for SSO login...';
    };

    const getInitStepInfo = () => {
      switch (initStep) {
        case 'git_update':
          return { icon: '🔄', text: getUpdateStatusText(), progress: 1 };
        case 'login':
          return { icon: '🔐', text: getLoginStatusText(), progress: 2 };
        case 'models':
          return { icon: '🤖', text: 'Loading models from server...', progress: 3 };
        case 'health':
          return { icon: '🏥', text: 'Checking model health...', progress: 4 };
        case 'docs':
          return { icon: '📚', text: 'Initializing docs...', progress: 5 };
        case 'config':
          return { icon: '⚙️', text: 'Loading configuration...', progress: 6 };
        default:
          return { icon: '✓', text: 'Ready!', progress: 7 };
      }
    };

    const stepInfo = getInitStepInfo();

    // Authors component with cycling highlight animation
    const AuthorsDisplay = () => {
      const authors = ['syngha.han', 'byeongju.lee', 'young87.kim'];
      const [highlightIndex, setHighlightIndex] = useState(0);

      useEffect(() => {
        const interval = setInterval(() => {
          setHighlightIndex((prev) => (prev + 1) % authors.length);
        }, 800);
        return () => clearInterval(interval);
      }, []);

      return (
        <Box marginTop={2}>
          <Text color="gray">by </Text>
          {authors.map((author, idx) => (
            <React.Fragment key={author}>
              <Text
                color={idx === highlightIndex ? 'cyan' : 'gray'}
                bold={idx === highlightIndex}
                dimColor={idx !== highlightIndex}
              >
                {author}
              </Text>
              {idx < authors.length - 1 && <Text color="gray"> · </Text>}
            </React.Fragment>
          ))}
        </Box>
      );
    };

    return (
      <Box flexDirection="column" alignItems="center" paddingY={2}>
        <Logo showVersion={true} showTagline={true} />

        <Box marginTop={2} flexDirection="column" alignItems="center">
          <Box>
            <Text color="cyan"><Spinner type="shark" /></Text>
          </Box>
          <Box marginTop={1}>
            <Text color="yellow">{stepInfo.icon} {stepInfo.text}</Text>
          </Box>

          {/* Show SSO URL for manual access during login step */}
          {initStep === 'login' && ssoUrl && (
            <Box marginTop={1} flexDirection="column" alignItems="center">
              <Text color="gray">브라우저가 열리지 않으면 아래 URL로 접속하세요:</Text>
              <Text color="cyan" wrap="truncate-end">{ssoUrl}</Text>
            </Box>
          )}

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

          {/* Authors with cycling highlight */}
          <AuthorsDisplay />
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
            <Logo
              showVersion={true}
              showTagline={false}
              animate={false}
              modelName={currentModelInfo.model}
              workingDirectory={shortenPath(process.cwd())}
            />
            <Text>{' '}</Text>
            <Box>
              <Text color="gray"> 📚 Local RAG documents available. Use </Text>
              <Text color="cyan">/docs</Text>
              <Text color="gray"> to configure offline documentation.</Text>
            </Box>
            <Box>
              <Text color="gray">    로컬 RAG 문서를 구성할 수 있습니다. </Text>
              <Text color="cyan">/docs</Text>
              <Text color="gray"> 명령어를 사용해보세요.</Text>
            </Box>
            <Text>{' '}</Text>
            <Box>
              <Text color="gray"> 🔧 Optional tools available! Use </Text>
              <Text color="cyan">/tool</Text>
              <Text color="gray"> to enable browser automation and more.</Text>
            </Box>
            <Box>
              <Text color="gray">    선택적 도구를 사용할 수 있습니다. </Text>
              <Text color="cyan">/tool</Text>
              <Text color="gray"> 명령어로 브라우저 자동화 등을 활성화하세요.</Text>
            </Box>
            <Box marginTop={1}>
              <Text color="red" dimColor>⚠️  Warning: If no_proxy is not configured correctly, LLM usage may be restricted.</Text>
            </Box>
            <Box>
              <Text color="red" dimColor>    Please ensure both </Text>
              <Text color="yellow" dimColor>no_proxy</Text>
              <Text color="red" dimColor> and </Text>
              <Text color="yellow" dimColor>NO_PROXY</Text>
              <Text color="red" dimColor> include </Text>
              <Text color="yellow" dimColor>10.229.95.228</Text>
            </Box>
            <Box>
              <Text color="red" dimColor>⚠️  주의: no_proxy 설정이 올바르지 않으면 LLM 사용에 제한이 있을 수 있습니다.</Text>
            </Box>
            <Box>
              <Text color="red" dimColor>    </Text>
              <Text color="yellow" dimColor>no_proxy</Text>
              <Text color="red" dimColor>와 </Text>
              <Text color="yellow" dimColor>NO_PROXY</Text>
              <Text color="red" dimColor> 모두 </Text>
              <Text color="yellow" dimColor>10.229.95.228</Text>
              <Text color="red" dimColor>이 포함되어 있는지 꼭 확인해주세요.</Text>
            </Box>
            <Text>{' '}</Text>
            <Box>
              <Text color="gray"> 💬 Feedback: </Text>
              <Text color="cyan">a2g.samsungds.net:4090/feedback</Text>
            </Box>
            <Box>
              <Text color="gray"> 📖 Documentation: </Text>
              <Text color="cyan">a2g.samsungds.net:4090/docs</Text>
            </Box>
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
          <Box key={entry.id} marginTop={1} marginBottom={1} flexDirection="column">
            <Text color="magenta" bold>● Assistant</Text>
            <Box paddingLeft={2}>
              <MarkdownRenderer content={entry.content} />
            </Box>
          </Box>
        );

      case 'interrupt':
        return (
          <Box key={entry.id} marginTop={1}>
            <Text color="red" bold>{entry.content}</Text>
          </Box>
        );

      case 'session_restored':
        return (
          <Box key={entry.id} marginTop={1} flexDirection="column">
            <Text color="cyan" bold>📂 {entry.content}</Text>
            {entry.details && <Text color="gray" dimColor>   {entry.details}</Text>}
          </Box>
        );

      case 'git_info':
        return (
          <Box key={entry.id} marginTop={0} marginBottom={0} flexDirection="column">
            <Text color="yellow"> 🔀 {entry.content}</Text>
            <Text color="gray">    Git 저장소가 감지되었습니다! 커밋 지원이 활성화됩니다.</Text>
          </Box>
        );

      case 'docs_search': {
        // Truncate both content and details if more than 5 lines (UI only)
        // Handle both actual newlines and literal \n strings
        const truncateText = (text: string, maxLines: number = 5): string => {
          const lines = text.split(/\\n|\n/);
          if (lines.length > maxLines) {
            return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
          }
          return lines.join('\n');
        };

        const displayContent = truncateText(entry.content);
        const displayDetails = entry.details ? truncateText(entry.details) : undefined;

        return (
          <Box key={entry.id} marginTop={1} flexDirection="column">
            <Text color="yellow" bold>📚 Document Search Complete</Text>
            {displayDetails && <Text color="gray" dimColor>   {displayDetails}</Text>}
            <Box paddingLeft={3} marginTop={0}>
              <Text color="gray">{displayContent}</Text>
            </Box>
          </Box>
        );
      }

      case 'tool_start': {
        // Tool별 아이콘 매핑
        const getToolIcon = (toolName: string): string => {
          // Office 도구 (prefix 매칭)
          if (toolName.startsWith('word_')) return '📄';       // Word
          if (toolName.startsWith('excel_')) return '📊';      // Excel
          if (toolName.startsWith('powerpoint_')) return '📽️';  // PowerPoint
          if (toolName.startsWith('browser_')) return '🌐';    // Browser

          switch (toolName) {
            case 'read_file':
              return '📖';  // 읽기
            case 'create_file':
              return '📝';  // 새 파일 생성
            case 'edit_file':
              return '✏️';   // 편집
            case 'list_files':
              return '📂';  // 폴더 목록
            case 'find_files':
              return '🔍';  // 검색
            case 'tell_to_user':
              return '💬';  // 메시지
            case 'bash':
              return '⚡';  // 터미널/쉘 명령어
            default:
              return '🔧';  // 기본 도구
          }
        };

        // Tool별 핵심 파라미터 추출
        const getToolParams = (toolName: string, args: Record<string, unknown> | undefined): string => {
          if (!args) return '';

          // Office 도구 파라미터 (prefix 매칭)
          if (toolName.startsWith('word_') || toolName.startsWith('excel_') || toolName.startsWith('powerpoint_')) {
            // 파일 경로가 있으면 표시
            const filePath = args['file_path'] as string;
            if (filePath) return filePath;
            // 셀/범위가 있으면 표시
            const cell = args['cell'] as string;
            const range = args['range'] as string;
            if (cell) return cell;
            if (range) return range;
            // 슬라이드 번호가 있으면 표시
            const slideNumber = args['slide_number'] as number;
            if (slideNumber) return `slide ${slideNumber}`;
            return '';
          }

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
            case 'bash':
              return args['command'] as string || '';
            default:
              return '';
          }
        };

        const icon = getToolIcon(entry.content);
        const params = getToolParams(entry.content, entry.toolArgs);
        const toolName = entry.content;

        // Truncate reason if too long
        const reason = entry.details || '';
        const maxReasonLen = 80;
        const truncatedReason = reason.length > maxReasonLen
          ? reason.substring(0, maxReasonLen) + '...'
          : reason;

        // 모든 도구 통일된 2줄 포맷
        return (
          <Box key={entry.id} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="cyan" bold>{icon} {toolName}</Text>
              {params && <Text color="gray"> ({params})</Text>}
            </Box>
            {truncatedReason && (
              <Box marginLeft={2}>
                <Text color="gray">⎿ </Text>
                <Text color="yellow">💭 </Text>
                <Text color="gray">{truncatedReason}</Text>
              </Box>
            )}
          </Box>
        );
      }

      case 'tool_result':
        // tool_result 표시 제거 - tool_start에서 reason만 표시
        return null;

      case 'tell_user':
        return (
          <Box key={entry.id} marginTop={1}>
            <Text color="yellow" bold>● </Text>
            <Text>{entry.content}</Text>
          </Box>
        );

      case 'star_request':
        return (
          <Box key={entry.id} marginTop={1}>
            <Text color="yellow">{entry.content}</Text>
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
            <Logo
              showVersion={true}
              showTagline={false}
              animate={false}
              modelName={currentModelInfo.model}
              workingDirectory={shortenPath(process.cwd())}
            />
            <Text color="gray">── {entry.content} ──</Text>
          </Box>
        );

      case 'approval_request': {
        // Format tool args for display
        const formatArg = (_key: string, value: unknown): string => {
          if (typeof value === 'string') {
            if (value.length > 100) return value.substring(0, 100) + '...';
            return value;
          }
          return JSON.stringify(value);
        };

        return (
          <Box key={entry.id} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="yellow" bold>⚠️ 승인 요청: </Text>
              <Text color="cyan" bold>{entry.content}</Text>
            </Box>
            {entry.details && (
              <Box marginLeft={2}>
                <Text color="gray">⎿ </Text>
                <Text>{entry.details}</Text>
              </Box>
            )}
            {entry.toolArgs && Object.entries(entry.toolArgs).map(([key, value], idx) => {
              if (key === 'reason') return null;
              return (
                <Box key={idx} marginLeft={2}>
                  <Text color="gray">⎿ </Text>
                  <Text color="magenta">{key}: </Text>
                  <Text color="gray">{formatArg(key, value)}</Text>
                </Box>
              );
            })}
          </Box>
        );
      }

      case 'approval_response':
        return (
          <Box key={entry.id} marginLeft={2}>
            <Text color="gray">⎿ </Text>
            {entry.success ? (
              <Text color="green">
                ✓ {entry.details === 'always_approved' ? '항상 승인됨' : '승인됨'}
              </Text>
            ) : (
              <Text color="red">
                ✗ 거부됨{entry.details && entry.details !== 'rejected' ? `: ${entry.details}` : ''}
              </Text>
            )}
          </Box>
        );

      case 'reasoning':
        return (
          <Box key={entry.id} marginTop={1} flexDirection="column">
            <Text color="gray">Thinking...</Text>
            <Box marginLeft={2}>
              <Text color="gray">{entry.content}</Text>
            </Box>
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

      {/* Tool Approval Dialog (Supervised Mode) - shown in scrollable area */}
      {pendingToolApproval && (
        <Box marginY={1}>
          <ApprovalDialog
            toolName={pendingToolApproval.toolName}
            args={pendingToolApproval.args}
            reason={pendingToolApproval.reason}
            onResponse={handleApprovalResponse}
          />
        </Box>
      )}

      {/* Rating Dialog - shown after processing completes (every N requests) */}
      {pendingRatingNotification && (
        <RatingDialog
          modelName={pendingRatingNotification.modelName}
          onSubmit={async (rating) => {
            await notificationManager.submitRating(pendingRatingNotification.modelName, rating);
            setPendingRatingNotification(null);
          }}
          onCancel={() => setPendingRatingNotification(null)}
        />
      )}

      {/* Activity Indicator (shown when processing, but NOT when TODO panel is visible) */}
      {isProcessing && planExecutionState.todos.length === 0 && !pendingToolApproval && !isDocsSearching && (
        <Box marginY={1}>
          <ActivityIndicator
            activity={getCurrentActivityType()}
            startTime={activityStartTime}
            detail={activityDetail}
            subActivities={subActivities}
            modelName={currentModelInfo.model}
          />
        </Box>
      )}

      {/* Docs Search Progress (shown when searching documents) */}
      {isDocsSearching && (
        <DocsSearchProgress
          logs={docsSearchLogs}
          isSearching={isDocsSearching}
        />
      )}

      {/* TODO Panel (always visible when there are todos) */}
      {planExecutionState.todos.length > 0 && (
        <Box marginTop={2} marginBottom={1}>
          <TodoPanel
            todos={planExecutionState.todos}
            currentTodoId={planExecutionState.currentTodoId}
            isProcessing={isProcessing}
          />
        </Box>
      )}

      {/* Input Area */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
        <Box>
          <Text color="green" bold>&gt; </Text>
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
              onHistoryPrev={handleHistoryPrev}
              onHistoryNext={handleHistoryNext}
              placeholder={
                isProcessing
                  ? "AI is working..."
                  : showSessionBrowser
                  ? "Select a session or press ESC..."
                  : showSettings
                  ? "Press ESC to close settings..."
                  : showDocsBrowser
                  ? "Select a doc source or press ESC..."
                  : "Type your message... (@ files, / commands, Alt+Enter newline)"
              }
              focus={!showSessionBrowser && !showSettings && !showDocsBrowser && !planExecutionState.askUserRequest}
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

      {/* Tool Selector (shown when /tool command is submitted) */}
      {showToolSelector && !isProcessing && (
        <Box marginTop={0}>
          <ToolSelector
            onClose={handleToolSelectorClose}
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
        {isProcessing || planExecutionState.executionPhase === 'compacting' ? (
          // Claude Code style with pulsing star animation (shark for compacting)
          <>
            <Box flexDirection="column">
              {planExecutionState.executionPhase === 'compacting' ? (
                // Shark spinner for compacting (full width)
                <Box>
                  <Text color="cyan"><Spinner type="shark" /></Text>
                </Box>
              ) : null}
              <Box>
                <Text color="magenta">
                  <Spinner type="star" />
                </Text>
                <Text color="white">{' '}
                  {getStatusText({
                    phase: planExecutionState.executionPhase,
                    todos: planExecutionState.todos,
                    currentToolName,
                  })}…
                </Text>
                <Text color="gray">
                  {' '}(esc to interrupt · {formatElapsedTime(sessionElapsed)}
                  {sessionTokens > 0 && ` · ↑ ${formatTokensCompact(sessionTokens)} tokens`})
                </Text>
              </Box>
            </Box>
            <Box>
              {/* Context usage indicator (tokens / percent) */}
              {(() => {
                const ctxInfo = planExecutionState.getContextUsageInfo();
                const ctxColor = ctxInfo.percent < 50 ? 'green' : ctxInfo.percent < 80 ? 'yellow' : 'red';
                return (
                  <>
                    <Text color={ctxColor}>Context ({formatTokensCompact(ctxInfo.tokens)} / {ctxInfo.percent}%)</Text>
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
              {/* Execution mode indicator */}
              <Text color={executionMode === 'auto' ? 'green' : 'yellow'} bold>
                [{executionMode === 'auto' ? 'Auto' : 'Supervised'}]
              </Text>
              <Text color="gray"> │ </Text>
              {/* Context usage indicator (tokens / percent) */}
              {(() => {
                const ctxInfo = planExecutionState.getContextUsageInfo();
                const ctxColor = ctxInfo.percent < 50 ? 'green' : ctxInfo.percent < 80 ? 'yellow' : 'red';
                return (
                  <>
                    <Text color={ctxColor}>Context ({formatTokensCompact(ctxInfo.tokens)} / {ctxInfo.percent}%)</Text>
                    <Text color="gray"> │ </Text>
                  </>
                );
              })()}
              {/* Model info - always visible */}
              <Text color="gray">{getHealthIndicator()} </Text>
              <Text color="cyan">{currentModelInfo.model}</Text>
              <Text color="gray"> │ </Text>
              <Text color="gray">{shortenPath(process.cwd())}</Text>
              {planExecutionState.todos.length > 0 && (
                <>
                  <Text color="gray"> │ </Text>
                  <TodoStatusBar todos={planExecutionState.todos} />
                </>
              )}
            </Box>
            <Text color="gray" dimColor>
              Tab: mode │ /help
            </Text>
          </>
        )}
      </Box>

      {/* Log files info (Ctrl+O to toggle) */}
      {showLogFiles && (() => {
        const streamLogger = getStreamLogger();
        const sessionLogPath = streamLogger?.getFilePath() ?? 'N/A';
        const logDir = streamLogger?.getLogDirectory() ?? '';
        const browserLogPath = logDir ? `${logDir}/browser-server_log.jsonl` : 'N/A';
        const officeLogPath = logDir ? `${logDir}/office-server_log.jsonl` : 'N/A';
        return (
          <Box flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
            <Text color="gray" dimColor>📁 Log Files (Ctrl+O to hide)</Text>
            <Text color="gray" dimColor>  Session: {sessionLogPath}</Text>
            <Text color="gray" dimColor>  Browser: {browserLogPath}</Text>
            <Text color="gray" dimColor>  Office:  {officeLogPath}</Text>
          </Box>
        );
      })()}
    </Box>
  );
};

export default PlanExecuteApp;
