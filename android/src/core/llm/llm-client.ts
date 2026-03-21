/**
 * LLM Client (Android)
 *
 * OpenAI Compatible API 클라이언트
 * CLI/Electron의 axios 기반과 동일 로직, React Native fetch 사용
 */

import type { Message, LLMRequestOptions } from '../../types';
import { configManager } from '../config/config-manager';
import { getProviderConfig, type LLMProvider } from './providers';
import { APIError, TimeoutError, ConnectionError } from '../../errors/network';
import { LLMRetryExhaustedError } from '../../errors/llm';
import { logger } from '../../utils/logger';

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
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

export interface RetryConfig {
  maxRetries?: number;
  currentAttempt?: number;
  disableRetry?: boolean;
  extendedRetryDone?: boolean;
}

export class LLMClient {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private provider: LLMProvider;
  private currentAbortController: AbortController | null = null;
  private isInterrupted: boolean = false;

  public countdownCallback: ((remainingSeconds: number) => void) | null = null;

  private static readonly DEFAULT_MAX_RETRIES = 3;

  constructor() {
    const endpoint = configManager.getCurrentEndpoint();
    const currentModel = configManager.getCurrentModel();

    if (!endpoint || !currentModel) {
      throw new Error('No endpoint or model configured.');
    }

    this.baseUrl = endpoint.baseUrl;
    this.apiKey = endpoint.apiKey || '';
    this.model = currentModel.apiModelId || currentModel.id;
    this.provider = endpoint.provider || 'other';
  }

  /**
   * Preprocess messages — 동일 로직 (CLI/Electron 패리티)
   */
  private preprocessMessages(messages: Message[], modelId: string): Message[] {
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }

    return messages.map((msg, index) => {
      if (msg.role !== 'assistant') return msg;

      const msgAny = msg as any;
      const processedMsg = { ...msg };
      const isLatestAssistant = index === lastAssistantIdx;

      if (!isLatestAssistant) {
        if (msgAny.reasoning_content) delete (processedMsg as any).reasoning_content;
        if (msgAny.reasoning) delete (processedMsg as any).reasoning;
        if (processedMsg.content) {
          processedMsg.content = processedMsg.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        }
      }

      if (msgAny.reasoning_content && (!processedMsg.content || processedMsg.content.trim() === '')) {
        processedMsg.content = isLatestAssistant ? msgAny.reasoning_content : '';
        delete (processedMsg as any).reasoning_content;
      }

      if (processedMsg.content === undefined || processedMsg.content === null) {
        processedMsg.content = '';
      }

      return processedMsg;
    });
  }

  /**
   * Chat Completion API (Non-streaming) — CLI 패리티
   */
  async chatCompletion(
    options: Partial<LLMRequestOptions>,
    retryConfig?: RetryConfig
  ): Promise<LLMResponse> {
    const maxRetries = retryConfig?.disableRetry ? 1 : (retryConfig?.maxRetries ?? LLMClient.DEFAULT_MAX_RETRIES);
    const currentAttempt = retryConfig?.currentAttempt ?? 1;

    const url = `${this.baseUrl}/chat/completions`;

    try {
      const modelId = options.model || this.model;
      const processedMessages = options.messages
        ? this.preprocessMessages(options.messages, modelId)
        : [];

      const providerConfig = getProviderConfig(this.provider);
      const requestBody: Record<string, unknown> = {
        model: modelId,
        messages: processedMessages,
        temperature: options.temperature ?? 0.7,
        stream: false,
      };

      if (options.tools) {
        requestBody.tools = options.tools;
        if (providerConfig.supportsParallelToolCalls) {
          requestBody.parallel_tool_calls = false;
        }
        if (options.tool_choice && providerConfig.supportsToolChoice) {
          requestBody.tool_choice =
            options.tool_choice === 'required' && !providerConfig.supportsToolChoiceRequired
              ? 'auto'
              : options.tool_choice;
        }
      }

      logger.httpRequest('POST', url, { model: modelId, messages: processedMessages.length });

      this.currentAbortController = new AbortController();
      const timeoutId = setTimeout(() => this.currentAbortController?.abort(), 600000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify(requestBody),
        signal: this.currentAbortController.signal,
      });

      clearTimeout(timeoutId);
      this.currentAbortController = null;

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new APIError(
          `API error: ${response.status} ${response.statusText} - ${errorBody}`,
          response.status,
          url
        );
      }

      const data = await response.json() as LLMResponse;

      if (!data.choices || !Array.isArray(data.choices)) {
        throw new Error('LLM 응답 형식이 올바르지 않습니다.');
      }

      logger.httpResponse(response.status, response.statusText, {
        choices: data.choices.length,
        usage: data.usage,
      });

      return data;
    } catch (error) {
      this.currentAbortController = null;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('INTERRUPTED');
      }

      // Retry logic — CLI 패리티
      if (currentAttempt < maxRetries && this.isRetryableError(error)) {
        const delay = Math.pow(2, currentAttempt - 1) * 1000;
        logger.debug(`LLM 호출 실패 (${currentAttempt}/${maxRetries}), ${delay}ms 후 재시도...`);
        await this.sleep(delay);
        return this.chatCompletion(options, { maxRetries, currentAttempt: currentAttempt + 1 });
      }

      // Extended retry — CLI 패리티
      if (currentAttempt >= maxRetries && !retryConfig?.disableRetry && !retryConfig?.extendedRetryDone && this.isRetryableError(error)) {
        const waited = await this.waitWithCountdown(120);
        if (!waited) throw new Error('INTERRUPTED');

        try {
          return await this.chatCompletion(options, {
            maxRetries,
            currentAttempt: 1,
            extendedRetryDone: true,
          });
        } catch (phase3Error) {
          if (phase3Error instanceof Error && phase3Error.message === 'INTERRUPTED') throw phase3Error;
          throw new LLMRetryExhaustedError(phase3Error instanceof Error ? phase3Error : new Error(String(phase3Error)));
        }
      }

      throw error;
    }
  }

  /**
   * Streaming Chat Completion — CLI 패리티
   */
  async *chatCompletionStream(
    options: Partial<LLMRequestOptions>
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const url = `${this.baseUrl}/chat/completions`;

    const modelId = options.model || this.model;
    const processedMessages = options.messages
      ? this.preprocessMessages(options.messages, modelId)
      : [];

    const providerConfig = getProviderConfig(this.provider);
    const requestBody: Record<string, unknown> = {
      model: modelId,
      messages: processedMessages,
      temperature: options.temperature ?? 0.7,
      stream: true,
    };

    if (options.tools) {
      requestBody.tools = options.tools;
      if (providerConfig.supportsParallelToolCalls) {
        requestBody.parallel_tool_calls = false;
      }
      if (options.tool_choice && providerConfig.supportsToolChoice) {
        requestBody.tool_choice =
          options.tool_choice === 'required' && !providerConfig.supportsToolChoiceRequired
            ? 'auto'
            : options.tool_choice;
      }
    }

    this.currentAbortController = new AbortController();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify(requestBody),
      signal: this.currentAbortController.signal,
    });

    if (!response.ok || !response.body) {
      this.currentAbortController = null;
      throw new APIError(`Stream error: ${response.status}`, response.status, url);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (this.isInterrupted) {
          throw new Error('INTERRUPTED');
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6)) as LLMStreamChunk;
              yield data;
            } catch {
              // skip invalid chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      this.currentAbortController = null;
    }
  }

  /**
   * Simple message send helper — CLI 패리티
   */
  async sendMessage(userMessage: string, systemPrompt?: string): Promise<string> {
    const messages: Message[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userMessage });

    const response = await this.chatCompletion({ messages });
    if (response.choices.length === 0) throw new Error('No response from LLM');
    return response.choices[0]?.message.content || '';
  }

  abort(): void {
    this.isInterrupted = true;
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  checkInterrupted(): boolean {
    return this.isInterrupted;
  }

  resetInterrupt(): void {
    this.isInterrupted = false;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error && error.message === 'INTERRUPTED') return false;
    if (error instanceof APIError) {
      const status = error.statusCode;
      if (!status) return true;
      if (status === 429 || status >= 500) return true;
      return false;
    }
    if (error instanceof TypeError) return true; // network errors in fetch
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async waitWithCountdown(totalSeconds: number): Promise<boolean> {
    for (let remaining = totalSeconds; remaining > 0; remaining -= 10) {
      if (this.isInterrupted) {
        this.countdownCallback?.(0);
        return false;
      }
      const waitSec = Math.min(10, remaining);
      this.countdownCallback?.(remaining);
      await this.sleep(waitSec * 1000);
    }
    this.countdownCallback?.(0);
    return !this.isInterrupted;
  }
}
