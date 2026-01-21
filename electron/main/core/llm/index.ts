/**
 * LLM Module Export
 * Re-exports from ROOT level llm-client.ts for backwards compatibility
 */

export {
  llmClient,
  default,
} from '../../llm-client';

export type {
  Message,
  ToolCall,
  ToolDefinition,
  LLMResponse,
  LLMStreamChunk,
  ChatRequestOptions,
  StreamCallback,
  RetryConfig,
} from '../../llm-client';
