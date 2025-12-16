/**
 * LLM Client
 *
 * OpenAI Compatible API 클라이언트
 * Gemini (HTTPS) 및 LiteLLM (HTTP) 지원
 *
 * Logger 사용 가이드:
 * - 이 파일은 이미 logger.httpRequest(), logger.httpResponse(), logger.error() 등을 사용 중입니다.
 * - 추가 개선 사항: 주요 public 함수에 logger.enter/exit 추가
 * - 예시: logger.enter('sendMessage', { messageLength: userMessage.length });
 * - 상세한 사용법은 docs/LOGGER_USAGE_KR.md 참고
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Message, LLMRequestOptions } from '../../types/index.js';
import { configManager } from '../config/config-manager.js';
import {
  NetworkError,
  APIError,
  TimeoutError,
  ConnectionError,
} from '../../errors/network.js';
import {
  LLMError,
  TokenLimitError,
  RateLimitError,
  ContextLengthError,
} from '../../errors/llm.js';
import { logger, isLLMLogEnabled } from '../../utils/logger.js';
import { usageTracker } from '../usage-tracker.js';

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
    message: Message & {
      reasoning?: string;
    };
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
      reasoning?: string;
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
  private modelName: string;
  private currentAbortController: AbortController | null = null;
  private isInterrupted: boolean = false;

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
    this.modelName = currentModel.name;

    // Axios 인스턴스 생성
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
      timeout: 600000, // 600초 (10분)
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
              content: (msg as any).reasoning || `Calling tools: ${toolNames}`,
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
    logger.enter('chatCompletion', {
      model: options.model || this.model,
      messagesCount: options.messages?.length || 0,
      hasTools: !!options.tools
    });

    const url = '/chat/completions';

    try {
      logger.flow('메시지 전처리 시작');
      // Preprocess messages for model-specific requirements
      const modelId = options.model || this.model;
      const processedMessages = options.messages ?
        this.preprocessMessages(options.messages, modelId) : [];

      logger.vars(
        { name: 'modelId', value: modelId },
        { name: 'originalMessages', value: options.messages?.length || 0 },
        { name: 'processedMessages', value: processedMessages.length },
        { name: 'temperature', value: options.temperature ?? 0.7 }
      );

      const requestBody = {
        model: modelId,
        messages: processedMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        stream: false,
        ...(options.tools && {
          tools: options.tools,
          parallel_tool_calls: false,  // Enforce one tool at a time via API
        }),
      };

      logger.flow('API 요청 준비 완료');

      // Log request
      logger.httpRequest('POST', `${this.baseUrl}${url}`, {
        model: modelId,
        messages: `${processedMessages.length} messages`,
        temperature: requestBody.temperature,
        max_tokens: requestBody.max_tokens,
        tools: options.tools ? `${options.tools.length} tools` : 'none',
      });

      logger.verbose('Full Request Body', requestBody);

      // LLM Log mode: 요청 로깅
      if (isLLMLogEnabled()) {
        logger.llmRequest(processedMessages, modelId, options.tools);
      }

      logger.startTimer('llm-api-call');

      // Create AbortController for this request
      this.currentAbortController = new AbortController();

      const response = await this.axiosInstance.post<LLMResponse>(url, requestBody, {
        signal: this.currentAbortController.signal,
      });

      this.currentAbortController = null;
      const elapsed = logger.endTimer('llm-api-call');

      logger.flow('API 응답 수신 완료');

      // Validate response structure
      if (!response.data.choices || !Array.isArray(response.data.choices)) {
        logger.error('Invalid response structure - missing choices array', response.data);
        throw new Error('LLM 응답 형식이 올바르지 않습니다. choices 배열이 없습니다.');
      }

      // Log response
      logger.httpResponse(response.status, response.statusText, {
        choices: response.data.choices.length,
        usage: response.data.usage,
      });

      logger.verbose('Full Response', response.data);

      logger.vars(
        { name: 'responseChoices', value: response.data.choices.length },
        { name: 'tokensUsed', value: response.data.usage?.total_tokens || 0 },
        { name: 'responseTime', value: elapsed }
      );

      // LLM Log mode: 응답 로깅
      if (isLLMLogEnabled()) {
        const responseContent = response.data.choices[0]?.message?.content || '';
        const toolCalls = response.data.choices[0]?.message?.tool_calls;
        logger.llmResponse(responseContent, toolCalls);
      }

      // Emit reasoning if present (extended thinking from o1 models)
      // Only emit for user-facing responses (skip internal classifier calls)
      const reasoningContent = response.data.choices[0]?.message?.reasoning;
      const maxTokens = options.max_tokens;
      const isInternalCall = maxTokens && maxTokens < 500; // Internal calls use small max_tokens

      if (reasoningContent && !isInternalCall) {
        const { emitReasoning } = await import('../../tools/llm/simple/file-tools.js');
        emitReasoning(reasoningContent, false);
        logger.debug('Reasoning content emitted', { length: reasoningContent.length });
      } else if (reasoningContent && isInternalCall) {
        logger.debug('Reasoning skipped (internal call)', { maxTokens, length: reasoningContent.length });
      }

      // Track token usage (Phase 3) + context tracking for auto-compact
      if (response.data.usage) {
        const promptTokens = response.data.usage.prompt_tokens || 0;
        usageTracker.recordUsage(
          this.model,
          promptTokens,
          response.data.usage.completion_tokens || 0,
          undefined,  // sessionId
          promptTokens  // lastPromptTokens for context tracking
        );
      }

      logger.exit('chatCompletion', {
        success: true,
        choices: response.data.choices.length,
        elapsed
      });

      return response.data;
    } catch (error) {
      this.currentAbortController = null;

      // Check if this was an abort/cancel
      if (axios.isCancel(error) || (error instanceof Error && error.name === 'CanceledError')) {
        logger.flow('API 호출 취소됨 (사용자 인터럽트)');
        logger.exit('chatCompletion', { success: false, aborted: true });
        throw new Error('INTERRUPTED');
      }

      logger.flow('API 호출 실패 - 에러 처리');
      logger.exit('chatCompletion', { success: false, error: (error as Error).message });
      throw this.handleError(error, {
        method: 'POST',
        url,
        body: options,
      });
    }
  }

  /**
   * Abort current LLM request and set interrupt flag (for ESC interrupt)
   */
  abort(): void {
    logger.flow('LLM 인터럽트 - 모든 동작 중단');
    this.isInterrupted = true;

    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  /**
   * Check if interrupted
   */
  checkInterrupted(): boolean {
    return this.isInterrupted;
  }

  /**
   * Reset interrupt flag (call before starting new operation)
   */
  resetInterrupt(): void {
    this.isInterrupted = false;
  }

  /**
   * Check if there's an active request
   */
  isRequestActive(): boolean {
    return this.currentAbortController !== null;
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

      // Check if this is an internal call (skip reasoning for classifier calls)
      const maxTokens = options.max_tokens;
      const isInternalCall = maxTokens && maxTokens < 500;

      // Import emitReasoning once before loop
      const { emitReasoning } = await import('../../tools/llm/simple/file-tools.js');

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

              // Emit reasoning if present in stream (extended thinking)
              // Skip for internal classifier calls
              const reasoningDelta = data.choices[0]?.delta?.reasoning;
              if (reasoningDelta && !isInternalCall) {
                emitReasoning(reasoningDelta, true);
                logger.debug('Reasoning delta emitted', { length: reasoningDelta.length });
              } else if (reasoningDelta && isInternalCall) {
                logger.debug('Reasoning delta skipped (internal call)', { maxTokens });
              }

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
    logger.enter('sendMessage', {
      messageLength: userMessage.length,
      hasSystemPrompt: !!systemPrompt
    });

    logger.flow('메시지 배열 구성');
    const messages: Message[] = [];

    if (systemPrompt) {
      logger.vars({ name: 'systemPrompt', value: systemPrompt.substring(0, 100) + (systemPrompt.length > 100 ? '...' : '') });
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    logger.vars(
      { name: 'totalMessages', value: messages.length },
      { name: 'userMessage', value: userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : '') }
    );

    logger.flow('LLM API 호출');
    logger.startTimer('sendMessage-api');

    const response = await this.chatCompletion({ messages });

    const elapsed = logger.endTimer('sendMessage-api');

    logger.flow('응답 처리');
    if (response.choices.length === 0) {
      logger.flow('응답 없음 - 에러 발생');
      logger.exit('sendMessage', { success: false, reason: 'No response from LLM' });
      throw new Error('No response from LLM');
    }

    const responseContent = response.choices[0]?.message.content || '';

    logger.vars(
      { name: 'responseLength', value: responseContent.length },
      { name: 'apiTime', value: elapsed }
    );

    logger.exit('sendMessage', {
      success: true,
      responseLength: responseContent.length,
      elapsed
    });

    return responseContent;
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
   * No iteration limit - continues until LLM stops calling tools
   */
  async sendMessageWithTools(
    userMessage: string,
    tools: import('../../types/index.js').ToolDefinition[],
    systemPrompt?: string
  ): Promise<{ response: string; toolCalls: Array<{ tool: string; args: unknown; result: string }> }> {
    logger.enter('sendMessageWithTools', {
      messageLength: userMessage.length,
      toolsCount: tools.length,
      hasSystemPrompt: !!systemPrompt
    });

    logger.flow('메시지 준비');
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

    logger.vars(
      { name: 'messagesCount', value: messages.length },
      { name: 'toolsAvailable', value: tools.map(t => t.function.name) }
    );

    const toolCallHistory: Array<{ tool: string; args: unknown; result: string }> = [];
    let iterations = 0;

    logger.flow('Tool call 반복 시작 (무제한)');
    while (true) {
      // Check for interrupt at start of each iteration
      if (this.isInterrupted) {
        logger.flow('Interrupt detected - stopping tool loop');
        throw new Error('INTERRUPTED');
      }

      iterations++;

      logger.vars({ name: 'iteration', value: iterations });

      logger.flow(`반복 ${iterations} - LLM 호출`);

      // LLM 호출 (tools 포함)
      logger.startTimer(`tool-iteration-${iterations}`);
      const response = await this.chatCompletion({
        messages,
        tools,
      });
      logger.endTimer(`tool-iteration-${iterations}`);

      // Check for interrupt after LLM call
      if (this.isInterrupted) {
        logger.flow('Interrupt detected after LLM call - stopping');
        throw new Error('INTERRUPTED');
      }

      const choice = response.choices[0];
      if (!choice) {
        logger.flow('응답에서 choice 없음 - 에러');
        logger.exit('sendMessageWithTools', { success: false, error: 'No choice in response' });
        throw new Error('응답에서 choice를 찾을 수 없습니다.');
      }

      const message = choice.message;
      messages.push(message);

      // Tool calls 확인
      if (message.tool_calls && message.tool_calls.length > 0) {
        logger.flow(`Tool calls 발견: ${message.tool_calls.length}개`);
        logger.vars({ name: 'toolCallsCount', value: message.tool_calls.length });

        // Multi-tool detection logging
        if (message.tool_calls.length > 1) {
          const toolNames = message.tool_calls.map(tc => tc.function.name).join(', ');
          logger.warn(`[MULTI-TOOL DETECTED] LLM returned ${message.tool_calls.length} tools: ${toolNames}`);
        }

        // Tool calls 실행 (parallel_tool_calls: false로 API에서 단일 tool만 호출됨)
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          logger.flow(`Tool 실행: ${toolName}`);

          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
            logger.vars(
              { name: 'toolName', value: toolName },
              { name: 'toolArgs', value: toolArgs }
            );
          } catch (parseError) {
            logger.flow(`Tool argument 파싱 실패: ${toolName}`);
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
          logger.flow('Tool 모듈 로드');
          const { executeFileTool, requestToolApproval } = await import('../../tools/llm/simple/file-tools.js');

          // Supervised Mode: Request user approval before tool execution
          const approvalResult = await requestToolApproval(toolName, toolArgs);

          if (approvalResult && typeof approvalResult === 'object' && approvalResult.reject) {
            // User rejected the tool execution
            logger.flow(`Tool rejected by user: ${toolName}`);

            const rejectMessage = approvalResult.comment
              ? `Tool execution rejected by user. Reason: ${approvalResult.comment}`
              : 'Tool execution rejected by user.';

            messages.push({
              role: 'tool',
              content: rejectMessage,
              tool_call_id: toolCall.id,
            });

            toolCallHistory.push({
              tool: toolName,
              args: toolArgs,
              result: rejectMessage,
            });

            continue;
          }

          logger.debug(`Executing tool: ${toolName}`, toolArgs);

          logger.flow(`Tool 실행 시작: ${toolName}`);
          logger.startTimer(`tool-exec-${toolName}`);

          let result: { success: boolean; result?: string; error?: string };

          try {
            result = await executeFileTool(toolName, toolArgs);
            const toolExecTime = logger.endTimer(`tool-exec-${toolName}`);

            logger.toolExecution(toolName, toolArgs, result);

            // LLM Log mode: Tool 결과 로깅
            if (isLLMLogEnabled()) {
              logger.llmToolResult(toolName, result.result || '', result.success);
            }

            logger.vars(
              { name: 'toolSuccess', value: result.success },
              { name: 'toolExecTime', value: toolExecTime }
            );
          } catch (toolError) {
            logger.endTimer(`tool-exec-${toolName}`);
            logger.flow(`Tool 실행 실패: ${toolName}`);
            logger.toolExecution(toolName, toolArgs, undefined, toolError as Error);

            // LLM Log mode: Tool 에러 로깅
            if (isLLMLogEnabled()) {
              const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
              logger.llmToolResult(toolName, `Error: ${errorMsg}`, false);
            }

            result = {
              success: false,
              error: toolError instanceof Error ? toolError.message : String(toolError),
            };
          }

          // 결과를 메시지에 추가
          logger.flow('Tool 결과를 메시지에 추가');
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

          logger.vars({ name: 'toolCallHistorySize', value: toolCallHistory.length });
        }
      } else {
        // Tool call 없음 - 최종 응답
        logger.flow('Tool call 없음 - 최종 응답 반환');

        logger.exit('sendMessageWithTools', {
          success: true,
          iterations,
          toolCallsCount: toolCallHistory.length,
          responseLength: message.content?.length || 0
        });

        return {
          response: message.content || '',
          toolCalls: toolCallHistory,
        };
      }
    }
  }

  /**
   * Chat Completion with Tools (대화 히스토리 유지)
   * Interactive Mode에서 사용 - 전체 대화 히스토리와 함께 tool calling 지원
   * No iteration limit - continues until LLM stops calling tools
   */
  async chatCompletionWithTools(
    messages: Message[],
    tools: import('../../types/index.js').ToolDefinition[]
  ): Promise<{
    message: Message;
    toolCalls: Array<{ tool: string; args: unknown; result: string }>;
    allMessages: Message[];
  }> {
    const workingMessages = [...messages];
    const toolCallHistory: Array<{ tool: string; args: unknown; result: string }> = [];
    let iterations = 0;

    while (true) {
      // Check for interrupt at start of each iteration
      if (this.isInterrupted) {
        logger.flow('Interrupt detected - stopping tool loop');
        throw new Error('INTERRUPTED');
      }

      iterations++;

      // LLM 호출 (tools 포함)
      const response = await this.chatCompletion({
        messages: workingMessages,
        tools,
      });

      // Check for interrupt after LLM call
      if (this.isInterrupted) {
        logger.flow('Interrupt detected after LLM call - stopping');
        throw new Error('INTERRUPTED');
      }

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('응답에서 choice를 찾을 수 없습니다.');
      }

      const assistantMessage = choice.message;
      workingMessages.push(assistantMessage);

      // Tool calls 확인
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Multi-tool detection logging
        if (assistantMessage.tool_calls.length > 1) {
          const toolNames = assistantMessage.tool_calls.map(tc => tc.function.name).join(', ');
          logger.warn(`[MULTI-TOOL DETECTED] LLM returned ${assistantMessage.tool_calls.length} tools: ${toolNames}`);
        }

        // Tool calls 실행 (parallel_tool_calls: false로 API에서 단일 tool만 호출됨)
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
          const { executeFileTool, requestToolApproval } = await import('../../tools/llm/simple/file-tools.js');

          // Supervised Mode: Request user approval before tool execution
          const approvalResult = await requestToolApproval(toolName, toolArgs);

          if (approvalResult && typeof approvalResult === 'object' && approvalResult.reject) {
            // User rejected the tool execution
            logger.flow(`Tool rejected by user: ${toolName}`);

            const rejectMessage = approvalResult.comment
              ? `Tool execution rejected by user. Reason: ${approvalResult.comment}`
              : 'Tool execution rejected by user.';

            workingMessages.push({
              role: 'tool',
              content: rejectMessage,
              tool_call_id: toolCall.id,
            });

            toolCallHistory.push({
              tool: toolName,
              args: toolArgs,
              result: rejectMessage,
            });

            continue;
          }

          logger.debug(`Executing tool: ${toolName}`, toolArgs);

          let result: { success: boolean; result?: string; error?: string };

          try {
            result = await executeFileTool(toolName, toolArgs);
            logger.toolExecution(toolName, toolArgs, result);

            // LLM Log mode: Tool 결과 로깅
            if (isLLMLogEnabled()) {
              logger.llmToolResult(toolName, result.result || '', result.success);
            }
          } catch (toolError) {
            logger.toolExecution(toolName, toolArgs, undefined, toolError as Error);

            // LLM Log mode: Tool 에러 로깅
            if (isLLMLogEnabled()) {
              const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
              logger.llmToolResult(toolName, `Error: ${errorMsg}`, false);
            }

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
        // Emit assistant response event for UI
        if (assistantMessage.content) {
          const { emitAssistantResponse } = await import('../../tools/llm/simple/file-tools.js');
          emitAssistantResponse(assistantMessage.content);
        }

        return {
          message: assistantMessage,
          toolCalls: toolCallHistory,
          allMessages: workingMessages,
        };
      }
    }
  }

  /**
   * 현재 모델 정보 가져오기
   */
  getModelInfo(): { model: string; endpoint: string } {
    return {
      model: this.modelName,
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
   * 현재 설정된 엔드포인트 Health Check
   */
  async healthCheck(): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
  }> {
    const endpoint = configManager.getCurrentEndpoint();
    const model = configManager.getCurrentModel();

    if (!endpoint || !model) {
      return { success: false, error: 'No endpoint or model configured' };
    }

    const startTime = Date.now();

    try {
      const response = await this.axiosInstance.post<LLMResponse>('/chat/completions', {
        model: model.id,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });

      const latency = Date.now() - startTime;

      if (response.status === 200 && response.data.choices?.[0]?.message) {
        return { success: true, latency };
      } else {
        return { success: false, latency, error: 'Invalid response format' };
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const status = axiosError.response.status;
        return { success: false, latency, error: `HTTP ${status}` };
      } else if (axiosError.request) {
        return { success: false, latency, error: 'Connection failed' };
      } else {
        return { success: false, latency, error: axiosError.message || 'Unknown error' };
      }
    }
  }

  /**
   * 모든 등록된 엔드포인트 일괄 Health Check
   */
  static async healthCheckAll(): Promise<
    Map<string, { modelId: string; healthy: boolean; latency?: number; error?: string }[]>
  > {
    const endpoints = configManager.getAllEndpoints();
    const results = new Map<
      string,
      { modelId: string; healthy: boolean; latency?: number; error?: string }[]
    >();

    for (const endpoint of endpoints) {
      const modelResults: { modelId: string; healthy: boolean; latency?: number; error?: string }[] = [];

      for (const model of endpoint.models) {
        if (!model.enabled) {
          modelResults.push({
            modelId: model.id,
            healthy: false,
            error: 'Model disabled',
          });
          continue;
        }

        const startTime = Date.now();

        try {
          const axiosInstance = axios.create({
            baseURL: endpoint.baseUrl,
            headers: {
              'Content-Type': 'application/json',
              ...(endpoint.apiKey && { Authorization: `Bearer ${endpoint.apiKey}` }),
            },
            timeout: 30000, // 30초 타임아웃
          });

          const response = await axiosInstance.post<LLMResponse>('/chat/completions', {
            model: model.id,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          });

          const latency = Date.now() - startTime;

          if (response.status === 200 && response.data.choices?.[0]?.message) {
            modelResults.push({ modelId: model.id, healthy: true, latency });
          } else {
            modelResults.push({
              modelId: model.id,
              healthy: false,
              latency,
              error: 'Invalid response',
            });
          }
        } catch (error) {
          const latency = Date.now() - startTime;
          const axiosError = error as AxiosError;

          let errorMessage = 'Unknown error';
          if (axiosError.response) {
            errorMessage = `HTTP ${axiosError.response.status}`;
          } else if (axiosError.code === 'ECONNREFUSED') {
            errorMessage = 'Connection refused';
          } else if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
            errorMessage = 'Timeout';
          } else if (axiosError.request) {
            errorMessage = 'Network error';
          }

          modelResults.push({
            modelId: model.id,
            healthy: false,
            latency,
            error: errorMessage,
          });
        }
      }

      results.set(endpoint.id, modelResults);
    }

    return results;
  }

  /**
   * 엔드포인트 연결 테스트 (Static)
   * config init 시 사용하기 위한 정적 메서드
   */
  static async testConnection(
    baseUrl: string,
    apiKey: string,
    model: string
  ): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();

    try {
      const axiosInstance = axios.create({
        baseURL: baseUrl,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        timeout: 60000, // 60초 타임아웃
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

      const latency = Date.now() - startTime;

      if (response.status === 200 && response.data.choices?.[0]?.message) {
        return { success: true, latency };
      } else {
        return { success: false, latency, error: '유효하지 않은 응답 형식' };
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as { error?: { message?: string } };
        const message = data?.error?.message || axiosError.message;

        if (status === 401) {
          return { success: false, latency, error: 'API 키가 유효하지 않습니다.' };
        } else if (status === 404) {
          return { success: false, latency, error: '엔드포인트 또는 모델을 찾을 수 없습니다.' };
        } else {
          return { success: false, latency, error: `API 에러 (${status}): ${message}` };
        }
      } else if (axiosError.request) {
        return { success: false, latency, error: `네트워크 에러: 엔드포인트에 연결할 수 없습니다.` };
      } else {
        return { success: false, latency, error: axiosError.message || '알 수 없는 에러' };
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
