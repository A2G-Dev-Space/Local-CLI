/**
 * Pipe Runner
 *
 * -p 모드의 핵심 실행 로직
 * Non-interactive: CLI 인자로 프롬프트 받아 처리 후 결과 출력
 * ask_to_user는 Manager LLM이 자동 답변 (Jarvis 방식)
 */

import chalk from 'chalk';
import { Message, TodoItem } from '../types/index.js';
import type { AskUserRequest, AskUserResponse } from '../orchestration/types.js';
import { LLMClient } from '../core/llm/llm-client.js';
import { DASHBOARD_URL } from '../constants.js';
import { ensureAuthenticated, syncModelsFromDashboard } from '../core/auth/auth-gate.js';
import { configManager } from '../core/config/config-manager.js';
import { PlanExecutor } from '../orchestration/plan-executor.js';
import type { StateCallbacks } from '../orchestration/types.js';

/**
 * stderr에 상세 과정 출력 (stdout은 최종 결과 전용)
 */
function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

export class PipeRunner {
  private specific: boolean;
  private llmClient: LLMClient | null = null;
  private planExecutor: PlanExecutor;
  private lastResponse: string = '';
  private todos: TodoItem[] = [];
  private prompt: string = '';

  constructor(specific: boolean) {
    this.specific = specific;
    this.planExecutor = new PlanExecutor();
  }

  async run(prompt: string): Promise<void> {
    this.prompt = prompt;

    try {
      // 초기화
      await configManager.initialize();

      const creds = await ensureAuthenticated(DASHBOARD_URL);
      await syncModelsFromDashboard(DASHBOARD_URL, creds.token);

      if (!configManager.hasEndpoints()) {
        log(chalk.red('Error: Dashboard에서 사용 가능한 모델이 없습니다.'));
        process.exit(1);
      }

      this.llmClient = new LLMClient(creds.token);

      // 실행
      const messages: Message[] = [];
      const isInterruptedRef = { current: false };
      const callbacks = this.createCallbacks();

      await this.planExecutor.executeAutoMode(
        prompt,
        this.llmClient,
        messages,
        this.todos,
        isInterruptedRef,
        callbacks
      );

      // 최종 결과 출력 (stdout)
      if (this.lastResponse) {
        console.log(this.lastResponse);
      }
    } catch (error) {
      log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  private createCallbacks(): StateCallbacks {
    let previousMessages: Message[] = [];

    return {
      setTodos: (todosOrFn) => {
        const newTodos = typeof todosOrFn === 'function'
          ? todosOrFn(this.todos)
          : todosOrFn;

        if (this.specific) {
          for (const todo of newTodos) {
            const existing = this.todos.find(t => t.id === todo.id);
            if (!existing) {
              log(chalk.dim(`  #${newTodos.indexOf(todo) + 1} ${todo.title}`));
            } else if (existing.status !== todo.status) {
              if (todo.status === 'in_progress') {
                log(chalk.cyan(`\n[Executing] #${newTodos.indexOf(todo) + 1} ${todo.title}`));
              } else if (todo.status === 'completed') {
                log(chalk.green(`  ✓ ${todo.title}`));
              } else if (todo.status === 'failed') {
                log(chalk.red(`  ✗ ${todo.title}`));
              }
            }
          }

          // 첫 TODO 배치 생성 시 헤더
          if (this.todos.length === 0 && newTodos.length > 0) {
            // 위에서 이미 개별 TODO를 출력했으므로, 헤더만 앞에 삽입
            // (setTodos는 배치로 호출되므로 헤더를 먼저 출력)
          }
        }

        this.todos = newTodos;
      },

      setCurrentTodoId: () => {},
      setExecutionPhase: (phase) => {
        if (this.specific && phase === 'planning') {
          log(chalk.yellow('\n[Planning] TODO 생성 중...'));
        }
      },
      setIsInterrupted: () => {},
      setCurrentActivity: () => {},

      setMessages: (messagesOrFn) => {
        const newMessages = typeof messagesOrFn === 'function'
          ? messagesOrFn(previousMessages)
          : messagesOrFn;

        const addedMessages = newMessages.slice(previousMessages.length);

        for (const msg of addedMessages) {
          // Tool call 처리
          if (msg.role === 'assistant' && msg.tool_calls) {
            for (const toolCall of msg.tool_calls) {
              let args: Record<string, unknown> = {};
              try { args = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }

              // final_response의 message를 lastResponse로 캡처
              if (toolCall.function.name === 'final_response' && typeof args['message'] === 'string') {
                this.lastResponse = args['message'];
              }

              // -ps 모드: tool call 출력
              if (this.specific) {
                const summary = this.summarizeToolArgs(toolCall.function.name, args);
                log(chalk.dim(`  → ${toolCall.function.name} ${summary}`));
              }
            }
          }

          // Tool result 출력 (-ps)
          if (this.specific && msg.role === 'tool') {
            const isSuccess = !msg.content?.startsWith('Error:');
            if (isSuccess) {
              log(chalk.dim(`  ← OK`));
            } else {
              log(chalk.red(`  ← Error: ${msg.content?.slice(0, 100)}`));
            }
          }

          // 최종 응답 추적
          if (msg.role === 'assistant' && !msg.tool_calls && msg.content) {
            this.lastResponse = msg.content;
          }
        }

        previousMessages = newMessages;
      },

      setAskUserRequest: () => {},

      // Manager LLM이 Sub-LLM의 질문에 자동 답변 (Jarvis 방식)
      askUser: async (request) => {
        return this.handleAskUser(request);
      },
    };
  }

  /**
   * Manager LLM이 ask_to_user 질문에 자동 답변 (Jarvis 방식)
   */
  private async handleAskUser(request: AskUserRequest): Promise<AskUserResponse> {
    const optionsList = request.options.length > 0
      ? request.options.map((o, i) => `${i + 1}. ${o}`).join('\n')
      : '(선택지 없음 — 자유 답변)';

    try {
      const response = await this.llmClient!.chatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are an autonomous agent answering a sub-agent's question on behalf of the user.
Use the task context to make the best decision.
If options are given, reply with EXACTLY one of the option texts.
Reply in Korean. No explanation, just the answer.`,
          },
          {
            role: 'user',
            content: `<TASK>\n${this.prompt}\n</TASK>\n\n질문: ${request.question}\n\n선택지:\n${optionsList}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const answer = response.choices?.[0]?.message?.content?.trim() || '';

      if (request.options.length > 0) {
        const exact = request.options.find(o => o === answer);
        const partial = !exact ? request.options.find(o => answer.includes(o) || o.includes(answer)) : undefined;
        const selected: string = exact ?? partial ?? request.options[0] ?? '';

        if (this.specific) {
          log(chalk.magenta(`  [Auto] Q: ${request.question} → A: ${selected}`));
        }
        return { selectedOption: selected, isOther: false };
      }

      if (this.specific) {
        log(chalk.magenta(`  [Auto] Q: ${request.question} → A: ${answer || 'Yes'}`));
      }
      return { selectedOption: answer || 'Yes', isOther: true };
    } catch {
      const fallback = request.options[0] || 'Yes';
      if (this.specific) {
        log(chalk.magenta(`  [Auto] Q: ${request.question} → A: ${fallback} (fallback)`));
      }
      return { selectedOption: fallback, isOther: false };
    }
  }

  /**
   * Tool 인자를 한 줄 요약
   */
  private summarizeToolArgs(toolName: string, args: Record<string, unknown>): string {
    if (toolName === 'bash' && args['command']) return String(args['command']).slice(0, 80);
    if (toolName.includes('file') && args['path']) return String(args['path']);
    if (toolName.includes('search') && args['query']) return String(args['query']).slice(0, 60);
    const keys = Object.keys(args);
    if (keys.length === 0) return '';
    const firstKey = keys[0];
    if (!firstKey) return '';
    return String(args[firstKey]).slice(0, 60);
  }
}

/**
 * Pipe 모드 실행 (CLI에서 호출)
 */
export async function runPipeMode(prompt: string, specific: boolean): Promise<void> {
  const runner = new PipeRunner(specific);
  await runner.run(prompt);
}
