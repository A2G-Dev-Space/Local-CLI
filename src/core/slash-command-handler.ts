/**
 * Slash Command Handler
 *
 * Core logic for handling slash commands
 * This module provides reusable command execution logic
 */

import { Message, TodoItem } from '../types/index.js';
import { sessionManager } from './session-manager.js';

// Planning mode is always 'auto' - other modes have been removed
export type PlanningMode = 'auto';

export interface CommandHandlerContext {
  planningMode: PlanningMode;
  messages: Message[];
  todos: TodoItem[];
  setPlanningMode: (mode: PlanningMode) => void;
  setMessages: (messages: Message[]) => void;
  setTodos: (todos: TodoItem[]) => void;
  exit: () => void;
  // Optional UI control callbacks
  onShowSessionBrowser?: () => void;
  onShowSettings?: () => void;
  onShowModelSelector?: () => void;
}

export interface CommandExecutionResult {
  handled: boolean;
  shouldContinue: boolean;
  updatedContext?: Partial<CommandHandlerContext>;
}


/**
 * Execute a slash command
 * Returns true if command was handled, false otherwise
 */
export async function executeSlashCommand(
  command: string,
  context: CommandHandlerContext
): Promise<CommandExecutionResult> {
  const trimmedCommand = command.trim();

  // Exit commands
  if (trimmedCommand === '/exit' || trimmedCommand === '/quit') {
    context.exit();
    return { handled: true, shouldContinue: false };
  }

  // Clear command
  if (trimmedCommand === '/clear') {
    context.setMessages([]);
    context.setTodos([]);
    return {
      handled: true,
      shouldContinue: false,
      updatedContext: {
        messages: [],
        todos: [],
      },
    };
  }

  // Settings command - show settings UI
  if (trimmedCommand === '/settings') {
    if (context.onShowSettings) {
      context.onShowSettings();
      return {
        handled: true,
        shouldContinue: false,
      };
    }
    // Fallback if no UI callback
    const settingsMessage = `Current Settings:\n  Planning Mode: ${context.planningMode}\n\nUse /settings in interactive mode to change settings.`;
    const updatedMessages = [
      ...context.messages,
      { role: 'assistant' as const, content: settingsMessage },
    ];
    context.setMessages(updatedMessages);
    return {
      handled: true,
      shouldContinue: false,
      updatedContext: {
        messages: updatedMessages,
      },
    };
  }

  // Model command - show model selector
  if (trimmedCommand === '/model') {
    if (context.onShowModelSelector) {
      context.onShowModelSelector();
      return {
        handled: true,
        shouldContinue: false,
      };
    }
    // Fallback if no UI callback
    const modelMessage = `Use /model in interactive mode to switch between LLM models.`;
    const updatedMessages = [
      ...context.messages,
      { role: 'assistant' as const, content: modelMessage },
    ];
    context.setMessages(updatedMessages);
    return {
      handled: true,
      shouldContinue: false,
      updatedContext: {
        messages: updatedMessages,
      },
    };
  }

  // Help command
  if (trimmedCommand === '/help') {
    const helpMessage = `
Available commands:
  /exit, /quit    - Exit the application
  /clear          - Clear conversation and TODOs
  /settings       - Open settings menu
  /model          - Switch between LLM models
  /load           - Load a saved session

Keyboard shortcuts:
  Ctrl+C          - Exit

Note: All conversations are automatically saved.
    `;
    const updatedMessages = [
      ...context.messages,
      { role: 'assistant' as const, content: helpMessage },
    ];
    context.setMessages(updatedMessages);
    return {
      handled: true,
      shouldContinue: false,
      updatedContext: {
        messages: updatedMessages,
      },
    };
  }

  // Load command - load saved session
  if (trimmedCommand.startsWith('/load')) {
    const parts = trimmedCommand.split(' ');
    const sessionIdOrIndex = parts[1];

    try {
      const sessions = await sessionManager.listSessions();

      if (sessions.length === 0) {
        const noSessionMessage = '저장된 세션이 없습니다.';
        const updatedMessages = [
          ...context.messages,
          { role: 'assistant' as const, content: noSessionMessage },
        ];
        context.setMessages(updatedMessages);
        return {
          handled: true,
          shouldContinue: false,
          updatedContext: {
            messages: updatedMessages,
          },
        };
      }

      // If no session ID provided, show SessionBrowser UI if available, otherwise show text list
      if (!sessionIdOrIndex) {
        // If UI callback is available (React UI), trigger SessionBrowser
        if (context.onShowSessionBrowser) {
          context.onShowSessionBrowser();
          return {
            handled: true,
            shouldContinue: false,
          };
        }

        // Fallback to text list (Classic CLI mode)
        const sessionList = sessions.map((session, index) => {
          const date = new Date(session.createdAt).toLocaleDateString('ko-KR');
          return `${index + 1}. ${session.name} (${session.messageCount}개 메시지, ${date})`;
        }).join('\n');

        const listMessage = `저장된 세션 목록:\n\n${sessionList}\n\n사용법: /load <번호> 또는 /load <세션ID>`;
        const updatedMessages = [
          ...context.messages,
          { role: 'assistant' as const, content: listMessage },
        ];
        context.setMessages(updatedMessages);
        return {
          handled: true,
          shouldContinue: false,
          updatedContext: {
            messages: updatedMessages,
          },
        };
      }

      // Load session by index or ID
      let sessionId: string;
      const index = parseInt(sessionIdOrIndex);
      if (!isNaN(index) && index > 0 && index <= sessions.length) {
        // Load by index
        sessionId = sessions[index - 1]!.id;
      } else {
        // Load by ID
        sessionId = sessionIdOrIndex;
      }

      const sessionData = await sessionManager.loadSession(sessionId);
      if (!sessionData) {
        const errorMessage = `세션을 찾을 수 없습니다: ${sessionIdOrIndex}`;
        const updatedMessages = [
          ...context.messages,
          { role: 'assistant' as const, content: errorMessage },
        ];
        context.setMessages(updatedMessages);
        return {
          handled: true,
          shouldContinue: false,
          updatedContext: {
            messages: updatedMessages,
          },
        };
      }

      // Restore messages (without adding success message)
      const loadedMessages = sessionData.messages;
      context.setMessages(loadedMessages);

      return {
        handled: true,
        shouldContinue: false,
        updatedContext: {
          messages: loadedMessages,
        },
      };
    } catch (error) {
      const errorMessage = `세션 로드 실패: ${error instanceof Error ? error.message : 'Unknown error'}`;
      const updatedMessages = [
        ...context.messages,
        { role: 'assistant' as const, content: errorMessage },
      ];
      context.setMessages(updatedMessages);
      return {
        handled: true,
        shouldContinue: false,
        updatedContext: {
          messages: updatedMessages,
        },
      };
    }
  }

  // Unknown command
  if (trimmedCommand.startsWith('/')) {
    const unknownMessage = `Unknown command: ${trimmedCommand}. Type /help for available commands.`;
    const updatedMessages = [
      ...context.messages,
      { role: 'assistant' as const, content: unknownMessage },
    ];
    context.setMessages(updatedMessages);
    return {
      handled: true,
      shouldContinue: false,
      updatedContext: {
        messages: updatedMessages,
      },
    };
  }

  // Not a command
  return { handled: false, shouldContinue: true };
}

/**
 * Check if a message is a slash command
 */
export function isSlashCommand(message: string): boolean {
  return message.trim().startsWith('/');
}
