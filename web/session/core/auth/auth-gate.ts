/**
 * Auth Gate
 *
 * CLI 시작 시 자동 인증 게이트 + Dashboard 모델 동기화
 *
 * 플로우:
 * 1. loadCredentials() → 유효성 검사
 * 2. 만료 1시간 이내 → refreshTokenFromServer() 백그라운드 갱신
 * 3. 만료/없음 → performOAuthLogin() + /api/auth/me 로 plan 갱신
 * 4. 실패 시 process.exit(1)
 * 5. syncModelsFromDashboard() → /v1/models → configManager 자동 등록
 */

import chalk from 'chalk';
import {
  loadCredentials,
  performOAuthLogin,
  saveCredentials,
  refreshTokenFromServer,
  type DashboardCredentials,
} from './oauth-login.js';
import { configManager } from '../config/config-manager.js';
import { SERVICE_ID } from '../../constants.js';
import { logger } from '../../utils/logger.js';
import type { EndpointConfig, ModelInfo } from '../../types/index.js';
import { syncVisionToolState } from '../../tools/registry.js';
import { reportError } from '../telemetry/error-reporter.js';

/**
 * 인증이 완료된 credentials 반환
 * 실패 시 에러 메시지 출력 후 process.exit(1)
 */
export async function ensureAuthenticated(
  dashboardUrl: string,
): Promise<DashboardCredentials> {
  // 1. 기존 credentials 로드
  const existing = await loadCredentials();

  if (existing) {
    // Dashboard URL이 변경된 경우 강제 재로그인
    if (existing.dashboardUrl !== dashboardUrl) {
      logger.warn('Auth: dashboardUrl changed, forcing re-login', {
        old: existing.dashboardUrl,
        new: dashboardUrl,
      });
      console.log(chalk.yellow(`\n  Dashboard 서버가 변경되었습니다. 재로그인이 필요합니다.`));
    } else {
      const expiresAt = new Date(existing.expiresAt);
      const now = new Date();
      const oneHourMs = 60 * 60 * 1000;
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();

      // 유효하고 만료까지 1시간 이상 남음 → 무소음 진행
      if (timeUntilExpiry > oneHourMs) {
        return existing;
      }

      // 유효하지만 만료 1시간 이내 → 백그라운드 토큰 갱신
      if (timeUntilExpiry > 0) {
        const refreshed = await refreshTokenFromServer(existing);
        if (refreshed) {
          return refreshed;
        }
        // 갱신 실패해도 아직 유효하므로 기존 토큰 사용
        return existing;
      }
    }
  }

  // 2. 만료 또는 없음 → OAuth 로그인
  console.log(chalk.cyan(`\n  Dashboard: ${dashboardUrl}`));

  const creds = await performOAuthLogin(dashboardUrl);

  if (!creds) {
    console.log(chalk.red('\n  로그인 실패. 프로그램을 종료합니다.\n'));
    process.exit(1);
  }

  console.log(chalk.green('  로그인 성공!'));
  if (creds.displayName) {
    console.log(chalk.dim(`  사용자: ${creds.displayName} (${creds.provider || ''})`));
  }
  if (creds.email) {
    console.log(chalk.dim(`  이메일: ${creds.email}`));
  }

  // 3. /api/auth/me로 plan 정보 갱신
  try {
    const meRes = await fetch(`${dashboardUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${creds.token}` },
    });
    if (meRes.ok) {
      const meData = (await meRes.json()) as {
        plan?: { name: string; displayName: string; tier: string };
      };
      if (meData.plan) {
        creds.plan = meData.plan;
        await saveCredentials(creds);
        console.log(chalk.dim(`  플랜: ${meData.plan.displayName}`));
      }
    }
  } catch {
    // Plan fetch 실패는 무시 (로그인 자체는 성공)
  }

  console.log(chalk.dim(`  만료: ${new Date(creds.expiresAt).toLocaleString()}\n`));

  return creds;
}

/**
 * Dashboard에서 모델 목록을 가져와 configManager에 자동 등록
 *
 * GET ${dashboardUrl}/v1/models 호출 → _hanseol 필드에서 모델 정보 추출
 * → configManager에 "dashboard" endpoint 자동 등록/갱신
 */
export async function syncModelsFromDashboard(
  dashboardUrl: string,
  token: string,
): Promise<void> {
  logger.flow('Syncing models from Dashboard');

  const DASHBOARD_ENDPOINT_ID = 'dashboard';

  try {
    const res = await fetch(`${dashboardUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Service-Id': SERVICE_ID },
    });

    if (!res.ok) {
      throw new Error(`GET /v1/models failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as {
      data: Array<{
        id: string;
        _hanseol?: {
          id: string;
          modelName: string;
          displayName: string;
          maxTokens: number;
          supportsVision?: boolean;
        };
      }>;
    };

    // _hanseol 필드에서 모델 정보 추출
    const models: ModelInfo[] = (data.data || []).map((m) => ({
      id: m._hanseol?.id || m.id,
      name: m._hanseol?.displayName || m.id,
      apiModelId: m._hanseol?.modelName || m.id,
      maxTokens: m._hanseol?.maxTokens || 128000,
      enabled: true,
      supportsVision: m._hanseol?.supportsVision || false,
    }));

    logger.flow('Models fetched from Dashboard', {
      count: models.length,
      models: models.map((m) => m.id),
    });

    const config = configManager.getConfig();

    // 수동 등록된 endpoint 전부 제거 — Dashboard endpoint만 유지
    config.endpoints = config.endpoints.filter((ep) => ep.id === DASHBOARD_ENDPOINT_ID);

    if (models.length === 0) {
      // Dashboard에 모델이 없으면 endpoint도 비우고 현재 모델 해제
      config.endpoints = [];
      config.currentEndpoint = undefined;
      config.currentModel = undefined;
      await configManager.saveConfig();
      logger.warn('Dashboard returned no models — cleared all endpoints');
      return;
    }

    const existingIndex = config.endpoints.findIndex((ep) => ep.id === DASHBOARD_ENDPOINT_ID);

    if (existingIndex >= 0) {
      // 기존 dashboard endpoint 갱신 (모델 목록 + 토큰 업데이트)
      config.endpoints[existingIndex]!.models = models;
      config.endpoints[existingIndex]!.apiKey = token;
      config.endpoints[existingIndex]!.updatedAt = new Date();
    } else {
      // 새로 생성
      const endpoint: EndpointConfig = {
        id: DASHBOARD_ENDPOINT_ID,
        name: 'Dashboard',
        baseUrl: `${dashboardUrl}/v1`,
        apiKey: token,
        models,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      config.endpoints.push(endpoint);
    }

    // 현재 endpoint를 dashboard로 설정
    config.currentEndpoint = DASHBOARD_ENDPOINT_ID;

    // 현재 모델이 없거나 기존 모델이 새 목록에 없으면 첫 번째 모델로 설정
    const currentModelExists = models.some((m) => m.id === config.currentModel);
    if (!config.currentModel || !currentModelExists) {
      config.currentModel = models[0]?.id;
    }

    await configManager.saveConfig();

    logger.flow('Dashboard models synced to configManager', {
      endpointId: DASHBOARD_ENDPOINT_ID,
      modelCount: models.length,
      currentModel: config.currentModel,
    });

    // Sync vision tool state based on VL model availability
    await syncVisionToolState();
  } catch (error) {
    logger.errorSilent('Failed to sync models from Dashboard', error as Error);
    reportError(error, { type: 'modelSync' }).catch(() => {});
    throw error;
  }
}
