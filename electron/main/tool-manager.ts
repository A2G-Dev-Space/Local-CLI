/**
 * Tool Manager for Electron
 * Manages optional tool groups (Browser, Office) with enable/disable support
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './utils/logger';
import { toolRegistry } from './tools/registry';

/**
 * Tool group interface
 */
export interface ToolGroup {
  id: string;
  name: string;
  description: string;
  toolCount: number;
  enabled: boolean;
  available: boolean;  // System requirements met
  requiresWindows?: boolean;
}

/**
 * Tool state persisted to disk
 */
interface ToolState {
  enabledTools: string[];
  lastUpdated: string;
}

/**
 * Tool Manager class
 */
class ToolManager {
  private configPath: string;
  private state: ToolState;
  private toolGroups: Map<string, ToolGroup>;

  constructor() {
    // Windows: %APPDATA%\LOCAL-CLI-UI, Linux/Mac: ~/.local-cli-ui
    const configDir = process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'LOCAL-CLI-UI')
      : path.join(os.homedir(), '.local-cli-ui');
    this.configPath = path.join(configDir, 'tools.json');
    this.state = { enabledTools: [], lastUpdated: new Date().toISOString() };
    this.toolGroups = new Map();

    // Initialize tool groups
    this.initializeToolGroups();

    // Load persisted state
    this.loadState();
  }

  /**
   * Initialize available tool groups
   */
  private initializeToolGroups(): void {
    const isWindows = process.platform === 'win32';
    const hasWindowsAccess = isWindows || this.checkWSLWindowsAccess();

    // Browser Automation Tools
    this.toolGroups.set('browser', {
      id: 'browser',
      name: 'Browser Automation',
      description: 'Control Chrome/Edge browser for web testing (navigate, click, screenshot, etc.)',
      toolCount: 8,
      enabled: false,
      available: true,  // CDP works on all platforms with Chrome/Edge
    });

    // Microsoft Word Tools
    this.toolGroups.set('word', {
      id: 'word',
      name: 'Microsoft Word',
      description: 'Control Word for document editing (write, read, save, export PDF)',
      toolCount: 6,
      enabled: false,
      available: hasWindowsAccess,
      requiresWindows: true,
    });

    // Microsoft Excel Tools
    this.toolGroups.set('excel', {
      id: 'excel',
      name: 'Microsoft Excel',
      description: 'Control Excel for spreadsheet editing (cells, ranges, formulas, charts)',
      toolCount: 8,
      enabled: false,
      available: hasWindowsAccess,
      requiresWindows: true,
    });

    // Microsoft PowerPoint Tools
    this.toolGroups.set('powerpoint', {
      id: 'powerpoint',
      name: 'Microsoft PowerPoint',
      description: 'Control PowerPoint for presentations (slides, shapes, transitions)',
      toolCount: 6,
      enabled: false,
      available: hasWindowsAccess,
      requiresWindows: true,
    });
  }

  /**
   * Check if WSL has Windows access
   */
  private checkWSLWindowsAccess(): boolean {
    try {
      // Check for WSL indicator
      if (!fs.existsSync('/proc/version')) return false;
      const version = fs.readFileSync('/proc/version', 'utf-8');
      if (!version.toLowerCase().includes('microsoft')) return false;

      // Check for Windows drive mount
      return fs.existsSync('/mnt/c/Windows');
    } catch {
      return false;
    }
  }

  /**
   * Load state from disk (sync - just loads the state)
   */
  private loadState(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.state = JSON.parse(data);
        logger.info('Tool state loaded', { enabledTools: this.state.enabledTools });
      }
    } catch (error) {
      logger.error('Failed to load tool state', error);
    }
  }

  /**
   * Initialize - enable saved tool groups in registry
   * This should be awaited before using the agent
   */
  async initialize(): Promise<void> {
    const enablePromises: Promise<void>[] = [];

    for (const toolId of this.state.enabledTools) {
      const group = this.toolGroups.get(toolId);
      if (group && group.available) {
        group.enabled = true;
        enablePromises.push(
          toolRegistry.enableToolGroup(toolId).then(result => {
            if (result.success) {
              logger.info(`Tool group enabled in registry: ${toolId}`);
            } else {
              logger.error(`Failed to enable tool group in registry: ${toolId}`, { error: result.error });
            }
          }).catch(err => {
            logger.error(`Failed to enable tool group in registry: ${toolId}`, err);
          })
        );
      }
    }

    await Promise.all(enablePromises);
    logger.info('Tool manager initialized', {
      enabled: this.state.enabledTools,
      registryStats: toolRegistry.getStats()
    });
  }

  /**
   * Save state to disk
   */
  private saveState(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.state.enabledTools = Array.from(this.toolGroups.values())
        .filter(g => g.enabled)
        .map(g => g.id);
      this.state.lastUpdated = new Date().toISOString();

      fs.writeFileSync(this.configPath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      logger.error('Failed to save tool state', error);
    }
  }

  /**
   * Get all tool groups
   */
  getToolGroups(): ToolGroup[] {
    return Array.from(this.toolGroups.values());
  }

  /**
   * Get available tool groups (system requirements met)
   */
  getAvailableToolGroups(): ToolGroup[] {
    return Array.from(this.toolGroups.values()).filter(g => g.available);
  }

  /**
   * Get enabled tool groups
   */
  getEnabledToolGroups(): ToolGroup[] {
    return Array.from(this.toolGroups.values()).filter(g => g.enabled);
  }

  /**
   * Check if a tool group is enabled
   */
  isEnabled(groupId: string): boolean {
    return this.toolGroups.get(groupId)?.enabled ?? false;
  }

  /**
   * Enable a tool group
   */
  async enableToolGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    const group = this.toolGroups.get(groupId);
    if (!group) {
      return { success: false, error: `Tool group '${groupId}' not found` };
    }

    if (!group.available) {
      return { success: false, error: `Tool group '${groupId}' is not available on this system` };
    }

    // Enable in tool registry (registers tool implementations)
    const registryResult = await toolRegistry.enableToolGroup(groupId);
    if (!registryResult.success) {
      logger.error(`Failed to enable tool group in registry: ${groupId}`, { error: registryResult.error });
      return registryResult;
    }

    // Perform any initialization needed
    if (groupId === 'browser') {
      // Browser tools require Chrome/Edge - actual check happens at runtime
      logger.info('Browser tools enabled - Chrome/Edge will be detected at runtime');
    }

    group.enabled = true;
    this.saveState();

    logger.info(`Tool group enabled: ${groupId}`, { toolCount: group.toolCount });
    return { success: true };
  }

  /**
   * Disable a tool group
   */
  async disableToolGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    const group = this.toolGroups.get(groupId);
    if (!group) {
      return { success: false, error: `Tool group '${groupId}' not found` };
    }

    // Disable in tool registry (unregisters tool implementations)
    await toolRegistry.disableToolGroup(groupId);

    group.enabled = false;
    this.saveState();

    logger.info(`Tool group disabled: ${groupId}`);
    return { success: true };
  }

  /**
   * Toggle a tool group
   */
  async toggleToolGroup(groupId: string): Promise<{ success: boolean; enabled?: boolean; error?: string }> {
    const group = this.toolGroups.get(groupId);
    if (!group) {
      return { success: false, error: `Tool group '${groupId}' not found` };
    }

    if (group.enabled) {
      const result = await this.disableToolGroup(groupId);
      return { ...result, enabled: false };
    } else {
      const result = await this.enableToolGroup(groupId);
      return { ...result, enabled: result.success };
    }
  }

  /**
   * Get tool summary for display
   */
  getSummary(): {
    total: number;
    available: number;
    enabled: number;
    groups: ToolGroup[];
  } {
    const groups = this.getToolGroups();
    return {
      total: groups.length,
      available: groups.filter(g => g.available).length,
      enabled: groups.filter(g => g.enabled).length,
      groups,
    };
  }
}

// Export singleton instance
export const toolManager = new ToolManager();
export default toolManager;
