/**
 * LLM Client for Electron Main Process
 * OpenAI Compatible API client
 * Based on CLI's llm-client.ts but simplified for Electron
 */

import { logger } from './logger';
import { llmManager } from './llm-manager';
import { usageTracker } from './usage-tracker';

// Message types
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

// LLM Response types
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

// Chat request options
export interface ChatRequestOptions {
  messages: Message[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// Streaming callback type
export type StreamCallback = (chunk: string, done: boolean) => void;

/**
 * LLM Client Class for Electron
 */
class LLMClient {
  private abortController: AbortController | null = null;

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
   * Chat completion (non-streaming)
   */
  async chatCompletion(options: ChatRequestOptions): Promise<LLMResponse> {
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
          model.id,
          data.usage.prompt_tokens || 0,
          data.usage.completion_tokens || 0
        );
      }

      return data;
    } catch (error) {
      this.abortController = null;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request cancelled');
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

// Export singleton instance
export const llmClient = new LLMClient();
