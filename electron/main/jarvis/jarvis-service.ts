/**
 * Jarvis Service - Manager LLM 오케스트레이션
 *
 * 핵심 역할:
 * - 주기적 ONCE/FREE 폴링 → Manager LLM 분석 → 자율 실행
 * - 사용자 채팅 처리 (Manager LLM 도구 루프)
 * - 2-Layer 컨텍스트 관리 (영구 기억 + 대화 메시지)
 * - Sub-LLM(Planner/Executor) 위임 + ask_to_user 가로채기
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { BrowserWindow } from 'electron';
import { llmClient, Message } from '../core/llm';
import { logger } from '../utils/logger';
import { configManager } from '../core/config';
import { onceTaskList, freeWorkList } from '../tools/llm/simple/external-services';
import { compactConversation } from '../core/compact';
import { runAgentCore, AgentIO, AgentRunState } from '../orchestration/agent-engine';
import type { AgentConfig } from '../orchestration/agent-engine';
import type {
  JarvisConfig,
  JarvisMemory,
  JarvisMemoryEntry,
  JarvisStatus,
  JarvisState,
  JarvisChatMessage,
} from './jarvis-types';
import { JARVIS_SYSTEM_PROMPT, JARVIS_MANAGER_TOOLS, buildManagerUserPrompt } from './jarvis-prompts';

// =============================================================================
// Constants
// =============================================================================

const MAX_MANAGER_ITERATIONS = 20; // Manager LLM 도구 루프 최대 반복
const MAX_RETRY_NO_TOOL = 3;       // 도구 미사용 시 재시도
const MEMORY_MAX_ENTRIES = 100;     // 기억 항목 최대 수

// =============================================================================
// JarvisService Class
// =============================================================================

export class JarvisService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private memory: JarvisMemory = { entries: [], lastGreeting: '', lastPollTime: '' };
  private messages: Message[] = [];    // Layer 2 대화
  private pendingUserMessages: string[] = []; // 실행 중 대기열
  private chatHistory: JarvisChatMessage[] = []; // UI 대화 이력 (윈도우 재오픈 시 복원용)

  private status: JarvisStatus = 'idle';
  private isRunning = false;
  private isStopped = false; // stop() 호출 시 true → 진행 중인 루프 종료

  // Pending response maps (사용자 응답 대기용)
  private pendingApprovals = new Map<string, { resolve: (approved: boolean) => void; timer: NodeJS.Timeout }>();
  private pendingQuestions = new Map<string, { resolve: (answer: string) => void; timer: NodeJS.Timeout }>();
  private static readonly RESPONSE_TIMEOUT = 300_000; // 5분
  private jarvisWindow: BrowserWindow | null = null;

  // Memory file path
  private memoryPath: string;

  constructor() {
    const homeDir = process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'LOCAL-CLI-UI')
      : path.join(os.homedir(), '.local-cli-ui');
    this.memoryPath = path.join(homeDir, 'jarvis-memory.json');
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  setWindow(window: BrowserWindow | null): void {
    this.jarvisWindow = window;
  }

  async start(): Promise<void> {
    this.isStopped = false;
    await this.loadMemory();
    const config = this.getConfig();

    // 첫 인사 + TODO 체크
    this.greetAndCheck();

    // 타이머 시작
    this.scheduleNextPoll(config.pollIntervalMinutes);
    logger.info('[JarvisService] Started', { interval: config.pollIntervalMinutes });
  }

  stop(): void {
    this.isStopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.setStatus('idle');

    // Pending 응답 모두 정리
    for (const [, pending] of this.pendingApprovals) {
      clearTimeout(pending.timer);
      pending.resolve(false);
    }
    this.pendingApprovals.clear();
    for (const [, pending] of this.pendingQuestions) {
      clearTimeout(pending.timer);
      pending.resolve('[서비스 종료]');
    }
    this.pendingQuestions.clear();

    logger.info('[JarvisService] Stopped');
  }

  async pollNow(): Promise<void> {
    if (this.isRunning) {
      logger.info('[JarvisService] Already running, skipping poll');
      return;
    }
    await this.runManagerLoop('poll');
  }

  /**
   * 사용자 메시지 처리
   */
  async handleUserMessage(message: string): Promise<void> {
    logger.info('[JarvisService] handleUserMessage', { message: message.slice(0, 300), messageLength: message.length, isRunning: this.isRunning });

    // 사용자 메시지를 chatHistory에 기록 (윈도우 재오픈 시 복원용)
    this.chatHistory.push({
      id: `user-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: Date.now(),
    });

    if (this.isRunning) {
      // 실행 중이면 대기열에 저장
      this.pendingUserMessages.push(message);
      logger.info('[JarvisService] Message queued (busy)', { queueSize: this.pendingUserMessages.length });
      this.broadcastMessage({
        id: `sys-${Date.now()}`,
        type: 'system',
        content: '현재 작업 중입니다. 완료 후 메시지를 처리하겠습니다.',
        timestamp: Date.now(),
      });
      return;
    }
    await this.runManagerLoop('user_message', message);
  }

  getState(): JarvisState {
    return {
      status: this.status,
      isRunning: this.isRunning,
      lastPollTime: this.memory.lastPollTime || null,
      nextPollTime: null, // TODO: calculate from timer
      currentTask: null,
    };
  }

  // ===========================================================================
  // User Response Handling (IPC에서 호출)
  // ===========================================================================

  respondToApproval(requestId: string, approved: boolean): void {
    const pending = this.pendingApprovals.get(requestId);
    if (pending) {
      logger.info('[JarvisService] respondToApproval', { requestId, approved });
      pending.resolve(approved);
    } else {
      logger.warn('[JarvisService] respondToApproval: no pending request', { requestId });
    }
  }

  respondToQuestion(requestId: string, answer: string): void {
    const pending = this.pendingQuestions.get(requestId);
    if (pending) {
      logger.info('[JarvisService] respondToQuestion', { requestId, answerLength: answer.length });
      pending.resolve(answer);
    } else {
      logger.warn('[JarvisService] respondToQuestion: no pending request', { requestId });
    }
  }

  // ===========================================================================
  // Core: Manager LLM Tool Loop
  // ===========================================================================

  private async runManagerLoop(trigger: 'poll' | 'user_message' | 'greeting', userMessage?: string): Promise<void> {
    if (this.isRunning) {
      logger.info('[JarvisService] runManagerLoop skipped (already running)', { trigger });
      return;
    }
    this.isRunning = true;
    logger.info('[JarvisService] runManagerLoop started', { trigger, hasUserMessage: !!userMessage });
    await this.runManagerLoopInternal(trigger, userMessage);
  }

  private async runManagerLoopInternal(trigger: 'poll' | 'user_message' | 'greeting', userMessage?: string): Promise<void> {
    if (this.isStopped) return;
    this.setStatus(trigger === 'poll' ? 'polling' : 'analyzing');

    try {
      // 1. ONCE/FREE 데이터 조회
      const [onceTodosResult, freeItemsResult] = await Promise.allSettled([
        onceTaskList().catch(() => ({ success: false, result: undefined })),
        freeWorkList().catch(() => ({ success: false, items: undefined })),
      ]);

      const onceTodos = onceTodosResult.status === 'fulfilled' && 'result' in onceTodosResult.value
        ? (onceTodosResult.value.result || '') : '';
      let freeWorkItems = '';
      if (freeItemsResult.status === 'fulfilled' && 'items' in freeItemsResult.value && freeItemsResult.value.items?.length) {
        freeWorkItems = freeItemsResult.value.items
          .map((item: { id: string; title: string; content: string }) =>
            `- ${item.title} [id: ${item.id}]: ${item.content?.slice(0, 200) || ''}`)
          .join('\n');
      }
      logger.info('[JarvisService] Data fetched', {
        onceTodosLength: onceTodos.length,
        freeItemsLength: freeWorkItems.length,
        onceFailed: onceTodosResult.status === 'rejected',
        freeFailed: freeItemsResult.status === 'rejected',
      });

      // 2. 컨텍스트 구성
      const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const recentConversation = this.messages.slice(-20).map(m =>
        `[${m.role.toUpperCase()}]: ${(m.content || '').slice(0, 500)}`
      ).join('\n');

      const userPrompt = buildManagerUserPrompt({
        trigger,
        userMessage,
        memory: this.memory.entries,
        onceTodos,
        freeWorkItems,
        recentConversation,
        currentTime: now,
        pendingMessages: this.pendingUserMessages.length > 0 ? [...this.pendingUserMessages] : undefined,
      });

      // 대기열 초기화 (컨텍스트에 포함했으므로)
      this.pendingUserMessages = [];

      // 2.5. Jarvis 전용 모델 임시 적용 (설정되어 있으면)
      const jarvisModelConfig = this.getConfig();
      let originalEndpointId: string | undefined;
      let originalModelId: string | undefined;
      if (jarvisModelConfig.endpointId || jarvisModelConfig.modelId) {
        const currentEndpoints = configManager.getEndpoints();
        originalEndpointId = currentEndpoints.currentEndpointId;
        originalModelId = currentEndpoints.currentModelId;
        logger.info('[JarvisService] Switching to Jarvis model', {
          from: `${originalEndpointId}:${originalModelId}`,
          to: `${jarvisModelConfig.endpointId}:${jarvisModelConfig.modelId}`,
        });
        if (jarvisModelConfig.endpointId) {
          await configManager.setCurrentEndpoint(jarvisModelConfig.endpointId);
        }
        if (jarvisModelConfig.modelId) {
          await configManager.setCurrentModel(jarvisModelConfig.modelId);
        }
      }

      // 3. Manager LLM 도구 루프
      logger.info('[JarvisService] Starting Manager LLM loop', {
        trigger,
        userMessage: userMessage?.slice(0, 200),
        memoryEntries: this.memory.entries.length,
        conversationMessages: this.messages.length,
        pendingMessages: this.pendingUserMessages.length,
      });

      const managerMessages: Message[] = [
        { role: 'system', content: JARVIS_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ];

      let noToolRetries = 0;
      let consecutiveReports = 0; // 연속 report_to_user 감지 → 루프 종료 조건

      for (let i = 0; i < MAX_MANAGER_ITERATIONS; i++) {
        this.setStatus('analyzing');

        logger.info('[JarvisService] LLM call #' + (i + 1), { totalMessages: managerMessages.length });
        let response;
        try {
          response = await llmClient.chatCompletion({
            messages: managerMessages,
            tools: JARVIS_MANAGER_TOOLS,
            tool_choice: 'required',
            temperature: 0.5,
            max_tokens: 2000,
          });
        } catch (error) {
          logger.errorSilent('[JarvisService] Manager LLM call failed', { type: 'jarvis', iteration: i + 1, error: String(error) });
          this.broadcastMessage({
            id: `err-${Date.now()}`,
            type: 'system',
            content: 'LLM 호출에 실패했습니다. 다음 폴링에서 다시 시도합니다.',
            timestamp: Date.now(),
          });
          break;
        }

        const assistantMessage = response.choices?.[0]?.message;
        if (!assistantMessage) {
          logger.warn('[JarvisService] LLM returned empty message', { iteration: i + 1, choices: response.choices?.length });
          break;
        }

        // LLM 텍스트 응답이 있으면 로깅 (도구 호출 없이 텍스트만 온 경우 추적용)
        if (assistantMessage.content) {
          logger.info('[JarvisService] LLM text response', { iteration: i + 1, content: String(assistantMessage.content).slice(0, 300) });
        }

        managerMessages.push(assistantMessage);

        // Tool call 처리
        const toolCalls = assistantMessage.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
          noToolRetries++;
          if (noToolRetries >= MAX_RETRY_NO_TOOL) {
            logger.warn('[JarvisService] Manager LLM failed to use tools after retries');
            break;
          }
          // 재시도: 도구 사용 강제
          managerMessages.push({
            role: 'user',
            content: 'ERROR: 도구를 사용하지 않았습니다. 반드시 도구를 사용해주세요.',
          });
          continue;
        }

        noToolRetries = 0;
        const toolCall = toolCalls[0]; // 단일 도구 실행
        const toolName = toolCall.function.name;
        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch (parseErr) {
          logger.warn('[JarvisService] Failed to parse tool arguments', {
            tool: toolName,
            rawArgs: (toolCall.function.arguments || '').slice(0, 200),
            error: String(parseErr),
          });
          toolArgs = {};
        }

        logger.info('[JarvisService] Manager tool call', { tool: toolName, iteration: i + 1, args: JSON.stringify(toolArgs).slice(0, 300) });

        // 4. 도구별 처리
        let toolResult = '';
        let shouldBreak = false;

        switch (toolName) {
          case 'delegate_to_planner': {
            consecutiveReports = 0; // 다른 도구 호출 시 리셋
            this.setStatus('executing');
            const taskDesc = (toolArgs.task_description as string) || '';
            const workDir = (toolArgs.working_directory as string) || process.cwd();
            logger.info('[JarvisService] delegate_to_planner', { trigger, iteration: i + 1, taskDesc: taskDesc.slice(0, 500), workDir });
            this.broadcastMessage({
              id: `exec-${Date.now()}`,
              type: 'execution_status',
              content: '작업을 실행하고 있습니다...',
              timestamp: Date.now(),
            });

            try {
              const result = await this.executeViaAgentEngine(taskDesc, workDir);
              toolResult = JSON.stringify({
                success: result.success,
                response: result.response.slice(0, 2000),
                iterations: result.iterations,
                toolCalls: result.toolCalls.map(tc => `${tc.tool}: ${tc.success ? 'OK' : 'FAIL'}`).join(', '),
              });
              this.broadcastMessage({
                id: `exec-done-${Date.now()}`,
                type: 'execution_status',
                content: result.success ? '작업이 완료되었습니다' : '작업에 실패했습니다',
                timestamp: Date.now(),
              });
            } catch (err) {
              toolResult = JSON.stringify({
                success: false,
                response: `실행 오류: ${String(err)}`,
                iterations: 0,
              });
              this.broadcastMessage({
                id: `exec-err-${Date.now()}`,
                type: 'execution_status',
                content: '작업에 실패했습니다',
                timestamp: Date.now(),
              });
            }
            break;
          }

          case 'report_to_user': {
            const message = (toolArgs.message as string) || '';
            logger.info('[JarvisService] report_to_user', { trigger, iteration: i + 1, message: message.slice(0, 500), consecutiveReports: consecutiveReports + 1 });
            this.broadcastMessage({
              id: `jarvis-${Date.now()}`,
              type: 'jarvis',
              content: message,
              timestamp: Date.now(),
            });
            // Layer 2에 기록
            this.messages.push({ role: 'assistant', content: `[Jarvis → User] ${message}` });
            consecutiveReports++;
            // 1번 report로 충분 → 즉시 루프 종료 (중복 메시지 방지)
            logger.info('[JarvisService] report_to_user sent, ending loop');
            toolResult = 'Message sent. Cycle complete. Do NOT send another message.';
            shouldBreak = true;
            break;
          }

          case 'request_approval': {
            consecutiveReports = 0;
            this.setStatus('waiting_user');
            const message = (toolArgs.message as string) || '';
            const requestId = `approval-${Date.now()}`;
            logger.info('[JarvisService] request_approval', { trigger, iteration: i + 1, requestId, message: message.slice(0, 500) });
            this.broadcastMessage({
              id: requestId,
              type: 'approval_request',
              content: message,
              timestamp: Date.now(),
              requestId,
            });
            toolResult = await new Promise<string>((resolve) => {
              const timer = setTimeout(() => {
                this.pendingApprovals.delete(requestId);
                logger.warn('[JarvisService] Approval timeout', { requestId });
                this.setStatus('analyzing');
                resolve(JSON.stringify({ approved: false, reason: '응답 시간 초과' }));
              }, JarvisService.RESPONSE_TIMEOUT);
              this.pendingApprovals.set(requestId, {
                resolve: (approved) => {
                  clearTimeout(timer);
                  this.pendingApprovals.delete(requestId);
                  this.setStatus('analyzing');
                  resolve(JSON.stringify({ approved }));
                },
                timer,
              });
            });
            break;
          }

          case 'ask_to_user': {
            consecutiveReports = 0;
            this.setStatus('waiting_user');
            const question = (toolArgs.question as string) || '';
            const options = toolArgs.options as string[] | undefined;
            const requestId = `question-${Date.now()}`;
            logger.info('[JarvisService] ask_to_user', { trigger, iteration: i + 1, requestId, question: question.slice(0, 500), options });
            this.broadcastMessage({
              id: requestId,
              type: 'question',
              content: question,
              timestamp: Date.now(),
              requestId,
              options,
            });
            toolResult = await new Promise<string>((resolve) => {
              const timer = setTimeout(() => {
                this.pendingQuestions.delete(requestId);
                logger.warn('[JarvisService] Question timeout', { requestId });
                this.setStatus('analyzing');
                resolve(JSON.stringify({ answer: '[응답 시간 초과 - 기본값 사용]' }));
              }, JarvisService.RESPONSE_TIMEOUT);
              this.pendingQuestions.set(requestId, {
                resolve: (answer) => {
                  clearTimeout(timer);
                  this.pendingQuestions.delete(requestId);
                  this.setStatus('analyzing');
                  resolve(JSON.stringify({ answer }));
                },
                timer,
              });
            });
            break;
          }

          case 'add_memory': {
            consecutiveReports = 0;
            const key = (toolArgs.key as string) || '';
            const content = (toolArgs.content as string) || '';
            const entry = this.addMemory(key, content);
            toolResult = `Memory added: [${entry.id}] ${key}`;
            break;
          }

          case 'update_memory': {
            consecutiveReports = 0;
            const id = (toolArgs.id as string) || '';
            const content = (toolArgs.content as string) || '';
            const success = this.updateMemory(id, content);
            toolResult = success ? `Memory updated: ${id}` : `Memory not found: ${id}`;
            break;
          }

          case 'delete_memory': {
            consecutiveReports = 0;
            const id = (toolArgs.id as string) || '';
            const success = this.deleteMemory(id);
            toolResult = success ? `Memory deleted: ${id}` : `Memory not found: ${id}`;
            break;
          }

          default:
            toolResult = `Unknown tool: ${toolName}`;
            break;
        }

        // Tool result를 Manager에게 반환
        managerMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });

        logger.info('[JarvisService] Tool result', { tool: toolName, resultLength: toolResult.length, shouldBreak });

        if (shouldBreak) break;
      }

      // Jarvis 전용 모델 복원
      if (originalEndpointId !== undefined || originalModelId !== undefined) {
        logger.info('[JarvisService] Restoring original model', { endpointId: originalEndpointId, modelId: originalModelId });
        if (originalEndpointId) await configManager.setCurrentEndpoint(originalEndpointId);
        if (originalModelId) await configManager.setCurrentModel(originalModelId);
      }

      // 폴링 시각 업데이트
      this.memory.lastPollTime = new Date().toISOString();
      await this.saveMemory();

      // 컨텍스트 auto-compact 체크
      await this.checkAndCompact();

    } catch (error) {
      logger.errorSilent('[JarvisService] runManagerLoop error', { type: 'jarvis', trigger, error: String(error) });
    } finally {
      // 대기열 처리 전에 isRunning 유지하여 race condition 방지
      if (this.pendingUserMessages.length > 0) {
        const nextMessage = this.pendingUserMessages.shift()!;
        logger.info('[JarvisService] Processing queued message', { remaining: this.pendingUserMessages.length });
        this.setStatus('analyzing');
        try {
          await this.runManagerLoopInternal('user_message', nextMessage);
        } catch (queueErr) {
          logger.errorSilent('[JarvisService] Queued message processing failed', { type: 'jarvis', error: String(queueErr) });
        }
      }
      this.isRunning = false;
      this.setStatus('idle');
      logger.info('[JarvisService] runManagerLoop finished');
    }
  }

  // ===========================================================================
  // Greeting
  // ===========================================================================

  private async greetAndCheck(): Promise<void> {
    logger.info('[JarvisService] Starting greeting & check');
    await this.runManagerLoop('greeting');
    this.memory.lastGreeting = new Date().toISOString();
    await this.saveMemory();
    logger.info('[JarvisService] Greeting complete');
  }

  // ===========================================================================
  // Timer
  // ===========================================================================

  private scheduleNextPoll(intervalMinutes: number): void {
    if (this.timer) clearTimeout(this.timer);
    const nextPollAt = new Date(Date.now() + intervalMinutes * 60 * 1000).toLocaleTimeString('ko-KR');
    logger.info('[JarvisService] Next poll scheduled', { intervalMinutes, nextPollAt });
    this.timer = setTimeout(async () => {
      logger.info('[JarvisService] Timer triggered, starting poll');
      await this.pollNow();
      const config = this.getConfig();
      this.scheduleNextPoll(config.pollIntervalMinutes);
    }, intervalMinutes * 60 * 1000);
  }

  // ===========================================================================
  // Memory (Layer 1)
  // ===========================================================================

  private addMemory(key: string, content: string): JarvisMemoryEntry {
    const entry: JarvisMemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      key,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.memory.entries.push(entry);
    const beforeCount = this.memory.entries.length;
    // FIFO: 최대 항목 수 유지
    if (this.memory.entries.length > MEMORY_MAX_ENTRIES) {
      this.memory.entries = this.memory.entries.slice(-MEMORY_MAX_ENTRIES);
    }
    logger.info('[JarvisService] Memory added', { id: entry.id, key, totalEntries: this.memory.entries.length, trimmed: beforeCount - this.memory.entries.length });
    this.saveMemory().catch((err) => logger.errorSilent('[JarvisService] Memory save failed after add', { type: 'jarvis', error: String(err) }));
    return entry;
  }

  private updateMemory(id: string, content: string): boolean {
    const entry = this.memory.entries.find(e => e.id === id);
    if (!entry) {
      logger.warn('[JarvisService] Memory update failed: not found', { id });
      return false;
    }
    entry.content = content;
    entry.updatedAt = new Date().toISOString();
    logger.info('[JarvisService] Memory updated', { id, key: entry.key });
    this.saveMemory().catch((err) => logger.errorSilent('[JarvisService] Memory save failed after update', { type: 'jarvis', error: String(err) }));
    return true;
  }

  private deleteMemory(id: string): boolean {
    const index = this.memory.entries.findIndex(e => e.id === id);
    if (index === -1) {
      logger.warn('[JarvisService] Memory delete failed: not found', { id });
      return false;
    }
    const deleted = this.memory.entries[index];
    this.memory.entries.splice(index, 1);
    logger.info('[JarvisService] Memory deleted', { id, key: deleted.key, remainingEntries: this.memory.entries.length });
    this.saveMemory().catch((err) => logger.errorSilent('[JarvisService] Memory save failed after delete', { type: 'jarvis', error: String(err) }));
    return true;
  }

  private async loadMemory(): Promise<void> {
    try {
      const data = await fs.readFile(this.memoryPath, 'utf-8');
      this.memory = JSON.parse(data);
      logger.info('[JarvisService] Memory loaded', { entries: this.memory.entries.length, path: this.memoryPath });
    } catch (err) {
      logger.warn('[JarvisService] Memory load failed (using defaults)', { path: this.memoryPath, error: String(err) });
      this.memory = { entries: [], lastGreeting: '', lastPollTime: '' };
    }
  }

  private async saveMemory(): Promise<void> {
    try {
      const dir = path.dirname(this.memoryPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.memoryPath, JSON.stringify(this.memory, null, 2), 'utf-8');
    } catch (error) {
      logger.errorSilent('[JarvisService] Failed to save memory', { type: 'jarvis', error: String(error) });
    }
  }

  // ===========================================================================
  // Context Compact (Layer 2)
  // ===========================================================================

  private async checkAndCompact(): Promise<void> {
    // 메시지가 50개 이상이면 compact
    if (this.messages.length < 50) return;

    try {
      const result = await compactConversation(this.messages, {
        workingDirectory: process.cwd(),
      });
      if (result.success && result.compactedMessages) {
        this.messages = result.compactedMessages;
        logger.info('[JarvisService] Conversation compacted', {
          from: result.originalMessageCount,
          to: result.newMessageCount,
        });
      }
    } catch (error) {
      logger.errorSilent('[JarvisService] Compact failed', { type: 'jarvis', error: String(error) });
    }
  }

  // ===========================================================================
  // Agent Engine Execution (delegate_to_planner)
  // ===========================================================================

  private jarvisAgentState: AgentRunState = {
    isRunning: false,
    runId: 0,
    abortController: null,
    currentTodos: [],
    alwaysApprovedTools: new Set<string>(),
    currentSessionId: 'jarvis-session',
  };

  /**
   * Agent Engine을 직접 호출하여 Planner→Executor 파이프라인 실행.
   * Manager LLM이 비서 User 역할 — ask_to_user를 Manager가 대신 응답.
   */
  private async executeViaAgentEngine(
    taskDescription: string,
    workingDirectory: string,
  ): Promise<{ success: boolean; response: string; iterations: number; toolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string; success: boolean }>; error?: string }> {
    // Jarvis 전용 AgentIO — 모든 이벤트를 jarvisWindow로만 전송
    const jarvisIO: AgentIO = {
      broadcast: (channel: string, ...data: unknown[]) => {
        // 중간 과정은 로그로만 기록, UI에는 표시하지 않음
        if (channel === 'agent:toolCall') {
          const toolInfo = data[0] as { toolName?: string } | undefined;
          if (toolInfo?.toolName) {
            logger.info('[JarvisService] Sub-agent tool call', { tool: toolInfo.toolName });
          }
        }
      },
      flashWindows: () => {
        this.jarvisWindow?.flashFrame(true);
      },
      showTaskWindow: () => { /* noop */ },
      isTaskWindowVisible: () => false,
      requestApproval: async () => {
        // 완전 자율: 모든 도구 자동 승인
        return 'always' as const;
      },
      sendFileEdit: () => { /* Jarvis는 파일 편집 미리보기 안 함 */ },
    };

    const config: AgentConfig = {
      workingDirectory,
      enablePlanning: true,
      autoMode: true, // supervised mode 비활성화 → 전부 자동 승인
    };

    const result = await runAgentCore(
      taskDescription,
      [], // 새로운 실행이므로 기존 메시지 없음
      config,
      {
        onAskUser: async (request) => {
          // Manager LLM이 Sub-LLM의 질문에 기억+컨텍스트 기반으로 판단하여 답변
          logger.info('[JarvisService] Sub-LLM ask_to_user intercepted', {
            question: request.question,
            options: request.options,
          });

          try {
            const memoryContext = this.memory.entries.length > 0
              ? this.memory.entries.map(e => `[${e.key}]: ${e.content}`).join('\n')
              : '(기억 없음)';

            const optionsList = request.options.length > 0
              ? request.options.map((o, i) => `${i + 1}. ${o}`).join('\n')
              : '(선택지 없음 — 자유 답변)';

            const response = await llmClient.chatCompletion({
              messages: [
                {
                  role: 'system',
                  content: `You are Jarvis, answering a sub-agent's question on behalf of the user.
Use the provided memory/context to make the best decision.
If options are given, reply with EXACTLY one of the option texts. If no options, reply with a brief answer.
Reply in Korean. No explanation, just the answer.`,
                },
                {
                  role: 'user',
                  content: `<MEMORY>\n${memoryContext}\n</MEMORY>\n\n<TASK_CONTEXT>\n${taskDescription}\n</TASK_CONTEXT>\n\n질문: ${request.question}\n\n선택지:\n${optionsList}`,
                },
              ],
              temperature: 0.3,
              max_tokens: 200,
            });

            const answer = response.choices?.[0]?.message?.content?.trim() || '';
            logger.info('[JarvisService] Manager answered sub-LLM question', { answer: answer.slice(0, 200) });

            if (request.options.length > 0) {
              // 옵션 매칭: 정확 → 포함 → fallback 첫 번째
              const exact = request.options.find(o => o === answer);
              const partial = !exact ? request.options.find(o => answer.includes(o) || o.includes(answer)) : undefined;
              const selected = exact || partial || request.options[0];
              return { selectedOption: selected, isOther: false };
            }

            return { selectedOption: answer || 'Yes', isOther: true };
          } catch (err) {
            logger.warn('[JarvisService] Manager LLM failed to answer, falling back to first option', { error: String(err) });
            return {
              selectedOption: request.options[0] || 'Yes',
              isOther: false,
            };
          }
        },
        onComplete: (response) => {
          logger.info('[JarvisService] Agent execution complete', { responseLength: response.length });
        },
        onError: (error) => {
          logger.errorSilent('[JarvisService] Agent execution error', { type: 'jarvis', error: error.message });
        },
      },
      jarvisIO,
      this.jarvisAgentState,
    );

    return result;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private getConfig(): JarvisConfig {
    const config = configManager.get('jarvis');
    return config || { enabled: false, pollIntervalMinutes: 30, autoStartOnBoot: true };
  }

  private setStatus(status: JarvisStatus): void {
    if (this.status !== status) {
      logger.info('[JarvisService] Status changed', { from: this.status, to: status });
    }
    this.status = status;
    this.jarvisWindow?.webContents.send('jarvis:statusChange', status);
  }

  getChatHistory(): JarvisChatMessage[] {
    return [...this.chatHistory];
  }

  private broadcastMessage(message: JarvisChatMessage): void {
    logger.info('[JarvisService] broadcastMessage', {
      id: message.id,
      type: message.type,
      content: message.content.slice(0, 300),
      hasRequestId: !!message.requestId,
      hasOptions: !!(message as any).options,
    });
    this.chatHistory.push(message);
    this.jarvisWindow?.webContents.send('jarvis:message', message);
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const jarvisService = new JarvisService();
