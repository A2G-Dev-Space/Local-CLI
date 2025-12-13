#!/usr/bin/env node

/**
 * Nexus Coder
 * Enterprise AI Coding Assistant
 *
 * Entry Point: CLI 애플리케이션의 진입점
 * 폐쇄망 환경: 인증 없이 사용 가능
 */

import { Command } from 'commander';
import chalk from 'chalk';
import React from 'react';
import { render } from 'ink';
import { createRequire } from 'module';
import { configManager } from './core/config/config-manager.js';
import { createLLMClient } from './core/llm/llm-client.js';
import { PlanExecuteApp } from './ui/components/PlanExecuteApp.js';
import { setupLogging } from './utils/logger.js';
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
  .action(async (options: { verbose?: boolean; debug?: boolean; llmLog?: boolean }) => {
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
      } catch (error: any) {
        console.error(chalk.red('\n❌ Admin Server에서 모델 목록을 가져올 수 없습니다.'));
        if (error instanceof Error) {
          console.error(chalk.red(`   ${error.message}`));
        }

        // 프록시 차단 감지
        const responseData = error.response?.data;
        if (responseData && (
          typeof responseData === 'string' && responseData.includes('차단') ||
          JSON.stringify(responseData).includes('차단')
        )) {
          console.log(chalk.yellow('\n⚠️  사내 프록시에 의해 차단되었습니다.'));
          console.log(chalk.white('   no_proxy 환경변수에 서버 주소를 추가하세요:\n'));
          console.log(chalk.cyan('   export no_proxy="$no_proxy,a2g.samsungds.net"'));
          console.log(chalk.gray('\n   또는 ~/.bashrc 또는 ~/.zshrc에 추가 후 터미널 재시작\n'));
        } else {
          console.log(chalk.yellow('\n서버 연결 상태를 확인하거나 관리자에게 문의하세요.\n'));
        }
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
 * login 명령어: SSO 로그인
 */
program
  .command('login')
  .description('Login via SSO')
  .action(async () => {
    console.log(chalk.cyan('🔐 SSO Login'));
    console.log(chalk.yellow('SSO login will be implemented in Phase 2'));
    // TODO: Implement SSO login flow
    // 1. Start local callback server
    // 2. Open browser to SSO URL
    // 3. Receive JWT token
    // 4. Decode and store credentials
  });

/**
 * logout 명령어: 로그아웃
 */
program
  .command('logout')
  .description('Logout and clear credentials')
  .action(async () => {
    console.log(chalk.cyan('🔓 Logging out...'));
    console.log(chalk.yellow('Logout will be implemented in Phase 2'));
    // TODO: Clear auth.json
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
  console.log(chalk.white('사용법: ncli [--verbose] [--debug]\n'));
  console.log(chalk.white('대화형 모드에서 /help를 사용하여 도움말을 확인하세요.\n'));
  process.exit(1);
});

/**
 * CLI 프로그램 실행
 */
program.parse(process.argv);
