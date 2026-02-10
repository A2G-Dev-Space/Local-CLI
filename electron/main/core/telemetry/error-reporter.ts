/**
 * Error Telemetry Reporter (local-cli-git stub)
 *
 * local-cli-git에는 Dashboard가 없으므로 에러 텔레메트리 비활성화.
 * 다른 코드에서 reportError()를 호출해도 안전하게 무시됨.
 */

/**
 * No-op: local-cli-git에서는 토큰 주입 비활성화
 */
export function setErrorReporterToken(_token: string | null): void {
  // No-op for local-cli-git (no Dashboard)
}

/**
 * No-op: local-cli-git에서는 에러 보고 비활성화
 */
export async function reportError(
  _error: unknown,
  _context?: Record<string, unknown>,
): Promise<void> {
  // No-op for local-cli-git (no Dashboard)
}
