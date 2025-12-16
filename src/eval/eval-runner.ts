/**
 * Eval Runner
 *
 * --eval 모드의 핵심 실행 로직
 * NDJSON 이벤트 스트림으로 출력
 */

import { Message, TodoItem } from '../types/index.js';
import { LLMClient, createLLMClient } from '../core/llm/llm-client.js';
import { configManager } from '../core/config/config-manager.js';
import { PlanExecutor } from '../orchestration/plan-executor.js';
import type { StateCallbacks } from '../orchestration/types.js';
import type {
  EvalInput,
  EvalEvent,
  EvalStartEvent,
  EvalTodoEvent,
  EvalToolCallEvent,
  EvalToolResultEvent,
  EvalResponseEvent,
  EvalErrorEvent,
  EvalEndEvent,
} from './types.js';

/**
 * 이벤트를 NDJSON으로 stdout에 출력
 */
function emitEvent(event: EvalEvent): void {
  console.log(JSON.stringify(event));
}

/**
 * 현재 타임스탬프 반환
 */
function now(): string {
  return new Date().toISOString();
}

/**
 * Eval Runner 클래스
 */
export class EvalRunner {
  private llmClient: LLMClient | null = null;
  private planExecutor: PlanExecutor;
  private startTime: number = 0;
  private toolCallCount: number = 0;
  private filesModified: Set<string> = new Set();
  private lastResponse: string = '';
  private todos: TodoItem[] = [];

  constructor() {
    this.planExecutor = new PlanExecutor();
  }

  /**
   * 평가 실행
   */
  async run(input: EvalInput): Promise<void> {
    this.startTime = Date.now();
    this.toolCallCount = 0;
    this.filesModified.clear();
    this.lastResponse = '';
    this.todos = [];

    try {
      // 1. 초기화
      await configManager.initialize();

      if (!configManager.hasEndpoints()) {
        this.emitError('No LLM endpoint configured. Run: lcli to setup.');
        return;
      }

      this.llmClient = createLLMClient();
      const modelInfo = this.llmClient.getModelInfo();

      // 작업 디렉토리 변경
      if (input.working_dir) {
        process.chdir(input.working_dir);
      }

      // 2. Start 이벤트
      const startEvent: EvalStartEvent = {
        event: 'start',
        timestamp: now(),
        data: {
          prompt: input.prompt,
          model: modelInfo.model,
          endpoint: modelInfo.endpoint,
          working_dir: process.cwd(),
        },
      };
      emitEvent(startEvent);

      // 3. 실행
      await this.execute(input.prompt);

      // 4. End 이벤트
      this.emitEnd(true);

    } catch (error) {
      this.emitError(error instanceof Error ? error.message : String(error));
      this.emitEnd(false);
    }
  }

  /**
   * 실제 실행 로직
   */
  private async execute(prompt: string): Promise<void> {
    if (!this.llmClient) {
      throw new Error('LLM Client not initialized');
    }

    const messages: Message[] = [];
    const isInterruptedRef = { current: false };

    // StateCallbacks를 이벤트로 연결
    const callbacks = this.createCallbacks();

    // Auto 모드로 실행 (분류 후 적절한 모드 선택)
    await this.planExecutor.executeAutoMode(
      prompt,
      this.llmClient,
      messages,
      this.todos,
      isInterruptedRef,
      callbacks
    );
  }

  /**
   * 이벤트 출력용 StateCallbacks 생성
   */
  private createCallbacks(): StateCallbacks {
    let previousMessages: Message[] = [];

    return {
      setTodos: (todosOrFn) => {
        const newTodos = typeof todosOrFn === 'function'
          ? todosOrFn(this.todos)
          : todosOrFn;

        // 새로 추가된 TODO 감지
        for (const todo of newTodos) {
          const existing = this.todos.find(t => t.id === todo.id);
          if (!existing) {
            // 새 TODO
            this.emitTodo('created', todo);
          } else if (existing.status !== todo.status) {
            // 상태 변경
            if (todo.status === 'in_progress') {
              this.emitTodo('started', todo);
            } else if (todo.status === 'completed') {
              this.emitTodo('completed', todo);
            } else if (todo.status === 'failed') {
              this.emitTodo('failed', todo);
            }
          }
        }

        this.todos = newTodos;
      },

      setCurrentTodoId: () => {
        // 이벤트 불필요
      },

      setExecutionPhase: () => {
        // 이벤트 불필요
      },

      setIsInterrupted: () => {
        // 이벤트 불필요
      },

      setCurrentActivity: () => {
        // 이벤트 불필요
      },

      setMessages: (messagesOrFn) => {
        const newMessages = typeof messagesOrFn === 'function'
          ? messagesOrFn(previousMessages)
          : messagesOrFn;

        // 새로 추가된 메시지에서 tool call과 response 감지
        const addedMessages = newMessages.slice(previousMessages.length);

        for (const msg of addedMessages) {
          // Tool call 감지 (assistant 메시지의 tool_calls)
          if (msg.role === 'assistant' && msg.tool_calls) {
            for (const toolCall of msg.tool_calls) {
              this.emitToolCall(toolCall.function.name, toolCall.function.arguments);
            }
          }

          // Tool result 감지
          if (msg.role === 'tool') {
            const isSuccess = !msg.content?.startsWith('Error:');
            this.emitToolResult(msg.tool_call_id || 'unknown', isSuccess, msg.content);

            // 파일 수정 감지
            if (isSuccess && msg.content) {
              this.detectFileModification(msg.content);
            }
          }

          // Assistant 최종 응답 (tool_calls 없는 경우)
          if (msg.role === 'assistant' && !msg.tool_calls && msg.content) {
            this.lastResponse = msg.content;
          }
        }

        previousMessages = newMessages;
      },

      setAskUserRequest: () => {
        // eval 모드에서는 사용자 입력 불가 - 자동 스킵
      },
    };
  }

  /**
   * TODO 이벤트 출력
   */
  private emitTodo(action: 'created' | 'started' | 'completed' | 'failed', todo: TodoItem): void {
    const event: EvalTodoEvent = {
      event: 'todo',
      timestamp: now(),
      data: {
        action,
        id: todo.id,
        title: todo.title,
        status: todo.status,
      },
    };
    emitEvent(event);
  }

  /**
   * Tool call 이벤트 출력
   */
  private emitToolCall(tool: string, argsJson: string): void {
    this.toolCallCount++;

    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(argsJson);
    } catch {
      args = { raw: argsJson };
    }

    const event: EvalToolCallEvent = {
      event: 'tool_call',
      timestamp: now(),
      data: {
        tool,
        args,
      },
    };
    emitEvent(event);
  }

  /**
   * Tool result 이벤트 출력
   */
  private emitToolResult(tool: string, success: boolean, content?: string): void {
    const event: EvalToolResultEvent = {
      event: 'tool_result',
      timestamp: now(),
      data: {
        tool,
        success,
        ...(success ? { result: content?.substring(0, 500) } : { error: content }),
      },
    };
    emitEvent(event);
  }

  /**
   * 파일 수정 감지
   */
  private detectFileModification(content: string): void {
    // "created", "written", "edited" 등의 패턴으로 파일 경로 추출
    const patterns = [
      /File created: (.+)/,
      /File written: (.+)/,
      /Successfully edited (.+)/,
      /Created file: (.+)/,
      /Updated file: (.+)/,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        this.filesModified.add(match[1].trim());
      }
    }
  }

  /**
   * Response 이벤트 출력
   */
  private emitResponse(): void {
    if (this.lastResponse) {
      const event: EvalResponseEvent = {
        event: 'response',
        timestamp: now(),
        data: {
          content: this.lastResponse,
        },
      };
      emitEvent(event);
    }
  }

  /**
   * Error 이벤트 출력
   */
  private emitError(message: string): void {
    const event: EvalErrorEvent = {
      event: 'error',
      timestamp: now(),
      data: {
        message,
      },
    };
    emitEvent(event);
  }

  /**
   * End 이벤트 출력
   */
  private emitEnd(success: boolean): void {
    // Response 이벤트 먼저 출력
    if (success) {
      this.emitResponse();
    }

    const duration = Date.now() - this.startTime;

    const todoStats = this.todos.length > 0 ? {
      total: this.todos.length,
      completed: this.todos.filter(t => t.status === 'completed').length,
      failed: this.todos.filter(t => t.status === 'failed').length,
    } : undefined;

    const event: EvalEndEvent = {
      event: 'end',
      timestamp: now(),
      data: {
        success,
        duration_ms: duration,
        ...(todoStats && { todos: todoStats }),
        ...(this.toolCallCount > 0 && { tool_calls: this.toolCallCount }),
        ...(this.filesModified.size > 0 && { files_modified: Array.from(this.filesModified) }),
      },
    };
    emitEvent(event);
  }
}

/**
 * stdin에서 JSON 입력 읽기
 */
export async function readStdinJson(): Promise<EvalInput> {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      try {
        const input = JSON.parse(data) as EvalInput;
        if (!input.prompt) {
          reject(new Error('Missing required field: prompt'));
          return;
        }
        resolve(input);
      } catch (error) {
        reject(new Error(`Invalid JSON input: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    process.stdin.on('error', (error) => {
      reject(error);
    });

    // Timeout for stdin (30 seconds)
    setTimeout(() => {
      if (!data) {
        reject(new Error('No input received (timeout after 30s)'));
      }
    }, 30000);
  });
}

/**
 * Eval 모드 실행 (CLI에서 호출)
 */
export async function runEvalMode(): Promise<void> {
  try {
    const input = await readStdinJson();
    const runner = new EvalRunner();
    await runner.run(input);
  } catch (error) {
    // 입력 오류는 JSON 이벤트로 출력
    const errorEvent: EvalErrorEvent = {
      event: 'error',
      timestamp: new Date().toISOString(),
      data: {
        message: error instanceof Error ? error.message : String(error),
        code: 'INPUT_ERROR',
      },
    };
    console.log(JSON.stringify(errorEvent));

    const endEvent: EvalEndEvent = {
      event: 'end',
      timestamp: new Date().toISOString(),
      data: {
        success: false,
        duration_ms: 0,
      },
    };
    console.log(JSON.stringify(endEvent));

    process.exit(1);
  }
}
