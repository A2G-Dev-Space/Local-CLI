/**
 * Error Telemetry Reporter (Electron)
 *
 * Electron에서 발생하는 에러를 Dashboard API로 보고
 * - Fire-and-forget: 전송 실패해도 앱 동작에 영향 없음
 * - 5초 타임아웃
 * - INTERRUPTED 에러는 전송하지 않음
 * - 인증 안 된 상태에서는 무시
 */

import * as os from 'os';
import * as fs from 'fs';
import { DASHBOARD_URL, APP_VERSION, CREDENTIALS_FILE_PATH } from '../../constants.js';
import { logger } from '../../utils/logger';

const REPORT_TIMEOUT_MS = 5000;

/**
 * 외부에서 토큰을 주입하는 방식 (circular import 방지 + vite 번들 호환)
 */
let _injectedToken: string | null = null;

export function setErrorReporterToken(token: string | null): void {
  _injectedToken = token;
  logger.info('[ErrorReporter] Token injected', { hasToken: !!token });
}

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
  // console.error로 직접 출력 — logger 문제 여부 확인용
  console.error('[ErrorReporter] reportError CALLED', context?.['type'] ?? 'no-type');
  try {
    // INTERRUPTED는 보고하지 않음
    if (error instanceof Error && error.message === 'INTERRUPTED') return;

    // 인증 토큰 읽기 (주입된 토큰 우선 → credentials.json 폴백)
    const token = getAuthToken();
    if (!token) {
      console.error('[ErrorReporter] No auth token — skipping');
      logger.warn('[ErrorReporter] No auth token found, skipping report');
      return;
    }
    console.error('[ErrorReporter] Token found, sending...');

    // 페이로드 생성
    const payload = buildPayload(error, context);

    // Fire-and-forget 전송
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);

    const url = `${DASHBOARD_URL}/api/error-telemetry/report`;
    logger.info('[ErrorReporter] Sending error report', {
      url,
      errorName: payload.errorName,
      errorCode: payload.errorCode,
      type: context?.['type'],
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Service-Id': 'hanseol-ui',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    logger.info('[ErrorReporter] Report sent', { status: res.status });
  } catch (sendError) {
    logger.warn('[ErrorReporter] Failed to send error report', {
      error: sendError instanceof Error ? sendError.message : String(sendError),
    });
  }
}

/**
 * 인증 토큰 읽기
 * 1차: setErrorReporterToken()으로 주입된 토큰 사용
 * 2차: credentials.json 파일에서 직접 읽기
 */
function getAuthToken(): string | null {
  // 1차: 주입된 토큰 (auth-gate에서 인증 성공 후 설정됨)
  if (_injectedToken) {
    return _injectedToken;
  }

  // 2차: credentials.json 파일 직접 읽기
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
    logger.warn('[ErrorReporter] Failed to read credentials file', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * 에러를 보고 페이로드로 변환
 */
function buildPayload(
  error: unknown,
  extraContext?: Record<string, unknown>,
): ErrorReportPayload {
  const platform = os.platform();

  // BaseError 체크 (toJSON 메서드 있는지 확인 - Electron에서는 별도 import path)
  if (error instanceof Error && 'code' in error && 'toJSON' in error && typeof (error as { toJSON: unknown }).toJSON === 'function') {
    const json = (error as { toJSON(): Record<string, unknown> }).toJSON();
    return {
      source: 'electron',
      appVersion: APP_VERSION,
      platform,
      errorName: String(json.name || error.name),
      errorCode: String(json.code || 'UNKNOWN'),
      errorMessage: String(json.message || error.message),
      stackTrace: json.stack ? String(json.stack) : error.stack,
      isRecoverable: Boolean(json.isRecoverable),
      context: {
        ...(json.details as Record<string, unknown> || {}),
        ...extraContext,
        userMessage: json.userMessage,
      },
    };
  }

  if (error instanceof Error) {
    return {
      source: 'electron',
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
    source: 'electron',
    appVersion: APP_VERSION,
    platform,
    errorName: 'UnknownError',
    errorCode: 'UNKNOWN',
    errorMessage: String(error),
    isRecoverable: false,
    context: extraContext,
  };
}
