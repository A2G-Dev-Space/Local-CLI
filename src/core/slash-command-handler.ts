/**
 * Slash Command Handler
 *
 * Core logic for handling slash commands
 * This module provides reusable command execution logic
 */

import { Message, TodoItem } from '../types/index.js';
import { configManager } from './config-manager.js';
import { documentManager } from './document-manager.js';
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
}

export interface CommandExecutionResult {
  handled: boolean;
  shouldContinue: boolean;
  updatedContext?: Partial<CommandHandlerContext>;
}

/**
 * Classic CLI Command Handler Context
 * Used for inquirer-based classic UI mode
 */
export interface ClassicCommandContext {
  messages: Message[];
  running: boolean;
  onExit?: () => void | Promise<void>;
}

export interface ClassicCommandResult {
  handled: boolean;
  shouldContinue: boolean;
  shouldBreak: boolean;
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
  /save [name]    - Save current session
  /load           - Load a saved session
  /status         - Show system status

Keyboard shortcuts:
  Tab             - Cycle through modes
  Ctrl+T          - Toggle TODO panel
  Ctrl+C          - Exit
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

  // Save command (placeholder - to be implemented)
  if (trimmedCommand.startsWith('/save')) {
    const sessionName = trimmedCommand.substring(5).trim() || `session-${Date.now()}`;
    const saveMessage = `Session saving not yet implemented. Would save as: ${sessionName}`;
    const updatedMessages = [
      ...context.messages,
      { role: 'assistant' as const, content: saveMessage },
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

  // Load command (placeholder - to be implemented)
  if (trimmedCommand === '/load') {
    const loadMessage = 'Session loading not yet implemented.';
    const updatedMessages = [
      ...context.messages,
      { role: 'assistant' as const, content: loadMessage },
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

/**
 * Execute slash command for Classic CLI mode (inquirer-based)
 * Returns result indicating if command was handled and whether to continue/break
 */
export async function executeClassicSlashCommand(
  command: string,
  context: ClassicCommandContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chalk: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inquirer: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ora?: any
): Promise<ClassicCommandResult> {
  const userMessage = command.trim();

  // /exit or /quit - Exit the application
  if (userMessage === '/exit' || userMessage === '/quit') {
    console.log(chalk.cyan('\n👋 OPEN-CLI를 종료합니다.\n'));
    if (context.onExit) {
      await context.onExit();
    }
    return { handled: true, shouldContinue: false, shouldBreak: true };
  }

  // /context - Show conversation history
  if (userMessage === '/context') {
    console.log(chalk.yellow('\n📝 대화 히스토리:\n'));
    if (context.messages.length === 0) {
      console.log(chalk.dim('  (비어있음)\n'));
    } else {
      context.messages.forEach((msg, index) => {
        const preview = msg.content?.substring(0, 100) || '';
        const ellipsis = msg.content && msg.content.length > 100 ? '...' : '';
        console.log(
          chalk.white(`  ${index + 1}. [${msg.role}]: ${preview}${ellipsis}`)
        );
      });
      console.log();
    }
    return { handled: true, shouldContinue: false, shouldBreak: false };
  }

  // /clear - Clear conversation history
  if (userMessage === '/clear') {
    context.messages.length = 0;
    console.log(chalk.green('\n✅ 대화 히스토리가 초기화되었습니다.\n'));
    return { handled: true, shouldContinue: false, shouldBreak: false };
  }

  // /help - Show help message
  if (userMessage === '/help') {
    console.log(chalk.yellow('\n📚 Interactive Mode 도움말:\n'));
    console.log(chalk.white('  /exit, /quit    - 종료'));
    console.log(chalk.white('  /context        - 대화 히스토리 보기'));
    console.log(chalk.white('  /clear          - 대화 히스토리 초기화'));
    console.log(chalk.white('  /save [name]    - 현재 대화 저장'));
    console.log(chalk.white('  /load           - 저장된 대화 불러오기'));
    console.log(chalk.white('  /sessions       - 저장된 대화 목록 보기'));
    console.log(chalk.white('  /endpoint       - 엔드포인트 보기/전환'));
    console.log(chalk.white('  /docs           - 로컬 문서 보기/검색'));
    console.log(chalk.white('  /status         - 시스템 상태 보기'));
    console.log(chalk.white('  /help           - 이 도움말\n'));
    return { handled: true, shouldContinue: false, shouldBreak: false };
  }

  // /endpoint - View/switch endpoints
  if (userMessage === '/endpoint') {
    try {
      const endpoints = configManager.getAllEndpoints();
      const currentEndpoint = configManager.getCurrentEndpoint();

      if (endpoints.length === 0) {
        console.log(chalk.yellow('\n등록된 엔드포인트가 없습니다.\n'));
        return { handled: true, shouldContinue: false, shouldBreak: false };
      }

      console.log(chalk.yellow('\n📡 등록된 엔드포인트:\n'));

      endpoints.forEach((endpoint, index) => {
        const isCurrent = endpoint.id === currentEndpoint?.id;
        const marker = isCurrent ? chalk.green('●') : chalk.dim('○');
        const currentLabel = isCurrent ? chalk.green('(현재)') : '';
        console.log(`${marker} ${chalk.bold(endpoint.name)} ${currentLabel}`);
        console.log(chalk.dim(`   ID: ${endpoint.id}`));
        console.log(chalk.dim(`   URL: ${endpoint.baseUrl}`));
        if (index < endpoints.length - 1) {
          console.log();
        }
      });

      // Ask to switch endpoint
      if (endpoints.length > 1) {
        console.log();

        const choices = endpoints.map((ep) => ({
          name: `${ep.name} (${ep.baseUrl})`,
          value: ep.id,
        }));

        choices.push({
          name: chalk.dim('(취소)'),
          value: 'cancel',
        });

        const switchAnswer = await inquirer.prompt([
          {
            type: 'list',
            name: 'endpointId',
            message: '전환할 엔드포인트를 선택하세요:',
            choices: choices,
          },
        ]);

        if (switchAnswer.endpointId !== 'cancel') {
          await configManager.setCurrentEndpoint(switchAnswer.endpointId);
          const newEndpoint = endpoints.find(
            (ep) => ep.id === switchAnswer.endpointId
          );

          console.log(chalk.green('\n✅ 엔드포인트가 변경되었습니다!'));
          console.log(chalk.dim(`  이름: ${newEndpoint?.name || ''}`));
          console.log(chalk.dim(`  URL: ${newEndpoint?.baseUrl || ''}\n`));

          console.log(
            chalk.yellow(
              '⚠️  Interactive Mode를 재시작하면 새 엔드포인트가 적용됩니다.\n'
            )
          );
        } else {
          console.log(chalk.yellow('취소되었습니다.\n'));
        }
      } else {
        console.log();
      }
    } catch (error) {
      console.error(chalk.red('\n❌ 엔드포인트 조회 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
    }
    return { handled: true, shouldContinue: false, shouldBreak: false };
  }

  // /docs - Local document management
  if (userMessage.startsWith('/docs')) {
    try {
      const parts = userMessage.split(' ');
      const subcommand = parts[1] || '';
      const arg = parts.slice(2).join(' ').trim();

      if (subcommand === '' || subcommand === 'list') {
        // List documents
        const documents = await documentManager.listDocuments();

        if (documents.length === 0) {
          console.log(chalk.yellow('\n저장된 문서가 없습니다.\n'));
          console.log(chalk.white('새 문서 추가: open docs add\n'));
          return { handled: true, shouldContinue: false, shouldBreak: false };
        }

        console.log(chalk.cyan.bold('\n📚 로컬 문서 목록\n'));

        documents.slice(0, 10).forEach((doc, index) => {
          console.log(
            chalk.white(`  ${index + 1}. ${chalk.bold(doc.title)}`)
          );
          console.log(chalk.dim(`     ID: ${doc.id}`));

          if (doc.tags.length > 0) {
            console.log(chalk.dim(`     태그: ${doc.tags.join(', ')}`));
          }

          if (doc.preview) {
            console.log(chalk.dim(`     "${doc.preview.substring(0, 60)}..."`));
          }

          console.log();
        });

        if (documents.length > 10) {
          console.log(chalk.dim(`... 외 ${documents.length - 10}개 문서\n`));
        }

        console.log(chalk.dim('문서 보기: /docs view <id>'));
        console.log(chalk.dim('문서 검색: /docs search <query>\n'));
      } else if (subcommand === 'search' && arg) {
        // Search documents
        const spinner = ora ? ora('검색 중...').start() : null;
        const results = await documentManager.searchDocuments(arg);
        if (spinner) spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow('\n검색 결과가 없습니다.\n'));
          return { handled: true, shouldContinue: false, shouldBreak: false };
        }

        console.log(chalk.cyan.bold(`\n🔍 검색 결과: "${arg}"\n`));

        results.slice(0, 5).forEach((doc, index) => {
          console.log(
            chalk.white(`  ${index + 1}. ${chalk.bold(doc.title)}`)
          );
          console.log(chalk.dim(`     ID: ${doc.id}`));

          if (doc.tags.length > 0) {
            console.log(chalk.dim(`     태그: ${doc.tags.join(', ')}`));
          }

          console.log();
        });

        if (results.length > 5) {
          console.log(chalk.dim(`... 외 ${results.length - 5}개 문서\n`));
        }

        console.log(chalk.dim('문서 보기: /docs view <id>\n'));
      } else if (subcommand === 'view' && arg) {
        // View document
        const document = await documentManager.getDocument(arg);

        if (!document) {
          console.log(chalk.red(`\n문서를 찾을 수 없습니다: ${arg}\n`));
          console.log(chalk.white('문서 목록: /docs list\n'));
          return { handled: true, shouldContinue: false, shouldBreak: false };
        }

        console.log(chalk.cyan.bold(`\n📄 ${document.metadata.title}\n`));
        console.log(chalk.dim(`ID: ${document.metadata.id}`));

        if (document.metadata.tags.length > 0) {
          console.log(
            chalk.dim(`태그: ${document.metadata.tags.join(', ')}`)
          );
        }

        console.log(chalk.white(`\n${'─'.repeat(60)}\n`));
        console.log(document.content);
        console.log(chalk.white(`\n${'─'.repeat(60)}\n`));
      } else {
        // Show usage
        console.log(chalk.yellow('\n📚 /docs 명령어 사용법:\n'));
        console.log(chalk.white('  /docs              - 문서 목록 보기'));
        console.log(chalk.white('  /docs search <query> - 문서 검색'));
        console.log(chalk.white('  /docs view <id>     - 문서 내용 보기\n'));
      }
    } catch (error) {
      console.error(chalk.red('\n❌ 문서 조회 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
    }
    return { handled: true, shouldContinue: false, shouldBreak: false };
  }

  // /save [name] - Save session
  if (userMessage.startsWith('/save')) {
    const parts = userMessage.split(' ');
    const sessionName =
      parts.slice(1).join(' ').trim() ||
      `session-${new Date().toISOString().split('T')[0]}`;

    if (context.messages.length === 0) {
      console.log(chalk.yellow('\n⚠️  저장할 대화 내용이 없습니다.\n'));
      return { handled: true, shouldContinue: false, shouldBreak: false };
    }

    try {
      const sessionId = await sessionManager.saveSession(
        sessionName,
        context.messages
      );
      console.log(chalk.green('\n✅ 대화가 저장되었습니다!'));
      console.log(chalk.dim(`  이름: ${sessionName}`));
      console.log(chalk.dim(`  ID: ${sessionId}`));
      console.log(chalk.dim(`  메시지: ${context.messages.length}개\n`));
    } catch (error) {
      console.error(chalk.red('\n❌ 세션 저장 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
    }
    return { handled: true, shouldContinue: false, shouldBreak: false };
  }

  // /sessions - List sessions
  if (userMessage === '/sessions') {
    try {
      const sessions = await sessionManager.listSessions();

      if (sessions.length === 0) {
        console.log(chalk.yellow('\n저장된 대화가 없습니다.\n'));
        return { handled: true, shouldContinue: false, shouldBreak: false };
      }

      console.log(chalk.yellow('\n📋 저장된 대화 목록:\n'));
      sessions.forEach((session, index) => {
        const createdDate = new Date(session.createdAt).toLocaleString('ko-KR');
        console.log(
          chalk.white(`  ${index + 1}. ${chalk.bold(session.name)}`)
        );
        console.log(
          chalk.dim(
            `     메시지: ${session.messageCount}개 | 모델: ${session.model}`
          )
        );
        console.log(chalk.dim(`     생성: ${createdDate}`));
        if (session.firstMessage) {
          const ellipsis = session.firstMessage.length >= 50 ? '...' : '';
          console.log(
            chalk.dim(`     "${session.firstMessage}${ellipsis}"`)
          );
        }
        console.log(chalk.dim(`     ID: ${session.id}`));
        console.log();
      });
    } catch (error) {
      console.error(chalk.red('\n❌ 세션 목록 조회 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
    }
    return { handled: true, shouldContinue: false, shouldBreak: false };
  }

  // /load - Load session
  if (userMessage === '/load') {
    try {
      const sessions = await sessionManager.listSessions();

      if (sessions.length === 0) {
        console.log(chalk.yellow('\n저장된 대화가 없습니다.\n'));
        return { handled: true, shouldContinue: false, shouldBreak: false };
      }

      // Select session
      const choices = sessions.map((session) => ({
        name: `${session.name} (${session.messageCount}개 메시지, ${new Date(session.createdAt).toLocaleDateString('ko-KR')})`,
        value: session.id,
      }));

      const loadAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'sessionId',
          message: '불러올 대화를 선택하세요:',
          choices: choices,
        },
      ]);

      // Load session
      const sessionData = await sessionManager.loadSession(
        loadAnswer.sessionId
      );

      if (!sessionData) {
        console.log(chalk.red('\n❌ 세션을 불러올 수 없습니다.\n'));
        return { handled: true, shouldContinue: false, shouldBreak: false };
      }

      // Restore messages
      context.messages.length = 0;
      context.messages.push(...sessionData.messages);

      console.log(chalk.green('\n✅ 대화가 복원되었습니다!'));
      console.log(chalk.dim(`  이름: ${sessionData.metadata.name}`));
      console.log(
        chalk.dim(`  메시지: ${sessionData.messages.length}개\n`)
      );
    } catch (error) {
      console.error(chalk.red('\n❌ 세션 로드 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
    }
    return { handled: true, shouldContinue: false, shouldBreak: false };
  }

  // /status - Show system status
  if (userMessage === '/status') {
    const endpoint = configManager.getCurrentEndpoint();
    const model = configManager.getCurrentModel();
    const cwd = process.cwd();

    // Read package.json for version
    let version = 'unknown';
    try {
      const { readFile } = await import('fs/promises');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packageJsonPath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      version = packageJson.version;
    } catch {
      version = '0.1.0';
    }

    console.log(chalk.cyan.bold('\n📊 System Status\n'));
    console.log(chalk.white(`  Version:      ${chalk.green(version)}`));
    console.log(chalk.white(`  Session ID:   ${chalk.green(sessionManager.getCurrentSessionId() || 'No active session')}`));
    console.log(chalk.white(`  Working Dir:  ${chalk.green(cwd)}`));
    console.log(chalk.white(`  Endpoint URL: ${chalk.green(endpoint?.baseUrl || 'Not configured')}`));
    console.log(chalk.white(`  LLM ID:    ${chalk.green(model?.name || 'Not configured')} ${chalk.dim(`(${model?.id || 'N/A'})`)}\n`));

    return { handled: true, shouldContinue: false, shouldBreak: false };
  }

  // Command not handled
  return { handled: false, shouldContinue: true, shouldBreak: false };
}
