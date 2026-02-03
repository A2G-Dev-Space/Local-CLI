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
import { runEvalMode } from './eval/index.js';
import { initializeOptionalTools } from './tools/registry.js';
import { sessionManager } from './core/session/session-manager.js';

// Read version from package.json (single source of truth)
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

const program = new Command();

/**
 * CLI 프로그램 설정
 */
program
  .name('lcli')
  .description('LOCAL-CLI - OpenAI-Compatible Local CLI Coding Agent')
  .version(packageJson.version)
  .helpOption(false);  // -h, --help 비활성화 (/help 사용)

/**
 * 기본 명령어: 대화형 모드 시작
 */
program
  .option('--verbose', 'Enable verbose logging')
  .option('--debug', 'Enable debug logging')
  .option('--llm-log', 'Enable LLM logging')
  .option('--eval', 'Evaluation mode: read JSON from stdin, output NDJSON events')
  .action(async (options: { verbose?: boolean; debug?: boolean; llmLog?: boolean; eval?: boolean }) => {
    // --eval 모드: stdin JSON 입력, stdout NDJSON 이벤트 출력
    if (options.eval) {
      await runEvalMode();
      return;
    }

    let cleanup: (() => Promise<void>) | null = null;
    try {
      // Clear terminal on start
      process.stdout.write('\x1B[2J\x1B[0f');

      // Show loading spinner immediately (before any async work)
      const ora = (await import('ora')).default;
      const spinner = ora({
        text: chalk.cyan('한설 시작 중...'),
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
        console.log(chalk.cyan('🚀 Starting LOCAL-CLI...\n'));
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
        console.log(chalk.yellow('\n⚠️  Ink UI를 시작할 수 없습니다.\n'));
        console.log(chalk.dim(`Error: ${error instanceof Error ? error.message : String(error)}\n`));
        process.exit(1);
      }
    } catch (error) {
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
  console.log(chalk.white('Usage: lcli [--verbose] [--debug]\n'));
  console.log(chalk.white('Use /help in interactive mode for help.\n'));
  process.exit(1);
});

/**
 * CLI 프로그램 실행
 */
program.parse(process.argv);
