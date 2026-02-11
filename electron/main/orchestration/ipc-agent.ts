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
import * as fs from 'fs/promises';
import * as path from 'path';
import { llmClient, Message } from '../core/llm';
import { logger } from '../utils/logger';
import { reportError } from '../core/telemetry/error-reporter';
import { detectGitRepo } from '../utils/git-utils';
import { toolRegistry, executeSimpleTool } from '../tools';
import { OptionalToolGroupId } from '../tools/types';
import {
  setWorkingDirectory,
  setPowerShellWorkingDirectory,
  setTodoWriteCallback,
  setTellToUserCallback,
  setAskUserCallback,
  setGetTodosCallback,
  setFinalResponseCallback,
  clearFinalResponseCallbacks,
  setToolExecutionCallback,
  setToolResponseCallback,
} from '../tools';
import { setReasoningCallback, setToolApprovalCallback, requestToolApproval } from '../tools/llm/simple/simple-tool-executor';
import type { ToolApprovalResult } from '../tools/llm/simple/simple-tool-executor';
import { ContextLengthError } from '../errors';
import { PLAN_EXECUTE_SYSTEM_PROMPT, buildPlanExecutePrompt } from '../prompts';
import { GIT_COMMIT_RULES } from '../prompts/shared/git-rules';
import { PlanningLLM } from '../agents/planner';
import { contextTracker, getContextTracker } from '../core/compact';
import { configManager } from '../core/config';
import {
  validateToolMessages,
  truncateMessages,
  buildTodoContext,
  flattenMessagesToHistory,
  parseToolArguments,
} from './utils';
import { compactConversation } from '../core/compact';
import type { TodoItem, AskUserRequest, AskUserResponse } from './types';

// =============================================================================
// Types
// =============================================================================

export interface AgentConfig {
  // maxIterations removed - CLI parity: no iteration limit
  enabledToolGroups?: OptionalToolGroupId[];
  workingDirectory?: string;
  enablePlanning?: boolean;
  resumeTodos?: boolean;
  autoMode?: boolean;
}

// =============================================================================
// System Prompt Builder (CLI parity: plan-executor.ts buildSystemPrompt)
// =============================================================================

/**
 * Build system prompt with conditional Git rules
 * Git rules are only added when .git folder exists in working directory
 *
 * CLI parity: src/orchestration/plan-executor.ts buildSystemPrompt()
 */
function buildSystemPrompt(workingDirectory: string): string {
  const isGitRepo = detectGitRepo(workingDirectory);

  // Build base prompt with tool summary and working directory
  const toolSummary = toolRegistry.getToolSummaryForPlanning();
  let prompt = buildPlanExecutePrompt({ toolSummary, workingDirectory });

  // Add Git rules conditionally (CLI parity)
  if (isGitRepo) {
    prompt += `\n\n${GIT_COMMIT_RULES}`;
    logger.debug('Git repo detected - added GIT_COMMIT_RULES to prompt');
  }

  return prompt;
}

export interface AgentCallbacks {
  onMessage?: (message: Message) => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, result: string, success: boolean) => void;
  onToolExecution?: (toolName: string, reason: string, args: Record<string, unknown>) => void;
  onToolResponse?: (toolName: string, success: boolean, result: string) => void;
  onTodoUpdate?: (todos: TodoItem[]) => void;
  onTellUser?: (message: string) => void;
  onAskUser?: (request: AskUserRequest) => Promise<AskUserResponse>;
  onStreamChunk?: (chunk: string) => void;
  onComplete?: (response: string) => void;
  onError?: (error: Error) => void;
}

export interface AgentResult {
  success: boolean;
  response: string;
  messages: Message[];
  toolCalls: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: string;
    success: boolean;
  }>;
  iterations: number;
  error?: string;
}

// =============================================================================
// Agent State
// =============================================================================

interface AgentState {
  isRunning: boolean;
  abortController: AbortController | null;
  currentTodos: TodoItem[];
  chatWindow: BrowserWindow | null;
  taskWindow: BrowserWindow | null;
  runId: number; // Unique ID per runAgent() call to detect stale runs
  pendingApprovals: Map<string, (result: ToolApprovalResult) => void>; // Supervised Mode approval resolvers
  alwaysApprovedTools: Set<string>; // Tools approved with "always" in current session
  currentSessionId: string | null; // Track session for clearing always-approved tools
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

// Tools that don't require approval (communication tools, not action tools)

// Helper to send IPC messages to both chat and task windows
function broadcastToWindows(channel: string, ...args: unknown[]): void {
  if (state.chatWindow && !state.chatWindow.isDestroyed()) {
    state.chatWindow.webContents.send(channel, ...args);
  }
  if (state.taskWindow && !state.taskWindow.isDestroyed()) {
    state.taskWindow.webContents.send(channel, ...args);
  }
}
const NO_APPROVAL_TOOLS = new Set([
  'tell_to_user',
  'ask_to_user',
  'final_response',
  'write_todos',
  'update_todos',
  'get_todo_list',
]);

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
  state.currentTodos = []; // Clear todos so next run starts fresh with new planning
  // Broadcast empty todos to sync Task Window
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
 * result: null means approved, { reject: true, comment: string } means rejected
 */
export function handleToolApprovalResponse(requestId: string, result: ToolApprovalResult | null): void {
  const resolver = state.pendingApprovals.get(requestId);
  if (resolver) {
    logger.info('[Supervised] Tool approval response received', { requestId, result });
    // null means approved (no rejection), pass it through
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
// Main Agent Execution
// =============================================================================

export async function runAgent(
  userMessage: string,
  existingMessages: Message[] = [],
  config: AgentConfig = {},
  callbacks: AgentCallbacks = {}
): Promise<AgentResult> {
  const {
    // maxIterations removed - CLI parity: no iteration limit, runs until LLM stops
    workingDirectory = process.cwd(),
    enablePlanning = true,
    resumeTodos = false,
    autoMode = true, // true = Auto Mode (no approval), false = Supervised Mode (ask for approval)
  } = config;

  logger.info('Starting agent', {
    userMessage: userMessage.substring(0, 100),
    existingMessagesCount: existingMessages.length,
    workingDirectory,
    enablePlanning,
    resumeTodos,
    autoMode,
  });

  // Initialize state
  state.isRunning = true;
  state.abortController = new AbortController();

  // Clear old todos if not resuming - ensures fresh planning for new requests
  if (!resumeTodos) {
    state.currentTodos = [];
  }

  // Set working directory for all tool executors
  setWorkingDirectory(workingDirectory);
  setPowerShellWorkingDirectory(workingDirectory);

  // Setup callbacks
  setTodoWriteCallback(async (todos: TodoItem[]) => {
    state.currentTodos = todos;
    if (callbacks.onTodoUpdate) {
      callbacks.onTodoUpdate(todos);
    }
    broadcastToWindows('agent:todoUpdate', todos);
    // Task 윈도우 자동 표시 (TODO가 처음 생성될 때)
    if (state.taskWindow && !state.taskWindow.isDestroyed() && !state.taskWindow.isVisible() && todos.length > 0) {
      state.taskWindow.show();
    }
    return true;
  });

  setGetTodosCallback(() => state.currentTodos);
  setFinalResponseCallback((message: string) => {
    logger.flow('Final response callback received', { messageLength: message.length });
  });

  setTellToUserCallback((message: string) => {
    if (callbacks.onTellUser) {
      callbacks.onTellUser(message);
    }
    broadcastToWindows('agent:tellUser', message);
  });

  setAskUserCallback(async (request: AskUserRequest) => {
    if (callbacks.onAskUser) {
      return callbacks.onAskUser(request);
    }
    return {
      selectedOption: request.options[0],
      isOther: false,
    };
  });

  // Supervised Mode: Tool approval callback
  if (!autoMode && state.chatWindow) {
    setToolApprovalCallback(async (toolName: string, args: Record<string, unknown>, reason?: string): Promise<ToolApprovalResult> => {
      return new Promise((resolve) => {
        const requestId = `approval-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Store resolver for this request
        state.pendingApprovals = state.pendingApprovals || new Map();
        state.pendingApprovals.set(requestId, resolve);

        // Send approval request to renderer
        // NOTE: Event name must match preload's onApprovalRequest listener ('agent:approvalRequest')
        logger.info('[Supervised] Requesting tool approval', { requestId, toolName, reason });
        state.chatWindow!.webContents.send('agent:approvalRequest', {
          id: requestId,
          toolName,
          args,
          reason: reason || (args['reason'] as string) || undefined,
        });
      });
    });
  } else {
    // Auto Mode: No approval needed
    setToolApprovalCallback(null);
  }

  // Tool execution callback - send to renderer for UI display
  setToolExecutionCallback((toolName: string, reason: string, args: Record<string, unknown>) => {
    if (callbacks.onToolExecution) {
      callbacks.onToolExecution(toolName, reason, args);
    }
    // Use agent:toolCall to match preload's onToolCall listener
    broadcastToWindows('agent:toolCall', { toolName, args: { ...args, reason } });
  });

  // Tool response callback - send to renderer for UI display
  setToolResponseCallback((toolName: string, success: boolean, result: string) => {
    if (callbacks.onToolResponse) {
      callbacks.onToolResponse(toolName, success, result);
    }
    // Use agent:toolResult to match preload's onToolResult listener
    broadcastToWindows('agent:toolResult', { toolName, success, result });
  });

  // Reasoning callback - send reasoning content to renderer (CLI parity)
  setReasoningCallback((content: string, isStreaming: boolean) => {
    broadcastToWindows('agent:reasoning', { content, isStreaming });
  });

  // Get tools from registry
  const tools = toolRegistry.getLLMToolDefinitions();
  const actualEnabledToolGroups = toolRegistry.getEnabledToolGroupIds() as OptionalToolGroupId[];
  logger.info('Enabled tool groups from registry', { enabledToolGroups: actualEnabledToolGroups });

  // Build system prompt with Git rules if applicable (CLI parity)
  const systemPrompt = buildSystemPrompt(workingDirectory);

  // Initialize context tracker
  void getContextTracker();

  // ==========================================================================
  // Planning Phase
  // ==========================================================================
  if (enablePlanning && !resumeTodos && state.currentTodos.length === 0) {
    logger.flow('Starting planning phase');

    if (state.abortController?.signal.aborted) {
      throw new Error('Agent aborted');
    }

    try {
      // Create PlanningLLM with proper arguments (llmClient and tool summary functions)
      // Includes optional tools info (browser, office, etc.) for planning
      const planningLLM = new PlanningLLM(
        llmClient,
        () => toolRegistry.getToolSummaryForPlanning(),
        () => toolRegistry.getEnabledOptionalToolsInfo()
      );

      // Set ask-user callback for Planning LLM (enables ask_to_user during planning)
      planningLLM.setAskUserCallback(async (request: AskUserRequest) => {
        if (callbacks.onAskUser) {
          return callbacks.onAskUser(request);
        }
        return {
          selectedOption: request.options[0],
          isOther: false,
        };
      });

      const planningResult = await planningLLM.generateTODOList(
        userMessage,
        existingMessages
      );

      // Add clarification messages to history (ask_to_user Q&A from planning phase)
      if (planningResult.clarificationMessages?.length) {
        existingMessages = [...existingMessages, ...planningResult.clarificationMessages];
        logger.flow('Added planning clarification messages to history', {
          count: planningResult.clarificationMessages.length,
        });
      }

      if (planningResult.directResponse) {
        logger.flow('Planning returned direct response, skipping execution');

        // Chat 로그: 사용자 입력 및 어시스턴트 응답
        logger.info('[CHAT] User message', { content: userMessage.substring(0, 500) });
        logger.info('[CHAT] Assistant response (direct)', { content: planningResult.directResponse.substring(0, 500) });

        if (callbacks.onComplete) {
          callbacks.onComplete(planningResult.directResponse);
        }
        broadcastToWindows('agent:complete', {
          response: planningResult.directResponse,
        });

        state.isRunning = false;
        state.abortController = null;

        // Include user message + direct response in history (CLI parity: plan-executor.ts)
        // Without this, direct responses would be lost on session restore
        const lastMsg = existingMessages[existingMessages.length - 1];
        const needsUserMessage = !(lastMsg?.role === 'user' && lastMsg?.content === userMessage);
        const updatedMessages = needsUserMessage
          ? [...existingMessages, { role: 'user' as const, content: userMessage }, { role: 'assistant' as const, content: planningResult.directResponse }]
          : [...existingMessages, { role: 'assistant' as const, content: planningResult.directResponse }];

        return {
          success: true,
          response: planningResult.directResponse,
          messages: updatedMessages,
          toolCalls: [],
          iterations: 0,
        };
      }

      if (planningResult.todos.length > 0) {
        state.currentTodos = planningResult.todos;

        if (callbacks.onTodoUpdate) {
          callbacks.onTodoUpdate(planningResult.todos);
        }
        broadcastToWindows('agent:todoUpdate', planningResult.todos);

        logger.info('Planning complete', {
          todoCount: planningResult.todos.length,
          complexity: planningResult.complexity,

        });
      }
    } catch (planningError) {
      logger.error('Planning failed, falling back to direct execution', planningError as Error);
      reportError(planningError, { type: 'planning', method: 'generateTODOList', ...errorContext }).catch(() => {});
    }
  }

  // ==========================================================================
  // Prepare Messages
  // CLI parity: System prompt is injected per-LLM call, not stored in history
  // ==========================================================================
  // Flatten history messages into chronological text with XML tags
  // CLI parity: This helps weaker LLMs distinguish history from current request
  let validMessages: Message[] = validateToolMessages([...existingMessages]);
  validMessages = truncateMessages(validMessages, 100);
  validMessages = validMessages.filter((m) => m.role !== 'system');

  // Base history for flatten (snapshot of existing conversation, excludes tool loop messages)
  let baseHistory: Message[] = [...validMessages];

  // toolLoopMessages: tracks only messages generated within the while loop
  // CLI parity: matches chatCompletionWithTools's toolLoopMessages pattern
  const toolLoopMessages: Message[] = [];

  // rebuildMessages: reconstruct [system, user] from scratch every iteration
  // CLI parity: captures state.currentTodos LIVE (always reads latest value)
  const rebuildMessages = (loopMessages: Message[]): Message[] => {
    const fullHistory = [...baseHistory, ...loopMessages];
    const historyText = flattenMessagesToHistory(fullHistory);
    const todoContext = buildTodoContext(state.currentTodos); // 매 호출마다 최신 TODO 상태

    let userContent = '';
    if (todoContext) {
      userContent += `<CURRENT_TASK>\n${todoContext}\n</CURRENT_TASK>\n\n`;
    }
    if (historyText) {
      userContent += `<CONVERSATION_HISTORY>\n${historyText}\n</CONVERSATION_HISTORY>\n\n`;
    }
    userContent += `<CURRENT_REQUEST>\n${userMessage}\n</CURRENT_REQUEST>`;

    return [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userContent },
    ];
  };

  // Initial messages (same as rebuildMessages([]))
  let messages: Message[] = rebuildMessages([]);

  // addMessage: pushes to both working messages AND toolLoopMessages
  // CLI parity: matches chatCompletionWithTools's addMessage helper
  const addMessage = (msg: Message) => {
    messages.push(msg);
    toolLoopMessages.push(msg);
  };

  // Chat 로그: 사용자 입력
  logger.info('[CHAT] User message', { content: userMessage.substring(0, 500) });

  // Send user message to renderer and callbacks
  const userMessageObj = { role: 'user' as const, content: userMessage };
  if (callbacks.onMessage) {
    callbacks.onMessage(userMessageObj);
  }
  broadcastToWindows('agent:message', userMessageObj);

  // Tool call history
  const toolCallHistory: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: string;
    success: boolean;
  }> = [];

  let iterations = 0;
  let finalResponse = '';
  let noToolCallRetries = 0;
  const MAX_NO_TOOL_CALL_RETRIES = 3;
  let contextCompactRetried = false;
  let finalResponseFailures = 0;
  const MAX_FINAL_RESPONSE_FAILURES = 3;
  let consecutiveParseFailures = 0;
  const MAX_CONSECUTIVE_PARSE_FAILURES = 3;

  // Track parse failure tool_call_ids — stripped from returned history
  // Parse error hints are only useful for immediate retry, not for future sessions
  const parseFailureToolCallIds = new Set<string>();
  const stripParseFailures = (msgs: Message[]): Message[] => {
    if (parseFailureToolCallIds.size === 0) return msgs;
    return msgs.filter(msg => {
      if (msg.role === 'tool' && msg.tool_call_id && parseFailureToolCallIds.has(msg.tool_call_id)) return false;
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0 &&
          msg.tool_calls.every(tc => parseFailureToolCallIds.has(tc.id))) return false;
      return true;
    });
  };

  // Error telemetry: 현재 모델 정보 (reportError context에 포함)
  const currentModelInfo = configManager.getCurrentModel();
  const errorContext = {
    modelId: currentModelInfo?.id || 'unknown',
    modelName: currentModelInfo?.name || 'unknown',
  };
  const SOFT_ITERATION_LIMIT = 50; // Warn after this many iterations (informational only)
  let softLimitWarned = false;

  try {
    // CLI parity: no iteration limit - runs until LLM stops calling tools
    while (state.isRunning) {
      iterations++;

      // rebuildMessages 모드: 매 iteration마다 messages 재구성
      // CLI parity: 최신 TODO 상태, 전체 대화 history + tool loop messages를 포함
      messages = rebuildMessages(toolLoopMessages);

      logger.info(`Agent iteration ${iterations}`, { messagesCount: messages.length });

      // [DEBUG] Log last 4 messages before LLM call to diagnose repeated tool calls
      {
        const lastN = messages.slice(-4);
        const debugMsgs = lastN.map((m, i) => {
          const idx = messages.length - lastN.length + i;
          const base: Record<string, unknown> = { idx, role: m.role };
          if (m.role === 'tool') {
            base.tool_call_id = (m as any).tool_call_id;
            base.content = typeof m.content === 'string' ? m.content.substring(0, 300) : m.content;
          } else if (m.role === 'assistant') {
            base.contentSnippet = typeof m.content === 'string' ? m.content.substring(0, 100) : '(none)';
            base.toolCalls = (m as any).tool_calls?.map((tc: any) => ({
              id: tc.id,
              name: tc.function?.name,
              argsSnippet: typeof tc.function?.arguments === 'string' ? tc.function.arguments.substring(0, 100) : '',
            }));
          } else {
            base.contentSnippet = typeof m.content === 'string' ? m.content.substring(0, 100) : '(none)';
          }
          return base;
        });
        logger.info('[DEBUG] Messages before LLM call (last 4)', { messages: JSON.stringify(debugMsgs) });
      }

      // Soft warning at 50 iterations (informational only, not a limit)
      if (iterations === SOFT_ITERATION_LIMIT && !softLimitWarned) {
        softLimitWarned = true;
        logger.warn(`Reached ${SOFT_ITERATION_LIMIT} iterations (informational)`);
        addMessage({
          role: 'user',
          content: `You have made ${SOFT_ITERATION_LIMIT} tool calls. Please wrap up and call final_response soon to deliver your results.`,
        });
      }

      if (state.abortController?.signal.aborted) {
        throw new Error('Agent aborted');
      }

      // Call LLM with context length error recovery
      let response;
      try {
        response = await llmClient.chatCompletion({
          messages,
          tools,
          tool_choice: 'required', // Force LLM to call a tool (prevents empty responses)
          temperature: 0.7,
        });
      } catch (llmError) {
        if (llmError instanceof ContextLengthError && !contextCompactRetried) {
          contextCompactRetried = true;
          logger.warn('Context length exceeded - rolling back last tool group');

          if (callbacks.onTellUser) {
            callbacks.onTellUser('컨텍스트 길이 초과 - 마지막 도구 실행을 롤백하고 재시도합니다...');
          }
          broadcastToWindows('agent:tellUser', '컨텍스트 길이 초과 - 마지막 도구 실행을 롤백하고 재시도합니다...');

          // CLI parity: rollback toolLoopMessages instead of compacting
          // Remove last tool group (assistant with tool_calls + tool results)
          let rollbackIdx = toolLoopMessages.length - 1;
          while (rollbackIdx >= 0 && toolLoopMessages[rollbackIdx]?.role === 'tool') {
            rollbackIdx--;
          }
          if (rollbackIdx >= 0 && toolLoopMessages[rollbackIdx]?.tool_calls) {
            toolLoopMessages.length = rollbackIdx;
            logger.debug('Rolled back toolLoopMessages', { newLength: toolLoopMessages.length });
          }

          // Next iteration's rebuildMessages() will produce smaller context naturally
          continue;
        } else {
          throw llmError;
        }
      }

      // Check abort immediately after LLM response returns
      // (abort may have been called while waiting for the response)
      if (!state.isRunning || state.abortController?.signal.aborted) {
        logger.info('Agent aborted after LLM response');
        throw new Error('Agent aborted');
      }

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No response from LLM');
      }

      addMessage(assistantMessage);

      // Chat 로그: 어시스턴트 응답
      logger.info('[CHAT] Assistant message', {
        content: assistantMessage.content?.substring(0, 500),
        hasToolCalls: !!assistantMessage.tool_calls?.length,
        toolCount: assistantMessage.tool_calls?.length || 0,
        toolCallDetails: assistantMessage.tool_calls?.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          argsSnippet: tc.function.arguments?.substring(0, 150),
        })),
      });

      if (callbacks.onMessage) {
        callbacks.onMessage(assistantMessage);
      }
      broadcastToWindows('agent:message', assistantMessage);

      // Check for tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (state.abortController?.signal.aborted) {
            throw new Error('Agent aborted');
          }

          // Sanitize tool name: strip <|...|> special tokens and trailing garbage
          const rawToolName = toolCall.function.name;
          const toolName =
            rawToolName.replace(/<\|.*$/, '').replace(/[^a-zA-Z0-9_-]+$/, '').trim() || rawToolName;
          if (toolName !== rawToolName) {
            logger.warn('Tool name sanitized (model leaked special tokens)', {
              original: rawToolName,
              sanitized: toolName,
            });
            toolCall.function.name = toolName;
          }
          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = parseToolArguments(toolCall.function.arguments);
            consecutiveParseFailures = 0;
          } catch (parseError) {
            consecutiveParseFailures++;
            parseFailureToolCallIds.add(toolCall.id);
            const errorMessage = `Error parsing tool arguments: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`;
            logger.error('Tool argument parse error', {
              toolName,
              error: errorMessage,
              consecutiveFailures: consecutiveParseFailures,
            });

            reportError(parseError, {
              type: 'toolArgParsing',
              tool: toolName,
              consecutiveFailures: consecutiveParseFailures,
              ...errorContext,
              rawArguments: typeof toolCall.function.arguments === 'string' ? toolCall.function.arguments.substring(0, 500) : undefined,
            }).catch(() => {});

            // 3회 연속 parse 실패 시 abort — 모델이 JSON function calling을 지원하지 않음
            if (consecutiveParseFailures >= MAX_CONSECUTIVE_PARSE_FAILURES) {
              logger.error('[ABORT] Tool argument parse failed 3 times consecutively. Model may not support JSON function calling.');
              const abortMsg = '현재 모델이 올바른 JSON tool arguments를 생성하지 못하고 있습니다. 다른 모델로 변경해 주세요.';
              addMessage({
                role: 'tool',
                content: errorMessage,
                tool_call_id: toolCall.id,
              });

              // 에이전트 종료 — 최종 응답으로 abort 메시지 전달
              broadcastToWindows('agent:message', {
                role: 'assistant',
                content: abortMsg,
              });
              toolLoopMessages.push({ role: 'assistant' as const, content: abortMsg });
              const abortReturnMessages = stripParseFailures(toolLoopMessages);
              return {
                success: false,
                response: abortMsg,
                messages: [...validMessages, { role: 'user' as const, content: userMessage }, ...abortReturnMessages],
                toolCalls: toolCallHistory,
                iterations,
              };
            }

            // LLM에게 구체적 피드백 — raw input + 실패 원인 + 올바른 형식 안내
            const rawArgs = toolCall.function.arguments;
            const rawPreview = typeof rawArgs === 'string' ? rawArgs.substring(0, 300) : String(rawArgs);
            const hintMsg = `Error: Failed to parse tool arguments for "${toolName}".

Parse error: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}

Your raw input was:
\`\`\`
${rawPreview}
\`\`\`

Fix the following issues:
1. Arguments MUST be valid JSON (not XML, not plain text)
2. All strings must use double quotes ("), not single quotes (')
3. No trailing commas after the last property
4. No comments inside JSON
5. Escape special characters in strings (\\n, \\", \\\\)

Correct format example:
\`\`\`json
{"reason": "description", "file_path": "src/index.ts"}
\`\`\`

Do NOT use XML tags like <arg_key> or <arg_value>. Retry with valid JSON.`;
            addMessage({
              role: 'tool',
              content: hintMsg,
              tool_call_id: toolCall.id,
            });

            toolCallHistory.push({
              tool: toolName,
              args: {},
              result: errorMessage,
              success: false,
            });

            continue;
          }

          logger.info(`Executing tool: ${toolName}`, { args: JSON.stringify(toolArgs).substring(0, 200) });

          // Supervised Mode: Request approval before executing tool
          // Skip approval for: Auto Mode, communication tools, always-approved tools
          const skipApproval = autoMode || NO_APPROVAL_TOOLS.has(toolName) || state.alwaysApprovedTools.has(toolName);

          if (!skipApproval) {
            // For edit_file, show diff preview BEFORE asking for approval
            // (create_file skipped because file doesn't exist yet)
            if (toolName === 'edit_file') {
              try {
                const filePath = toolArgs['file_path'] as string;
                const resolvedPath = path.isAbsolute(filePath)
                  ? filePath
                  : path.resolve(workingDirectory, filePath);
                const ext = path.extname(filePath).toLowerCase();
                const langMap: Record<string, string> = {
                  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
                  '.py': 'python', '.json': 'json', '.html': 'html', '.css': 'css', '.md': 'markdown',
                };
                const language = langMap[ext] || 'plaintext';

                // Smart unescape for diff preview: match what file-tools.ts does
                const rawOld = toolArgs['old_string'] as string || '';
                const rawNew = toolArgs['new_string'] as string || '';
                const oldString = rawOld.includes('\n') ? rawOld : rawOld.replace(/\\\\n/g, '\x00E\x00').replace(/\\n/g, '\n').replace(/\x00E\x00/g, '\\n');
                const newString = rawNew.includes('\n') ? rawNew : rawNew.replace(/\\\\n/g, '\x00E\x00').replace(/\\n/g, '\n').replace(/\x00E\x00/g, '\\n');
                const originalContent = await fs.readFile(resolvedPath, 'utf-8');
                const newContent = originalContent.replace(oldString, newString);

                // Send diff preview event
                state.chatWindow?.webContents.send('agent:fileEdit', {
                  path: resolvedPath,
                  originalContent,
                  newContent,
                  language,
                });

                // Wait for diff to be shown
                await new Promise(resolve => setTimeout(resolve, 2000));
              } catch (previewError) {
                logger.warn('[Supervised] Failed to show edit_file preview', { error: previewError });
              }
            }

            // Request approval
            const approvalResult = await requestToolApproval(
              toolName,
              toolArgs,
              toolArgs['reason'] as string | undefined
            );

            // If 'always' approved, remember for this session
            if (approvalResult === 'always') {
              state.alwaysApprovedTools.add(toolName);
              logger.info('[Supervised] Tool always-approved for session', { toolName });
            }

            // If approval was rejected, skip tool execution
            if (approvalResult && typeof approvalResult === 'object' && approvalResult.reject) {
              const rejectMessage = `Tool execution rejected by user: ${approvalResult.comment || 'No reason provided'}`;
              logger.info('[Supervised] Tool rejected', { toolName, comment: approvalResult.comment });

              addMessage({
                role: 'tool',
                content: rejectMessage,
                tool_call_id: toolCall.id,
              });

              toolCallHistory.push({
                tool: toolName,
                args: toolArgs,
                result: rejectMessage,
                success: false,
              });

              continue;
            }
          }

          // Execute tool via simple tool executor (CLI parity: uses executeFileTool)
          const result = await executeSimpleTool(toolName, toolArgs);

          // Check abort after tool execution completes
          if (!state.isRunning || state.abortController?.signal.aborted) {
            logger.info('Agent aborted after tool execution', { toolName });
            throw new Error('Agent aborted');
          }

          const toolResultContent = result.success
            ? result.result || '(no output)'
            : `Error: ${result.error}`;

          // Tool 실행 실패 시 에러 텔레메트리
          if (!result.success) {
            reportError(new Error(result.error || 'Tool execution failed'), {
              type: 'toolExecution',
              tool: toolName,
              ...errorContext,
              toolArgs,
            }).catch(() => {});
          }

          logger.info(`Tool result: ${toolName}`, {
            success: result.success,
            resultLength: toolResultContent.length,
          });

          // Handle final_response tool specially
          if (toolName === 'final_response') {
            if (result.success && result.metadata?.['isFinalResponse']) {
              logger.flow('final_response tool executed successfully - returning');
              finalResponse = result.result || '';

              addMessage({
                role: 'tool',
                content: toolResultContent,
                tool_call_id: toolCall.id,
              });

              toolCallHistory.push({
                tool: toolName,
                args: toolArgs,
                result: toolResultContent,
                success: result.success,
              });

              // Send agent:toolResult for final_response - AgentContext will display it as chat message
              // NOTE: simple-tool-executor skips final_response, so we send it here (only once)
              broadcastToWindows('agent:toolResult', {
                toolName,
                result: finalResponse,
                success: result.success,
              });

              // Send agent:complete with empty response to signal completion
              // (the actual message is displayed via agent:toolResult above)
              // Chat 로그: 최종 응답
              logger.info('[CHAT] Final response', { content: finalResponse.substring(0, 500) });

              if (callbacks.onComplete) {
                callbacks.onComplete(finalResponse);
              }
              broadcastToWindows('agent:complete', { response: '' });

              // Return original history + user message + tool loop messages (not synthetic flatten)
              const finalReturnToolLoopMessages = stripParseFailures(toolLoopMessages);
              const finalReturnMessages = [...validMessages, { role: 'user' as const, content: userMessage }, ...finalReturnToolLoopMessages];

              return {
                success: true,
                response: finalResponse,
                messages: finalReturnMessages,
                toolCalls: toolCallHistory,
                iterations,
              };
            } else {
              finalResponseFailures++;
              logger.flow(`final_response failed (attempt ${finalResponseFailures}/${MAX_FINAL_RESPONSE_FAILURES}): ${result.error}`);

              if (finalResponseFailures >= MAX_FINAL_RESPONSE_FAILURES) {
                logger.warn('Max final_response failures exceeded - forcing completion');
                const fallbackMessage = (toolArgs['message'] as string) || 'Task completed with incomplete TODOs.';

                addMessage({
                  role: 'tool',
                  content: fallbackMessage,
                  tool_call_id: toolCall.id,
                });

                toolCallHistory.push({
                  tool: toolName,
                  args: toolArgs,
                  result: fallbackMessage,
                  success: false,
                });

                if (callbacks.onToolResult) {
                  callbacks.onToolResult(toolName, fallbackMessage, false);
                }
                broadcastToWindows('agent:toolResult', {
                  toolName,
                  result: fallbackMessage,
                  success: false,
                });

                if (callbacks.onTellUser) {
                  callbacks.onTellUser('완료되지 않은 TODO가 있지만, 최대 재시도 횟수에 도달하여 작업을 종료합니다.');
                }
                broadcastToWindows('agent:tellUser', '완료되지 않은 TODO가 있지만, 최대 재시도 횟수에 도달하여 작업을 종료합니다.');

                // Chat 로그: fallback 응답
                logger.info('[CHAT] Final response (fallback)', { content: fallbackMessage.substring(0, 500) });

                if (callbacks.onComplete) {
                  callbacks.onComplete(fallbackMessage);
                }
                broadcastToWindows('agent:complete', { response: fallbackMessage });

                // Return original history + user message + tool loop messages (not synthetic flatten)
                const fbReturnToolLoopMessages = stripParseFailures(toolLoopMessages);
                const fbReturnMessages = [...validMessages, { role: 'user' as const, content: userMessage }, ...fbReturnToolLoopMessages];

                return {
                  success: true,
                  response: fallbackMessage,
                  messages: fbReturnMessages,
                  toolCalls: toolCallHistory,
                  iterations,
                };
              }
            }
          }

          addMessage({
            role: 'tool',
            content: toolResultContent,
            tool_call_id: toolCall.id,
          });

          // [DEBUG] Verify tool result was pushed to messages
          logger.info('[DEBUG] Tool result pushed', {
            toolName,
            tool_call_id: toolCall.id,
            contentSnippet: toolResultContent.substring(0, 200),
            messagesCountAfterPush: messages.length,
            lastMsgRole: messages[messages.length - 1]?.role,
            lastMsgToolCallId: (messages[messages.length - 1] as any)?.tool_call_id,
          });

          toolCallHistory.push({
            tool: toolName,
            args: toolArgs,
            result: toolResultContent,
            success: result.success,
          });

          if (callbacks.onToolResult) {
            callbacks.onToolResult(toolName, toolResultContent, result.success);
          }
          broadcastToWindows('agent:toolResult', {
            toolName,
            result: toolResultContent,
            success: result.success,
          });
        }
      } else {
        noToolCallRetries++;
        logger.flow(`No tool call - enforcing tool usage (attempt ${noToolCallRetries}/${MAX_NO_TOOL_CALL_RETRIES})`);

        if (noToolCallRetries > MAX_NO_TOOL_CALL_RETRIES) {
          logger.warn('Max no-tool-call retries exceeded - returning content as final response');
          finalResponse = assistantMessage.content || 'Task completed.';
          break;
        }

        const hasMalformedToolCall = assistantMessage.content &&
          (/<tool_call>/i.test(assistantMessage.content) ||
           /<arg_key>/i.test(assistantMessage.content) ||
           /<arg_value>/i.test(assistantMessage.content) ||
           /<\/tool_call>/i.test(assistantMessage.content) ||
           /bash<arg_key>/i.test(assistantMessage.content) ||
           // Grok/xAI XML function call format
           /<xai:function_call/i.test(assistantMessage.content) ||
           /<\/xai:function_call>/i.test(assistantMessage.content) ||
           /<parameter\s+name=/i.test(assistantMessage.content));

        const retryMessage = hasMalformedToolCall
          ? 'Your previous response contained a malformed tool call (XML tags in content). You MUST use the proper tool_calls API format. Use final_response tool to deliver your message to the user.'
          : 'You must use tools for all actions. Use final_response tool to deliver your final message to the user after completing all tasks.';

        if (hasMalformedToolCall) {
          logger.warn('Malformed tool call detected in content', {
            contentSnippet: assistantMessage.content?.substring(0, 200),
          });
        }

        addMessage({
          role: 'user',
          content: retryMessage,
        });

        continue;
      }

      // ========================================================================
      // Preventative auto-compact check (CLI parity: plan-executor.ts)
      // Triggers at 70% context usage to prevent LLM context length errors
      // ========================================================================
      const model = configManager.getCurrentModel();
      const maxTokens = model?.maxTokens || 128000;

      // Send context usage to renderer for StatusBar display
      const usage = contextTracker.getContextUsage(maxTokens);
      if (usage.usagePercentage > 0) {
        broadcastToWindows('agent:contextUpdate', {
          usagePercentage: usage.usagePercentage,
          currentTokens: usage.currentTokens,
          maxTokens: usage.maxTokens,
        });
      }

      // Check if auto-compact should trigger (one-shot at threshold)
      if (contextTracker.shouldTriggerAutoCompact(maxTokens)) {
        logger.flow('Preventative auto-compact triggered at threshold', {
          usagePercentage: usage.usagePercentage,
        });

        if (callbacks.onTellUser) {
          callbacks.onTellUser(`컨텍스트 ${usage.usagePercentage}% 사용 - 자동 압축을 실행합니다...`);
        }
        broadcastToWindows('agent:tellUser', `컨텍스트 ${usage.usagePercentage}% 사용 - 자동 압축을 실행합니다...`);

        // Compact the full conversation (baseHistory + toolLoopMessages)
        const fullMessagesToCompact = [...baseHistory, ...toolLoopMessages];
        const compactResult = await compactConversation(fullMessagesToCompact, { workingDirectory });

        if (compactResult.success && compactResult.compactedMessages) {
          logger.info('Preventative auto-compact successful', {
            originalCount: compactResult.originalMessageCount,
            newCount: compactResult.newMessageCount,
          });

          // Update return value references (compacted replaces original history)
          validMessages = [...compactResult.compactedMessages];

          // Compacted content becomes the new base history for subsequent rebuilds
          // Without this, rebuildMessages would produce empty CONVERSATION_HISTORY
          baseHistory = [...compactResult.compactedMessages];
          toolLoopMessages.length = 0;

          // Reset context tracker with estimated token count
          const rebuildPreview = rebuildMessages(toolLoopMessages);
          const totalContent = rebuildPreview
            .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
            .join('');
          const estimatedTokens = contextTracker.estimateTokens(totalContent);
          contextTracker.reset(estimatedTokens);

          // Update renderer with new usage
          const newUsage = contextTracker.getContextUsage(maxTokens);
          broadcastToWindows('agent:contextUpdate', {
            usagePercentage: newUsage.usagePercentage,
            currentTokens: newUsage.currentTokens,
            maxTokens: newUsage.maxTokens,
          });
        } else {
          logger.warn('Preventative auto-compact failed', { error: compactResult.error });
        }
      }
    }

    // CLI parity: no max iterations check - loop exits when LLM calls final_response or stops

    if (callbacks.onComplete) {
      callbacks.onComplete(finalResponse);
    }
    broadcastToWindows('agent:complete', { response: finalResponse });

    // Return original history + user message + tool loop messages (not the synthetic flattened message)
    // CLI parity: system prompt and synthetic flatten message are excluded from stored history
    const returnToolLoopMessages = stripParseFailures(toolLoopMessages);
    const returnMessages = [...validMessages, { role: 'user' as const, content: userMessage }, ...returnToolLoopMessages];

    return {
      success: true,
      response: finalResponse,
      messages: returnMessages,
      toolCalls: toolCallHistory,
      iterations,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Treat abort/interrupt as graceful termination, not error
    const isAbort = errorMessage === 'Agent aborted' || errorMessage === 'INTERRUPTED';
    if (isAbort) {
      logger.info('Agent terminated by user abort', { iterations });
    } else {
      logger.error('Agent error', { error: errorMessage });
    }

    // Don't send error event for user-initiated aborts
    if (!isAbort) {
      reportError(error, { type: 'agent', method: 'runAgent' }).catch(() => {});
      if (callbacks.onError) {
        callbacks.onError(error instanceof Error ? error : new Error(errorMessage));
      }
      broadcastToWindows('agent:error', { error: errorMessage });
    }

    // Return original history + user message + tool loop messages (not the synthetic flattened message)
    const errorReturnToolLoopMessages = stripParseFailures(toolLoopMessages);
    const returnMessages = [...validMessages, { role: 'user' as const, content: userMessage }, ...errorReturnToolLoopMessages];

    return {
      success: isAbort, // Abort is not a failure - messages are still valid
      response: '',
      messages: returnMessages,
      toolCalls: toolCallHistory,
      iterations,
      error: isAbort ? undefined : errorMessage,
    };
  } finally {
    state.isRunning = false;
    state.abortController = null;

    setTodoWriteCallback(null);
    setTellToUserCallback(null);
    setAskUserCallback(null);
    setReasoningCallback(null);
    clearFinalResponseCallbacks();
  }
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

  // Chat 로그: 사용자 입력
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

      // Chat 로그: 어시스턴트 응답
      logger.info('[CHAT] Assistant response', { content: result.content.substring(0, 500) });

      return { response: result.content, messages };
    } else {
      const result = await llmClient.chat(messages, false);
      messages.push(result.message);

      // Chat 로그: 어시스턴트 응답
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
