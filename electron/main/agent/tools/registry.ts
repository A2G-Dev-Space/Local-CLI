/**
 * Tool Registry for Electron Agent
 *
 * Central tool registration system (CLI style)
 * - Multi-category registration
 * - Type-safe tool retrieval
 * - LLM tool definitions export
 * - Optional tools with enable/disable support
 *
 * Total Tools: 214
 * - Core: 14 (file 6, powershell 4, todo 1, user 2, docs 1)
 * - Browser: 18
 * - Word: 52
 * - Excel: 62
 * - PowerPoint: 68
 */

import type { ToolDefinition } from '../../llm-client';
import type { LLMSimpleTool, ToolCategory } from './common/types';

// Import Core Tools
import { FILE_TOOLS, setWorkingDirectory as setFileWorkingDir, getWorkingDirectory as getFileWorkingDir } from './file';
import { POWERSHELL_TOOLS, setWorkingDirectory as setPSWorkingDir } from './powershell';
import { TODO_TOOLS, setTodoWriteCallback, TodoItem, TodoWriteCallback } from './todo';
import { USER_TOOLS, setTellToUserCallback, setAskUserCallback, TellToUserCallback, AskUserCallback, AskUserRequest, AskUserResponse } from './user';
import { DOCS_TOOLS } from './docs';

// Import Optional Tools (Office & Browser)
import { BROWSER_TOOLS } from './browser';
import { WORD_TOOLS } from './word';
import { EXCEL_TOOLS } from './excel';
import { POWERPOINT_TOOLS } from './powerpoint';

// =============================================================================
// Types
// =============================================================================

export interface EnableResult {
  success: boolean;
  error?: string;
}

export interface OptionalToolGroup {
  id: string;
  name: string;
  description: string;
  tools: LLMSimpleTool[];
  enabled: boolean;
  onEnable?: () => Promise<EnableResult>;
  onDisable?: () => Promise<void>;
}

// =============================================================================
// Optional Tool Groups Configuration
// =============================================================================

function getOptionalToolGroupsConfig(): OptionalToolGroup[] {
  return [
    {
      id: 'browser',
      name: 'Browser Automation',
      description: 'Control Chrome/Edge browser (navigate, click, screenshot, etc.)',
      tools: BROWSER_TOOLS,
      enabled: false,
    },
    {
      id: 'word',
      name: 'Microsoft Word',
      description: 'Control Word for document editing (52 tools)',
      tools: WORD_TOOLS,
      enabled: false,
    },
    {
      id: 'excel',
      name: 'Microsoft Excel',
      description: 'Control Excel for spreadsheet editing (62 tools)',
      tools: EXCEL_TOOLS,
      enabled: false,
    },
    {
      id: 'powerpoint',
      name: 'Microsoft PowerPoint',
      description: 'Control PowerPoint for presentations (68 tools)',
      tools: POWERPOINT_TOOLS,
      enabled: false,
    },
  ];
}

// =============================================================================
// Tool Registry Class
// =============================================================================

class ToolRegistry {
  private tools: Map<string, LLMSimpleTool> = new Map();
  private categoryIndex: Map<ToolCategory, Set<string>> = new Map();
  private optionalToolGroups: Map<string, OptionalToolGroup> = new Map();
  private enabledOptionalTools: Set<string> = new Set();

  constructor() {
    // Initialize category index
    const categories: ToolCategory[] = ['llm-simple', 'llm-agent', 'llm-planning'];
    for (const category of categories) {
      this.categoryIndex.set(category, new Set());
    }

    // Initialize optional tool groups
    for (const group of getOptionalToolGroupsConfig()) {
      this.optionalToolGroups.set(group.id, { ...group });
    }
  }

  /**
   * Register a tool
   */
  register(tool: LLMSimpleTool): void {
    const name = tool.definition.function.name;
    this.tools.set(name, tool);

    // Index by categories
    for (const category of tool.categories) {
      this.categoryIndex.get(category)?.add(name);
    }
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: LLMSimpleTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get tool by name
   */
  get(name: string): LLMSimpleTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all tools in a category
   */
  getByCategory(category: ToolCategory): LLMSimpleTool[] {
    const names = this.categoryIndex.get(category) || new Set();
    return Array.from(names)
      .map((name) => this.tools.get(name))
      .filter((tool): tool is LLMSimpleTool => tool !== undefined);
  }

  /**
   * Get all LLM Simple tools
   */
  getLLMSimpleTools(): LLMSimpleTool[] {
    return this.getByCategory('llm-simple');
  }

  /**
   * Get all LLM tool definitions (for chatCompletion)
   */
  getLLMToolDefinitions(): ToolDefinition[] {
    return this.getLLMSimpleTools().map((tool) => tool.definition);
  }

  /**
   * Enable an optional tool group
   */
  async enableToolGroup(groupId: string): Promise<EnableResult> {
    const group = this.optionalToolGroups.get(groupId);
    if (!group) {
      return { success: false, error: `Tool group '${groupId}' not found` };
    }

    // Run validation if onEnable callback exists
    if (group.onEnable) {
      const result = await group.onEnable();
      if (!result.success) {
        return result;
      }
    }

    group.enabled = true;

    // Register tools to the main registry
    for (const tool of group.tools) {
      this.register(tool);
      this.enabledOptionalTools.add(tool.definition.function.name);
    }

    return { success: true };
  }

  /**
   * Disable an optional tool group
   */
  async disableToolGroup(groupId: string): Promise<boolean> {
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

    // Call onDisable callback
    if (group.onDisable) {
      try {
        await group.onDisable();
      } catch {
        // Ignore cleanup errors
      }
    }

    return true;
  }

  /**
   * Toggle an optional tool group
   */
  async toggleToolGroup(groupId: string): Promise<EnableResult> {
    const group = this.optionalToolGroups.get(groupId);
    if (!group) {
      return { success: false, error: `Tool group '${groupId}' not found` };
    }

    if (group.enabled) {
      const success = await this.disableToolGroup(groupId);
      return { success };
    } else {
      return await this.enableToolGroup(groupId);
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
   * Get enabled optional tool group IDs
   * Returns array of group IDs that are currently enabled
   */
  getEnabledToolGroupIds(): string[] {
    return Array.from(this.optionalToolGroups.values())
      .filter(g => g.enabled)
      .map(g => g.id);
  }

  /**
   * Get enabled optional tools info for planning prompt
   * Returns formatted string describing enabled optional tools
   */
  getEnabledOptionalToolsInfo(): string {
    const enabledGroups = Array.from(this.optionalToolGroups.values())
      .filter(g => g.enabled);

    if (enabledGroups.length === 0) {
      return '';
    }

    const lines: string[] = ['', '**Currently enabled optional tools:**'];
    for (const group of enabledGroups) {
      lines.push(`- **${group.name}**: ${group.description}`);
    }
    return lines.join('\n');
  }

  /**
   * Get tool count statistics
   */
  getStats(): { total: number; core: number; optional: number; categories: Record<string, number> } {
    const stats: Record<string, number> = {};
    for (const [category, names] of this.categoryIndex) {
      stats[category] = names.size;
    }

    const coreCount = FILE_TOOLS.length + POWERSHELL_TOOLS.length + TODO_TOOLS.length + USER_TOOLS.length + DOCS_TOOLS.length;
    const optionalCount = this.enabledOptionalTools.size;

    return {
      total: this.tools.size,
      core: coreCount,
      optional: optionalCount,
      categories: stats,
    };
  }

  /**
   * List all registered tool names
   */
  listAll(): string[] {
    return Array.from(this.tools.keys());
  }
}

// =============================================================================
// Global Registry Instance
// =============================================================================

export const toolRegistry = new ToolRegistry();

// =============================================================================
// Initialize Registry
// =============================================================================

export function initializeToolRegistry(): void {
  // Register Core Tools
  toolRegistry.registerAll(FILE_TOOLS);       // 6 tools
  toolRegistry.registerAll(POWERSHELL_TOOLS); // 4 tools
  toolRegistry.registerAll(TODO_TOOLS);       // 1 tool
  toolRegistry.registerAll(USER_TOOLS);       // 2 tools
  toolRegistry.registerAll(DOCS_TOOLS);       // 1 tool
  // Total Core: 14 tools

  // Note: Optional tools (Browser, Word, Excel, PowerPoint) are registered via enableToolGroup()
  // Browser: 18 tools
  // Word: 52 tools
  // Excel: 62 tools
  // PowerPoint: 68 tools
  // Total Optional: 200 tools
}

// =============================================================================
// Working Directory Management
// =============================================================================

export function setWorkingDirectory(dir: string): void {
  setFileWorkingDir(dir);
  setPSWorkingDir(dir);
}

export function getWorkingDirectory(): string {
  return getFileWorkingDir();
}

// =============================================================================
// Callback Exports (re-export from tool modules)
// =============================================================================

export {
  setTodoWriteCallback,
  setTellToUserCallback,
  setAskUserCallback,
};

export type {
  TodoItem,
  TodoWriteCallback,
  TellToUserCallback,
  AskUserCallback,
  AskUserRequest,
  AskUserResponse,
};

// =============================================================================
// Auto-initialize on import
// =============================================================================

initializeToolRegistry();

export default toolRegistry;
