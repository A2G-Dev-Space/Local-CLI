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
import { BROWSER_TOOLS, findChromePath } from './browser/index.js';
import { WORD_TOOLS, EXCEL_TOOLS, POWERPOINT_TOOLS, shutdownOfficeServer, startOfficeServer, registerOfficeGroupEnabled } from './office/index.js';
// Background bash tools are always enabled, imported in initializeToolRegistry
import { BACKGROUND_BASH_TOOLS } from './llm/simple/background-bash-tool.js';

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
 * Validation: Check if Chrome/Chromium is installed
 */
async function validateBrowserTools(): Promise<EnableResult> {
  const chromePath = findChromePath();
  if (!chromePath) {
    const platform = process.platform;
    let installGuide = '';
    if (platform === 'linux') {
      installGuide = `
Chrome이 설치되어 있지 않습니다.

설치 방법:
  Ubuntu/Debian: sudo apt install chromium-browser
  또는 Chrome 설치: https://www.google.com/chrome/

WSL에서 Windows Chrome 사용:
  Windows에 Chrome/Edge 설치 후 자동 감지됩니다.
  또는 CHROME_PATH 환경변수 설정`;
    } else if (platform === 'darwin') {
      installGuide = `
Chrome이 설치되어 있지 않습니다.

설치: https://www.google.com/chrome/`;
    } else {
      installGuide = `
Chrome이 설치되어 있지 않습니다.

설치: https://www.google.com/chrome/`;
    }
    return { success: false, error: installGuide.trim() };
  }
  return { success: true };
}

/**
 * Validation: Start Office server and check connection
 * Returns a factory that creates enable callbacks with groupId registration
 */
function createOfficeEnableCallback(groupId: string): () => Promise<EnableResult> {
  return async () => {
    try {
      const started = await startOfficeServer();
      if (!started) {
        return {
          success: false,
          error: `Office 서버에 연결할 수 없습니다.

WSL 사용 시 mirrored networking 설정이 필요합니다:
1. Windows에서 %USERPROFILE%\\.wslconfig 파일 생성
2. 다음 내용 추가:
   [wsl2]
   networkingMode=mirrored
3. PowerShell에서 'wsl --shutdown' 실행 후 WSL 재시작

자세한 내용: docs/05_OFFICE_TOOLS.md`,
        };
      }
      // Register this group as enabled for smart shutdown
      registerOfficeGroupEnabled(groupId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Office 서버 시작 실패: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };
}

/**
 * Create disable callback that passes groupId for smart shutdown
 */
function createOfficeDisableCallback(groupId: string): () => Promise<void> {
  return async () => {
    await shutdownOfficeServer(groupId);
  };
}

/**
 * Available optional tool groups
 * Note: Browser tools require Chrome to be installed, so they are optional
 * Note: Office tools require Windows + Microsoft Office + office-server.exe
 */
export const OPTIONAL_TOOL_GROUPS: OptionalToolGroup[] = [
  {
    id: 'browser',
    name: 'Browser Automation',
    description: 'Control Chrome browser for web testing (navigate, click, screenshot, etc.)',
    tools: BROWSER_TOOLS,
    enabled: false,
    onEnable: validateBrowserTools,
  },
  {
    id: 'word',
    name: 'Microsoft Word',
    description: 'Control Word for document editing (write, read, save, screenshot)',
    tools: WORD_TOOLS,
    enabled: false,
    onEnable: createOfficeEnableCallback('word'),
    onDisable: createOfficeDisableCallback('word'),
  },
  {
    id: 'excel',
    name: 'Microsoft Excel',
    description: 'Control Excel for spreadsheet editing (cells, ranges, formulas)',
    tools: EXCEL_TOOLS,
    enabled: false,
    onEnable: createOfficeEnableCallback('excel'),
    onDisable: createOfficeDisableCallback('excel'),
  },
  {
    id: 'powerpoint',
    name: 'Microsoft PowerPoint',
    description: 'Control PowerPoint for presentations (slides, text, images)',
    tools: POWERPOINT_TOOLS,
    enabled: false,
    onEnable: createOfficeEnableCallback('powerpoint'),
    onDisable: createOfficeDisableCallback('powerpoint'),
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
   * @param skipValidation - If true, skip onEnable validation (for restoring from config)
   * @returns EnableResult with success status and optional error message
   */
  async enableToolGroup(groupId: string, persist: boolean = true, skipValidation: boolean = false): Promise<EnableResult> {
    const group = this.optionalToolGroups.get(groupId);
    if (!group) {
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

    return { success: true };
  }

  /**
   * Disable an optional tool group
   * @param persist - If true, saves state to config (default: true)
   */
  async disableToolGroup(groupId: string, persist: boolean = true): Promise<boolean> {
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
