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
import { createRequire } from 'module';
import open from 'open';
import { configManager } from './core/config/config-manager.js';
import { createLLMClient } from './core/llm/llm-client.js';
import { PlanExecuteApp } from './ui/components/PlanExecuteApp.js';
import { setupLogging } from './utils/logger.js';
import { setupNexusModels } from './core/nexus-setup.js';
import { authManager } from './core/auth/index.js';
import { runEvalMode } from './eval/index.js';
import { GitAutoUpdater } from './core/git-auto-updater.js';

// Read version from package.json (single source of truth)
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

const program = new Command();

/**
 * CLI 프로그램 설정
 */
program
  .name('nexus')
  .description('Nexus Coder - Enterprise AI Coding Assistant')
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

      // Setup logging (log level, JSON stream logger, exit handlers)
      const loggingSetup = await setupLogging({
        verbose: options.verbose,
        debug: options.debug,
        llmLog: options.llmLog,
      });
      cleanup = loggingSetup.cleanup;

      // ConfigManager 초기화
      await configManager.initialize();

      // Auto-update 체크 (최우선: 로그인 전에 실행)
      const updater = new GitAutoUpdater({
        onStatus: (status) => {
          switch (status.type) {
            case 'checking':
              console.log(chalk.gray('Checking for updates...'));
              break;
            case 'first_run':
            case 'updating':
              console.log(chalk.cyan(`  [${status.step}/${status.totalSteps}] ${status.message}`));
              break;
            case 'complete':
              console.log(chalk.green(`\n✓ ${status.message}\n`));
              break;
            case 'error':
              console.log(chalk.red(`\n✗ ${status.message}\n`));
              break;
            case 'no_update':
              // Silent - no message needed
              break;
          }
        }
      });
      const needsRestart = await updater.run();
      if (needsRestart) {
        process.exit(0);
      }

      // AuthManager 초기화 및 SSO 로그인 체크
      await authManager.initialize();

      if (!authManager.isAuthenticated()) {
        console.log(chalk.yellow('\n🔐 SSO 로그인이 필요합니다.\n'));
        console.log(chalk.gray('브라우저에서 로그인 페이지가 열립니다...\n'));

        try {
          await authManager.login(async (url) => {
            await open(url);
          });
          const user = authManager.getCurrentUser();
          console.log(chalk.green(`✓ 로그인 성공: ${user?.username} (${user?.deptname})\n`));
        } catch (error) {
          console.error(chalk.red('\n❌ SSO 로그인 실패:'));
          if (error instanceof Error) {
            console.error(chalk.red(`   ${error.message}`));
          }
          console.log(chalk.yellow('\n인증서 파일을 확인하거나 관리자에게 문의하세요.\n'));
          process.exit(1);
        }
      }

      // Admin Server에서 모델 목록 가져와서 설정
      if (options.verbose || options.debug) {
        console.log(chalk.gray('Fetching models from Admin Server...'));
      }
      try {
        await setupNexusModels(options.debug);
        if (options.verbose || options.debug) {
          console.log(chalk.green('✓ Models loaded from Admin Server\n'));
        }
      } catch (error) {
        console.error(chalk.red('\n❌ Admin Server에서 모델 목록을 가져올 수 없습니다.'));
        if (error instanceof Error) {
          console.error(chalk.red(`   ${error.message}`));
        }
        console.log(chalk.yellow('\n서버 연결 상태를 확인하거나 관리자에게 문의하세요.\n'));
        process.exit(1);
      }

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

      // Ink UI 시작 (verbose/debug/llm-log 모드에서만 시작 메시지 표시)
      if (options.verbose || options.debug) {
        console.log(chalk.cyan('🚀 Starting Nexus Coder...\n'));
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
