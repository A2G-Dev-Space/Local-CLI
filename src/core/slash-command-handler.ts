/**
 * Slash Command Handler
 *
 * Core logic for handling slash commands
 * This module provides reusable command execution logic
 */

import { Message, TodoItem } from '../types/index.js';
import { sessionManager } from './session/session-manager.js';
import { usageTracker } from './usage-tracker.js';
import {
  getDocsInfo,
  downloadDocsFromSource,
  getAvailableSources,
} from './docs-manager.js';

// Planning mode is always 'auto' - other modes have been removed
export type PlanningMode = 'auto';

export interface CompactResult {
  success: boolean;
  originalMessageCount: number;
  newMessageCount: number;
  error?: string;
}

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
  onShowDocsBrowser?: () => void;
  onCompact?: () => Promise<CompactResult>;
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

  // Compact command - compress conversation history
  if (trimmedCommand === '/compact') {
    if (context.onCompact) {
      const result = await context.onCompact();
      const compactMessage = result.success
        ? `✅ 대화가 압축되었습니다. (${result.originalMessageCount}개 → ${result.newMessageCount}개 메시지)`
        : `❌ 압축 실패: ${result.error}`;
      const updatedMessages = [
        ...context.messages,
        { role: 'assistant' as const, content: compactMessage },
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
    // Fallback if no compact callback
    const fallbackMessage = '/compact는 interactive mode에서만 사용할 수 있습니다.';
    const updatedMessages = [
      ...context.messages,
      { role: 'assistant' as const, content: fallbackMessage },
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

  // Usage command - show token usage statistics
  if (trimmedCommand === '/usage') {
    const usageMessage = usageTracker.formatUsageDisplay();
    const updatedMessages = [
      ...context.messages,
      { role: 'assistant' as const, content: usageMessage },
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

  // Docs command - manage documentation
  if (trimmedCommand.startsWith('/docs')) {
    const parts = trimmedCommand.split(' ');
    const subCommand = parts[1];
    const sourceId = parts[2];

    // /docs - show DocsBrowser UI if available
    if (!subCommand) {
      // If UI callback is available (React UI), trigger DocsBrowser
      if (context.onShowDocsBrowser) {
        context.onShowDocsBrowser();
        return {
          handled: true,
          shouldContinue: false,
        };
      }

      // Fallback to text display (non-interactive mode)
      const info = await getDocsInfo();
      const sources = getAvailableSources();

      let docsMessage = '📚 문서 관리\n\n';
      docsMessage += `경로: ${info.path}\n`;
      docsMessage += `상태: ${info.exists ? '✅ 존재' : '❌ 없음'}\n`;

      if (info.exists) {
        docsMessage += `파일 수: ${info.totalFiles}개\n`;
        docsMessage += `크기: ${info.totalSize}\n`;

        if (info.installedSources.length > 0) {
          docsMessage += `\n설치된 문서: ${info.installedSources.join(', ')}\n`;
        }
      }

      docsMessage += '\n📥 사용 가능한 문서 소스:\n';
      for (const source of sources) {
        const installed = info.installedSources.includes(source.id);
        const status = installed ? '✅' : '⬜';
        docsMessage += `  ${status} ${source.id} - ${source.description}\n`;
      }

      docsMessage += '\n사용법:\n';
      docsMessage += '  /docs download <source>  - 문서 다운로드\n';
      docsMessage += '  예: /docs download agno\n';

      const updatedMessages = [
        ...context.messages,
        { role: 'assistant' as const, content: docsMessage },
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

    // /docs download <source>
    if (subCommand === 'download') {
      if (!sourceId) {
        const sources = getAvailableSources();
        const availableIds = sources.map(s => s.id).join(', ');
        const errorMessage = `소스를 지정해주세요.\n사용 가능한 소스: ${availableIds}\n\n예: /docs download agno`;
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

      // Show downloading message
      const downloadingMessage = `📥 ${sourceId} 문서 다운로드 중...`;
      const messagesWithDownloading = [
        ...context.messages,
        { role: 'assistant' as const, content: downloadingMessage },
      ];
      context.setMessages(messagesWithDownloading);

      // Download
      const result = await downloadDocsFromSource(sourceId);

      let resultMessage: string;
      if (result.success) {
        resultMessage = `✅ ${result.message}\n\n`;
        resultMessage += `📊 다운로드 결과:\n`;
        resultMessage += `  • 신규 다운로드: ${result.downloadedFiles ?? 0}개\n`;
        if (result.skippedFiles && result.skippedFiles > 0) {
          resultMessage += `  • 이미 존재 (스킵): ${result.skippedFiles}개\n`;
        }
        if (result.failedFiles && result.failedFiles > 0) {
          resultMessage += `  • 실패: ${result.failedFiles}개\n`;
        }
        resultMessage += `\n📁 경로: ${result.targetPath}`;
      } else {
        resultMessage = `❌ ${result.message}`;
      }

      const updatedMessages = [
        ...messagesWithDownloading,
        { role: 'assistant' as const, content: resultMessage },
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

    // Unknown /docs subcommand
    const unknownSubMessage = `알 수 없는 명령: /docs ${subCommand}\n사용법: /docs 또는 /docs download <source>`;
    const updatedMessages = [
      ...context.messages,
      { role: 'assistant' as const, content: unknownSubMessage },
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
  /compact        - Compact conversation to free up context
  /settings       - Open settings menu
  /model          - Switch between LLM models
  /load           - Load a saved session
  /usage          - Show token usage statistics
  /docs           - Manage documentation (download agno, adk)

Keyboard shortcuts:
  Ctrl+C          - Exit
  Ctrl+T          - Toggle TODO details
  ESC             - Interrupt current execution

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
