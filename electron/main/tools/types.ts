/**
 * Tool Types for Electron
 *
 * Type definitions for the tool system
 */

// =============================================================================
// Tool Definition Types
// =============================================================================

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
  default?: unknown;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required?: string[];
    };
  };
}

// =============================================================================
// Tool Execution Types
// =============================================================================

export interface ToolResult {
  success: boolean;
  result?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolContext {
  workingDirectory: string;
  currentTodos?: Array<{
    id: string;
    title: string;
    status: string;
  }>;
}

// =============================================================================
// Tool Group Types
// =============================================================================

export type CoreToolGroupId = 'file' | 'powershell' | 'todo' | 'user';
export type OptionalToolGroupId = 'browser' | 'word' | 'excel' | 'powerpoint' | 'docs';
export type ToolGroupId = CoreToolGroupId | OptionalToolGroupId;

export interface ToolGroup {
  id: ToolGroupId;
  name: string;
  description: string;
  tools: ToolDefinition[];
  execute: (toolName: string, args: Record<string, unknown>) => Promise<ToolResult>;
  isOptional: boolean;
  isEnabled?: boolean;
}

// =============================================================================
// Tool Registry Types
// =============================================================================

export interface ToolRegistry {
  register(group: ToolGroup): void;
  unregister(groupId: ToolGroupId): void;
  getToolDefinitions(): ToolDefinition[];
  getLLMToolDefinitions(): ToolDefinition[];
  executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult>;
  enableToolGroup(groupId: OptionalToolGroupId): void;
  disableToolGroup(groupId: OptionalToolGroupId): void;
  isToolGroupEnabled(groupId: OptionalToolGroupId): boolean;
  getEnabledToolGroupIds(): OptionalToolGroupId[];
  getToolSummary(): string;
}
