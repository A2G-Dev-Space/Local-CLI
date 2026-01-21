/**
 * Config Manager for Electron Main Process
 * User settings management (theme, layout, directories)
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { logger } from '../../logger';

// =============================================================================
// Types
// =============================================================================

export interface AppConfig {
  theme: 'light' | 'dark' | 'system';
  lastOpenedDirectory?: string;
  recentDirectories: string[];
  sidebarWidth: number;
  bottomPanelHeight: number;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: AppConfig = {
  theme: 'light',
  recentDirectories: [],
  sidebarWidth: 260,
  bottomPanelHeight: 300,
};

// =============================================================================
// Config Manager Class
// =============================================================================

class ConfigManager {
  private configPath: string;
  private config: AppConfig;
  private initialized: boolean = false;

  constructor() {
    this.configPath = '';
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Get config directory path
   */
  getConfigDirectory(): string {
    return path.dirname(this.configPath);
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Initialize config manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Config file path (Windows: %APPDATA%\LOCAL-CLI-UI)
    const appDataPath = process.platform === 'win32'
      ? path.join(process.env.APPDATA || app.getPath('userData'), 'LOCAL-CLI-UI')
      : app.getPath('userData');
    this.configPath = path.join(appDataPath, 'config.json');

    logger.info('Config path', {
      configPath: this.configPath,
    });

    // Create config directory
    await this.ensureConfigDirectory();

    // Load existing config
    await this.load();

    this.initialized = true;
  }

  /**
   * Ensure config directory exists
   */
  private async ensureConfigDirectory(): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create config directory', error);
    }
  }

  /**
   * Load config from file
   */
  async load(): Promise<AppConfig> {
    try {
      const content = await fs.promises.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(content);
      this.config = { ...DEFAULT_CONFIG, ...loadedConfig };
      logger.info('Config loaded', { config: this.config });
    } catch (error) {
      // Use default config if file not found
      this.config = { ...DEFAULT_CONFIG };
      logger.info('Using default config (file not found)');
    }
    return this.config;
  }

  /**
   * Save config to file
   */
  async save(): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
      logger.debug('Config saved', { config: this.config });
    } catch (error) {
      logger.error('Failed to save config', error);
    }
  }

  /**
   * Get all config
   */
  getAll(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get specific config value
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * Set specific config value
   */
  async set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<void> {
    this.config[key] = value;
    await this.save();
  }

  /**
   * Update multiple config values
   */
  async update(updates: Partial<AppConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.save();
  }

  /**
   * Set theme
   */
  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.set('theme', theme);
  }

  /**
   * Get theme
   */
  getTheme(): 'light' | 'dark' | 'system' {
    return this.config.theme;
  }

  /**
   * Add recent directory
   */
  async addRecentDirectory(directory: string): Promise<void> {
    const recent = this.config.recentDirectories.filter(d => d !== directory);
    recent.unshift(directory);
    this.config.recentDirectories = recent.slice(0, 10); // Max 10
    this.config.lastOpenedDirectory = directory;
    await this.save();
  }

  /**
   * Get recent directories
   */
  getRecentDirectories(): string[] {
    return [...this.config.recentDirectories];
  }

  /**
   * Reset config to defaults
   */
  async reset(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.save();
  }
}

// =============================================================================
// Export
// =============================================================================

export const configManager = new ConfigManager();
export default configManager;
