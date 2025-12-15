/**
 * Nexus Coder Setup
 *
 * CLI 시작 시 Admin Server에서 모델 목록을 가져와서
 * 기존 endpoint 형식으로 자동 설정
 * 폐쇄망 환경: 인증 없이 사용 가능
 */

import axios from 'axios';
import { ADMIN_SERVER_URL } from '../constants.js';
import { configManager } from './config/config-manager.js';
import { EndpointConfig, ModelInfo } from '../types/index.js';

const NEXUS_ENDPOINT_ID = 'nexus-admin-server';

/**
 * Admin Server에서 모델 목록 가져오기
 */
interface NexusModelResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
    _nexus?: {
      id: string;
      displayName: string;
      maxTokens: number;
    };
  }>;
}

/**
 * Admin Server에서 모델 목록을 가져와서 endpoint 형식으로 설정
 */
export async function setupNexusModels(debug = false): Promise<void> {
  const url = `${ADMIN_SERVER_URL}/v1/models`;
  if (debug) console.log(`[DEBUG] Requesting: ${url}`);

  // Admin Server에서 모델 목록 가져오기 (인증 없음)
  let response;
  try {
    response = await axios.get<NexusModelResponse>(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  } catch (error: any) {
    if (debug) {
      console.log('[DEBUG] Request failed:');
      console.log('  URL:', url);
      console.log('  Status:', error.response?.status);
      console.log('  Data:', JSON.stringify(error.response?.data));
    }
    throw error;
  }

  const models: ModelInfo[] = response.data.data.map((model) => ({
    id: model.id,
    name: model._nexus?.displayName || model.id,
    enabled: true,
    maxTokens: model._nexus?.maxTokens || 128000,
    healthStatus: 'healthy' as const,
  }));

  if (models.length === 0) {
    throw new Error('No models available from Admin Server');
  }

  // Nexus endpoint 생성/업데이트
  const nexusEndpoint: EndpointConfig = {
    id: NEXUS_ENDPOINT_ID,
    name: 'Nexus Coder Admin Server',
    baseUrl: `${ADMIN_SERVER_URL}/v1`,
    apiKey: '', // Auth headers로 인증
    models,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const config = configManager.getConfig();

  // 기존 nexus endpoint 제거 후 새로 추가
  config.endpoints = config.endpoints.filter((ep) => ep.id !== NEXUS_ENDPOINT_ID);
  config.endpoints.push(nexusEndpoint);

  // 현재 endpoint로 설정
  config.currentEndpoint = NEXUS_ENDPOINT_ID;

  // 현재 모델이 없거나 유효하지 않으면 첫 번째 모델로 설정
  const currentModelExists = models.some((m) => m.id === config.currentModel);
  if (!config.currentModel || !currentModelExists) {
    config.currentModel = models[0]?.id;
  }

  await configManager.saveConfig();
}

/**
 * Nexus endpoint인지 확인
 */
export function isNexusEndpoint(endpointId: string): boolean {
  return endpointId === NEXUS_ENDPOINT_ID;
}

/**
 * 현재 endpoint가 Nexus인지 확인
 */
export function isCurrentEndpointNexus(): boolean {
  const endpoint = configManager.getCurrentEndpoint();
  return endpoint?.id === NEXUS_ENDPOINT_ID;
}
