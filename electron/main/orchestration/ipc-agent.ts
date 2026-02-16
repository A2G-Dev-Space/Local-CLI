/**
 * IPC Agent for Electron
 *
 * Wrapper functions for IPC communication with renderer process.
 * Provides runAgent, abortAgent, simpleChat for ipc-handlers.ts
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 * CLI parity: This is Electron-specific - CLI uses React hooks directly with PlanExecutor
 */

import { BrowserWindow } from 'electron';
import { llmClient, Message } from '../core/llm';
import { logger } from '../utils/logger';
import { reportError } from '../core/telemetry/error-reporter';
import type { ToolApprovalResult } from '../tools/llm/simple/simple-tool-executor';
import {
  runAgentCore,
  AgentIO,
  AgentRunState,
} from './agent-engine';
import type { AgentConfig, AgentCallbacks, AgentResult } from './agent-engine';
import type { TodoItem } from './types';

// Re-export types for consumers
export type { AgentConfig, AgentCallbacks, AgentResult };

// =============================================================================
// Agent State (Electron-specific: extends AgentRunState with BrowserWindow)
// =============================================================================

interface AgentState extends AgentRunState {
  chatWindow: BrowserWindow | null;
  taskWindow: BrowserWindow | null;
  pendingApprovals: Map<string, (result: ToolApprovalResult) => void>;
}

const state: AgentState = {
  isRunning: false,
  abortController: null,
  currentTodos: [],
  chatWindow: null,
  taskWindow: null,
  runId: 0,
  pendingApprovals: new Map(),
  alwaysApprovedTools: new Set(),
  currentSessionId: null,
};

// Helper to send IPC messages to both chat and task windows
function broadcastToWindows(channel: string, ...args: unknown[]): void {
  if (state.chatWindow && !state.chatWindow.isDestroyed()) {
    state.chatWindow.webContents.send(channel, ...args);
  }
  if (state.taskWindow && !state.taskWindow.isDestroyed()) {
    state.taskWindow.webContents.send(channel, ...args);
  }
}

// Flash taskbar on both windows for user attention
function flashAllWindows(): void {
  if (state.chatWindow && !state.chatWindow.isDestroyed() && !state.chatWindow.isFocused()) {
    state.chatWindow.flashFrame(true);
  }
  if (state.taskWindow && !state.taskWindow.isDestroyed() && !state.taskWindow.isFocused()) {
    state.taskWindow.flashFrame(true);
  }
}

// =============================================================================
// Agent Setup
// =============================================================================

export function setAgentMainWindow(window: BrowserWindow | null): void {
  state.chatWindow = window;
}

export function setAgentTaskWindow(window: BrowserWindow | null): void {
  state.taskWindow = window;
}

export function isAgentRunning(): boolean {
  return state.isRunning;
}

export function abortAgent(): void {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  state.isRunning = false;
  state.currentTodos = [];
  broadcastToWindows('agent:todoUpdate', []);
  // Clear pending approvals
  state.pendingApprovals.forEach((resolve) => {
    resolve({ reject: true, comment: 'Agent aborted' });
  });
  state.pendingApprovals.clear();
  llmClient.abort();
  logger.info('Agent aborted');
}

/**
 * Handle tool approval response from renderer (Supervised Mode)
 */
export function handleToolApprovalResponse(requestId: string, result: ToolApprovalResult | null): void {
  const resolver = state.pendingApprovals.get(requestId);
  if (resolver) {
    logger.info('[Supervised] Tool approval response received', { requestId, result });
    resolver(result as ToolApprovalResult);
    state.pendingApprovals.delete(requestId);
  } else {
    logger.warn('[Supervised] No pending approval found for request', { requestId });
  }
}

export function getCurrentTodos(): TodoItem[] {
  return [...state.currentTodos];
}

export function setCurrentTodos(todos: TodoItem[]): void {
  state.currentTodos = [...todos];
}

/**
 * Clear always-approved tools (call when starting a new session/chat)
 */
export function clearAlwaysApprovedTools(): void {
  state.alwaysApprovedTools.clear();
  logger.info('[Supervised] Cleared always-approved tools for new session');
}

// =============================================================================
// Main IO Implementation (BrowserWindow-based)
// =============================================================================

function createMainIO(): AgentIO {
  return {
    broadcast: (channel: string, ...data: unknown[]) => {
      broadcastToWindows(channel, ...data);
    },
    flashWindows: () => {
      flashAllWindows();
    },
    showTaskWindow: () => {
      if (state.taskWindow && !state.taskWindow.isDestroyed()) {
        state.taskWindow.show();
      }
    },
    isTaskWindowVisible: () => {
      return state.taskWindow?.isVisible() ?? false;
    },
    requestApproval: (toolName: string, args: Record<string, unknown>, reason?: string): Promise<ToolApprovalResult> => {
      return new Promise((resolve) => {
        const requestId = `approval-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        state.pendingApprovals.set(requestId, resolve);

        logger.info('[Supervised] Requesting tool approval', { requestId, toolName, reason });
        state.chatWindow!.webContents.send('agent:approvalRequest', {
          id: requestId,
          toolName,
          args,
          reason: reason || (args['reason'] as string) || undefined,
        });
      });
    },
    sendFileEdit: (data: { path: string; originalContent: string; newContent: string; language: string }) => {
      state.chatWindow?.webContents.send('agent:fileEdit', data);
    },
  };
}

// =============================================================================
// Main Agent Execution (delegates to agent-engine)
// =============================================================================

export async function runAgent(
  userMessage: string,
  existingMessages: Message[] = [],
  config: AgentConfig = {},
  callbacks: AgentCallbacks = {}
): Promise<AgentResult> {
  const mainIO = createMainIO();
  return runAgentCore(userMessage, existingMessages, config, callbacks, mainIO, state);
}

// =============================================================================
// Streaming Agent
// =============================================================================

export async function runAgentStream(
  userMessage: string,
  existingMessages: Message[] = [],
  config: AgentConfig = {},
  callbacks: AgentCallbacks = {}
): Promise<AgentResult> {
  return runAgent(userMessage, existingMessages, config, callbacks);
}

// =============================================================================
// Simple Chat (no planning/tools)
// =============================================================================

export async function simpleChat(
  userMessage: string,
  existingMessages: Message[] = [],
  systemPrompt?: string,
  onChunk?: (chunk: string) => void
): Promise<{ response: string; messages: Message[] }> {
  logger.info('Simple chat', { userMessage: userMessage.substring(0, 100) });

  logger.info('[CHAT] User message', { content: userMessage.substring(0, 500) });

  let messages: Message[] = [...existingMessages];

  if (systemPrompt && !messages.some((m) => m.role === 'system')) {
    messages = [{ role: 'system', content: systemPrompt }, ...messages];
  }

  messages.push({ role: 'user', content: userMessage });

  try {
    if (onChunk) {
      const result = await llmClient.chatCompletionStream(
        { messages },
        (chunk, done) => {
          if (!done && chunk) {
            onChunk(chunk);
          }
        }
      );

      const assistantMessage: Message = { role: 'assistant', content: result.content };
      messages.push(assistantMessage);

      logger.info('[CHAT] Assistant response', { content: result.content.substring(0, 500) });

      return { response: result.content, messages };
    } else {
      const result = await llmClient.chat(messages, false);
      messages.push(result.message);

      logger.info('[CHAT] Assistant response', { content: result.content.substring(0, 500) });

      return { response: result.content, messages };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Simple chat error', { error: errorMessage });
    reportError(error, { type: 'agent', method: 'simpleChat' }).catch(() => {});
    throw error;
  }
}

// =============================================================================
// Exports
// =============================================================================

export default {
  runAgent,
  runAgentStream,
  simpleChat,
  abortAgent,
  isAgentRunning,
  getCurrentTodos,
  setCurrentTodos,
  setAgentMainWindow,
  setAgentTaskWindow,
};
