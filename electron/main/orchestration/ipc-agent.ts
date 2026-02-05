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
import { detectGitRepo } from '../utils/git-utils';
import { toolRegistry, executeSimpleTool } from '../tools';
import { OptionalToolGroupId } from '../tools/types';
import {
  setWorkingDirectory,
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

  // Set working directory for tool executor
  setWorkingDirectory(workingDirectory);

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

      const planningResult = await planningLLM.generateTODOListWithDocsDecision(
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
          docsSearchNeeded: planningResult.docsSearchNeeded,
        });
      }
    } catch (planningError) {
      logger.error('Planning failed, falling back to direct execution', planningError as Error);
    }
  }

  // ==========================================================================
  // Prepare Messages
  // CLI parity: System prompt is injected per-LLM call, not stored in history
  // ==========================================================================
  let messages: Message[] = validateToolMessages([...existingMessages]);
  messages = truncateMessages(messages, 100);

  // Filter out any system messages from history
  // System prompt will be injected at LLM call time only
  messages = messages.filter((m) => m.role !== 'system');

  // Prepend system prompt for LLM call
  // Inject todoContext into system prompt (not user message) to prevent leak into next planning call
  const todoContext = buildTodoContext(state.currentTodos);
  const systemWithTodos = todoContext ? systemPrompt + '\n' + todoContext : systemPrompt;
  messages = [{ role: 'system', content: systemWithTodos }, ...messages];

  messages.push({ role: 'user', content: userMessage });

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
  const SOFT_ITERATION_LIMIT = 50; // Warn after this many iterations (informational only)
  let softLimitWarned = false;

  try {
    // CLI parity: no iteration limit - runs until LLM stops calling tools
    while (state.isRunning) {
      iterations++;

      logger.info(`Agent iteration ${iterations}`, { messagesCount: messages.length });

      // Soft warning at 50 iterations (informational only, not a limit)
      if (iterations === SOFT_ITERATION_LIMIT && !softLimitWarned) {
        softLimitWarned = true;
        logger.warn(`Reached ${SOFT_ITERATION_LIMIT} iterations (informational)`);
        messages.push({
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
          logger.warn('Context length exceeded - attempting auto-compact');
          contextCompactRetried = true;

          if (callbacks.onTellUser) {
            callbacks.onTellUser('컨텍스트 길이 초과로 자동 압축을 시도합니다...');
          }
          broadcastToWindows('agent:tellUser', '컨텍스트 길이 초과로 자동 압축을 시도합니다...');

          const compactResult = await compactConversation(messages, { workingDirectory });

          if (compactResult.success && compactResult.compactedMessages) {
            logger.info('Auto-compact successful', {
              originalCount: compactResult.originalMessageCount,
              newCount: compactResult.newMessageCount,
            });

            const systemMessage = messages.find(m => m.role === 'system');
            messages = systemMessage
              ? [systemMessage, ...compactResult.compactedMessages]
              : compactResult.compactedMessages;

            response = await llmClient.chatCompletion({
              messages,
              tools,
              temperature: 0.7,
            });
          } else {
            logger.error('Auto-compact failed', { error: compactResult.error });
            throw llmError;
          }
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

      messages.push(assistantMessage);

      // Chat 로그: 어시스턴트 응답
      logger.info('[CHAT] Assistant message', {
        content: assistantMessage.content?.substring(0, 500),
        hasToolCalls: !!assistantMessage.tool_calls?.length,
        toolCount: assistantMessage.tool_calls?.length || 0,
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

          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = parseToolArguments(toolCall.function.arguments);
          } catch (parseError) {
            const errorMessage = `Error parsing tool arguments: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`;
            logger.error('Tool argument parse error', { toolName, error: errorMessage });

            messages.push({
              role: 'tool',
              content: errorMessage,
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

                // NOTE: We no longer unescape content here.
                // JSON parsing already handles escape sequences properly.
                // The old unescape function was corrupting source code that contains
                // string literals like '\n' or '\t' by converting them to actual newlines/tabs.
                const oldString = toolArgs['old_string'] as string || '';
                const newString = toolArgs['new_string'] as string || '';
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

              messages.push({
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

          logger.info(`Tool result: ${toolName}`, {
            success: result.success,
            resultLength: toolResultContent.length,
          });

          // Handle final_response tool specially
          if (toolName === 'final_response') {
            if (result.success && result.metadata?.['isFinalResponse']) {
              logger.flow('final_response tool executed successfully - returning');
              finalResponse = result.result || '';

              messages.push({
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

              return {
                success: true,
                response: finalResponse,
                messages,
                toolCalls: toolCallHistory,
                iterations,
              };
            } else {
              finalResponseFailures++;
              logger.flow(`final_response failed (attempt ${finalResponseFailures}/${MAX_FINAL_RESPONSE_FAILURES}): ${result.error}`);

              if (finalResponseFailures >= MAX_FINAL_RESPONSE_FAILURES) {
                logger.warn('Max final_response failures exceeded - forcing completion');
                const fallbackMessage = (toolArgs['message'] as string) || 'Task completed with incomplete TODOs.';

                messages.push({
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

                return {
                  success: true,
                  response: fallbackMessage,
                  messages,
                  toolCalls: toolCallHistory,
                  iterations,
                };
              }
            }
          }

          messages.push({
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

        messages.push({
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

        const compactResult = await compactConversation(messages, { workingDirectory });

        if (compactResult.success && compactResult.compactedMessages) {
          logger.info('Preventative auto-compact successful', {
            originalCount: compactResult.originalMessageCount,
            newCount: compactResult.newMessageCount,
          });

          // Preserve system prompt, replace rest with compacted messages
          const systemMessage = messages.find(m => m.role === 'system');
          messages = systemMessage
            ? [systemMessage, ...compactResult.compactedMessages]
            : compactResult.compactedMessages;

          // Reset context tracker with estimated token count
          const totalContent = messages
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

    // Return messages without system prompt (CLI parity)
    // System prompt should not be stored in history
    const messagesWithoutSystem = messages.filter((m) => m.role !== 'system');

    return {
      success: true,
      response: finalResponse,
      messages: messagesWithoutSystem,
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
      if (callbacks.onError) {
        callbacks.onError(error instanceof Error ? error : new Error(errorMessage));
      }
      broadcastToWindows('agent:error', { error: errorMessage });
    }

    // Return messages without system prompt (CLI parity)
    const messagesWithoutSystem = messages.filter((m) => m.role !== 'system');

    return {
      success: isAbort, // Abort is not a failure - messages are still valid
      response: '',
      messages: messagesWithoutSystem,
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
