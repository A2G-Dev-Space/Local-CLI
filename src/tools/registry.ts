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
import { logger } from '../utils/logger.js';

// Import platform utilities
import { hasWindowsAccess } from '../utils/platform-utils.js';

// Import active tools
import { FILE_TOOLS, SYSTEM_TOOLS } from './llm/simple/file-tools.js';
import { USER_INTERACTION_TOOLS } from './llm/simple/user-interaction-tools.js';
import { TODO_TOOLS } from './llm/simple/todo-tools.js';
import { PLANNING_TOOLS } from './llm/simple/planning-tools.js';
import { FinalResponseTool } from './llm/simple/final-response-tool.js';
import { docsSearchAgentTool } from './llm/simple/docs-search-agent-tool.js';
import { LLM_AGENT_TOOLS } from './llm/agents/index.js';
import { getShellTools } from './llm/simple/index.js';

// Import optional tools
import { BROWSER_TOOLS, startBrowserServer, shutdownBrowserServer } from './browser/index.js';
import { WORD_TOOLS, EXCEL_TOOLS, POWERPOINT_TOOLS } from './office/index.js';

/**
 * Enable result with optional error message
 */
export interface EnableResult {
  success: boolean;
  error?: string;
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
  onEnable?: () => Promise<EnableResult>;  // Validation callback when enabling
  onDisable?: () => Promise<void>;  // Cleanup callback when disabled
}

/**
 * Validation: Check if browser tools are available
 * CDP 방식에서는 별도 서버가 필요 없음
 */
async function validateBrowserTools(): Promise<EnableResult> {
  // CDP 방식에서는 server.exe가 필요 없음
  // 브라우저(Chrome/Edge)가 설치되어 있으면 사용 가능
  // 실제 브라우저 유무는 launch 시 확인됨
  try {
    // startBrowserServer는 CDP 방식에서 항상 true 반환
    await startBrowserServer();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Browser 도구 활성화 실패: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Available optional tool groups
 * Note: Browser tools require Chrome to be installed, so they are optional
 * Note: Office tools require Windows + Microsoft Office (PowerShell COM automation)
 *
 * Office tools are only available on Native Windows and WSL (where Windows access is possible)
 */
function getOptionalToolGroupsConfig(): OptionalToolGroup[] {
  const groups: OptionalToolGroup[] = [
    {
      id: 'browser',
      name: 'Browser Automation',
      description: 'Control Chrome/Edge browser for web testing (navigate, click, screenshot, etc.)',
      tools: BROWSER_TOOLS,
      enabled: false,
      onEnable: validateBrowserTools,
      onDisable: shutdownBrowserServer,
    },
  ];

  // Office tools only available with Windows access
  if (hasWindowsAccess()) {
    groups.push(
      {
        id: 'word',
        name: 'Microsoft Word',
        description: 'Control Word for document editing (write, read, save, export PDF, header/footer)',
        tools: WORD_TOOLS,
        enabled: false,
      },
      {
        id: 'excel',
        name: 'Microsoft Excel',
        description: 'Control Excel for spreadsheet editing (cells, ranges, formulas, charts)',
        tools: EXCEL_TOOLS,
        enabled: false,
      },
      {
        id: 'powerpoint',
        name: 'Microsoft PowerPoint',
        description: 'Control PowerPoint for presentations (slides, shapes, transitions, PDF export)',
        tools: POWERPOINT_TOOLS,
        enabled: false,
      }
    );
  }

  return groups;
}

export const OPTIONAL_TOOL_GROUPS: OptionalToolGroup[] = getOptionalToolGroupsConfig();

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
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
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
   * @param skipValidation - If true, skip onEnable validation (for restoring from config)
   * @returns EnableResult with success status and optional error message
   */
  async enableToolGroup(groupId: string, persist: boolean = true, skipValidation: boolean = false): Promise<EnableResult> {
    logger.enter('enableToolGroup', { groupId, persist, skipValidation });
    const group = this.optionalToolGroups.get(groupId);
    if (!group) {
      logger.error('Tool group not found', { groupId });
      return { success: false, error: `Tool group '${groupId}' not found` };
    }

    // Run validation if onEnable callback exists (unless skipped)
    if (!skipValidation && group.onEnable) {
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

    // Persist state to config
    if (persist) {
      configManager.enableTool(groupId).catch(() => {
        // Ignore errors if config not initialized
      });
    }

    logger.info(`Tool group enabled: ${groupId}`, { toolCount: group.tools.length });
    logger.exit('enableToolGroup', { success: true });
    return { success: true };
  }

  /**
   * Disable an optional tool group
   * @param persist - If true, saves state to config (default: true)
   */
  async disableToolGroup(groupId: string, persist: boolean = true): Promise<boolean> {
    logger.enter('disableToolGroup', { groupId, persist });
    const group = this.optionalToolGroups.get(groupId);
    if (!group) {
      logger.warn('Tool group not found for disable', { groupId });
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

    // Call onDisable callback (e.g., shutdown Office server)
    if (group.onDisable) {
      try {
        await group.onDisable();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Persist state to config
    if (persist) {
      configManager.disableTool(groupId).catch(() => {
        // Ignore errors if config not initialized
      });
    }

    logger.info(`Tool group disabled: ${groupId}`);
    logger.exit('disableToolGroup', { success: true });
    return true;
  }

  /**
   * Toggle an optional tool group
   * @returns EnableResult with success status and optional error message
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
   * Get IDs of all enabled optional tool groups
   */
  getEnabledToolGroupIds(): string[] {
    return Array.from(this.optionalToolGroups.values())
      .filter(g => g.enabled)
      .map(g => g.id);
  }

  /**
   * Get tool count statistics
   */
  getStats(): { total: number; core: number; optional: number; categories: Record<string, number> } {
    const stats: Record<string, number> = {};
    for (const [category, names] of this.categoryIndex) {
      stats[category] = names.size;
    }

    const coreCount = FILE_TOOLS.length + USER_INTERACTION_TOOLS.length + TODO_TOOLS.length + SYSTEM_TOOLS.length + 2; // +2 for final_response and docs_search
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

  /**
   * Get tool summary for planning prompt
   * Returns formatted string with tool names and descriptions
   * Includes: always-on tools + enabled optional tools
   */
  getToolSummaryForPlanning(): string {
    const lines: string[] = [];

    // Get all LLM Simple tools (always-on)
    const simpleTools = this.getLLMSimpleTools();

    for (const tool of simpleTools) {
      const name = tool.definition.function.name;
      const desc = tool.definition.function.description?.split('\n')[0] || '';
      // Truncate long descriptions
      const shortDesc = desc.length > 80 ? desc.slice(0, 77) + '...' : desc;
      lines.push(`- \`${name}\`: ${shortDesc}`);
    }

    return lines.join('\n');
  }

  /**
   * Get enabled optional tools info for planning prompt
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

  // LLM Simple Tools - System utilities (bash on WSL/Linux, or powershell on Native Windows)
  toolRegistry.registerAll(SYSTEM_TOOLS);

  // LLM Simple Tools - Shell tools (platform-specific)
  // Native Windows: powershell + powershell_background_*
  // WSL/Linux: bash + bash_background_*
  const shellTools = getShellTools();
  toolRegistry.registerAll(shellTools);

  // LLM Simple Tools - TODO management
  toolRegistry.registerAll(TODO_TOOLS);

  // LLM Simple Tools - Final response (required for completing tasks)
  toolRegistry.register(FinalResponseTool);

  // LLM Planning Tools - create_todos (for task planning)
  toolRegistry.registerAll(PLANNING_TOOLS);

  // LLM Simple Tools - Docs Search Agent (callable by main LLM)
  toolRegistry.register(docsSearchAgentTool);

  // LLM Agent Tools (docs-search internal tools)
  toolRegistry.registerAll(LLM_AGENT_TOOLS);

  // Note: Optional tools (Browser, Word, Excel, PowerPoint) are registered via /tool command
  // Office tools only available when hasWindowsAccess() is true
}

/**
 * Initialize optional tool groups from saved config
 * Call this AFTER configManager.initialize() is complete
 */
export async function initializeOptionalTools(): Promise<void> {
  try {
    const enabledToolIds = configManager.getEnabledTools();
    for (const toolId of enabledToolIds) {
      // Skip validation when restoring from config
      // persist=false to avoid re-saving, skipValidation=true for fast startup
      await toolRegistry.enableToolGroup(toolId, false, true);
    }
  } catch {
    // Config not initialized yet, skip loading saved state
  }
}

// Auto-initialize on import
initializeToolRegistry();

export default toolRegistry;
