/**
 * Tool Registry
 *
 * Central registry for all tools
 * Manages tool registration, lookup, and execution
 */

import { BaseTool, ToolResult, ToolCategory, RiskLevel } from './base-tool.js';
import { ToolDefinition } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Tool registry singleton
 */
class ToolRegistryClass {
  private tools: Map<string, BaseTool> = new Map();

  /**
   * Register a tool
   */
  register(tool: BaseTool): void {
    const name = tool.getName();
    if (this.tools.has(name)) {
      logger.warn(`Tool "${name}" is already registered. Overwriting.`);
    }
    this.tools.set(name, tool);
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): BaseTool[] {
    return this.getAll().filter(tool => tool.getCategory() === category);
  }

  /**
   * Get tools by risk level
   */
  getByRiskLevel(riskLevel: RiskLevel): BaseTool[] {
    return this.getAll().filter(tool => tool.getRiskLevel() === riskLevel);
  }

  /**
   * Get tools that require approval
   */
  getRequiringApproval(): BaseTool[] {
    return this.getAll().filter(tool => tool.requiresApproval());
  }

  /**
   * Get all tool definitions for LLM
   */
  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(tool => tool.getDefinition());
  }

  /**
   * Get tool definitions by category
   */
  getDefinitionsByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getByCategory(category).map(tool => tool.getDefinition());
  }

  /**
   * Execute a tool by name
   */
  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`,
      };
    }
    return tool.run(args);
  }

  /**
   * Get tool count
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Get tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    byCategory: Record<ToolCategory, number>;
    byRiskLevel: Record<RiskLevel, number>;
    requiresApproval: number;
  } {
    const byCategory: Record<ToolCategory, number> = {
      file: 0,
      shell: 0,
      git: 0,
      npm: 0,
      search: 0,
      web: 0,
      agent: 0,
      custom: 0,
    };

    const byRiskLevel: Record<RiskLevel, number> = {
      safe: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let requiresApproval = 0;

    for (const tool of this.getAll()) {
      byCategory[tool.getCategory()]++;
      byRiskLevel[tool.getRiskLevel()]++;
      if (tool.requiresApproval()) {
        requiresApproval++;
      }
    }

    return {
      total: this.count(),
      byCategory,
      byRiskLevel,
      requiresApproval,
    };
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistryClass();

// Also export the class for testing
export { ToolRegistryClass };
