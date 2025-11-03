/**
 * LLM Client
 *
 * OpenAI Compatible API 클라이언트
 * Gemini (HTTPS) 및 LiteLLM (HTTP) 지원
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Message, LLMRequestOptions } from '../types/index.js';
import { configManager } from './config-manager.js';

/**
 * LLM 응답 인터페이스 (OpenAI Compatible)
 */
export interface LLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: Message;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 스트리밍 청크 인터페이스
 */
export interface LLMStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * LLM Client 클래스
 */
export class LLMClient {
  private axiosInstance: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    // ConfigManager에서 현재 설정 가져오기
    const endpoint = configManager.getCurrentEndpoint();
    const currentModel = configManager.getCurrentModel();

    if (!endpoint || !currentModel) {
      throw new Error('No endpoint or model configured. Run: open config init');
    }

    this.baseUrl = endpoint.baseUrl;
    this.apiKey = endpoint.apiKey || '';
    this.model = currentModel.id;

    // Axios 인스턴스 생성
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
      timeout: 60000, // 60초
    });
  }

  /**
   * Chat Completion API 호출 (Non-streaming)
   */
  async chatCompletion(options: Partial<LLMRequestOptions>): Promise<LLMResponse> {
    try {
      const requestBody = {
        model: options.model || this.model,
        messages: options.messages || [],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        stream: false,
        ...(options.tools && { tools: options.tools }),
      };

      const response = await this.axiosInstance.post<LLMResponse>('/chat/completions', requestBody);

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Chat Completion API 호출 (Streaming)
   */
  async *chatCompletionStream(
    options: Partial<LLMRequestOptions>
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    try {
      const requestBody = {
        model: options.model || this.model,
        messages: options.messages || [],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        stream: true,
        ...(options.tools && { tools: options.tools }),
      };

      const response = await this.axiosInstance.post('/chat/completions', requestBody, {
        responseType: 'stream',
      });

      // SSE (Server-Sent Events) 파싱
      const stream = response.data as AsyncIterable<Buffer>;
      let buffer = '';

      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const jsonStr = trimmed.slice(6);
              const data = JSON.parse(jsonStr) as LLMStreamChunk;
              yield data;
            } catch (parseError) {
              // JSON 파싱 에러 무시 (불완전한 청크)
              continue;
            }
          }
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 간단한 채팅 메시지 전송 (헬퍼 메서드)
   */
  async sendMessage(userMessage: string, systemPrompt?: string): Promise<string> {
    const messages: Message[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    const response = await this.chatCompletion({ messages });

    if (response.choices.length === 0) {
      throw new Error('No response from LLM');
    }

    return response.choices[0]?.message.content || '';
  }

  /**
   * 스트리밍 채팅 메시지 전송
   */
  async *sendMessageStream(
    userMessage: string,
    systemPrompt?: string
  ): AsyncGenerator<string, void, unknown> {
    const messages: Message[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    for await (const chunk of this.chatCompletionStream({ messages })) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Tools를 사용한 메시지 전송 (반복적으로 tool call 처리)
   */
  async sendMessageWithTools(
    userMessage: string,
    tools: import('../types/index.js').ToolDefinition[],
    systemPrompt?: string,
    maxIterations: number = 5
  ): Promise<{ response: string; toolCalls: Array<{ tool: string; args: unknown; result: string }> }> {
    const messages: Message[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    const toolCallHistory: Array<{ tool: string; args: unknown; result: string }> = [];
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      // LLM 호출 (tools 포함)
      const response = await this.chatCompletion({
        messages,
        tools,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('응답에서 choice를 찾을 수 없습니다.');
      }

      const message = choice.message;
      messages.push(message);

      // Tool calls 확인
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Tool calls 실행
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

          // Tool 실행 (외부에서 주입받아야 함 - 여기서는 import)
          const { executeFileTool } = await import('../tools/file-tools.js');
          const result = await executeFileTool(toolName, toolArgs);

          // 결과를 메시지에 추가
          messages.push({
            role: 'tool',
            content: result.success ? result.result || '' : `Error: ${result.error}`,
            tool_call_id: toolCall.id,
          });

          // 히스토리에 추가
          toolCallHistory.push({
            tool: toolName,
            args: toolArgs,
            result: result.success ? result.result || '' : `Error: ${result.error}`,
          });
        }
      } else {
        // Tool call 없음 - 최종 응답
        return {
          response: message.content || '',
          toolCalls: toolCallHistory,
        };
      }
    }

    // Max iterations 도달
    return {
      response: '최대 반복 횟수에 도달했습니다. Tool 실행이 완료되지 않았을 수 있습니다.',
      toolCalls: toolCallHistory,
    };
  }

  /**
   * 현재 모델 정보 가져오기
   */
  getModelInfo(): { model: string; endpoint: string } {
    return {
      model: this.model,
      endpoint: this.baseUrl,
    };
  }

  /**
   * 에러 처리
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        // 서버 응답 에러 (4xx, 5xx)
        const status = axiosError.response.status;
        const data = axiosError.response.data as { error?: { message?: string } };
        const message = data?.error?.message || axiosError.message;

        if (status === 401) {
          return new Error(`인증 실패: API 키가 유효하지 않습니다. (${message})`);
        } else if (status === 429) {
          return new Error(`Rate limit 초과: 잠시 후 다시 시도해주세요. (${message})`);
        } else if (status >= 500) {
          return new Error(`서버 에러 (${status}): ${message}`);
        } else {
          return new Error(`API 에러 (${status}): ${message}`);
        }
      } else if (axiosError.request) {
        // 요청 전송됐지만 응답 없음 (네트워크 에러)
        return new Error(`네트워크 에러: 엔드포인트에 연결할 수 없습니다. (${this.baseUrl})`);
      }
    }

    // 기타 에러
    if (error instanceof Error) {
      return error;
    }

    return new Error('알 수 없는 에러가 발생했습니다.');
  }

  /**
   * 재시도 로직이 포함된 Chat Completion
   */
  async chatCompletionWithRetry(
    options: Partial<LLMRequestOptions>,
    maxRetries = 3
  ): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.chatCompletion(options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          // 지수 백오프 (1s, 2s, 4s)
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`${maxRetries}번 재시도 후 실패: ${lastError?.message || '알 수 없는 에러'}`);
  }

  /**
   * 엔드포인트 연결 테스트 (Static)
   * config init 시 사용하기 위한 정적 메서드
   */
  static async testConnection(
    baseUrl: string,
    apiKey: string,
    model: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const axiosInstance = axios.create({
        baseURL: baseUrl,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        timeout: 30000, // 30초
      });

      // 간단한 테스트 메시지로 연결 확인
      const response = await axiosInstance.post<LLMResponse>('/chat/completions', {
        model: model,
        messages: [
          {
            role: 'user',
            content: 'test',
          },
        ],
        max_tokens: 10,
      });

      if (response.status === 200 && response.data.choices?.[0]?.message) {
        return { success: true };
      } else {
        return { success: false, error: '유효하지 않은 응답 형식' };
      }
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as { error?: { message?: string } };
        const message = data?.error?.message || axiosError.message;

        if (status === 401) {
          return { success: false, error: 'API 키가 유효하지 않습니다.' };
        } else if (status === 404) {
          return { success: false, error: '엔드포인트 또는 모델을 찾을 수 없습니다.' };
        } else {
          return { success: false, error: `API 에러 (${status}): ${message}` };
        }
      } else if (axiosError.request) {
        return { success: false, error: `네트워크 에러: 엔드포인트에 연결할 수 없습니다.` };
      } else {
        return { success: false, error: axiosError.message || '알 수 없는 에러' };
      }
    }
  }
}

/**
 * LLMClient 싱글톤 인스턴스
 * ConfigManager가 초기화된 후 사용 가능
 */
export function createLLMClient(): LLMClient {
  return new LLMClient();
}
