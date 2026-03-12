#!/usr/bin/env node

/**
 * LOCAL-CLI
 * 오프라인 기업 환경을 위한 완전한 로컬 LLM CLI 플랫폼
 *
 * Entry Point: CLI 애플리케이션의 진입점
 */

import { Command } from 'commander';
import chalk from 'chalk';
import React from 'react';
import { render } from 'ink';
import { createRequire } from 'module';
import { configManager } from './core/config/config-manager.js';
import { createLLMClient } from './core/llm/llm-client.js';
import { PlanExecuteApp } from './ui/components/PlanExecuteApp.js';
import { setupLogging, logger } from './utils/logger.js';
import { runPipeMode } from './pipe/index.js';
import { initializeOptionalTools } from './tools/registry.js';
import { sessionManager } from './core/session/session-manager.js';
import { reportError } from './core/telemetry/error-reporter.js';
import { runChatCommand } from './commands/chat-command.js';
import { runJarvisCommand } from './commands/jarvis-command.js';

// Read version from package.json (single source of truth)
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

// Process-level error handlers (fire-and-forget)
process.on('uncaughtException', (error) => {
  reportError(error, { type: 'uncaughtException' }).catch(() => {});
});
process.on('unhandledRejection', (reason) => {
  reportError(reason, { type: 'unhandledRejection' }).catch(() => {});
});

const program = new Command();

/**
 * CLI 프로그램 설정
 */
program
  .name('local-cli')
  .description('Local CLI - OpenAI-Compatible Local CLI Coding Agent')
  .version(packageJson.version)
  .helpOption(false);  // -h, --help 비활성화 (/help 사용)

/**
 * 기본 명령어: 대화형 모드 시작
 */
program
  .argument('[prompt]', 'Pipe 모드(-p)에서 실행할 명령')
  .option('-p, --pipe', 'Pipe 모드: UI 없이 명령 처리 후 결과만 출력')
  .option('-s, --specific', 'Pipe 모드 상세 출력 (-p와 함께 사용)')
  .option('--verbose', 'Enable verbose logging')
  .option('--debug', 'Enable debug logging')
  .option('--llm-log', 'Enable LLM logging')
  .action(async (prompt: string | undefined, options: { pipe?: boolean; specific?: boolean; verbose?: boolean; debug?: boolean; llmLog?: boolean }) => {
    // -p 모드: non-interactive pipe 모드
    if (options.pipe) {
      if (!prompt) {
        console.error('Error: -p 옵션에는 프롬프트가 필요합니다. 예: local-cli -p "파일 목록 보여줘"');
        process.exit(1);
      }
      // Setup logging for pipe mode (--verbose, --debug, --llm-log)
      if (options.verbose || options.debug || options.llmLog) {
        await setupLogging({ verbose: options.verbose, debug: options.debug, llmLog: options.llmLog });
      }
      await runPipeMode(prompt, options.specific ?? false);
      return;
    }

    let cleanup: (() => Promise<void>) | null = null;
    try {
      // Clear terminal on start
      process.stdout.write('\x1B[2J\x1B[0f');

      // Show loading spinner immediately (before any async work)
      const ora = (await import('ora')).default;
      const spinner = ora({
        text: chalk.cyan('Local-CLI 시작 중...'),
        color: 'cyan',
      }).start();

      // Setup logging (log level, JSON stream logger, exit handlers)
      const loggingSetup = await setupLogging({
        verbose: options.verbose,
        debug: options.debug,
        llmLog: options.llmLog,
      });
      cleanup = loggingSetup.cleanup;

      // Log session start
      logger.sessionStart({
        sessionId: sessionManager.getCurrentSessionId(),
        verbose: options.verbose,
        debug: options.debug,
        llmLog: options.llmLog,
        cwd: process.cwd(),
        platform: process.platform,
        nodeVersion: process.version,
      });

      // ConfigManager 초기화
      spinner.text = chalk.cyan('설정 로드 중...');
      logger.flow('Initializing config manager');
      await configManager.initialize();
      logger.flow('Config manager initialized');

      // Load saved optional tool states (e.g., browser tools, Office tools)
      logger.flow('Initializing optional tools');
      await initializeOptionalTools();
      logger.flow('Optional tools initialized');

      // LLMClient 생성 (엔드포인트가 없으면 null)
      spinner.text = chalk.cyan('LLM 클라이언트 생성 중...');
      let llmClient = null;
      let modelInfo = { model: 'Not configured', endpoint: 'Not configured' };

      if (configManager.hasEndpoints()) {
        logger.flow('Creating LLM client');
        try {
          llmClient = createLLMClient();
          modelInfo = llmClient.getModelInfo();
          logger.flow('LLM client created', { model: modelInfo.model, endpoint: modelInfo.endpoint });
        } catch (error) {
          // LLMClient 생성 실패 시 null 유지
          logger.warn('Failed to create LLM client', { error: error instanceof Error ? error.message : String(error) });
        }
      } else {
        logger.flow('No LLM endpoints configured');
      }

      // Stop spinner before starting Ink UI
      spinner.stop();
      process.stdout.write('\x1B[2J\x1B[0f'); // Clear again for clean UI

      // Ink UI 시작 (verbose/debug/llm-log 모드에서만 시작 메시지 표시)
      if (options.verbose || options.debug) {
        console.log(chalk.cyan('🚀 Starting local-cli...\n'));
      }

      // Ink UI를 같은 프로세스에서 직접 렌더링 (stdin raw mode 유지)
      try {
        // Use PlanExecuteApp for enhanced functionality
        // exitOnCtrlC: false - Ctrl+C is handled manually in PlanExecuteApp for smart behavior
        const { waitUntilExit } = render(
          React.createElement(PlanExecuteApp, { llmClient, modelInfo }),
          { exitOnCtrlC: false }
        );

        // Wait until the UI exits before cleanup
        await waitUntilExit();
      } catch (error) {
        reportError(error, { type: 'inkUiInit' }).catch(() => {});
        console.log(chalk.yellow('\n⚠️  Ink UI를 시작할 수 없습니다.\n'));
        console.log(chalk.dim(`Error: ${error instanceof Error ? error.message : String(error)}\n`));
        process.exit(1);
      }
    } catch (error) {
      reportError(error, { type: 'initialization' }).catch(() => {});
      console.error(chalk.red('\n❌ 에러 발생:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    } finally {
      // Log session end
      logger.sessionEnd({
        sessionId: sessionManager.getCurrentSessionId(),
        exitReason: 'normal',
      });

      // JSON Stream Logger 정리
      if (cleanup) {
        await cleanup();
      }
    }
  });


/**
 * chat 서브커맨드: Electron Chat 창에 명령 전달
 */
program
  .command('chat')
  .description('Electron Chat에 명령을 전달하고 결과를 받습니다')
  .argument('<prompt>', '실행할 명령')
  .option('-s, --specific', '상세 과정을 stderr에 출력')
  .action(async (prompt: string, opts: { specific?: boolean }) => {
    await runChatCommand(prompt, opts.specific ?? false);
  });

/**
 * jarvis 서브커맨드: Electron Jarvis에 명령 전달
 */
program
  .command('jarvis')
  .description('Electron Jarvis에 명령을 전달하고 결과를 받습니다')
  .argument('<prompt>', '실행할 명령')
  .option('-s, --specific', '상세 과정을 stderr에 출력')
  .action(async (prompt: string, opts: { specific?: boolean }) => {
    await runJarvisCommand(prompt, opts.specific ?? false);
  });

/**
 * 에러 핸들링: 알 수 없는 옵션 처리
 */
program.showHelpAfterError(false);
program.configureOutput({
  outputError: (str, write) => {
    if (str.includes('--help') || str.includes('-h')) {
      write(chalk.yellow('💡 For help, use /help command after starting the app.\n'));
    } else {
      write(chalk.red(str));
    }
  }
});

program.on('command:*', () => {
  console.error(chalk.red('⚠️  Unknown command.'));
  console.log(chalk.white('Usage: local-cli [--verbose] [--debug]\n'));
  console.log(chalk.white('Use /help in interactive mode for help.\n'));
  process.exit(1);
});

/**
 * CLI 프로그램 실행
 */
program.parse(process.argv);
