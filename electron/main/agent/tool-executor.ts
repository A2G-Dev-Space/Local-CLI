/**
 * Tool Executor for Electron Agent (CLI Style)
 *
 * Lightweight executor that uses tool registry for execution.
 * All tool implementations are in ./tools/ modules.
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import { logger } from '../logger';
import {
  toolRegistry,
  setWorkingDirectory as setToolsWorkingDir,
  getWorkingDirectory as getToolsWorkingDir,
  setTodoWriteCallback as setToolsTodoCallback,
  setTellToUserCallback as setToolsTellCallback,
  setAskUserCallback as setToolsAskCallback,
  type TodoItem,
  type TodoWriteCallback,
  type TellToUserCallback,
  type AskUserCallback,
  type AskUserRequest,
  type AskUserResponse,
} from './tools';

// =============================================================================
// Types (re-export from tools)
// =============================================================================

export interface ToolResult {
  success: boolean;
  result?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type { TodoItem, TodoWriteCallback, TellToUserCallback, AskUserCallback, AskUserRequest, AskUserResponse };

// =============================================================================
// Callback Types
// =============================================================================

export type ToolExecutionCallback = (toolName: string, args: Record<string, unknown>) => void;

// =============================================================================
// Callbacks
// =============================================================================

let toolExecutionCallback: ToolExecutionCallback | null = null;

/**
 * Set TODO write callback
 */
export function setTodoWriteCallback(callback: TodoWriteCallback | null): void {
  setToolsTodoCallback(callback);
}

/**
 * Set tell-to-user callback
 */
export function setTellToUserCallback(callback: TellToUserCallback | null): void {
  setToolsTellCallback(callback);
}

/**
 * Set ask-user callback
 */
export function setAskUserCallback(callback: AskUserCallback | null): void {
  setToolsAskCallback(callback);
}

/**
 * Set tool execution callback (called when a tool starts)
 */
export function setToolExecutionCallback(callback: ToolExecutionCallback | null): void {
  toolExecutionCallback = callback;
}

/**
 * Set current working directory
 */
export function setWorkingDirectory(dir: string): void {
  setToolsWorkingDir(dir);
}

/**
 * Get current working directory
 */
export function getWorkingDirectory(): string {
  return getToolsWorkingDir();
}

// =============================================================================
// Main Tool Executor
// =============================================================================

/**
 * Execute a tool by name (CLI style - uses registry)
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const startTime = Date.now();
  logger.info('Executing tool', { toolName, args: JSON.stringify(args).substring(0, 500) });

  // Notify tool execution callback
  if (toolExecutionCallback) {
    toolExecutionCallback(toolName, args);
  }

  try {
    // Get tool from registry
    const tool = toolRegistry.get(toolName);

    if (!tool) {
      const error = `Unknown tool: ${toolName}`;
      logger.warn('Tool not found', { toolName });
      return { success: false, error };
    }

    // Execute the tool
    const result = await tool.execute(args);
    const duration = Date.now() - startTime;

    logger.info('Tool execution completed', {
      toolName,
      success: result.success,
      duration,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Tool execution failed', { toolName, error: errorMessage });
    return { success: false, error: `Tool execution failed: ${errorMessage}` };
  }
}

/**
 * Execute a simple tool (alias for executeTool)
 */
export const executeSimpleTool = executeTool;

/**
 * Sanitize string value by removing XML-like parameter syntax
 * LLMs sometimes output malformed arguments with XML fragments like:
 * - `<parameter name="text">value` -> `value`
 * - `font_name">value` -> `value` (truncated XML)
 */
function sanitizeStringValue(value: string): string {
  if (typeof value !== 'string') return value;

  // Remove XML parameter tags: <parameter name="...">
  let sanitized = value.replace(/<parameter\s+name=["'][^"']*["']>/gi, '');

  // Remove closing parameter tags
  sanitized = sanitized.replace(/<\/parameter>/gi, '');

  // Remove truncated XML fragments like: font_name">value or text">value
  // Pattern: word followed by "> at the start
  sanitized = sanitized.replace(/^[a-z_]+["']?>/i, '');

  // Clean up any remaining XML-like artifacts at the start
  sanitized = sanitized.replace(/^["']?>/, '');

  return sanitized.trim();
}

/**
 * Sanitize all string values in an arguments object
 */
function sanitizeToolArguments(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeStringValue(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeStringValue(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeToolArguments(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Parse tool arguments from JSON string
 */
export function parseToolArguments(argsString: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(argsString);
    // Sanitize all string values to remove XML-like artifacts
    return sanitizeToolArguments(parsed);
  } catch (error) {
    throw new Error(`Failed to parse tool arguments: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
  }
}

// =============================================================================
// Tool Registry Access
// =============================================================================

/**
 * Get all registered tool names
 */
export function getRegisteredTools(): string[] {
  return toolRegistry.listAll();
}

/**
 * Get tool definitions for LLM
 */
export function getToolDefinitions() {
  return toolRegistry.getLLMToolDefinitions();
}

/**
 * Check if a tool is registered
 */
export function hasToolRegistered(toolName: string): boolean {
  return toolRegistry.has(toolName);
}

/**
 * Enable an optional tool group
 */
export async function enableToolGroup(groupId: string) {
  return toolRegistry.enableToolGroup(groupId);
}

/**
 * Disable an optional tool group
 */
export async function disableToolGroup(groupId: string) {
  return toolRegistry.disableToolGroup(groupId);
}

/**
 * Get optional tool groups
 */
export function getOptionalToolGroups() {
  return toolRegistry.getOptionalToolGroups();
}

/**
 * Get tool statistics
 */
export function getToolStats() {
  return toolRegistry.getStats();
}
