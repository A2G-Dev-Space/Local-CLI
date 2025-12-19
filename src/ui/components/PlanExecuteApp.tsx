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
  | 'reasoning';

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
import { AskUserDialog } from './dialogs/AskUserDialog.js';
import { ApprovalDialog } from './dialogs/ApprovalDialog.js';
import { DocsBrowser } from './dialogs/DocsBrowser.js';
import { CommandBrowser } from './CommandBrowser.js';
// ChatView removed - using Static log instead
import { Logo } from './Logo.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import { ActivityIndicator, type ActivityType, type SubActivity } from './ActivityIndicator.js';
import { useFileBrowserState } from '../hooks/useFileBrowserState.js';
import { useCommandBrowserState } from '../hooks/useCommandBrowserState.js';
import { usePlanExecution } from '../hooks/usePlanExecution.js';
import { isValidCommand } from '../hooks/slashCommandProcessor.js';
import { processFileReferences } from '../hooks/atFileProcessor.js';
import {
  executeSlashCommand,
  isSlashCommand,
  type CommandHandlerContext,
  type PlanningMode,
} from '../../core/slash-command-handler.js';
import { closeJsonStreamLogger } from '../../utils/json-stream-logger.js';
import { configManager } from '../../core/config/config-manager.js';
import { GitAutoUpdater, UpdateStatus } from '../../core/git-auto-updater.js';
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
import { createRequire } from 'module';

// Get version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../../../package.json') as { version: string };
const VERSION = pkg.version;

// Initialization steps for detailed progress display
type InitStep = 'git_update' | 'health' | 'docs' | 'config' | 'done';

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

  // Current tool being executed (for status bar)
  const [currentToolName, setCurrentToolName] = useState<string | null>(null);

  // Session browser state
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);

  // Settings browser state
  const [showSettings, setShowSettings] = useState(false);

  // LLM Setup Wizard state
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStep, setInitStep] = useState<InitStep>('docs');
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'unhealthy' | 'unknown'>('checking');
  const [gitUpdateStatus, setGitUpdateStatus] = useState<UpdateStatus | null>(null);

  // Model Selector state
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModelInfo, setCurrentModelInfo] = useState(modelInfo);

  // Docs Browser state
  const [showDocsBrowser, setShowDocsBrowser] = useState(false);


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

  // Initialize on startup: git update check -> health check -> docs -> config
  useEffect(() => {
    const initialize = async () => {
      logger.flow('Starting initialization');
      logger.startTimer('app-init');

      try {
        // Step 1: Check for git updates
        setInitStep('git_update');
        logger.flow('Checking for git updates');
        const updater = new GitAutoUpdater({
          onStatus: setGitUpdateStatus,
        });
        const needsRestart = await updater.run();
        if (needsRestart) {
          // Exit immediately so user can restart with new version
          process.exit(0);
        }

        // Step 2: Run health check (only if endpoints configured)
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

        // Step 3: Initialize docs directory
        setInitStep('docs');
        logger.flow('Initializing docs directory');
        await initializeDocsDirectory().catch((err) => {
          logger.warn('Docs directory initialization warning', { error: err });
        });

        // Step 4: Check config (show setup wizard if no endpoints)
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
    const updatedMessages: Message[] = [...messages, { role: 'user' as const, content: processedMessage }];
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
        }
      };

      processAndExecute();
    }
  }, [isProcessing, pendingUserMessage, llmClient, messages, planExecutionState, addLog]);

  // Show loading screen with logo during initialization
  if (isInitializing) {
    // Get git update status text
    const getGitStatusText = (): string => {
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
          // Exhaustiveness check: if new status types are added, TypeScript will error here
          return (((_: never): string => 'Checking for updates...')(gitUpdateStatus));
      }
    };

    const getInitStepInfo = () => {
      switch (initStep) {
        case 'git_update':
          return { icon: '🔄', text: getGitStatusText(), progress: 1 };
        case 'health':
          return { icon: '🏥', text: 'Checking model health...', progress: 2 };
        case 'docs':
          return { icon: '📚', text: 'Initializing docs...', progress: 3 };
        case 'config':
          return { icon: '⚙️', text: 'Loading configuration...', progress: 4 };
        default:
          return { icon: '✓', text: 'Ready!', progress: 5 };
      }
    };

    const stepInfo = getInitStepInfo();

    // Authors component with cycling highlight animation
    const AuthorsDisplay = () => {
      const authors = ['syngha.han', 'byeongju.lee', 'youngsub.kim'];
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

        return (
          <Box key={entry.id} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="cyan" bold>{icon} {entry.content}</Text>
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
                <Text color={entry.success ? 'cyan' : 'red'}>{entry.success ? '✓' : '✗'} </Text>
                <Text color="gray">{entry.success ? 'Updated' : 'Failed'}</Text>
              </Box>
              {entry.diff.map((line, idx) => (
                <Box key={idx} marginLeft={3}>
                  <Text
                    color={line.includes(' + ') ? 'white' : line.includes(' - ') ? 'white' : 'gray'}
                    backgroundColor={line.includes(' + ') ? '#1e40af' : line.includes(' - ') ? '#b91c1c' : undefined}
                  >
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

        // Tool별 결과 축약
        let displayText = entry.details || '';

        // read_file, read_docs_file, preview_file, submit_findings: 5줄 넘으면 축약
        if (entry.content === 'read_file' || entry.content === 'read_docs_file' || entry.content === 'preview_file' || entry.content === 'submit_findings') {
          const lines = displayText.split('\n');
          if (lines.length > 5) {
            displayText = lines.slice(0, 5).join('\n') + `\n... (${lines.length - 5} more lines)`;
          }
        }

        // bash: 3줄 넘으면 축약
        if (entry.content === 'bash') {
          const lines = displayText.split('\n');
          if (lines.length > 3) {
            displayText = lines.slice(0, 3).join('\n') + `\n... (${lines.length - 3} more lines)`;
          }
        }

        // list_files, find_files, list_directory: 개수와 미리보기
        if (entry.content === 'list_files' || entry.content === 'find_files' || entry.content === 'list_directory') {
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

        // create_file: diff 형식으로 전체 내용 표시 (+ 로)
        if (entry.content === 'create_file' && entry.toolArgs) {
          const content = entry.toolArgs['content'] as string;
          const filePath = entry.toolArgs['file_path'] as string;
          if (content) {
            const contentLines = content.split('\n');
            return (
              <Box key={entry.id} flexDirection="column" marginLeft={2}>
                <Box>
                  <Text color="gray">⎿  </Text>
                  <Text color={entry.success ? 'cyan' : 'red'}>{entry.success ? '✓' : '✗'} </Text>
                  <Text color="gray">Created {filePath} ({contentLines.length} lines)</Text>
                </Box>
                {contentLines.map((line, idx) => (
                  <Box key={idx} marginLeft={3}>
                    <Text color="white" backgroundColor="#1e40af">+ {line}</Text>
                  </Box>
                ))}
              </Box>
            );
          }
        }

        // 일반 결과
        return (
          <Box key={entry.id} marginLeft={2}>
            <Text color="gray">⎿  </Text>
            <Text color={entry.success ? 'cyan' : 'red'}>{entry.success ? '✓' : '✗'} </Text>
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
        <Box marginY={1}>
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
    </Box>
  );
};

export default PlanExecuteApp;
