/**
 * Base Tool Abstract Class
 *
 * All tools should extend this base class
 * Provides common functionality and interface for tool implementation
 */

import { ToolDefinition } from '../../types/index.js';

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
 * Tool execution context
 */
export interface ToolContext {
  workingDirectory: string;
  sessionId?: string;
  userId?: string;
  timeout?: number;
}

/**
 * Risk level for tool operations
 */
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Tool metadata
 */
export interface ToolMetadata {
  name: string;
  description: string;
  version: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
}

/**
 * Tool category
 */
export type ToolCategory =
  | 'file'      // File operations (read, write, list)
  | 'shell'     // Shell/bash commands
  | 'git'       // Git operations
  | 'npm'       // NPM operations
  | 'search'    // Code/file search
  | 'web'       // Web requests
  | 'agent'     // Sub-agent tools
  | 'custom';   // User-defined tools

/**
 * Base Tool Abstract Class
 */
export abstract class BaseTool {
  protected metadata: ToolMetadata;
  protected context?: ToolContext;

  constructor(metadata: ToolMetadata) {
    this.metadata = metadata;
  }

  /**
   * Get tool name
   */
  getName(): string {
    return this.metadata.name;
  }

  /**
   * Get tool description
   */
  getDescription(): string {
    return this.metadata.description;
  }

  /**
   * Get tool category
   */
  getCategory(): ToolCategory {
    return this.metadata.category;
  }

  /**
   * Get risk level
   */
  getRiskLevel(): RiskLevel {
    return this.metadata.riskLevel;
  }

  /**
   * Check if tool requires approval
   */
  requiresApproval(): boolean {
    return this.metadata.requiresApproval;
  }

  /**
   * Set execution context
   */
  setContext(context: ToolContext): void {
    this.context = context;
  }

  /**
   * Get tool definition for LLM
   * Must be implemented by subclass
   */
  abstract getDefinition(): ToolDefinition;

  /**
   * Execute the tool with given arguments
   * Must be implemented by subclass
   */
  abstract execute(args: Record<string, unknown>): Promise<ToolResult>;

  /**
   * Validate arguments before execution
   * Can be overridden by subclass for custom validation
   */
  protected validateArgs(_args: Record<string, unknown>): boolean {
    return true;
  }

  /**
   * Pre-execution hook
   * Can be overridden by subclass
   */
  protected async beforeExecute(_args: Record<string, unknown>): Promise<void> {
    // Default: no-op
  }

  /**
   * Post-execution hook
   * Can be overridden by subclass
   */
  protected async afterExecute(_result: ToolResult): Promise<void> {
    // Default: no-op
  }

  /**
   * Execute with hooks
   */
  async run(args: Record<string, unknown>): Promise<ToolResult> {
    if (!this.validateArgs(args)) {
      return {
        success: false,
        error: 'Invalid arguments provided',
      };
    }

    await this.beforeExecute(args);
    const result = await this.execute(args);
    await this.afterExecute(result);

    return result;
  }
}
