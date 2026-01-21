/**
 * LLM Client for Electron Main Process
 * OpenAI Compatible API client
 * Aligned with CLI's llm-client.ts for feature parity
 */

import { logger } from './logger';
import { llmManager } from './llm-manager';
import { usageTracker } from './usage-tracker';

// =============================================================================
// Types
// =============================================================================

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
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
 * Retry configuration interface
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

  /** Default maximum retry attempts */
  private static readonly DEFAULT_MAX_RETRIES = 3;

  /** Request timeout in milliseconds (10 minutes) */
  private static readonly REQUEST_TIMEOUT = 600000;

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
   * Preprocess messages for model-specific requirements
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
   * Check if error is retryable
   * - 5xx server errors
   * - Network errors (ECONNREFUSED, ETIMEDOUT, ECONNRESET, etc.)
   * - Rate Limit (429)
   */
  private isRetryableError(error: unknown): boolean {
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

      // HTTP status based errors
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
   * Check if error is context length exceeded
   */
  private isContextLengthError(error: unknown): boolean {
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
   * Sleep for specified milliseconds (for retry backoff)
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
    const maxRetries = retryConfig?.disableRetry ? 1 : (retryConfig?.maxRetries ?? LLMClient.DEFAULT_MAX_RETRIES);
    const currentAttempt = retryConfig?.currentAttempt ?? 1;

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
      stream: false,
      ...(options.tools && {
        tools: options.tools,
        parallel_tool_calls: false,
        ...(options.tool_choice && { tool_choice: options.tool_choice }),
      }),
    };

    logger.info('LLM Request', {
      endpoint: endpoint.name,
      model: modelId,
      messagesCount: options.messages.length,
      attempt: currentAttempt,
      maxRetries,
    });

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

        throw new Error(errorMessage);
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
          modelId,
          data.usage.prompt_tokens || 0,
          data.usage.completion_tokens || 0
        );
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      this.abortController = null;

      // User abort
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }

      // Retry logic with exponential backoff
      if (currentAttempt < maxRetries && this.isRetryableError(error)) {
        const delay = Math.pow(2, currentAttempt - 1) * 1000; // 1s, 2s, 4s
        logger.warn(`LLM call failed (${currentAttempt}/${maxRetries}), retrying in ${delay}ms...`, {
          error: (error as Error).message,
        });

        await this.sleep(delay);

        return this.chatCompletion(options, {
          ...retryConfig,
          currentAttempt: currentAttempt + 1,
        });
      }

      // Context length error - throw with special flag
      if (this.isContextLengthError(error)) {
        const contextError = new Error((error as Error).message);
        (contextError as any).isContextLengthError = true;
        throw contextError;
      }

      throw error;
    }
  }

  /**
   * Chat completion with streaming
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

    logger.info('LLM Stream Request', {
      endpoint: endpoint.name,
      model: modelId,
      messagesCount: options.messages.length,
    });

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

        throw new Error(errorMessage);
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
      clearTimeout(timeoutId);
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
   * Abort current request
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      logger.info('LLM Request aborted');
    }
  }

  /**
   * Check if request is active
   */
  isRequestActive(): boolean {
    return this.abortController !== null;
  }
}

// =============================================================================
// Export singleton instance
// =============================================================================

export const llmClient = new LLMClient();
