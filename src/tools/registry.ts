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
 * - Optional tools with enable/disable support
 * - Persistent tool state across sessions
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
import { configManager } from '../core/config/config-manager.js';

// Import active tools
import { FILE_TOOLS, SYSTEM_TOOLS } from './llm/simple/file-tools.js';
import { USER_INTERACTION_TOOLS } from './llm/simple/user-interaction-tools.js';
import { TODO_TOOLS } from './llm/simple/todo-tools.js';
import { PLANNING_TOOLS } from './llm/simple/planning-tools.js';
import { docsSearchAgentTool } from './llm/simple/docs-search-agent-tool.js';
import { LLM_AGENT_TOOLS } from './llm/agents/index.js';

// Import optional tools
import { BROWSER_TOOLS } from './browser/index.js';
// Background bash tools are always enabled, imported in initializeToolRegistry
import { BACKGROUND_BASH_TOOLS } from './llm/simple/background-bash-tool.js';

/**
 * Optional tool group definition
 */
export interface OptionalToolGroup {
  id: string;
  name: string;
  description: string;
  tools: LLMSimpleTool[];
  enabled: boolean;
}

/**
 * Available optional tool groups
 * Note: Browser tools require Chrome to be installed, so they are optional
 */
export const OPTIONAL_TOOL_GROUPS: OptionalToolGroup[] = [
  {
    id: 'browser',
    name: 'Browser Automation',
    description: 'Control Chrome browser for web testing (navigate, click, screenshot, etc.)',
    tools: BROWSER_TOOLS,
    enabled: false,  // Disabled by default
  },
];

// Re-export for use in initializeToolRegistry
export { BACKGROUND_BASH_TOOLS };

/**
 * Tool Registry class
 */
class ToolRegistry {
  private tools: Map<string, AnyTool> = new Map();
  private categoryIndex: Map<ToolCategory, Set<string>> = new Map();
  private optionalToolGroups: Map<string, OptionalToolGroup> = new Map();
  private enabledOptionalTools: Set<string> = new Set();

  constructor() {
    // Initialize category index for active categories
    const categories: ToolCategory[] = [
      'llm-simple',
      'llm-agent',
      'llm-planning',
    ];
    for (const category of categories) {
      this.categoryIndex.set(category, new Set());
    }

    // Initialize optional tool groups
    for (const group of OPTIONAL_TOOL_GROUPS) {
      this.optionalToolGroups.set(group.id, { ...group });
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
   * Get all LLM Planning tools
   */
  getLLMPlanningTools(): LLMSimpleTool[] {
    return this.getByCategory('llm-planning').filter(isLLMSimpleTool);
  }

  /**
   * Get LLM Planning tool definitions (for Planning LLM)
   */
  getLLMPlanningToolDefinitions(): ToolDefinition[] {
    return this.getLLMPlanningTools().map((tool) => tool.definition);
  }

  /**
   * Get all LLM tool definitions (for chatCompletion)
   * Includes both LLM Simple and LLM Agent tools (excludes Planning tools)
   * Note: Enabled optional tools are already included via enableToolGroup() registration
   */
  getLLMToolDefinitions(): ToolDefinition[] {
    const llmTools = [
      ...this.getLLMSimpleTools(),
      ...this.getLLMAgentTools(),
    ];

    return llmTools.map((tool) => tool.definition);
  }

  /**
   * Enable an optional tool group
   * @param persist - If true, saves state to config (default: true)
   */
  enableToolGroup(groupId: string, persist: boolean = true): boolean {
    const group = this.optionalToolGroups.get(groupId);
    if (!group) {
      return false;
    }

    group.enabled = true;

    // Register tools to the main registry
    for (const tool of group.tools) {
      this.register(tool);
      this.enabledOptionalTools.add(tool.definition.function.name);
    }

    // Persist state to config
    if (persist) {
      configManager.enableTool(groupId).catch(() => {
        // Ignore errors if config not initialized
      });
    }

    return true;
  }

  /**
   * Disable an optional tool group
   * @param persist - If true, saves state to config (default: true)
   */
  disableToolGroup(groupId: string, persist: boolean = true): boolean {
    const group = this.optionalToolGroups.get(groupId);
    if (!group) {
      return false;
    }

    group.enabled = false;

    // Remove tools from the main registry
    for (const tool of group.tools) {
      const toolName = tool.definition.function.name;
      this.tools.delete(toolName);
      this.enabledOptionalTools.delete(toolName);

      // Remove from category index
      for (const category of tool.categories) {
        this.categoryIndex.get(category)?.delete(toolName);
      }
    }

    // Persist state to config
    if (persist) {
      configManager.disableTool(groupId).catch(() => {
        // Ignore errors if config not initialized
      });
    }

    return true;
  }

  /**
   * Toggle an optional tool group
   */
  toggleToolGroup(groupId: string): boolean {
    const group = this.optionalToolGroups.get(groupId);
    if (!group) {
      return false;
    }

    if (group.enabled) {
      return this.disableToolGroup(groupId);
    } else {
      return this.enableToolGroup(groupId);
    }
  }

  /**
   * Get all optional tool groups with their current state
   */
  getOptionalToolGroups(): OptionalToolGroup[] {
    return Array.from(this.optionalToolGroups.values());
  }

  /**
   * Check if an optional tool group is enabled
   */
  isToolGroupEnabled(groupId: string): boolean {
    return this.optionalToolGroups.get(groupId)?.enabled ?? false;
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
  // LLM Simple Tools - File operations (read, create, edit, list, find)
  toolRegistry.registerAll(FILE_TOOLS);

  // LLM Simple Tools - User interaction (tell_to_user, ask_to_user)
  toolRegistry.registerAll(USER_INTERACTION_TOOLS);

  // LLM Simple Tools - System utilities (bash)
  toolRegistry.registerAll(SYSTEM_TOOLS);

  // LLM Simple Tools - Background process management (bash_background, bash_background_status, bash_background_kill)
  toolRegistry.registerAll(BACKGROUND_BASH_TOOLS);

  // LLM Simple Tools - TODO management
  toolRegistry.registerAll(TODO_TOOLS);

  // LLM Planning Tools - create_todos (for task planning)
  toolRegistry.registerAll(PLANNING_TOOLS);

  // LLM Simple Tools - Docs Search Agent (callable by main LLM)
  toolRegistry.register(docsSearchAgentTool);

  // LLM Agent Tools (docs-search internal tools)
  toolRegistry.registerAll(LLM_AGENT_TOOLS);

  // Note: Optional tools (Browser) are registered via /tool command
}

/**
 * Initialize optional tool groups from saved config
 * Call this AFTER configManager.initialize() is complete
 */
export async function initializeOptionalTools(): Promise<void> {
  try {
    const enabledToolIds = configManager.getEnabledTools();
    for (const toolId of enabledToolIds) {
      toolRegistry.enableToolGroup(toolId);
    }
  } catch {
    // Config not initialized yet, skip loading saved state
  }
}

// Auto-initialize on import
initializeToolRegistry();

export default toolRegistry;
