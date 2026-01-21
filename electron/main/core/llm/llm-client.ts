/**
 * LLM Client for Electron Main Process
 * OpenAI Compatible API client with retry logic
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import { logger } from '../../logger';
import { llmManager } from '../../llm-manager';
import { usageTracker } from '../../usage-tracker';
import {
  RateLimitError,
  ContextLengthError,
  APIError,
  TimeoutError,
  ConnectionError,
  NetworkError,
} from '../../errors';

// =============================================================================
// Types
// =============================================================================

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
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

export type StreamCallback = (chunk: string, done: boolean) => void;

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries?: number;
  currentAttempt?: number;
  disableRetry?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_RETRIES = 3;
// Note: DEFAULT_TIMEOUT is available for future use but not currently used
// const DEFAULT_TIMEOUT = 600000; // 10 minutes

// =============================================================================
// LLM Client Class
// =============================================================================

class LLMClient {
  private abortController: AbortController | null = null;
  private isInterrupted: boolean = false;

  /**
   * Get current endpoint config
   */
  private getEndpointConfig() {
    const endpoint = llmManager.getCurrentEndpoint();
    const model = llmManager.getCurrentModel();

    if (!endpoint || !model) {
      throw new Error('No endpoint or model configured. Please configure an LLM endpoint in Settings.');
    }

    return { endpoint, model };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    // User interrupt is not retryable
    if (error instanceof Error && error.message === 'INTERRUPTED') {
      return false;
    }

    // Typed errors
    if (error instanceof RateLimitError) {
      return true;
    }
    if (error instanceof TimeoutError || error instanceof ConnectionError) {
      return true;
    }
    if (error instanceof NetworkError) {
      return true;
    }
    if (error instanceof APIError) {
      // 5xx server errors are retryable
      if (error.statusCode && error.statusCode >= 500) {
        return true;
      }
      // 4xx errors are not retryable (except 429)
      if (error.statusCode === 429) {
        return true;
      }
      return false;
    }
    if (error instanceof ContextLengthError) {
      // Context length errors are not retryable
      return false;
    }

    // Generic Error - check message for network issues
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('timeout') || message.includes('network') ||
          message.includes('econnrefused') || message.includes('econnreset') ||
          message.includes('etimedout') || message.includes('enotfound')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sleep for exponential backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Chat completion (non-streaming) with retry logic
   */
  async chatCompletion(
    options: ChatRequestOptions,
    retryConfig?: RetryConfig
  ): Promise<LLMResponse> {
    const maxRetries = retryConfig?.disableRetry ? 1 : (retryConfig?.maxRetries ?? DEFAULT_MAX_RETRIES);
    const currentAttempt = retryConfig?.currentAttempt ?? 1;

    const { endpoint, model } = this.getEndpointConfig();
    const url = `${endpoint.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (endpoint.apiKey) {
      headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
    }

    const requestBody = {
      model: model.id,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? model.maxTokens,
      stream: false,
      ...(options.tools && {
        tools: options.tools,
        parallel_tool_calls: false,
        ...(options.tool_choice && { tool_choice: options.tool_choice }),
      }),
    };

    logger.info('LLM Request', {
      endpoint: endpoint.name,
      model: model.id,
      messagesCount: options.messages.length,
      attempt: currentAttempt,
      maxRetries,
    });

    this.abortController = new AbortController();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal,
      });

      this.abortController = null;

      if (!response.ok) {
        const errorText = await response.text();
        throw this.handleHttpError(response.status, errorText, url);
      }

      const data = await response.json() as LLMResponse;

      logger.info('LLM Response', {
        model: data.model,
        choices: data.choices.length,
        usage: data.usage,
      });

      // Track usage
      if (data.usage) {
        usageTracker.recordUsage(
          model.id,
          data.usage.prompt_tokens || 0,
          data.usage.completion_tokens || 0
        );
      }

      return data;
    } catch (error) {
      this.abortController = null;

      // Check if this was an abort/cancel
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }

      // Retry logic
      if (currentAttempt < maxRetries && this.isRetryableError(error)) {
        const delay = Math.pow(2, currentAttempt - 1) * 1000; // 1s, 2s, 4s
        logger.debug(`LLM call failed (${currentAttempt}/${maxRetries}), retrying in ${delay}ms...`, {
          error: (error as Error).message,
          attempt: currentAttempt,
          maxRetries,
          delay,
        });

        await this.sleep(delay);

        return this.chatCompletion(options, {
          maxRetries,
          currentAttempt: currentAttempt + 1,
        });
      }

      // Final failure
      if (currentAttempt > 1) {
        logger.error(`LLM call failed after ${maxRetries} retries`, {
          error: (error as Error).message,
          attempts: currentAttempt,
        });
      }

      throw error;
    }
  }

  /**
   * Handle HTTP errors and convert to typed errors
   */
  private handleHttpError(status: number, errorText: string, url: string): Error {
    let errorMessage = `HTTP ${status}`;
    let errorData: any = null;

    try {
      errorData = JSON.parse(errorText);
      errorMessage = errorData.error?.message || errorData.message || errorMessage;
    } catch {
      if (errorText) {
        errorMessage = errorText.substring(0, 500);
      }
    }

    // Rate limit
    if (status === 429) {
      const retryAfter = errorData?.error?.retry_after;
      return new RateLimitError(retryAfter);
    }

    // Context length exceeded
    if (errorMessage.includes('context_length_exceeded') ||
        errorMessage.includes('maximum context length')) {
      return new ContextLengthError(0, undefined, {
        details: { errorMessage, url },
      });
    }

    // Server errors
    if (status >= 500) {
      return new APIError(errorMessage, status, url, {
        isRecoverable: true,
      });
    }

    // Client errors
    return new APIError(errorMessage, status, url, {
      isRecoverable: false,
    });
  }

  /**
   * Chat completion with streaming
   */
  async chatCompletionStream(
    options: ChatRequestOptions,
    onChunk: StreamCallback
  ): Promise<{ content: string; usage?: LLMResponse['usage'] }> {
    const { endpoint, model } = this.getEndpointConfig();

    const url = `${endpoint.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (endpoint.apiKey) {
      headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
    }

    const requestBody = {
      model: model.id,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? model.maxTokens,
      stream: true,
      ...(options.tools && {
        tools: options.tools,
        parallel_tool_calls: false,
        ...(options.tool_choice && { tool_choice: options.tool_choice }),
      }),
    };

    logger.info('LLM Stream Request', {
      endpoint: endpoint.name,
      model: model.id,
      messagesCount: options.messages.length,
    });

    this.abortController = new AbortController();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw this.handleHttpError(response.status, errorText, url);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
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
            } catch {
              // Skip invalid JSON chunks
            }
          }
        }
      }

      this.abortController = null;

      logger.info('LLM Stream Complete', {
        contentLength: fullContent.length,
      });

      return { content: fullContent };
    } catch (error) {
      this.abortController = null;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }

      throw error;
    }
  }

  /**
   * Simple message send (helper)
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
   * Abort current request and set interrupt flag
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
   * Check if interrupted
   */
  checkInterrupted(): boolean {
    return this.isInterrupted;
  }

  /**
   * Reset interrupt flag
   */
  resetInterrupt(): void {
    this.isInterrupted = false;
  }

  /**
   * Check if request is active
   */
  isRequestActive(): boolean {
    return this.abortController !== null;
  }
}

// =============================================================================
// Export
// =============================================================================

export const llmClient = new LLMClient();
export default llmClient;
