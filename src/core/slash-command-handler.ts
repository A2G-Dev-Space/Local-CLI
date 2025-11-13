/**
 * Slash Command Handler
 *
 * Core logic for handling slash commands
 * This module provides reusable command execution logic
 */

import { Message, TodoItem } from '../types/index.js';
import { configManager } from './config-manager.js';
import { sessionManager } from './session-manager.js';

export type AppMode = 'direct' | 'plan-execute' | 'auto';

export interface CommandHandlerContext {
  mode: AppMode;
  messages: Message[];
  todos: TodoItem[];
  setMode: (mode: AppMode) => void;
  setMessages: (messages: Message[]) => void;
  setTodos: (todos: TodoItem[]) => void;
  exit: () => void;
  // Optional UI control callbacks
  onShowSessionBrowser?: () => void;
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

  // Mode command (show current mode)
  if (trimmedCommand === '/mode') {
    const modeMessage = `Current mode: ${context.mode}`;
    const updatedMessages = [
      ...context.messages,
      { role: 'assistant' as const, content: modeMessage },
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

  // Mode command (set mode)
  if (trimmedCommand.startsWith('/mode ')) {
    const newMode = trimmedCommand.split(' ')[1] as AppMode;
    if (['direct', 'plan-execute', 'auto'].includes(newMode)) {
      context.setMode(newMode);
      const modeMessage = `Mode switched to: ${newMode}`;
      const updatedMessages = [
        ...context.messages,
        { role: 'assistant' as const, content: modeMessage },
      ];
      context.setMessages(updatedMessages);
      return {
        handled: true,
        shouldContinue: false,
        updatedContext: {
          mode: newMode,
          messages: updatedMessages,
        },
      };
    }
    // Invalid mode
    const errorMessage = `Invalid mode: ${newMode}. Available modes: direct, plan-execute, auto`;
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

  // Help command
  if (trimmedCommand === '/help') {
    const helpMessage = `
Available commands:
  /exit, /quit    - Exit the application
  /clear          - Clear conversation and TODOs
  /mode [type]    - Switch mode (direct/plan-execute/auto)
  /load           - Load a saved session
  /status         - Show system status

Keyboard shortcuts:
  Tab             - Cycle through modes
  Ctrl+T          - Toggle TODO panel
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

  // Status command - show system information
  if (trimmedCommand === '/status') {
    const endpoint = configManager.getCurrentEndpoint();
    const model = configManager.getCurrentModel();
    const cwd = process.cwd();

    // Read package.json for version
    let version = 'unknown';
    try {
      // Get package.json from the module root
      const { readFile } = await import('fs/promises');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packageJsonPath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      version = packageJson.version;
    } catch {
      // If we can't read package.json, use the default version
      version = '0.1.0';
    }

    const statusMessage = `
System Status:
  Version:      ${version}
  Session ID:   ${sessionManager.getCurrentSessionId() || 'No active session'}
  Working Dir:  ${cwd}
  Endpoint URL: ${endpoint?.baseUrl || 'Not configured'}
  LLM Model:    ${model?.name || 'Not configured'} (${model?.id || 'N/A'})
    `;

    const updatedMessages = [
      ...context.messages,
      { role: 'assistant' as const, content: statusMessage },
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
