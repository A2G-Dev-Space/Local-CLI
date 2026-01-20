/**
 * Tool Types for Electron Agent
 *
 * Type definitions for tool system (Windows Native PowerShell based)
 */

import { ToolDefinition } from '../../../llm-client';

/**
 * Tool categories
 */
export type ToolCategory = 'llm-simple' | 'llm-agent' | 'llm-planning' | 'system-simple';

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  result?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * LLM Simple Tool Interface
 * - LLM이 tool_call로 호출
 * - Sub-LLM 사용하지 않음
 */
export interface LLMSimpleTool {
  /** Tool definition for LLM */
  definition: ToolDefinition;
  /** Execute the tool with given arguments */
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
  /** Categories this tool belongs to */
  categories: ToolCategory[];
  /** Optional description for registration */
  description?: string;
}

/**
 * Optional tool group definition
 */
export interface OptionalToolGroup {
  id: string;
  name: string;
  description: string;
  tools: LLMSimpleTool[];
  enabled: boolean;
  onEnable?: () => Promise<{ success: boolean; error?: string }>;
  onDisable?: () => Promise<void>;
}

/**
 * Type guard: Check if tool is LLM Simple Tool
 */
export function isLLMSimpleTool(tool: unknown): tool is LLMSimpleTool {
  return (
    typeof tool === 'object' &&
    tool !== null &&
    'definition' in tool &&
    'execute' in tool &&
    'categories' in tool
  );
}
