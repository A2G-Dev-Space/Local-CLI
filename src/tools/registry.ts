/**
 * Tool Registry
 *
 * 도구 중앙 등록 시스템
 * 모든 도구를 카테고리별로 등록하고 관리
 *
 * Features:
 * - Multi-category registration (한 도구가 여러 카테고리에 등록 가능)
 * - Type-safe tool retrieval
 * - LLM tool definitions export
 */

import { ToolDefinition } from '../types/index.js';
import {
  AnyTool,
  ToolCategory,
  LLMSimpleTool,
  LLMAgentTool,
  isLLMSimpleTool,
  isLLMAgentTool,
} from './types.js';

// Import active tools
import { FILE_SIMPLE_TOOLS } from './llm/simple/file-tools.js';
import { LLM_AGENT_TOOLS } from './llm/agents/index.js';

/**
 * Tool Registry class
 */
class ToolRegistry {
  private tools: Map<string, AnyTool> = new Map();
  private categoryIndex: Map<ToolCategory, Set<string>> = new Map();

  constructor() {
    // Initialize category index for active categories
    const categories: ToolCategory[] = [
      'llm-simple',
      'llm-agent',
    ];
    for (const category of categories) {
      this.categoryIndex.set(category, new Set());
    }
  }

  /**
   * Register a tool
   */
  register(tool: AnyTool): void {
    // Get tool name
    let name: string;
    if ('definition' in tool) {
      name = tool.definition.function.name;
    } else if ('name' in tool) {
      name = tool.name;
    } else {
      throw new Error('Tool must have a name or definition');
    }

    // Store tool
    this.tools.set(name, tool);

    // Index by categories
    if ('categories' in tool) {
      for (const category of tool.categories) {
        this.categoryIndex.get(category)?.add(name);
      }
    }
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: AnyTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get tool by name
   */
  get(name: string): AnyTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools in a category
   */
  getByCategory(category: ToolCategory): AnyTool[] {
    const names = this.categoryIndex.get(category) || new Set();
    return Array.from(names)
      .map((name) => this.tools.get(name))
      .filter((tool): tool is AnyTool => tool !== undefined);
  }

  /**
   * Get all LLM Simple tools
   */
  getLLMSimpleTools(): LLMSimpleTool[] {
    return this.getByCategory('llm-simple').filter(isLLMSimpleTool);
  }

  /**
   * Get all LLM Agent tools
   */
  getLLMAgentTools(): LLMAgentTool[] {
    return this.getByCategory('llm-agent').filter(isLLMAgentTool);
  }

  /**
   * Get all LLM tool definitions (for chatCompletion)
   * Includes both LLM Simple and LLM Agent tools
   */
  getLLMToolDefinitions(): ToolDefinition[] {
    const llmTools = [
      ...this.getLLMSimpleTools(),
      ...this.getLLMAgentTools(),
    ];
    return llmTools.map((tool) => tool.definition);
  }

  /**
   * Get tool count by category
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [category, names] of this.categoryIndex) {
      stats[category] = names.size;
    }
    return stats;
  }

  /**
   * List all registered tool names
   */
  listAll(): string[] {
    return Array.from(this.tools.keys());
  }
}

/**
 * Global tool registry instance
 */
export const toolRegistry = new ToolRegistry();

/**
 * Initialize registry with all built-in tools
 */
export function initializeToolRegistry(): void {
  // LLM Simple Tools (file operations, bash, todo, ask-user)
  toolRegistry.registerAll(FILE_SIMPLE_TOOLS);

  // LLM Agent Tools (docs-search tools)
  toolRegistry.registerAll(LLM_AGENT_TOOLS);

  // Future: User Commands, MCP Tools, System Tools
  // These will be added as they are implemented
}

// Auto-initialize on import
initializeToolRegistry();

export default toolRegistry;
