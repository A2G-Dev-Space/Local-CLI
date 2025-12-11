/**
 * Tool Types and Interfaces
 *
 * 6가지 도구 분류 시스템의 타입 정의
 *
 * Categories:
 * 1. LLM Simple Tools - LLM이 tool_call로 호출, Sub-LLM 없음
 * 2. LLM Agent Tools - LLM이 tool_call로 호출, Sub-LLM 사용
 * 3. System Simple Tools - 로직에서 조건에 따라 호출, Sub-LLM 없음
 * 4. System Agent Tools - 로직에서 조건에 따라 호출, Sub-LLM 사용
 * 5. User Commands - 사용자 /슬래시 명령어
 * 6. MCP Tools - Model Context Protocol 도구
 */

import { ToolDefinition } from '../types/index.js';
import { LLMClient } from '../core/llm-client.js';

/**
 * Tool categories for classification and registration
 */
export type ToolCategory =
  | 'llm-simple'
  | 'llm-agent'
  | 'system-simple'
  | 'system-agent'
  | 'user-command'
  | 'mcp';

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
 * Context passed to system tools
 */
export interface SystemContext {
  userMessage: string;
  messages: Array<{ role: string; content: string }>;
  currentDirectory: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 1. LLM Simple Tool Interface
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
 * 2. LLM Agent Tool Interface
 * - LLM이 tool_call로 호출
 * - Sub-LLM을 사용하여 복잡한 작업 수행
 */
export interface LLMAgentTool {
  /** Tool definition for LLM */
  definition: ToolDefinition;
  /** Execute the tool with given arguments and LLM client */
  execute: (args: Record<string, unknown>, llmClient: LLMClient) => Promise<ToolResult>;
  /** Categories this tool belongs to */
  categories: ToolCategory[];
  /** Flag indicating this tool requires Sub-LLM */
  requiresSubLLM: true;
  /** Optional description for registration */
  description?: string;
}

/**
 * 3. System Simple Tool Interface
 * - 로직에서 조건에 따라 자동 호출
 * - Sub-LLM 사용하지 않음
 */
export interface SystemSimpleTool {
  /** Unique tool name */
  name: string;
  /** Execute the tool with system context */
  execute: (context: SystemContext) => Promise<ToolResult>;
  /** Condition to trigger this tool automatically */
  triggerCondition: (context: SystemContext) => boolean;
  /** Categories this tool belongs to */
  categories: ToolCategory[];
  /** Optional description for registration */
  description?: string;
}

/**
 * 4. System Agent Tool Interface
 * - 로직에서 조건에 따라 자동 호출
 * - Sub-LLM을 사용하여 복잡한 작업 수행
 */
export interface SystemAgentTool {
  /** Unique tool name */
  name: string;
  /** Execute the tool with system context and LLM client */
  execute: (context: SystemContext, llmClient: LLMClient) => Promise<ToolResult>;
  /** Condition to trigger this tool automatically */
  triggerCondition: (context: SystemContext) => boolean;
  /** Categories this tool belongs to */
  categories: ToolCategory[];
  /** Flag indicating this tool requires Sub-LLM */
  requiresSubLLM: true;
  /** Optional description for registration */
  description?: string;
}

/**
 * 5. User Command Interface
 * - 사용자가 /슬래시 명령어로 직접 호출
 */
export interface UserCommand {
  /** Command name (e.g., '/help', '/settings') */
  name: string;
  /** Command aliases (e.g., '/quit' for '/exit') */
  aliases?: string[];
  /** Short description for help display */
  description: string;
  /** Execute the command */
  execute: (args: string[], context: UserCommandContext) => Promise<UserCommandResult>;
  /** Categories this command belongs to */
  categories: ToolCategory[];
}

/**
 * Context passed to user commands
 */
export interface UserCommandContext {
  messages: Array<{ role: string; content: string }>;
  setMessages: (messages: Array<{ role: string; content: string }>) => void;
  exit: () => void;
  // UI callbacks
  onShowSessionBrowser?: () => void;
  onShowSettings?: () => void;
  onShowModelSelector?: () => void;
}

/**
 * Result from user command execution
 */
export interface UserCommandResult {
  handled: boolean;
  shouldContinue: boolean;
  message?: string;
}

/**
 * 6. MCP Tool Interface
 * - Model Context Protocol 도구
 * - 외부 서버와 통신
 */
export interface MCPTool {
  /** Tool definition for MCP */
  definition: ToolDefinition;
  /** MCP server identifier */
  serverName: string;
  /** Execute the tool through MCP protocol */
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
  /** Categories this tool belongs to */
  categories: ToolCategory[];
  /** Optional description for registration */
  description?: string;
}

/**
 * Union type of all tool types
 */
export type AnyTool =
  | LLMSimpleTool
  | LLMAgentTool
  | SystemSimpleTool
  | SystemAgentTool
  | UserCommand
  | MCPTool;

/**
 * Type guard: Check if tool is LLM Simple Tool
 */
export function isLLMSimpleTool(tool: AnyTool): tool is LLMSimpleTool {
  return 'definition' in tool && 'execute' in tool && !('requiresSubLLM' in tool) && !('serverName' in tool);
}

/**
 * Type guard: Check if tool is LLM Agent Tool
 */
export function isLLMAgentTool(tool: AnyTool): tool is LLMAgentTool {
  return 'definition' in tool && 'requiresSubLLM' in tool && tool.requiresSubLLM === true;
}

/**
 * Type guard: Check if tool is System Simple Tool
 */
export function isSystemSimpleTool(tool: AnyTool): tool is SystemSimpleTool {
  return 'triggerCondition' in tool && !('requiresSubLLM' in tool);
}

/**
 * Type guard: Check if tool is System Agent Tool
 */
export function isSystemAgentTool(tool: AnyTool): tool is SystemAgentTool {
  return 'triggerCondition' in tool && 'requiresSubLLM' in tool && tool.requiresSubLLM === true;
}

/**
 * Type guard: Check if tool is User Command
 */
export function isUserCommand(tool: AnyTool): tool is UserCommand {
  return 'name' in tool && 'aliases' in tool || ('name' in tool && !('definition' in tool) && !('triggerCondition' in tool));
}

/**
 * Type guard: Check if tool is MCP Tool
 */
export function isMCPTool(tool: AnyTool): tool is MCPTool {
  return 'serverName' in tool && 'definition' in tool;
}
