#!/usr/bin/env node

/**
 * Nexus Coder
 * Enterprise AI Coding Assistant
 *
 * Entry Point: CLI 애플리케이션의 진입점
 * 폐쇄망 환경: SSO 인증 필수
 */

import { Command } from 'commander';
import chalk from 'chalk';
import React from 'react';
import { render } from 'ink';
import { configManager } from './core/config/config-manager.js';
import { PlanExecuteApp } from './ui/components/PlanExecuteApp.js';
import { setupLogging } from './utils/logger.js';
import { runEvalMode } from './eval/index.js';
import { APP_VERSION } from './constants.js';
import { initializeOptionalTools } from './tools/registry.js';

const program = new Command();

/**
 * CLI 프로그램 설정
 */
program
  .name('nexus')
  .description('Nexus Coder - Enterprise AI Coding Assistant')
  .version(APP_VERSION)
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

      // Setup logging (log level, JSON stream logger, exit handlers)
      const loggingSetup = await setupLogging({
        verbose: options.verbose,
        debug: options.debug,
        llmLog: options.llmLog,
      });
      cleanup = loggingSetup.cleanup;

      // ConfigManager 초기화
      await configManager.initialize();

      // Load saved optional tool states (e.g., browser tools)
      await initializeOptionalTools();

      // Ink UI 시작 - 모든 초기화는 PlanExecuteApp에서 UI와 함께 처리
      // (git update → login → health → docs → config)
      try {
        const { waitUntilExit } = render(
          React.createElement(PlanExecuteApp, { llmClient: null, modelInfo: { model: 'Not configured', endpoint: 'Not configured' } }),
          { exitOnCtrlC: false }
        );
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
  console.log(chalk.white('Usage: nexus [--verbose] [--debug]\n'));
  console.log(chalk.white('Use /help in interactive mode for help.\n'));
  process.exit(1);
});

/**
 * CLI 프로그램 실행
 */
program.parse(process.argv);
