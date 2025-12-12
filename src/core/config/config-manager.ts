/**
 * Configuration Manager
 *
 * LOCAL-CLI 설정 관리 시스템
 * ~/.local-cli/ 디렉토리 및 설정 파일 관리
 */

import { OpenConfig, EndpointConfig, ModelInfo } from '../../types/index.js';
import {
  OPEN_HOME_DIR,
  CONFIG_FILE_PATH,
  DOCS_DIR,
  BACKUPS_DIR,
  PROJECTS_DIR,
} from '../../constants.js';
import {
  ensureDirectory,
  readJsonFile,
  writeJsonFile,
  directoryExists,
} from '../../utils/file-system.js';

/**
 * 기본 설정 (빈 엔드포인트)
 */
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

/**
 * ConfigManager 클래스
 *
 * 설정 파일 및 디렉토리 관리
 */
export class ConfigManager {
  private config: OpenConfig | null = null;
  private initialized = false;

  /**
   * LOCAL-CLI 초기화
   * ~/.local-cli/ 디렉토리 및 설정 파일 생성
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 홈 디렉토리 생성
    await ensureDirectory(OPEN_HOME_DIR);

    // 하위 디렉토리 생성
    await ensureDirectory(DOCS_DIR);
    await ensureDirectory(BACKUPS_DIR);
    await ensureDirectory(PROJECTS_DIR);

    // 설정 파일 로드 또는 생성
    await this.loadOrCreateConfig();

    this.initialized = true;
  }

  /**
   * 설정 파일 로드 또는 기본 설정 생성
   */
  private async loadOrCreateConfig(): Promise<void> {
    const existingConfig = await readJsonFile<OpenConfig>(CONFIG_FILE_PATH);

    if (existingConfig) {
      this.config = existingConfig;
    } else {
      // 기본 설정 생성
      this.config = { ...DEFAULT_CONFIG };
      await this.saveConfig();
    }
  }

  /**
   * 설정 저장
   */
  async saveConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }

    await writeJsonFile(CONFIG_FILE_PATH, this.config);
  }

  /**
   * 현재 설정 가져오기
   */
  getConfig(): OpenConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }

    return this.config;
  }

  /**
   * 현재 엔드포인트 가져오기
   */
  getCurrentEndpoint(): EndpointConfig | null {
    const config = this.getConfig();

    if (!config.currentEndpoint) {
      return null;
    }

    return config.endpoints.find((ep) => ep.id === config.currentEndpoint) || null;
  }

  /**
   * 현재 모델 정보 가져오기
   */
  getCurrentModel(): ModelInfo | null {
    const endpoint = this.getCurrentEndpoint();

    if (!endpoint || !this.config?.currentModel) {
      return null;
    }

    return endpoint.models.find((m) => m.id === this.config?.currentModel) || null;
  }

  /**
   * 모든 엔드포인트 가져오기
   */
  getAllEndpoints(): EndpointConfig[] {
    return this.getConfig().endpoints;
  }

  /**
   * 엔드포인트 추가
   */
  async addEndpoint(endpoint: EndpointConfig): Promise<void> {
    const config = this.getConfig();

    // ID 중복 체크
    const exists = config.endpoints.some((ep) => ep.id === endpoint.id);
    if (exists) {
      throw new Error(`Endpoint with ID ${endpoint.id} already exists`);
    }

    config.endpoints.push(endpoint);
    await this.saveConfig();
  }

  /**
   * 엔드포인트 삭제
   */
  async removeEndpoint(endpointId: string): Promise<void> {
    const config = this.getConfig();

    config.endpoints = config.endpoints.filter((ep) => ep.id !== endpointId);

    // 현재 엔드포인트가 삭제된 경우 첫 번째 엔드포인트로 변경 (또는 undefined)
    if (config.currentEndpoint === endpointId) {
      const firstEndpoint = config.endpoints[0];
      config.currentEndpoint = firstEndpoint?.id;

      // 첫 번째 엔드포인트의 첫 번째 모델로 변경
      if (firstEndpoint) {
        const firstModel = firstEndpoint.models.find((m) => m.enabled);
        config.currentModel = firstModel?.id;
      } else {
        config.currentModel = undefined;
      }
    }

    await this.saveConfig();
  }

  /**
   * 현재 엔드포인트 변경
   */
  async setCurrentEndpoint(endpointId: string): Promise<void> {
    const config = this.getConfig();

    const endpoint = config.endpoints.find((ep) => ep.id === endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint ${endpointId} not found`);
    }

    config.currentEndpoint = endpointId;

    // 해당 엔드포인트의 첫 번째 활성 모델로 변경
    const activeModel = endpoint.models.find((m) => m.enabled);
    if (activeModel) {
      config.currentModel = activeModel.id;
    }

    await this.saveConfig();
  }

  /**
   * 현재 모델 변경
   */
  async setCurrentModel(modelId: string): Promise<void> {
    const config = this.getConfig();
    const endpoint = this.getCurrentEndpoint();

    if (!endpoint) {
      throw new Error('No endpoint selected');
    }

    const model = endpoint.models.find((m) => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found in current endpoint`);
    }

    if (!model.enabled) {
      throw new Error(`Model ${modelId} is disabled`);
    }

    config.currentModel = modelId;
    await this.saveConfig();
  }

  /**
   * 설정 값 업데이트
   */
  async updateSettings(settings: Partial<OpenConfig['settings']>): Promise<void> {
    const config = this.getConfig();
    config.settings = { ...config.settings, ...settings };
    await this.saveConfig();
  }

  /**
   * 홈 디렉토리 존재 여부 확인
   */
  async isInitialized(): Promise<boolean> {
    return await directoryExists(OPEN_HOME_DIR);
  }

  /**
   * 엔드포인트 존재 여부 확인
   */
  hasEndpoints(): boolean {
    if (!this.config) {
      return false;
    }
    return this.config.endpoints.length > 0;
  }

  /**
   * 초기 엔드포인트 생성
   * 첫 번째 엔드포인트를 추가하고 자동으로 현재 엔드포인트/모델로 설정
   */
  async createInitialEndpoint(endpoint: EndpointConfig): Promise<void> {
    const config = this.getConfig();

    // 첫 엔드포인트 추가
    config.endpoints.push(endpoint);

    // 자동으로 현재 엔드포인트/모델로 설정
    config.currentEndpoint = endpoint.id;

    // 첫 번째 활성 모델을 현재 모델로 설정
    const activeModel = endpoint.models.find((m) => m.enabled);
    if (activeModel) {
      config.currentModel = activeModel.id;
    }

    await this.saveConfig();
  }

  /**
   * 설정 초기화 (공장 초기화)
   */
  async reset(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.saveConfig();
  }

  /**
   * 엔드포인트 업데이트
   */
  async updateEndpoint(
    endpointId: string,
    updates: Partial<Omit<EndpointConfig, 'id' | 'createdAt'>>
  ): Promise<void> {
    const config = this.getConfig();
    const endpointIndex = config.endpoints.findIndex((ep) => ep.id === endpointId);

    if (endpointIndex === -1) {
      throw new Error(`Endpoint ${endpointId} not found`);
    }

    const endpoint = config.endpoints[endpointIndex]!;
    config.endpoints[endpointIndex] = {
      ...endpoint,
      ...updates,
      updatedAt: new Date(),
    };

    await this.saveConfig();
  }

  /**
   * 모델 health 상태 업데이트
   */
  async updateModelHealth(
    endpointId: string,
    modelId: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    _latency?: number
  ): Promise<void> {
    const config = this.getConfig();
    const endpoint = config.endpoints.find((ep) => ep.id === endpointId);

    if (!endpoint) {
      throw new Error(`Endpoint ${endpointId} not found`);
    }

    const model = endpoint.models.find((m) => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found in endpoint ${endpointId}`);
    }

    model.healthStatus = status;
    model.lastHealthCheck = new Date();

    await this.saveConfig();
  }

  /**
   * 모든 모델의 health 상태 일괄 업데이트
   */
  async updateAllHealthStatus(
    healthResults: Map<string, { modelId: string; healthy: boolean; latency?: number }[]>
  ): Promise<void> {
    const config = this.getConfig();

    for (const [endpointId, modelResults] of healthResults) {
      const endpoint = config.endpoints.find((ep) => ep.id === endpointId);
      if (!endpoint) continue;

      for (const result of modelResults) {
        const model = endpoint.models.find((m) => m.id === result.modelId);
        if (model) {
          model.healthStatus = result.healthy ? 'healthy' : 'unhealthy';
          model.lastHealthCheck = new Date();
        }
      }
    }

    await this.saveConfig();
  }

  /**
   * 모든 healthy 모델 목록 조회
   */
  getHealthyModels(): { endpoint: EndpointConfig; model: ModelInfo }[] {
    const config = this.getConfig();
    const healthyModels: { endpoint: EndpointConfig; model: ModelInfo }[] = [];

    for (const endpoint of config.endpoints) {
      for (const model of endpoint.models) {
        if (model.enabled && model.healthStatus === 'healthy') {
          healthyModels.push({ endpoint, model });
        }
      }
    }

    return healthyModels;
  }

  /**
   * 모든 모델 목록 조회 (엔드포인트 정보 포함)
   */
  getAllModels(): { endpoint: EndpointConfig; model: ModelInfo; isCurrent: boolean }[] {
    const config = this.getConfig();
    const allModels: { endpoint: EndpointConfig; model: ModelInfo; isCurrent: boolean }[] = [];

    for (const endpoint of config.endpoints) {
      for (const model of endpoint.models) {
        const isCurrent =
          endpoint.id === config.currentEndpoint && model.id === config.currentModel;
        allModels.push({ endpoint, model, isCurrent });
      }
    }

    return allModels;
  }
}

/**
 * ConfigManager 싱글톤 인스턴스
 */
export const configManager = new ConfigManager();
