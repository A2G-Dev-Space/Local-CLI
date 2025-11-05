/**
 * LLM Client
 *
 * OpenAI Compatible API 클라이언트
 * Gemini (HTTPS) 및 LiteLLM (HTTP) 지원
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Message, LLMRequestOptions } from '../types/index.js';
import { configManager } from './config-manager.js';
import {
  NetworkError,
  APIError,
  TimeoutError,
  ConnectionError,
} from '../errors/network.js';
import {
  LLMError,
  TokenLimitError,
  RateLimitError,
  ContextLengthError,
} from '../errors/llm.js';
import { logger } from '../utils/logger.js';

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
   * Preprocess messages for model-specific requirements
   *
   * Handles model-specific quirks like Harmony format for gpt-oss models
   */
  private preprocessMessages(messages: Message[], modelId: string): Message[] {
    // gpt-oss-120b / gpt-oss-20b: Harmony format handling
    // These models require content field even when tool_calls are present
    if (/^gpt-oss-(120b|20b)$/i.test(modelId)) {
      return messages.map((msg) => {
        // Check if this is an assistant message with tool_calls but no content
        if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
          if (!msg.content || msg.content.trim() === '') {
            // Add default content to satisfy Harmony format requirements
            const toolNames = msg.tool_calls.map(tc => tc.function.name).join(', ');
            return {
              ...msg,
              content: (msg as any).reasoning_content || `Calling tools: ${toolNames}`,
            };
          }
        }
        return msg;
      });
    }

    // Default: return messages as-is for standard OpenAI-compatible models
    return messages;
  }

  /**
   * Chat Completion API 호출 (Non-streaming)
   */
  async chatCompletion(options: Partial<LLMRequestOptions>): Promise<LLMResponse> {
    const url = '/chat/completions';

    try {
      // Preprocess messages for model-specific requirements
      const modelId = options.model || this.model;
      const processedMessages = options.messages ?
        this.preprocessMessages(options.messages, modelId) : [];

      const requestBody = {
        model: modelId,
        messages: processedMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        stream: false,
        ...(options.tools && { tools: options.tools }),
      };

      // Log request
      logger.httpRequest('POST', `${this.baseUrl}${url}`, {
        model: modelId,
        messages: `${processedMessages.length} messages`,
        temperature: requestBody.temperature,
        max_tokens: requestBody.max_tokens,
        tools: options.tools ? `${options.tools.length} tools` : 'none',
      });

      logger.verbose('Full Request Body', requestBody);

      const response = await this.axiosInstance.post<LLMResponse>(url, requestBody);

      // Log response
      logger.httpResponse(response.status, response.statusText, {
        choices: response.data.choices.length,
        usage: response.data.usage,
      });

      logger.verbose('Full Response', response.data);

      return response.data;
    } catch (error) {
      throw this.handleError(error, {
        method: 'POST',
        url,
        body: options,
      });
    }
  }

  /**
   * Chat Completion API 호출 (Streaming)
   */
  async *chatCompletionStream(
    options: Partial<LLMRequestOptions>
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const url = '/chat/completions';

    try {
      // Preprocess messages for model-specific requirements
      const modelId = options.model || this.model;
      const processedMessages = options.messages ?
        this.preprocessMessages(options.messages, modelId) : [];

      const requestBody = {
        model: modelId,
        messages: processedMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        stream: true,
        ...(options.tools && { tools: options.tools }),
      };

      // Log request
      logger.httpRequest('POST (stream)', `${this.baseUrl}${url}`, {
        model: modelId,
        messages: `${processedMessages.length} messages`,
        temperature: requestBody.temperature,
        max_tokens: requestBody.max_tokens,
      });

      logger.verbose('Full Streaming Request Body', requestBody);

      const response = await this.axiosInstance.post(url, requestBody, {
        responseType: 'stream',
      });

      logger.debug('Streaming response started', { status: response.status });

      // SSE (Server-Sent Events) 파싱
      const stream = response.data as AsyncIterable<Buffer>;
      let buffer = '';
      let chunkCount = 0;

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
              chunkCount++;
              yield data;
            } catch (parseError) {
              // JSON 파싱 에러 무시 (불완전한 청크)
              logger.debug('Skipping invalid chunk', { line: trimmed });
              continue;
            }
          }
        }
      }

      logger.debug('Streaming response completed', { chunkCount });

    } catch (error) {
      throw this.handleError(error, {
        method: 'POST (stream)',
        url,
        body: options,
      });
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
          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          } catch (parseError) {
            const errorMsg = `Tool argument parsing failed for ${toolName}`;
            logger.error(errorMsg, parseError);
            logger.debug('Raw arguments', { raw: toolCall.function.arguments });

            messages.push({
              role: 'tool',
              content: `Error: Failed to parse tool arguments - ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
              tool_call_id: toolCall.id,
            });

            toolCallHistory.push({
              tool: toolName,
              args: { raw: toolCall.function.arguments },
              result: `Error: Argument parsing failed`,
            });

            continue;
          }

          // Tool 실행 (외부에서 주입받아야 함 - 여기서는 import)
          const { executeFileTool } = await import('../tools/file-tools.js');

          logger.debug(`Executing tool: ${toolName}`, toolArgs);

          let result: { success: boolean; result?: string; error?: string };

          try {
            result = await executeFileTool(toolName, toolArgs);
            logger.toolExecution(toolName, toolArgs, result);
          } catch (toolError) {
            logger.toolExecution(toolName, toolArgs, undefined, toolError as Error);

            result = {
              success: false,
              error: toolError instanceof Error ? toolError.message : String(toolError),
            };
          }

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
   * Chat Completion with Tools (대화 히스토리 유지)
   * Interactive Mode에서 사용 - 전체 대화 히스토리와 함께 tool calling 지원
   */
  async chatCompletionWithTools(
    messages: Message[],
    tools: import('../types/index.js').ToolDefinition[],
    maxIterations: number = 5
  ): Promise<{
    message: Message;
    toolCalls: Array<{ tool: string; args: unknown; result: string }>;
    allMessages: Message[];
  }> {
    const workingMessages = [...messages];
    const toolCallHistory: Array<{ tool: string; args: unknown; result: string }> = [];
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      // LLM 호출 (tools 포함)
      const response = await this.chatCompletion({
        messages: workingMessages,
        tools,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('응답에서 choice를 찾을 수 없습니다.');
      }

      const assistantMessage = choice.message;
      workingMessages.push(assistantMessage);

      // Tool calls 확인
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Tool calls 실행
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          } catch (parseError) {
            const errorMsg = `Tool argument parsing failed for ${toolName}`;
            logger.error(errorMsg, parseError);
            logger.debug('Raw arguments', { raw: toolCall.function.arguments });

            workingMessages.push({
              role: 'tool',
              content: `Error: Failed to parse tool arguments - ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
              tool_call_id: toolCall.id,
            });

            toolCallHistory.push({
              tool: toolName,
              args: { raw: toolCall.function.arguments },
              result: `Error: Argument parsing failed`,
            });

            continue;
          }

          // Tool 실행
          const { executeFileTool } = await import('../tools/file-tools.js');

          logger.debug(`Executing tool: ${toolName}`, toolArgs);

          let result: { success: boolean; result?: string; error?: string };

          try {
            result = await executeFileTool(toolName, toolArgs);
            logger.toolExecution(toolName, toolArgs, result);
          } catch (toolError) {
            logger.toolExecution(toolName, toolArgs, undefined, toolError as Error);

            result = {
              success: false,
              error: toolError instanceof Error ? toolError.message : String(toolError),
            };
          }

          // 결과를 메시지에 추가
          workingMessages.push({
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

        // Tool call 후 다시 LLM 호출 (다음 iteration)
        continue;
      } else {
        // Tool call 없음 - 최종 응답
        return {
          message: assistantMessage,
          toolCalls: toolCallHistory,
          allMessages: workingMessages,
        };
      }
    }

    // Max iterations 도달
    const finalMessage: Message = {
      role: 'assistant',
      content: '최대 반복 횟수에 도달했습니다. Tool 실행이 완료되지 않았을 수 있습니다.',
    };

    workingMessages.push(finalMessage);

    return {
      message: finalMessage,
      toolCalls: toolCallHistory,
      allMessages: workingMessages,
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
   * Enhanced error handler with detailed logging
   */
  private handleError(error: unknown, requestContext?: { method?: string; url?: string; body?: unknown }): Error {
    // Log the error with context
    logger.error('LLM Client Error', error);

    if (requestContext) {
      logger.debug('Request Context', requestContext);
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Timeout error
      if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
        logger.error('Request Timeout', {
          timeout: this.axiosInstance.defaults.timeout,
          endpoint: this.baseUrl,
        });
        return new TimeoutError(
          this.axiosInstance.defaults.timeout || 60000,
          {
            cause: axiosError,
            details: {
              endpoint: this.baseUrl,
              method: requestContext?.method,
              url: requestContext?.url,
            },
          }
        );
      }

      if (axiosError.response) {
        // Server responded with error status (4xx, 5xx)
        const status = axiosError.response.status;
        const data = axiosError.response.data as any;
        const errorMessage = data?.error?.message || data?.message || axiosError.message;
        const errorType = data?.error?.type || 'unknown';
        const errorCode = data?.error?.code || data?.code;

        logger.httpResponse(status, axiosError.response.statusText, data);

        // Context length exceeded (common OpenAI error)
        if (
          errorType === 'invalid_request_error' &&
          (errorMessage.includes('context_length_exceeded') ||
           errorMessage.includes('maximum context length') ||
           errorCode === 'context_length_exceeded')
        ) {
          const maxLength = data?.error?.param?.max_tokens || 'unknown';
          logger.error('Context Length Exceeded', {
            maxLength,
            errorMessage,
            model: this.model,
          });

          return new ContextLengthError(
            typeof maxLength === 'number' ? maxLength : 0,
            undefined,
            {
              cause: axiosError,
              details: {
                model: this.model,
                endpoint: this.baseUrl,
                errorType,
                fullError: data,
              },
            }
          );
        }

        // Token limit error
        if (
          errorMessage.includes('token') &&
          (errorMessage.includes('limit') || errorMessage.includes('exceeded'))
        ) {
          logger.error('Token Limit Error', {
            errorMessage,
            model: this.model,
          });

          return new TokenLimitError(
            0, // We don't know the exact limit from error message
            undefined,
            {
              cause: axiosError,
              details: {
                model: this.model,
                endpoint: this.baseUrl,
                fullError: data,
              },
              userMessage: errorMessage,
            }
          );
        }

        // Rate limit (429)
        if (status === 429) {
          const retryAfter = axiosError.response.headers['retry-after'];
          const retrySeconds = retryAfter ? parseInt(retryAfter) : undefined;

          logger.error('Rate Limit Exceeded', {
            retryAfter: retrySeconds,
            errorMessage,
          });

          return new RateLimitError(retrySeconds, {
            cause: axiosError,
            details: {
              endpoint: this.baseUrl,
              model: this.model,
              fullError: data,
            },
          });
        }

        // Authentication error (401)
        if (status === 401) {
          logger.error('Authentication Failed', {
            endpoint: this.baseUrl,
            errorMessage,
          });

          return new APIError(
            `인증 실패: ${errorMessage}`,
            status,
            this.baseUrl,
            {
              cause: axiosError,
              details: {
                apiKeyProvided: !!this.apiKey,
                apiKeyLength: this.apiKey?.length || 0,
                fullError: data,
              },
              isRecoverable: false,
              userMessage: `API 키가 유효하지 않습니다. 설정을 확인해주세요.\n상세: ${errorMessage}`,
            }
          );
        }

        // Forbidden (403)
        if (status === 403) {
          logger.error('Access Forbidden', {
            endpoint: this.baseUrl,
            errorMessage,
          });

          return new APIError(
            `접근 거부: ${errorMessage}`,
            status,
            this.baseUrl,
            {
              cause: axiosError,
              details: {
                fullError: data,
              },
              isRecoverable: false,
            }
          );
        }

        // Not found (404)
        if (status === 404) {
          logger.error('Endpoint Not Found', {
            endpoint: this.baseUrl,
            url: requestContext?.url,
            errorMessage,
          });

          return new APIError(
            `엔드포인트를 찾을 수 없습니다: ${errorMessage}`,
            status,
            this.baseUrl,
            {
              cause: axiosError,
              details: {
                url: requestContext?.url,
                fullError: data,
              },
              isRecoverable: false,
              userMessage: `API 엔드포인트가 존재하지 않습니다.\nURL: ${this.baseUrl}${requestContext?.url || ''}\n상세: ${errorMessage}`,
            }
          );
        }

        // Server error (5xx)
        if (status >= 500) {
          logger.error('Server Error', {
            status,
            endpoint: this.baseUrl,
            errorMessage,
          });

          return new APIError(
            `서버 에러 (${status}): ${errorMessage}`,
            status,
            this.baseUrl,
            {
              cause: axiosError,
              details: {
                fullError: data,
              },
              isRecoverable: true, // Server errors are usually temporary
            }
          );
        }

        // Other API errors (4xx)
        logger.error('API Error', {
          status,
          endpoint: this.baseUrl,
          errorMessage,
          errorType,
          errorCode,
        });

        return new APIError(
          `API 에러 (${status}): ${errorMessage}`,
          status,
          this.baseUrl,
          {
            cause: axiosError,
            details: {
              errorType,
              errorCode,
              fullError: data,
            },
            userMessage: `API 요청 실패 (${status}):\n${errorMessage}\n\n에러 타입: ${errorType}\n에러 코드: ${errorCode}`,
          }
        );

      } else if (axiosError.request) {
        // Request sent but no response received (network error)
        const errorCode = axiosError.code;

        logger.error('Network Error - No Response', {
          code: errorCode,
          endpoint: this.baseUrl,
          message: axiosError.message,
        });

        // Connection refused, host not found, etc.
        if (
          errorCode === 'ECONNREFUSED' ||
          errorCode === 'ENOTFOUND' ||
          errorCode === 'ECONNRESET' ||
          errorCode === 'EHOSTUNREACH'
        ) {
          return new ConnectionError(this.baseUrl, {
            cause: axiosError,
            details: {
              code: errorCode,
              message: axiosError.message,
            },
            userMessage: `서버에 연결할 수 없습니다.\n엔드포인트: ${this.baseUrl}\n에러 코드: ${errorCode}\n상세: ${axiosError.message}\n\n네트워크 연결과 엔드포인트 URL을 확인해주세요.`,
          });
        }

        // General network error
        return new NetworkError(
          `네트워크 에러: ${axiosError.message}`,
          {
            cause: axiosError,
            details: {
              code: errorCode,
              endpoint: this.baseUrl,
            },
            userMessage: `네트워크 연결 실패.\n엔드포인트: ${this.baseUrl}\n에러: ${axiosError.message}`,
          }
        );
      }

      // Axios error without response or request
      logger.error('Axios Error', {
        code: axiosError.code,
        message: axiosError.message,
      });

      return new LLMError(
        `LLM 클라이언트 에러: ${axiosError.message}`,
        {
          cause: axiosError,
          details: {
            code: axiosError.code,
          },
        }
      );
    }

    // Non-axios error
    if (error instanceof Error) {
      logger.error('Unexpected Error', error);
      return new LLMError(
        `예상치 못한 에러: ${error.message}`,
        {
          cause: error,
          userMessage: `오류가 발생했습니다:\n${error.message}\n\n스택:\n${error.stack}`,
        }
      );
    }

    // Unknown error type
    logger.error('Unknown Error Type', { error });
    return new LLMError('알 수 없는 에러가 발생했습니다.', {
      details: { unknownError: error },
    });
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
