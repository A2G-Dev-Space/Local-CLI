/**
 * LOCAL-CLI Type Definitions
 *
 * 프로젝트 전체에서 사용되는 TypeScript 타입 정의
 */

/**
 * 엔드포인트 설정
 */
export interface EndpointConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: ModelInfo[];
  healthCheckInterval?: number;
  priority?: number;
  fallbackTo?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 모델 정보
 */
export interface ModelInfo {
  id: string;
  name: string;
  maxTokens: number;
  costPerMToken?: number;
  enabled: boolean;
  lastHealthCheck?: Date;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * LLM 메시지
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'error';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * Tool Call
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * LLM 요청 옵션
 */
export interface LLMRequestOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
}

/**
 * LLM Response
 */
export interface LLMResponse {
  choices: {
    message: {
      role: 'assistant' | 'system' | 'user';
      content: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'function_call';
    index?: number;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

/**
 * Tool 정의
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * 세션 메모리
 */
export interface SessionMemory {
  sessionId: string;
  tags: string[];
  messages: Message[];
  memory: Record<string, unknown>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    model: string;
    totalTokens: number;
    directories: string[];
    includedFiles: string[];
  };
}

/**
 * 설정 파일 구조
 */
export interface OpenConfig {
  version: string;
  currentEndpoint?: string;
  currentModel?: string;
  endpoints: EndpointConfig[];
  settings: {
    autoApprove: boolean;
    debugMode: boolean;
    streamResponse: boolean;
    autoSave: boolean;
  };
  /** Enabled optional tool group IDs (persisted across sessions) */
  enabledTools?: string[];
}

/**
 * TODO Item type for Plan-and-Execute Architecture
 * Simplified: title only, no description
 */
export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

/**
 * Planning result from Planning LLM
 */
export interface PlanningResult {
  todos: TodoItem[];
  estimatedTime?: string;
  complexity: 'simple' | 'moderate' | 'complex';
  /** Direct response when no planning is needed */
  directResponse?: string;
}

/**
 * TODO status type
 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

