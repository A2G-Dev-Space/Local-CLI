/**
 * LLM Client for Electron Main Process
 * OpenAI Compatible API client
 * Aligned with CLI's llm-client.ts for feature parity
 */

import { logger } from '../../utils/logger';
import { configManager } from '../config';
import { usageTracker } from '../usage-tracker';
import {
  APIError,
  TimeoutError,
  ConnectionError,
  RateLimitError,
  ContextLengthError,
  StreamingError,
  ValidationError,
} from '../../errors';
import { emitReasoning } from '../../tools/llm/simple/simple-tool-executor';

// =============================================================================
// Types
// =============================================================================

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'error'; // 'error' added for CLI parity
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  reasoning_content?: string; // For reasoning LLMs
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: Message & { reasoning?: string };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

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

export interface ChatRequestOptions {
  messages: Message[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * Retry configuration interface (CLI parity)
 */
export interface RetryConfig {
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Current attempt (internal use) */
  currentAttempt?: number;
  /** Disable retry */
  disableRetry?: boolean;
}

export type StreamCallback = (chunk: string, done: boolean) => void;

// =============================================================================
// LLM Client Class
// =============================================================================

class LLMClient {
  private abortController: AbortController | null = null;
  private isInterrupted: boolean = false;

  /** Default maximum retry attempts (CLI parity) */
  private static readonly DEFAULT_MAX_RETRIES = 3;

  /** Request timeout in milliseconds (10 minutes - CLI parity) */
  private static readonly REQUEST_TIMEOUT = 600000;

  /**
   * Get current endpoint config
   */
  private getEndpointConfig() {
    const endpoint = configManager.getCurrentEndpoint();
    const model = configManager.getCurrentModel();

    if (!endpoint || !model) {
      throw new ValidationError('No endpoint or model configured', {
        userMessage: 'LLM 엔드포인트나 모델이 설정되지 않았습니다. Settings에서 설정해주세요.',
      });
    }

    return { endpoint, model };
  }

  /**
   * Preprocess messages for model-specific requirements (CLI parity)
   *
   * Handles:
   * 1. reasoning_content → content conversion (for reasoning LLM responses)
   * 2. Harmony format for gpt-oss models
   */
  private preprocessMessages(messages: Message[], modelId: string): Message[] {
    return messages.map((msg) => {
      // Skip non-assistant messages
      if (msg.role !== 'assistant') {
        return msg;
      }

      const msgAny = msg as any;
      const processedMsg = { ...msg };

      // Handle reasoning_content from reasoning LLMs (DeepSeek-V3, etc.)
      // When switching between reasoning LLM and regular LLM, content field is required
      if (msgAny.reasoning_content && (!msg.content || msg.content.trim() === '')) {
        processedMsg.content = msgAny.reasoning_content;
        // Remove reasoning_content to avoid confusion
        delete (processedMsg as any).reasoning_content;
      }

      // gpt-oss-120b / gpt-oss-20b: Harmony format handling
      // These models require content field even when tool_calls are present
      if (/^gpt-oss-(120b|20b)$/i.test(modelId)) {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          if (!processedMsg.content || processedMsg.content.trim() === '') {
            const toolNames = msg.tool_calls.map(tc => tc.function.name).join(', ');
            processedMsg.content = msgAny.reasoning || `Calling tools: ${toolNames}`;
          }
        }
      }

      // Ensure content is at least empty string for assistant messages
      if (processedMsg.content === undefined || processedMsg.content === null) {
        processedMsg.content = '';
      }

      return processedMsg;
    });
  }

  /**
   * Check if error is retryable (CLI parity)
   * - 5xx server errors
   * - Network errors (ECONNREFUSED, ETIMEDOUT, ECONNRESET, etc.)
   * - Rate Limit (429)
   */
  private isRetryableError(error: unknown): boolean {
    // Check custom error types first
    if (error instanceof RateLimitError) {
      return true;
    }
    if (error instanceof ConnectionError || error instanceof TimeoutError) {
      return true;
    }
    if (error instanceof ContextLengthError) {
      return false; // Needs compact, not retry
    }
    if (error instanceof APIError) {
      // 5xx errors are retryable
      return error.statusCode !== undefined && error.statusCode >= 500;
    }

    if (error instanceof Error) {
      // User interrupt - don't retry
      if (error.message === 'INTERRUPTED' || error.name === 'AbortError') {
        return false;
      }

      const message = error.message.toLowerCase();

      // Network errors
      const networkErrors = ['econnrefused', 'etimedout', 'econnreset', 'econnaborted', 'enotfound', 'ehostunreach', 'timeout', 'network'];
      if (networkErrors.some(e => message.includes(e))) {
        return true;
      }

      // HTTP status based errors (fallback for non-custom errors)
      if (message.includes('429') || message.includes('rate limit')) {
        return true;
      }
      if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
        return true;
      }

      // Context length error - don't retry (needs compact)
      if (message.includes('context') && message.includes('length')) {
        return false;
      }
    }

    return false;
  }

  /**
   * Check if error is context length exceeded (CLI parity)
   */
  private isContextLengthError(error: unknown): boolean {
    // Check custom error type first
    if (error instanceof ContextLengthError) {
      return true;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (message.includes('context') && message.includes('length')) ||
             message.includes('maximum context') ||
             message.includes('token limit') ||
             message.includes('too many tokens');
    }
    return false;
  }

  /**
   * Enhanced error handler with detailed logging (CLI parity)
   * Converts raw errors into typed error classes for proper upstream handling.
   */
  private handleError(error: unknown, requestContext?: { method?: string; url?: string; body?: unknown }): Error {
    logger.error('LLM Client Error', { error: error instanceof Error ? error.message : error });

    if (requestContext) {
      logger.debug('Request Context', requestContext);
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Already a typed error - rethrow
      if (error instanceof ContextLengthError || error instanceof RateLimitError ||
          error instanceof APIError || error instanceof TimeoutError ||
          error instanceof ConnectionError || error instanceof StreamingError) {
        return error;
      }

      // Context length exceeded
      if (this.isContextLengthError(error)) {
        return new ContextLengthError(0, undefined, {
          details: { originalMessage: error.message },
        });
      }

      // Timeout
      if (message.includes('timeout') || message.includes('econnaborted')) {
        return new TimeoutError(LLMClient.REQUEST_TIMEOUT, {
          cause: error,
          details: { endpoint: requestContext?.url },
        });
      }

      // Connection errors
      if (message.includes('econnrefused') || message.includes('enotfound') ||
          message.includes('econnreset') || message.includes('ehostunreach')) {
        return new ConnectionError(requestContext?.url, {
          cause: error,
        });
      }

      // Rate limit
      if (message.includes('429') || message.includes('rate limit')) {
        return new RateLimitError(undefined, {
          cause: error,
          details: { originalMessage: error.message },
        });
      }

      // HTTP status errors
      const statusMatch = message.match(/http\s+(\d{3})/i);
      if (statusMatch) {
        const status = parseInt(statusMatch[1]);
        return new APIError(error.message, status, requestContext?.url, {
          cause: error,
        });
      }
    }

    // Unknown error
    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Sleep for specified milliseconds (for retry backoff) (CLI parity)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Chat completion (non-streaming) with retry logic (CLI parity)
   */
  async chatCompletion(
    options: ChatRequestOptions,
    retryConfig?: RetryConfig
  ): Promise<LLMResponse> {
    const maxRetries = retryConfig?.disableRetry ? 1 : (retryConfig?.maxRetries ?? LLMClient.DEFAULT_MAX_RETRIES);
    const currentAttempt = retryConfig?.currentAttempt ?? 1;

    const { endpoint, model } = this.getEndpointConfig();
    const modelId = model.id;

    // Preprocess messages for model-specific requirements
    const processedMessages = this.preprocessMessages(options.messages, modelId);

    // [DEBUG] Log tool message integrity after preprocessing
    {
      const toolMsgs = processedMessages.filter(m => m.role === 'tool');
      const lastToolMsg = toolMsgs[toolMsgs.length - 1];
      if (lastToolMsg) {
        logger.info('[DEBUG] Last tool msg in request', {
          role: lastToolMsg.role,
          tool_call_id: (lastToolMsg as any).tool_call_id,
          contentSnippet: typeof lastToolMsg.content === 'string' ? lastToolMsg.content.substring(0, 200) : '(non-string)',
          totalToolMsgs: toolMsgs.length,
          totalMsgs: processedMessages.length,
        });
      }

      // [DEBUG] Check for orphaned tool_calls (assistant with tool_calls but no matching tool response)
      const assistantToolCallIds = new Set<string>();
      const toolResponseIds = new Set<string>();
      for (const m of processedMessages) {
        if (m.role === 'assistant' && (m as any).tool_calls) {
          for (const tc of (m as any).tool_calls) {
            assistantToolCallIds.add(tc.id);
          }
        }
        if (m.role === 'tool' && (m as any).tool_call_id) {
          toolResponseIds.add((m as any).tool_call_id);
        }
      }
      const orphanedIds = [...assistantToolCallIds].filter(id => !toolResponseIds.has(id));
      if (orphanedIds.length > 0) {
        logger.warn('[DEBUG] ORPHANED tool_calls (no matching tool response)!', { orphanedIds });
      }
    }

    const url = `${endpoint.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (endpoint.apiKey) {
      headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
    }

    const requestBody = {
      model: modelId,
      messages: processedMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? model.maxTokens,
      stream: false,
      ...(options.tools && {
        tools: options.tools,
        parallel_tool_calls: false,  // Enforce one tool at a time (CLI parity)
        ...(options.tool_choice && { tool_choice: options.tool_choice }),
      }),
    };

    logger.enter('chatCompletion', {
      model: modelId,
      messagesCount: options.messages.length,
      hasTools: !!options.tools,
      attempt: currentAttempt,
      maxRetries,
    });

    logger.httpRequest('POST', url, {
      model: modelId,
      messages: `${options.messages.length} messages`,
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens,
      tools: options.tools ? `${options.tools.length} tools` : 'none',
    });

    // Check interrupt BEFORE creating new AbortController
    // Prevents race condition: abort() sets isInterrupted, but new controller overwrites the aborted one
    if (this.isInterrupted) {
      logger.flow('LLM chatCompletion skipped - already interrupted');
      this.isInterrupted = false;
      throw new Error('INTERRUPTED');
    }

    this.abortController = new AbortController();

    // Setup timeout
    const timeoutId = setTimeout(() => {
      this.abortController?.abort();
    }, LLMClient.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);
      this.abortController = null;

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText.substring(0, 500);
          }
        }

        // Use specific error classes based on status code
        if (response.status === 429) {
          throw new RateLimitError(undefined, {
            details: { originalMessage: errorMessage },
          });
        }
        throw new APIError(errorMessage, response.status, url);
      }

      const data = await response.json() as LLMResponse;

      logger.httpResponse(200, 'OK', {
        model: data.model,
        choices: data.choices.length,
        usage: data.usage,
      });

      logger.exit('chatCompletion', {
        success: true,
        choices: data.choices.length,
        tokensUsed: data.usage?.total_tokens || 0,
      });

      // Emit reasoning if present (CLI parity - extended thinking from o1/DeepSeek-V3 models)
      const reasoningContent = data.choices[0]?.message?.reasoning;
      const isInternalCall = options.max_tokens && options.max_tokens < 500;
      if (reasoningContent && !isInternalCall) {
        emitReasoning(reasoningContent, false);
        logger.debug('Reasoning content emitted', { length: reasoningContent.length });
      } else if (reasoningContent && isInternalCall) {
        logger.debug('Reasoning skipped (internal call)', { maxTokens: options.max_tokens, length: reasoningContent.length });
      }

      // Track usage (CLI parity - with context tracking)
      if (data.usage) {
        usageTracker.recordUsage(
          modelId,
          data.usage.prompt_tokens || 0,
          data.usage.completion_tokens || 0,
          undefined,
          data.usage.prompt_tokens // lastPromptTokens for context tracking
        );
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      this.abortController = null;

      // User abort (CLI parity)
      if (error instanceof Error && (error.name === 'AbortError' || this.isInterrupted)) {
        this.isInterrupted = false;
        logger.flow('API 호출 취소됨 (사용자 인터럽트)');
        logger.exit('chatCompletion', { success: false, aborted: true });
        throw new Error('INTERRUPTED');
      }

      // Retry logic with exponential backoff (CLI parity)
      if (currentAttempt < maxRetries && this.isRetryableError(error)) {
        const delay = Math.pow(2, currentAttempt - 1) * 1000; // 1s, 2s, 4s
        logger.warn(`LLM call failed (${currentAttempt}/${maxRetries}), retrying in ${delay}ms...`, {
          error: (error as Error).message,
        });

        await this.sleep(delay);

        return this.chatCompletion(options, {
          ...retryConfig,
          maxRetries,
          currentAttempt: currentAttempt + 1,
        });
      }

      // Context length error - use custom error class
      if (this.isContextLengthError(error)) {
        logger.error('Context length exceeded', { error: (error as Error).message });
        logger.exit('chatCompletion', { success: false, error: 'context_length_exceeded' });
        // If already ContextLengthError, rethrow as-is
        if (error instanceof ContextLengthError) {
          throw error;
        }
        // Otherwise, wrap in ContextLengthError
        throw new ContextLengthError(0, undefined, {
          details: { originalMessage: (error as Error).message },
        });
      }

      logger.error('LLM API error', { error: (error as Error).message });
      logger.exit('chatCompletion', { success: false, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Chat completion with streaming (CLI parity)
   */
  async chatCompletionStream(
    options: ChatRequestOptions,
    onChunk: StreamCallback
  ): Promise<{ content: string; usage?: LLMResponse['usage'] }> {
    const { endpoint, model } = this.getEndpointConfig();
    const modelId = model.id;

    // Preprocess messages for model-specific requirements
    const processedMessages = this.preprocessMessages(options.messages, modelId);

    const url = `${endpoint.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (endpoint.apiKey) {
      headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
    }

    const requestBody = {
      model: modelId,
      messages: processedMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? model.maxTokens,
      stream: true,
      ...(options.tools && {
        tools: options.tools,
        parallel_tool_calls: false,
        ...(options.tool_choice && { tool_choice: options.tool_choice }),
      }),
    };

    logger.enter('chatCompletionStream', {
      model: modelId,
      messagesCount: options.messages.length,
      hasTools: !!options.tools,
    });

    logger.httpStreamStart('POST', url);

    // Check interrupt BEFORE creating new AbortController (same fix as chatCompletion)
    if (this.isInterrupted) {
      logger.flow('LLM streamCompletion skipped - already interrupted');
      this.isInterrupted = false;
      throw new Error('INTERRUPTED');
    }

    this.abortController = new AbortController();

    // Setup timeout
    const timeoutId = setTimeout(() => {
      this.abortController?.abort();
    }, LLMClient.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText.substring(0, 500);
          }
        }

        // Use specific error classes based on status code
        if (response.status === 429) {
          throw new RateLimitError(undefined, {
            details: { originalMessage: errorMessage },
          });
        }
        // Context length error detection in stream (CLI parity)
        if (this.isContextLengthError(new Error(errorMessage))) {
          throw new ContextLengthError(0, undefined, {
            details: { originalMessage: errorMessage },
          });
        }
        throw new APIError(errorMessage, response.status, url);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new StreamingError('No response body available for streaming');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      const isInternalCall = options.max_tokens && options.max_tokens < 500;

      while (true) {
        // Check for interrupt (CLI parity)
        if (this.isInterrupted) {
          reader.cancel();
          throw new Error('INTERRUPTED');
        }

        const { done, value } = await reader.read();

        if (done) {
          onChunk('', true);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const jsonStr = trimmed.slice(6);
              const chunk = JSON.parse(jsonStr) as LLMStreamChunk;
              const content = chunk.choices[0]?.delta?.content;

              if (content) {
                fullContent += content;
                onChunk(content, false);
              }

              // Emit reasoning delta if present (CLI parity - extended thinking)
              const reasoningDelta = chunk.choices[0]?.delta?.reasoning;
              if (reasoningDelta && !isInternalCall) {
                emitReasoning(reasoningDelta, true);
              }
            } catch {
              // Skip invalid JSON chunks
            }
          }
        }
      }

      this.abortController = null;

      logger.httpStreamEnd(fullContent.length, 0);
      logger.exit('chatCompletionStream', {
        success: true,
        contentLength: fullContent.length,
      });

      return { content: fullContent };
    } catch (error) {
      clearTimeout(timeoutId);
      this.abortController = null;

      if (error instanceof Error && (error.name === 'AbortError' || this.isInterrupted)) {
        this.isInterrupted = false;
        logger.flow('Stream 취소됨 (사용자 인터럽트)');
        logger.exit('chatCompletionStream', { success: false, aborted: true });
        throw new Error('INTERRUPTED');
      }

      // Context length error - wrap in ContextLengthError (CLI parity)
      if (this.isContextLengthError(error)) {
        logger.error('Stream context length exceeded', { error: (error as Error).message });
        logger.exit('chatCompletionStream', { success: false, error: 'context_length_exceeded' });
        if (error instanceof ContextLengthError) {
          throw error;
        }
        throw new ContextLengthError(0, undefined, {
          details: { originalMessage: (error as Error).message },
        });
      }

      logger.error('Stream error', { error: (error as Error).message });
      logger.exit('chatCompletionStream', { success: false, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Simple message send (helper) (CLI parity)
   */
  async sendMessage(
    userMessage: string,
    systemPrompt?: string,
    stream?: boolean,
    onChunk?: StreamCallback
  ): Promise<string> {
    const messages: Message[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: userMessage });

    if (stream && onChunk) {
      const result = await this.chatCompletionStream({ messages }, onChunk);
      return result.content;
    } else {
      const response = await this.chatCompletion({ messages });
      return response.choices[0]?.message?.content || '';
    }
  }

  /**
   * Chat with conversation history
   */
  async chat(
    messages: Message[],
    stream?: boolean,
    onChunk?: StreamCallback
  ): Promise<{ content: string; message: Message }> {
    if (stream && onChunk) {
      const result = await this.chatCompletionStream({ messages }, onChunk);
      return {
        content: result.content,
        message: { role: 'assistant', content: result.content },
      };
    } else {
      const response = await this.chatCompletion({ messages });
      const assistantMessage = response.choices[0]?.message;
      return {
        content: assistantMessage?.content || '',
        message: assistantMessage || { role: 'assistant', content: '' },
      };
    }
  }

  /**
   * Chat Completion with Tools (CLI parity: chatCompletionWithTools)
   * Full tool loop with ContextLengthError recovery, malformed tool call detection,
   * final_response handling, no-tool-call retry, and max failures fallback.
   *
   * No iteration limit - continues until LLM stops calling tools.
   *
   * @param messages - Conversation history
   * @param tools - Available tool definitions
   * @param options - Additional options
   * @param options.getPendingMessage - Callback to get pending user message
   * @param options.clearPendingMessage - Callback to clear pending message after processing
   */
  async chatCompletionWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options?: {
      getPendingMessage?: () => string | null;
      clearPendingMessage?: () => void;
    }
  ): Promise<{
    message: Message;
    toolCalls: Array<{ tool: string; args: unknown; result: string }>;
    allMessages: Message[];
  }> {
    const { executeFileTool, requestToolApproval, emitAssistantResponse } = await import(
      '../../tools/llm/simple/simple-tool-executor'
    );

    let workingMessages = [...messages];
    const toolCallHistory: Array<{ tool: string; args: unknown; result: string }> = [];
    let contextLengthRecoveryAttempted = false;
    let noToolCallRetries = 0;
    let finalResponseFailures = 0;
    const MAX_NO_TOOL_CALL_RETRIES = 3;
    const MAX_FINAL_RESPONSE_FAILURES = 3;

    while (true) {
      // Check for interrupt at start of each iteration
      if (this.isInterrupted) {
        logger.flow('Interrupt detected - stopping tool loop');
        throw new Error('INTERRUPTED');
      }

      // Check for pending user message and inject it
      if (options?.getPendingMessage && options?.clearPendingMessage) {
        const pendingMsg = options.getPendingMessage();
        if (pendingMsg) {
          logger.flow('Injecting pending user message into conversation');
          workingMessages.push({ role: 'user', content: pendingMsg });
          options.clearPendingMessage();
        }
      }

      // LLM call with ContextLengthError recovery
      let response: LLMResponse;
      try {
        response = await this.chatCompletion({
          messages: workingMessages,
          tools,
          tool_choice: 'required',
        });
      } catch (error) {
        // ContextLengthError recovery: rollback last tool + compact + retry
        if (error instanceof ContextLengthError && !contextLengthRecoveryAttempted) {
          contextLengthRecoveryAttempted = true;
          logger.flow('ContextLengthError detected - attempting recovery with compact');

          // Rollback: remove last tool results and assistant message with tool_calls
          let rollbackIdx = workingMessages.length - 1;
          while (rollbackIdx >= 0 && workingMessages[rollbackIdx]?.role === 'tool') {
            rollbackIdx--;
          }
          if (rollbackIdx >= 0 && workingMessages[rollbackIdx]?.tool_calls) {
            workingMessages = workingMessages.slice(0, rollbackIdx);
            logger.debug('Rolled back messages to before last tool execution', {
              removedCount: messages.length - rollbackIdx,
            });
          }

          // Execute compact
          const { compactConversation } = await import('../../core/compact');
          const compactResult = await compactConversation(workingMessages, {});

          if (compactResult.success && compactResult.compactedMessages) {
            workingMessages = [...compactResult.compactedMessages];
            logger.flow('Compact completed, retrying with reduced context', {
              originalCount: compactResult.originalMessageCount,
              newCount: compactResult.newMessageCount,
            });
            continue;
          } else {
            logger.error('Compact failed during recovery', { error: compactResult.error });
            throw error;
          }
        }
        throw error;
      }

      // Check for interrupt after LLM call
      if (this.isInterrupted) {
        logger.flow('Interrupt detected after LLM call - stopping');
        throw new Error('INTERRUPTED');
      }

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No choice in LLM response');
      }

      const assistantMessage = choice.message;
      workingMessages.push(assistantMessage);

      // Tool calls processing
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Multi-tool detection logging
        if (assistantMessage.tool_calls.length > 1) {
          const toolNames = assistantMessage.tool_calls.map(tc => tc.function.name).join(', ');
          logger.warn(`[MULTI-TOOL DETECTED] LLM returned ${assistantMessage.tool_calls.length} tools: ${toolNames}`);
        }

        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          } catch (parseError) {
            const errorMsg = `Error: Failed to parse tool arguments - ${parseError instanceof Error ? parseError.message : 'Unknown error'}`;
            logger.error('Tool argument parse error', { toolName, error: errorMsg });

            workingMessages.push({
              role: 'tool',
              content: errorMsg,
              tool_call_id: toolCall.id,
            });
            toolCallHistory.push({
              tool: toolName,
              args: { raw: toolCall.function.arguments },
              result: errorMsg,
            });
            continue;
          }

          // Supervised Mode: Request user approval before tool execution
          const approvalResult = await requestToolApproval(toolName, toolArgs);
          if (approvalResult && typeof approvalResult === 'object' && approvalResult.reject) {
            logger.flow(`Tool rejected by user: ${toolName}`);
            const rejectMessage = approvalResult.comment
              ? `Tool execution rejected by user. Reason: ${approvalResult.comment}`
              : 'Tool execution rejected by user.';

            workingMessages.push({
              role: 'tool',
              content: rejectMessage,
              tool_call_id: toolCall.id,
            });
            toolCallHistory.push({ tool: toolName, args: toolArgs, result: rejectMessage });
            continue;
          }

          logger.debug(`Executing tool: ${toolName}`, toolArgs);

          let result: { success: boolean; result?: string; error?: string; metadata?: Record<string, unknown> };

          try {
            result = await executeFileTool(toolName, toolArgs);
            logger.llmToolResult(toolName, result.result || '', result.success);

            // Handle final_response tool
            if (toolName === 'final_response') {
              if (result.success && result.metadata?.['isFinalResponse']) {
                logger.flow('final_response tool executed successfully - returning');
                workingMessages.push({
                  role: 'tool',
                  content: result.result || '',
                  tool_call_id: toolCall.id,
                });
                toolCallHistory.push({
                  tool: toolName,
                  args: toolArgs,
                  result: result.result || '',
                });

                return {
                  message: { role: 'assistant', content: result.result || '' },
                  toolCalls: toolCallHistory,
                  allMessages: workingMessages,
                };
              } else {
                finalResponseFailures++;
                logger.flow(`final_response failed (attempt ${finalResponseFailures}/${MAX_FINAL_RESPONSE_FAILURES}): ${result.error}`);

                if (finalResponseFailures >= MAX_FINAL_RESPONSE_FAILURES) {
                  logger.warn('Max final_response failures exceeded - forcing completion');
                  const fallbackMessage = (toolArgs['message'] as string) || 'Task completed with incomplete TODOs.';
                  emitAssistantResponse(fallbackMessage);

                  return {
                    message: { role: 'assistant', content: fallbackMessage },
                    toolCalls: toolCallHistory,
                    allMessages: workingMessages,
                  };
                }
              }
            }
          } catch (toolError) {
            logger.llmToolResult(toolName, `Error: ${toolError instanceof Error ? toolError.message : String(toolError)}`, false);
            result = {
              success: false,
              error: toolError instanceof Error ? toolError.message : String(toolError),
            };
          }

          // Add result to messages
          workingMessages.push({
            role: 'tool',
            content: result.success ? result.result || '' : `Error: ${result.error}`,
            tool_call_id: toolCall.id,
          });
          toolCallHistory.push({
            tool: toolName,
            args: toolArgs,
            result: result.success ? result.result || '' : `Error: ${result.error}`,
          });

          // Check for interrupt after tool execution
          if (this.isInterrupted) {
            logger.flow('Interrupt detected after tool execution - stopping');
            throw new Error('INTERRUPTED');
          }
        }
        continue;
      } else {
        // No tool call - enforce tool usage
        noToolCallRetries++;
        logger.flow(`No tool call - enforcing tool usage (attempt ${noToolCallRetries}/${MAX_NO_TOOL_CALL_RETRIES})`);

        if (noToolCallRetries > MAX_NO_TOOL_CALL_RETRIES) {
          logger.warn('Max no-tool-call retries exceeded - returning content as final response');
          const fallbackContent = assistantMessage.content || 'Task completed.';
          emitAssistantResponse(fallbackContent);

          return {
            message: { role: 'assistant', content: fallbackContent },
            toolCalls: toolCallHistory,
            allMessages: workingMessages,
          };
        }

        // Check for malformed tool call patterns
        const hasMalformedToolCall = assistantMessage.content &&
          (/<tool_call>/i.test(assistantMessage.content) ||
           /<arg_key>/i.test(assistantMessage.content) ||
           /<arg_value>/i.test(assistantMessage.content) ||
           /<\/tool_call>/i.test(assistantMessage.content) ||
           /bash<arg_key>/i.test(assistantMessage.content) ||
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

        workingMessages.push({ role: 'user', content: retryMessage });
        continue;
      }
    }
  }

  /**
   * Abort current request and set interrupt flag (CLI parity)
   */
  abort(): void {
    logger.info('LLM Interrupt - aborting all operations');
    this.isInterrupted = true;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if interrupted (CLI parity)
   */
  checkInterrupted(): boolean {
    return this.isInterrupted;
  }

  /**
   * Reset interrupt flag (CLI parity)
   */
  resetInterrupt(): void {
    this.isInterrupted = false;
  }

  /**
   * Check if request is active (CLI parity)
   */
  isRequestActive(): boolean {
    return this.abortController !== null;
  }

  /**
   * Get current model info (CLI parity)
   */
  getModelInfo(): { model: string; endpoint: string } {
    const { endpoint, model } = this.getEndpointConfig();
    return {
      model: model.name,
      endpoint: endpoint.baseUrl,
    };
  }
}

// =============================================================================
// Export singleton instance
// =============================================================================

export const llmClient = new LLMClient();

// Also export class for potential extension
export { LLMClient };
