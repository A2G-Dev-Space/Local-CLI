/**
 * Session Module Export
 * Re-exports from ROOT level session-manager.ts for backwards compatibility
 */

export { sessionManager, default } from '../../session-manager';
export type {
  ChatMessage,
  Session,
  SessionSummary,
  SessionLogEntry,
  SessionTodoItem,
} from '../../session-manager';
