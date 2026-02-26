/**
 * CLI Server Bridge
 *
 * Electron 내부 이벤트를 CLI Server의 SSE 스트림으로 전달하는 EventEmitter 브릿지.
 * ipc-handlers, jarvis-service 등에서 emit → cli-server에서 subscribe하여 SSE 포워딩.
 */

import { EventEmitter } from 'events';

export const cliBridge = new EventEmitter();

/**
 * CLI Server로 이벤트 전달
 */
export function emitToCLI(channel: string, ...args: unknown[]): void {
  cliBridge.emit(channel, ...args);
}
