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
  SystemSimpleTool,
  SystemAgentTool,
  UserCommand,
  MCPTool,
  isLLMSimpleTool,
  isLLMAgentTool,
  isSystemSimpleTool,
  isSystemAgentTool,
  isUserCommand,
  isMCPTool,
} from './types.js';

// Import all tools
import { FILE_SIMPLE_TOOLS } from './llm/simple/file-tools.js';
import { LLM_AGENT_TOOLS } from './llm/agents/index.js';
import { DOCS_SYSTEM_AGENT_TOOLS } from './system/agents/docs-search.js';
import { SYSTEM_SIMPLE_TOOLS } from './system/simple/index.js';
import { USER_COMMANDS } from './user/index.js';
import { MCP_TOOLS } from './mcp/index.js';

/**
 * Tool Registry class
 */
class ToolRegistry {
  private tools: Map<string, AnyTool> = new Map();
  private categoryIndex: Map<ToolCategory, Set<string>> = new Map();

  constructor() {
    // Initialize category index
    const categories: ToolCategory[] = [
      'llm-simple',
      'llm-agent',
      'system-simple',
      'system-agent',
      'user-command',
      'mcp',
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
   * Get all System Simple tools
   */
  getSystemSimpleTools(): SystemSimpleTool[] {
    return this.getByCategory('system-simple').filter(isSystemSimpleTool);
  }

  /**
   * Get all System Agent tools
   */
  getSystemAgentTools(): SystemAgentTool[] {
    return this.getByCategory('system-agent').filter(isSystemAgentTool);
  }

  /**
   * Get all User Commands
   */
  getUserCommands(): UserCommand[] {
    return this.getByCategory('user-command').filter(isUserCommand);
  }

  /**
   * Get all MCP tools
   */
  getMCPTools(): MCPTool[] {
    return this.getByCategory('mcp').filter(isMCPTool);
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
  getStats(): Record<ToolCategory, number> {
    const stats: Record<ToolCategory, number> = {
      'llm-simple': 0,
      'llm-agent': 0,
      'system-simple': 0,
      'system-agent': 0,
      'user-command': 0,
      'mcp': 0,
    };

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
  // LLM Simple Tools (file operations, etc.)
  toolRegistry.registerAll(FILE_SIMPLE_TOOLS);

  // LLM Agent Tools (complex operations with Sub-LLM)
  toolRegistry.registerAll(LLM_AGENT_TOOLS);

  // System Simple Tools (auto-triggered, no Sub-LLM)
  toolRegistry.registerAll(SYSTEM_SIMPLE_TOOLS as AnyTool[]);

  // System Agent Tools (auto-triggered with Sub-LLM)
  toolRegistry.registerAll(DOCS_SYSTEM_AGENT_TOOLS);

  // User Commands (/slash commands)
  toolRegistry.registerAll(USER_COMMANDS);

  // MCP Tools (external servers)
  toolRegistry.registerAll(MCP_TOOLS);
}

// Auto-initialize on import
initializeToolRegistry();

export default toolRegistry;
