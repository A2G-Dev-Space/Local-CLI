/**
 * Logger (Android)
 *
 * React Native 환경에 맞춘 로거
 */

const isDev = __DEV__;

export const logger = {
  enter(fn: string, data?: Record<string, unknown>) {
    if (isDev) console.log(`[ENTER] ${fn}`, data || '');
  },
  exit(fn: string, data?: Record<string, unknown>) {
    if (isDev) console.log(`[EXIT] ${fn}`, data || '');
  },
  flow(msg: string) {
    if (isDev) console.log(`[FLOW] ${msg}`);
  },
  debug(msg: string, data?: unknown) {
    if (isDev) console.log(`[DEBUG] ${msg}`, data || '');
  },
  warn(msg: string, data?: unknown) {
    console.warn(`[WARN] ${msg}`, data || '');
  },
  error(msg: string, data?: unknown) {
    console.error(`[ERROR] ${msg}`, data || '');
  },
  vars(...vars: { name: string; value: unknown }[]) {
    if (isDev) vars.forEach(v => console.log(`  ${v.name}:`, v.value));
  },
  verbose(msg: string, _data?: unknown) {
    // verbose는 프로덕션에서 무시
  },
  httpRequest(method: string, url: string, data?: unknown) {
    if (isDev) console.log(`[HTTP] ${method} ${url}`, data || '');
  },
  httpResponse(status: number, statusText: string, data?: unknown) {
    if (isDev) console.log(`[HTTP] ${status} ${statusText}`, data || '');
  },
  startTimer(name: string) {
    if (isDev) console.time(name);
  },
  endTimer(name: string): number {
    if (isDev) console.timeEnd(name);
    return 0;
  },
};
