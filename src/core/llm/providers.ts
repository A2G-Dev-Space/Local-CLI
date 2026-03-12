/**
 * LLM Provider Definitions
 *
 * Each provider has different API parameter support.
 * This module ensures only supported parameters are sent per provider.
 */

export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'zai'
  | 'qwen'
  | 'deepseek'
  | 'ollama'
  | 'lmstudio'
  | 'xai'
  | 'other';

export interface ProviderConfig {
  id: LLMProvider;
  name: string;
  defaultBaseUrl: string;
  /** Whether the API accepts parallel_tool_calls parameter */
  supportsParallelToolCalls: boolean;
  /** Whether the API accepts tool_choice: 'required' */
  supportsToolChoiceRequired: boolean;
}

export const PROVIDER_CONFIGS: Record<LLMProvider, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportsParallelToolCalls: true,
    supportsToolChoiceRequired: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    supportsParallelToolCalls: true,
    supportsToolChoiceRequired: true,
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    supportsParallelToolCalls: false,
    supportsToolChoiceRequired: true,
  },
  zai: {
    id: 'zai',
    name: 'Z.AI (GLM)',
    defaultBaseUrl: 'https://api.z.ai/api/paas/v4',
    supportsParallelToolCalls: false,
    supportsToolChoiceRequired: false,
  },
  qwen: {
    id: 'qwen',
    name: 'Alibaba Qwen',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    supportsParallelToolCalls: true,
    supportsToolChoiceRequired: false,
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    supportsParallelToolCalls: false,
    supportsToolChoiceRequired: true,
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434/v1',
    supportsParallelToolCalls: false,
    supportsToolChoiceRequired: false,
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    defaultBaseUrl: 'http://localhost:1234/v1',
    supportsParallelToolCalls: false,
    supportsToolChoiceRequired: true,
  },
  xai: {
    id: 'xai',
    name: 'x.ai (Grok)',
    defaultBaseUrl: 'https://api.x.ai/v1',
    supportsParallelToolCalls: true,
    supportsToolChoiceRequired: true,
  },
  other: {
    id: 'other',
    name: 'Other',
    defaultBaseUrl: '',
    supportsParallelToolCalls: false,
    supportsToolChoiceRequired: false,
  },
};

export const ALL_PROVIDERS: LLMProvider[] = [
  'openai', 'anthropic', 'gemini', 'zai', 'qwen',
  'deepseek', 'ollama', 'lmstudio', 'xai', 'other',
];

export function getProviderConfig(provider?: LLMProvider): ProviderConfig {
  return PROVIDER_CONFIGS[provider || 'other'];
}
