/**
 * Error Telemetry Reporter
 *
 * CLI에서 발생하는 에러를 Dashboard API로 보고
 * - Fire-and-forget: 전송 실패해도 앱 동작에 영향 없음
 * - 5초 타임아웃
 * - INTERRUPTED 에러는 전송하지 않음
 * - 인증 안 된 상태에서는 무시
 */

import * as os from 'os';
import * as fs from 'fs';
import { DASHBOARD_URL, APP_VERSION, CREDENTIALS_FILE_PATH, APP_NAME } from '../../constants.js';
import { BaseError } from '../../errors/base.js';
import { logger } from '../../utils/logger.js';

const REPORT_TIMEOUT_MS = 5000;

interface ErrorReportPayload {
  source: 'cli' | 'electron';
  appVersion: string;
  platform: string;
  errorName: string;
  errorCode: string;
  errorMessage: string;
  stackTrace?: string;
  isRecoverable: boolean;
  context?: Record<string, unknown>;
}

/**
 * 에러를 Dashboard API로 보고 (fire-and-forget)
 */
export async function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    // INTERRUPTED는 보고하지 않음
    if (error instanceof Error && error.message === 'INTERRUPTED') return;

    // 인증 토큰 읽기
    const token = getAuthToken();
    if (!token) {
      logger.warn('[ErrorReporter] No auth token found, skipping report');
      return;
    }

    // 페이로드 생성
    const payload = buildPayload(error, 'cli', context);

    // Fire-and-forget 전송
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);

    const url = `${DASHBOARD_URL}/api/error-telemetry/report`;
    logger.info('[ErrorReporter] Sending error report', {
      url,
      errorName: payload.errorName,
      type: context?.['type'],
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Service-Id': APP_NAME,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    logger.info('[ErrorReporter] Report sent', { status: res.status });
  } catch (sendError) {
    logger.warn('[ErrorReporter] Failed to send', {
      error: sendError instanceof Error ? sendError.message : String(sendError),
    });
  }
}

/**
 * credentials.json에서 토큰 읽기
 */
function getAuthToken(): string | null {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE_PATH)) {
      logger.warn('[ErrorReporter] credentials file not found', { path: CREDENTIALS_FILE_PATH });
      return null;
    }
    const raw = fs.readFileSync(CREDENTIALS_FILE_PATH, 'utf-8');
    const creds = JSON.parse(raw);
    if (!creds.token) {
      logger.warn('[ErrorReporter] credentials file has no token');
      return null;
    }

    // 만료 확인
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) {
      logger.warn('[ErrorReporter] token expired');
      return null;
    }

    return creds.token;
  } catch (err) {
    logger.warn('[ErrorReporter] Failed to read credentials', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * 에러 객체를 보고 페이로드로 변환
 */
function buildPayload(
  error: unknown,
  source: 'cli' | 'electron',
  extraContext?: Record<string, unknown>,
): ErrorReportPayload {
  const platform = os.platform();

  if (error instanceof BaseError) {
    return {
      source,
      appVersion: APP_VERSION,
      platform,
      errorName: error.name,
      errorCode: error.code,
      errorMessage: error.message,
      stackTrace: error.stack,
      isRecoverable: error.isRecoverable,
      context: {
        ...(error.details || {}),
        ...extraContext,
        userMessage: error.userMessage,
      },
    };
  }

  if (error instanceof Error) {
    return {
      source,
      appVersion: APP_VERSION,
      platform,
      errorName: error.name,
      errorCode: 'UNKNOWN',
      errorMessage: error.message,
      stackTrace: error.stack,
      isRecoverable: false,
      context: extraContext,
    };
  }

  return {
    source,
    appVersion: APP_VERSION,
    platform,
    errorName: 'UnknownError',
    errorCode: 'UNKNOWN',
    errorMessage: String(error),
    isRecoverable: false,
    context: extraContext,
  };
}
