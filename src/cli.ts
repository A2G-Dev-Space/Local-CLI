#!/usr/bin/env node

/**
 * OPEN-CLI
 * 오프라인 기업 환경을 위한 완전한 로컬 LLM CLI 플랫폼
 *
 * Entry Point: CLI 애플리케이션의 진입점
 */

import { Command } from 'commander';
import chalk from 'chalk';
import React from 'react';
import { render } from 'ink';
import { configManager } from './core/config/config-manager.js';
import { createLLMClient } from './core/llm/llm-client.js';
import { PlanExecuteApp } from './ui/components/PlanExecuteApp.js';
import { setupLogging } from './utils/logger.js';

const program = new Command();

/**
 * CLI 프로그램 설정
 */
program
  .name('open')
  .description('OPEN-CLI - 오프라인 기업용 AI 코딩 어시스턴트')
  .version('0.1.0')
  .helpOption(false);  // -h, --help 비활성화 (/help 사용)

/**
 * 기본 명령어: 대화형 모드 시작
 */
program
  .option('--verbose', 'Enable verbose logging (shows detailed error messages, HTTP requests, tool execution)')
  .option('--debug', 'Enable debug logging (shows all debug information)')
  .action(async (options: { verbose?: boolean; debug?: boolean }) => {
    let cleanup: (() => Promise<void>) | null = null;
    try {
      // Clear terminal on start
      process.stdout.write('\x1B[2J\x1B[0f');

      // Setup logging (log level, JSON stream logger, exit handlers)
      const loggingSetup = await setupLogging({
        verbose: options.verbose,
        debug: options.debug,
      });
      cleanup = loggingSetup.cleanup;

      // ConfigManager 초기화
      await configManager.initialize();

      // LLMClient 생성 (엔드포인트가 없으면 null)
      let llmClient = null;
      let modelInfo = { model: 'Not configured', endpoint: 'Not configured' };

      if (configManager.hasEndpoints()) {
        try {
          llmClient = createLLMClient();
          modelInfo = llmClient.getModelInfo();
        } catch {
          // LLMClient 생성 실패 시 null 유지
        }
      }

      // Ink UI 시작 (verbose/debug 모드에서만 시작 메시지 표시)
      if (options.verbose || options.debug) {
        console.log(chalk.cyan('🚀 Starting OPEN-CLI...\n'));
      }

      // Ink UI를 같은 프로세스에서 직접 렌더링 (stdin raw mode 유지)
      try {
        // Use PlanExecuteApp for enhanced functionality
        const { waitUntilExit } = render(React.createElement(PlanExecuteApp, { llmClient, modelInfo }));

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
      write(chalk.yellow('💡 도움말은 앱 실행 후 /help 명령어를 사용하세요.\n'));
    } else {
      write(chalk.red(str));
    }
  }
});

program.on('command:*', () => {
  console.error(chalk.red('⚠️  알 수 없는 명령어입니다.'));
  console.log(chalk.white('사용법: open [--verbose] [--debug]\n'));
  console.log(chalk.white('대화형 모드에서 /help를 사용하여 도움말을 확인하세요.\n'));
  process.exit(1);
});

/**
 * CLI 프로그램 실행
 */
program.parse(process.argv);
