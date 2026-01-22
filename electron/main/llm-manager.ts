/**
 * LLM Manager for Electron UI
 * Reads from CLI's config at ~/.local-cli/config.json
 * Manages LLM endpoints and provides connection testing
 */

import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './utils/logger';

// Windows UI 전용 Config 경로 (CLI와 별도)
// config.json에 endpoints 정보 포함 (CLI와 동일한 구조)
function getUIConfigPath(): string {
  if (process.platform === 'win32') {
    // Windows: %APPDATA%\LOCAL-CLI-UI\config.json
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'LOCAL-CLI-UI', 'config.json');
  }
  // Linux/Mac: ~/.local-cli-ui/config.json
  return path.join(os.homedir(), '.local-cli-ui', 'config.json');
}

const UI_CONFIG_PATH = getUIConfigPath();
const UI_CONFIG_DIR = path.dirname(UI_CONFIG_PATH);

// Types matching CLI's types
export interface ModelInfo {
  id: string;
  name: string;
  maxTokens: number;
  enabled: boolean;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck?: Date;
  costPerMToken?: number;
}

export interface EndpointConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: ModelInfo[];
  createdAt?: Date;
  updatedAt?: Date;
}

// CLI's OpenConfig structure
interface OpenConfig {
  currentEndpoint?: string;
  currentModel?: string;
  endpoints: EndpointConfig[];
  settings: {
    autoApprove: boolean;
    debugMode: boolean;
    streamResponse: boolean;
    autoSave: boolean;
    maxTokens: number;
    temperature: number;
  };
}

interface SystemStatus {
  version: string;
  sessionId: string;
  workingDir: string;
  endpointUrl: string;
  llmModel: string;
  configPath: string;
}

/**
 * LLM Manager Class - reads/writes CLI config
 */
class LLMManager {
  private config: OpenConfig | null = null;
  private currentSessionId: string | null = null;

  constructor() {
    this.loadConfig();
  }

  /**
   * Load config from UI's config file
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(UI_CONFIG_PATH)) {
        const data = fs.readFileSync(UI_CONFIG_PATH, 'utf-8');
        this.config = JSON.parse(data);
        logger.info('Loaded UI LLM config', { path: UI_CONFIG_PATH, endpoints: this.config?.endpoints?.length || 0 });
      } else {
        logger.info('UI LLM config not found, using defaults', { path: UI_CONFIG_PATH });
        this.config = this.getDefaultConfig();
        // Save default config
        this.saveConfig();
      }
    } catch (error) {
      logger.error('Failed to load UI LLM config', error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Get default config
   */
  private getDefaultConfig(): OpenConfig {
    return {
      endpoints: [],
      settings: {
        autoApprove: false,
        debugMode: false,
        streamResponse: true,
        autoSave: true,
        maxTokens: 4096,
        temperature: 0.7,
      },
    };
  }

  /**
   * Save config to UI's config file
   */
  private saveConfig(): void {
    if (!this.config) return;

    try {
      // Ensure directory exists
      if (!fs.existsSync(UI_CONFIG_DIR)) {
        fs.mkdirSync(UI_CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(UI_CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.info('Saved UI LLM config', { path: UI_CONFIG_PATH });
    } catch (error) {
      logger.error('Failed to save UI LLM config', error);
    }
  }

  /**
   * Reload config from file (call this to refresh)
   */
  reloadConfig(): void {
    this.loadConfig();
  }

  /**
   * Get all endpoints
   */
  getEndpoints(): { endpoints: EndpointConfig[]; currentEndpointId?: string } {
    if (!this.config) this.loadConfig();

    return {
      endpoints: this.config?.endpoints || [],
      currentEndpointId: this.config?.currentEndpoint,
    };
  }

  /**
   * Get current endpoint
   */
  getCurrentEndpoint(): EndpointConfig | null {
    if (!this.config) return null;
    if (!this.config.currentEndpoint) return this.config.endpoints[0] || null;
    return this.config.endpoints.find((ep) => ep.id === this.config!.currentEndpoint) || null;
  }

  /**
   * Get current model
   */
  getCurrentModel(): ModelInfo | null {
    const endpoint = this.getCurrentEndpoint();
    if (!endpoint) return null;

    if (this.config?.currentModel) {
      return endpoint.models.find((m) => m.id === this.config!.currentModel) || endpoint.models[0] || null;
    }
    return endpoint.models[0] || null;
  }

  /**
   * Add endpoint
   */
  addEndpoint(endpointData: Omit<EndpointConfig, 'id' | 'createdAt' | 'updatedAt'>): EndpointConfig {
    if (!this.config) this.loadConfig();
    if (!this.config) this.config = this.getDefaultConfig();

    const endpoint: EndpointConfig = {
      ...endpointData,
      id: `ep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.config.endpoints.push(endpoint);

    // Set as current if first endpoint
    if (this.config.endpoints.length === 1) {
      this.config.currentEndpoint = endpoint.id;
    }

    this.saveConfig();
    logger.info('Endpoint added', { endpointId: endpoint.id, name: endpoint.name });

    return endpoint;
  }

  /**
   * Update endpoint
   */
  updateEndpoint(endpointId: string, updates: Partial<Omit<EndpointConfig, 'id' | 'createdAt'>>): boolean {
    if (!this.config) return false;

    const index = this.config.endpoints.findIndex((ep) => ep.id === endpointId);
    if (index === -1) return false;

    this.config.endpoints[index] = {
      ...this.config.endpoints[index],
      ...updates,
      updatedAt: new Date(),
    };

    this.saveConfig();
    logger.info('Endpoint updated', { endpointId });

    return true;
  }

  /**
   * Remove endpoint
   */
  removeEndpoint(endpointId: string): boolean {
    if (!this.config) return false;

    const index = this.config.endpoints.findIndex((ep) => ep.id === endpointId);
    if (index === -1) return false;

    this.config.endpoints.splice(index, 1);

    // Update current endpoint if removed
    if (this.config.currentEndpoint === endpointId) {
      this.config.currentEndpoint = this.config.endpoints[0]?.id;
    }

    this.saveConfig();
    logger.info('Endpoint removed', { endpointId });

    return true;
  }

  /**
   * Set current endpoint
   */
  setCurrentEndpoint(endpointId: string): boolean {
    if (!this.config) return false;

    const endpoint = this.config.endpoints.find((ep) => ep.id === endpointId);
    if (!endpoint) return false;

    this.config.currentEndpoint = endpointId;
    this.saveConfig();
    logger.info('Current endpoint set', { endpointId });

    return true;
  }

  /**
   * Set current model
   */
  setCurrentModel(modelId: string): boolean {
    if (!this.config) return false;

    const endpoint = this.getCurrentEndpoint();
    if (!endpoint) return false;

    const model = endpoint.models.find((m) => m.id === modelId);
    if (!model) return false;

    this.config.currentModel = modelId;
    this.saveConfig();

    return true;
  }

  /**
   * Test connection to an endpoint
   */
  async testConnection(
    baseUrl: string,
    apiKey: string | undefined,
    modelId: string
  ): Promise<{ success: boolean; error?: string; latency?: number }> {
    const startTime = Date.now();

    try {
      // Normalize base URL
      let url = baseUrl.trim();
      if (!url.endsWith('/')) url += '/';
      url += 'chat/completions';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText.substring(0, 200);
          }
        }

        return { success: false, error: errorMessage };
      }

      return { success: true, latency };
    } catch (error) {
      const latency = Date.now() - startTime;

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          return { success: false, error: 'Connection timeout', latency };
        }
        return { success: false, error: error.message, latency };
      }

      return { success: false, error: 'Unknown error', latency };
    }
  }

  /**
   * Health check all endpoints
   */
  async healthCheckAll(): Promise<void> {
    if (!this.config) return;

    for (const endpoint of this.config.endpoints) {
      for (const model of endpoint.models) {
        const result = await this.testConnection(
          endpoint.baseUrl,
          endpoint.apiKey,
          model.id
        );

        model.healthStatus = result.success ? 'healthy' : 'unhealthy';
        model.lastHealthCheck = new Date();
      }
    }

    this.saveConfig();
  }

  /**
   * Get system status
   */
  getStatus(): SystemStatus {
    const endpoint = this.getCurrentEndpoint();
    const model = this.getCurrentModel();

    return {
      version: app.getVersion(),
      sessionId: this.currentSessionId || 'No active session',
      workingDir: process.cwd(),
      endpointUrl: endpoint?.baseUrl || 'Not configured',
      llmModel: model ? `${model.name} (${model.id})` : 'Not configured',
      configPath: UI_CONFIG_PATH,
    };
  }

  /**
   * Set current session ID
   */
  setCurrentSessionId(sessionId: string | null): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Get UI config path
   */
  getConfigPath(): string {
    return UI_CONFIG_PATH;
  }

  /**
   * Check if UI config exists
   */
  configExists(): boolean {
    return fs.existsSync(UI_CONFIG_PATH);
  }
}

// Export singleton instance
export const llmManager = new LLMManager();
