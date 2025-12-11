/**
 * User Commands Index
 *
 * 사용자가 /슬래시 명령어로 직접 호출하는 명령어들
 *
 * Note: Current slash commands are implemented in:
 * - src/core/slash-command-handler.ts (command execution)
 * - src/ui/hooks/slashCommandProcessor.ts (UI command list)
 *
 * TODO: Migrate slash commands to use UserCommand interface
 * Commands to migrate:
 * - /exit, /quit - Exit the application
 * - /clear - Clear conversation and TODOs
 * - /settings - Open settings menu
 * - /model - Switch between LLM models
 * - /load - Load a saved session
 * - /help - Show help
 */

import { UserCommand } from '../types.js';

// Placeholder for future UserCommand implementations
export const USER_COMMANDS: UserCommand[] = [];
