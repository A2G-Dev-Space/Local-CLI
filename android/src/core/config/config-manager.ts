/**
 * Configuration Manager (Android)
 *
 * AsyncStorage 기반 설정 관리 (CLI의 fs 기반과 동일 로직)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OpenConfig, EndpointConfig, ModelInfo } from '../../types';
import { STORAGE_KEY_CONFIG } from '../constants';
import { logger } from '../../utils/logger';

const DEFAULT_CONFIG: OpenConfig = {
  version: '0.1.0',
  currentEndpoint: undefined,
  currentModel: undefined,
  endpoints: [],
  settings: {
    autoApprove: false,
    debugMode: false,
    streamResponse: true,
    autoSave: true,
  },
};

class ConfigManager {
  private config: OpenConfig | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    logger.enter('ConfigManager.initialize');
    if (this.initialized) return;

    await this.loadOrCreateConfig();
    this.initialized = true;
    logger.exit('ConfigManager.initialize', { success: true });
  }

  private async loadOrCreateConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) {
        this.config = JSON.parse(stored) as OpenConfig;
        logger.flow('Config loaded from AsyncStorage');
      } else {
        this.config = { ...DEFAULT_CONFIG };
        await this.saveConfig();
        logger.flow('Default config created');
      }
    } catch (error) {
      logger.error('Failed to load config', error);
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  async saveConfig(): Promise<void> {
    if (!this.config) return;
    try {
      await AsyncStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    } catch (error) {
      logger.error('Failed to save config', error);
    }
  }

  getConfig(): OpenConfig {
    if (!this.config) {
      throw new Error('ConfigManager not initialized');
    }
    return this.config;
  }

  getCurrentEndpoint(): EndpointConfig | undefined {
    if (!this.config) return undefined;
    const endpointId = this.config.currentEndpoint;
    if (!endpointId) return undefined;
    return this.config.endpoints.find(e => e.id === endpointId);
  }

  getCurrentModel(): ModelInfo | undefined {
    if (!this.config) return undefined;
    const endpoint = this.getCurrentEndpoint();
    if (!endpoint) return undefined;
    const modelId = this.config.currentModel;
    if (!modelId) return endpoint.models.find(m => m.enabled);
    return endpoint.models.find(m => m.id === modelId) || endpoint.models.find(m => m.enabled);
  }

  async addEndpoint(endpoint: EndpointConfig): Promise<void> {
    if (!this.config) return;
    this.config.endpoints.push(endpoint);
    if (!this.config.currentEndpoint) {
      this.config.currentEndpoint = endpoint.id;
      if (endpoint.models.length > 0) {
        this.config.currentModel = endpoint.models[0]!.id;
      }
    }
    await this.saveConfig();
  }

  async removeEndpoint(endpointId: string): Promise<void> {
    if (!this.config) return;
    this.config.endpoints = this.config.endpoints.filter(e => e.id !== endpointId);
    if (this.config.currentEndpoint === endpointId) {
      this.config.currentEndpoint = this.config.endpoints[0]?.id;
      this.config.currentModel = undefined;
    }
    await this.saveConfig();
  }

  async setCurrentEndpoint(endpointId: string): Promise<void> {
    if (!this.config) return;
    const endpoint = this.config.endpoints.find(e => e.id === endpointId);
    if (!endpoint) throw new Error(`Endpoint ${endpointId} not found`);
    this.config.currentEndpoint = endpointId;
    this.config.currentModel = endpoint.models.find(m => m.enabled)?.id;
    await this.saveConfig();
  }

  async setCurrentModel(modelId: string): Promise<void> {
    if (!this.config) return;
    this.config.currentModel = modelId;
    await this.saveConfig();
  }

  async updateSettings(settings: Partial<OpenConfig['settings']>): Promise<void> {
    if (!this.config) return;
    this.config.settings = { ...this.config.settings, ...settings };
    await this.saveConfig();
  }

  getEndpoints(): EndpointConfig[] {
    return this.config?.endpoints || [];
  }
}

export const configManager = new ConfigManager();
