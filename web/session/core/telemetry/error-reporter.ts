/**
 * Error Telemetry Reporter
 *
 * No-op for local-web: no Dashboard to report errors to.
 * Function signatures preserved for callers.
 */

// 최근 채팅 메시지 저장 (에러 보고 시 컨텍스트로 포함)
const MAX_RECENT_MESSAGES = 10;

/**
 * 에러 보고 시 포함할 최근 메시지 업데이트
 * plan-executor 또는 agent-engine에서 매 iteration 호출
 */
export function updateRecentMessagesForTelemetry(messages: Array<{ role: string; content?: string | null }>): void {
  // No-op: retained for caller compatibility
  void messages;
  void MAX_RECENT_MESSAGES;
}

/**
 * 에러를 Dashboard API로 보고 (fire-and-forget)
 */
export async function reportError(
  _error: unknown,
  _context?: Record<string, unknown>,
): Promise<void> {
  // No-op: local-web has no Dashboard to report errors to
}
