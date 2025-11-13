#!/usr/bin/env node

/**
 * OPEN-CLI
 * 오프라인 기업 환경을 위한 완전한 로컬 LLM CLI 플랫폼
 *
 * Entry Point: CLI 애플리케이션의 진입점
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import React from 'react';
import { render } from 'ink';
import { configManager } from './core/config-manager.js';
import { createLLMClient, LLMClient } from './core/llm-client.js';
import { sessionManager } from './core/session-manager.js';
import { documentManager } from './core/document-manager.js';
import { EndpointConfig } from './types/index.js';
// import { InteractiveApp } from './ui/components/InteractiveApp.js';
import { PlanExecuteApp } from './ui/components/PlanExecuteApp.js';
import { GitAutoUpdater } from './core/git-auto-updater.js';
import { logger, LogLevel, setLogLevel } from './utils/logger.js';
import { initializeJsonStreamLogger, closeJsonStreamLogger } from './utils/json-stream-logger.js';

const program = new Command();

/**
 * CLI 프로그램 설정
 */
program.name('open').description('OPEN-CLI - 오프라인 기업용 AI 코딩 어시스턴트').version('0.1.0');

/**
 * 기본 명령어: 대화형 모드 시작
 */
program
  .option('--no-update', 'Skip auto-update check')
  .option('--plan-execute', 'Use Plan & Execute mode (default: auto-detect)')
  .option('--verbose', 'Enable verbose logging (shows detailed error messages, HTTP requests, tool execution)')
  .option('--debug', 'Enable debug logging (shows all debug information)')
  .action(async (options: { noUpdate?: boolean; planExecute?: boolean; verbose?: boolean; debug?: boolean }) => {
  try {
    // Set log level based on CLI options
    // Normal mode (no flags): INFO
    // --verbose: DEBUG (상세 로깅)
    // --debug: VERBOSE (최대 디버그 로깅 + 위치 정보)
    if (options.debug) {
      setLogLevel(LogLevel.VERBOSE);
      logger.info('🔍 Debug mode enabled - maximum logging with location tracking');
    } else if (options.verbose) {
      setLogLevel(LogLevel.DEBUG);
      logger.info('📝 Verbose mode enabled - detailed logging');
    }
    // else: 기본값 INFO (logger 초기화 시 설정됨)

    // Initialize JSON stream logger (always enabled)
    const sessionId = sessionManager.getCurrentSessionId() || Date.now().toString();
    await initializeJsonStreamLogger(sessionId);

    // Ensure cleanup on exit
    process.on('SIGINT', async () => {
      await closeJsonStreamLogger();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await closeJsonStreamLogger();
      process.exit(0);
    });

    // Git-based auto-update (unless disabled)
    if (!options.noUpdate) {
      const updater = new GitAutoUpdater();
      await updater.run({ noUpdate: options.noUpdate });
    }

    // ConfigManager 초기화 확인
    const isInitialized = await configManager.isInitialized();
    if (!isInitialized) {
      console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════╗'));
      console.log(chalk.cyan.bold('║                     OPEN-CLI v0.1.0                        ║'));
      console.log(chalk.cyan.bold('║              오프라인 기업용 AI 코딩 어시스턴트              ║'));
      console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════╝\n'));

      console.log(chalk.yellow('⚠️  OPEN-CLI가 초기화되지 않았습니다.'));
      console.log(chalk.white('먼저 초기화를 진행해주세요:\n'));
      console.log(chalk.green('  $ open config init\n'));
      return;
    }

    await configManager.initialize();

    // LLMClient 생성
    const llmClient = createLLMClient();
    const modelInfo = llmClient.getModelInfo();

    // Ink UI 시작
    console.log(chalk.cyan('🚀 Starting Ink UI...\n'));

    // Ink UI를 같은 프로세스에서 직접 렌더링 (stdin raw mode 유지)
    try {
      // Use PlanExecuteApp for enhanced functionality
      const AppComponent = PlanExecuteApp; // Always use PlanExecuteApp now
      render(React.createElement(AppComponent, { llmClient, modelInfo }));
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
  }
});

/**
 * /help 명령어
 */
program
  .command('help')
  .description('도움말 표시')
  .action(() => {
    console.log(chalk.cyan.bold('\n📚 OPEN-CLI 도움말\n'));
    console.log(chalk.white('사용법: open [command] [options]\n'));

    console.log(chalk.yellow('주요 명령어:'));
    console.log(chalk.white('  open              대화형 모드 시작'));
    console.log(chalk.white('  open help         도움말 표시'));
    console.log(chalk.white('  open version      버전 정보 표시'));
    console.log(chalk.white('  open config       설정 관리'));
    console.log(chalk.white('  open chat         LLM과 대화'));
    console.log(chalk.white('  open tools        File Tools와 함께 대화\n'));

    console.log(chalk.yellow('설정 명령어:'));
    console.log(chalk.white('  open config init  OPEN-CLI 초기화'));
    console.log(chalk.white('  open config show  현재 설정 표시'));
    console.log(chalk.white('  open config reset 설정 초기화\n'));

    console.log(chalk.yellow('대화 명령어:'));
    console.log(chalk.white('  open chat "메시지"       일반 응답'));
    console.log(chalk.white('  open chat "메시지" -s    스트리밍 응답\n'));

    console.log(chalk.yellow('파일 시스템 도구 (자동 바인딩):'));
    console.log(chalk.white('  모든 대화형 모드에서 LLM이 자동으로 사용'));
    console.log(chalk.dim('    read_file, write_file, list_files, find_files'));
    console.log(chalk.dim('    자세한 내용: BIND_TOOLS.md\n'));

    console.log(chalk.dim('더 자세한 정보는 문서를 참조하세요.'));
    console.log(chalk.dim('https://github.com/HanSyngha/open-cli\n'));
  });

/**
 * config 명령어
 */
const configCommand = program.command('config').description('설정 관리');

/**
 * config init - OPEN-CLI 초기화
 */
configCommand
  .command('init')
  .description('OPEN-CLI 초기화 (엔드포인트 설정 및 연결 확인)')
  .action(async () => {
    try {
      console.log(chalk.cyan.bold('\n🚀 OPEN-CLI 초기화\n'));

      // 1. 디렉토리 초기화
      const isInitialized = await configManager.isInitialized();

      if (isInitialized) {
        // 이미 초기화되어 있으면 엔드포인트 추가 여부 확인
        await configManager.initialize();

        if (configManager.hasEndpoints()) {
          console.log(chalk.yellow('⚠️  이미 초기화되어 있습니다.'));
          console.log(chalk.white('설정 확인: open config show'));
          console.log(chalk.white('설정 초기화: open config reset\n'));
          return;
        }
      } else {
        // 디렉토리 생성
        await configManager.initialize();
        console.log(chalk.green('✅ 디렉토리 생성 완료\n'));
      }

      // 2. 사용자 입력 받기
      console.log(chalk.white('엔드포인트 정보를 입력해주세요:\n'));

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '엔드포인트 이름:',
          default: 'My LLM Endpoint',
          validate: (input: string) =>
            input.trim().length > 0 || '이름을 입력해주세요.',
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: 'Base URL (HTTP/HTTPS):',
          default: 'https://generativelanguage.googleapis.com/v1beta/openai/',
          validate: (input: string) => {
            const trimmed = input.trim();
            if (!trimmed) return 'URL을 입력해주세요.';
            if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
              return 'URL은 http:// 또는 https://로 시작해야 합니다.';
            }
            return true;
          },
        },
        {
          type: 'password',
          name: 'apiKey',
          message: 'API Key (선택사항, Enter 키 입력 시 스킵):',
          mask: '*',
        },
        {
          type: 'input',
          name: 'modelId',
          message: 'Model ID:',
          default: 'gemini-2.0-flash',
          validate: (input: string) =>
            input.trim().length > 0 || 'Model ID를 입력해주세요.',
        },
        {
          type: 'input',
          name: 'modelName',
          message: 'Model 이름 (표시용):',
          default: 'Gemini 2.0 Flash',
        },
        {
          type: 'input',
          name: 'maxTokens',
          message: 'Max Tokens:',
          default: '1048576',
          validate: (input: string) => {
            const num = parseInt(input);
            return !isNaN(num) && num > 0 || 'Max Tokens는 양수여야 합니다.';
          },
        },
      ]);

      // 3. 연결 테스트
      console.log(chalk.cyan('\n🔍 엔드포인트 연결 테스트 중...\n'));

      const spinner = ora('연결 확인 중...').start();

      const testResult = await LLMClient.testConnection(
        answers.baseUrl.trim(),
        answers.apiKey?.trim() || '',
        answers.modelId.trim()
      );

      if (!testResult.success) {
        spinner.fail('연결 실패');
        console.log(chalk.red('\n❌ ' + testResult.error + '\n'));
        console.log(chalk.yellow('설정을 확인하고 다시 시도해주세요.\n'));
        process.exit(1);
      }

      spinner.succeed('연결 성공!');

      // 4. 설정 저장
      const endpointId = 'ep-' + Date.now();
      const endpoint: EndpointConfig = {
        id: endpointId,
        name: answers.name.trim(),
        baseUrl: answers.baseUrl.trim(),
        apiKey: answers.apiKey?.trim() || undefined,
        models: [
          {
            id: answers.modelId.trim(),
            name: answers.modelName.trim(),
            maxTokens: parseInt(answers.maxTokens),
            enabled: true,
            healthStatus: 'healthy',
            lastHealthCheck: new Date(),
          },
        ],
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await configManager.createInitialEndpoint(endpoint);

      console.log(chalk.green('\n✅ 초기화 완료!\n'));

      console.log(chalk.white('생성된 디렉토리:'));
      console.log(chalk.dim('  ~/.open-cli/'));
      console.log(chalk.dim('  ~/.open-cli/config.json'));
      console.log(chalk.dim('  ~/.open-cli/docs/'));
      console.log(chalk.dim('  ~/.open-cli/backups/'));
      console.log(chalk.dim('  ~/.open-cli/projects/\n'));

      console.log(chalk.green('📡 등록된 엔드포인트:'));
      console.log(chalk.white('  이름: ' + endpoint.name));
      console.log(chalk.white('  URL: ' + endpoint.baseUrl));
      console.log(chalk.white('  모델: ' + (endpoint.models[0]?.name || '') + ' (' + (endpoint.models[0]?.id || '') + ')'));
      console.log(chalk.white('  상태: 🟢 연결 확인됨\n'));

      console.log(chalk.cyan('다음 단계:'));
      console.log(chalk.white('  open config show  - 현재 설정 확인'));
      console.log(chalk.white('  open chat "메시지" - LLM과 대화 시작\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ 초기화 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * config show - 현재 설정 표시
 */
configCommand
  .command('show')
  .description('현재 설정 표시')
  .action(async () => {
    try {
      const isInitialized = await configManager.isInitialized();

      if (!isInitialized) {
        console.log(chalk.yellow('\n⚠️  OPEN-CLI가 초기화되지 않았습니다.'));
        console.log(chalk.white('초기화: open config init\n'));
        return;
      }

      await configManager.initialize();

      const config = configManager.getConfig();
      const endpoint = configManager.getCurrentEndpoint();
      const model = configManager.getCurrentModel();

      console.log(chalk.cyan.bold('\n📋 OPEN-CLI 설정\n'));

      console.log(chalk.yellow('현재 엔드포인트:'));
      if (endpoint) {
        console.log(chalk.white('  ID: ' + endpoint.id));
        console.log(chalk.white('  이름: ' + endpoint.name));
        console.log(chalk.white('  URL: ' + endpoint.baseUrl));
        console.log(chalk.white('  API Key: ' + (endpoint.apiKey ? '********' : '(없음)')));
        console.log(chalk.white('  우선순위: ' + (endpoint.priority || 'N/A') + '\n'));
      } else {
        console.log(chalk.red('  (설정되지 않음)\n'));
      }

      console.log(chalk.yellow('현재 모델:'));
      if (model) {
        console.log(chalk.white('  ID: ' + model.id));
        console.log(chalk.white('  이름: ' + model.name));
        console.log(chalk.white('  최대 토큰: ' + model.maxTokens.toLocaleString()));
        console.log(chalk.white('  상태: ' + (model.enabled ? '✅ 활성' : '❌ 비활성')));
        console.log(
          chalk.white(
            '  헬스: ' + (model.healthStatus === 'healthy' ? '🟢 정상' : model.healthStatus === 'degraded' ? '🟡 저하됨' : '🔴 비정상') + '\n'
          )
        );
      } else {
        console.log(chalk.red('  (설정되지 않음)\n'));
      }

      console.log(chalk.yellow('전체 설정:'));
      console.log(chalk.white('  버전: ' + config.version));
      console.log(chalk.white('  등록된 엔드포인트: ' + config.endpoints.length + '개'));
      console.log(chalk.white('  자동 승인: ' + (config.settings.autoApprove ? '✅ ON' : '❌ OFF')));
      console.log(chalk.white('  디버그 모드: ' + (config.settings.debugMode ? '✅ ON' : '❌ OFF')));
      console.log(
        chalk.white('  스트리밍 응답: ' + (config.settings.streamResponse ? '✅ ON' : '❌ OFF'))
      );
      console.log(chalk.white('  자동 저장: ' + (config.settings.autoSave ? '✅ ON' : '❌ OFF') + '\n'));
    } catch (error) {
      console.error(chalk.red('❌ 설정 조회 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      process.exit(1);
    }
  });

/**
 * config reset - 설정 초기화
 */
configCommand
  .command('reset')
  .description('설정 초기화 (공장 초기화)')
  .action(async () => {
    try {
      const isInitialized = await configManager.isInitialized();

      if (!isInitialized) {
        console.log(chalk.yellow('\n⚠️  OPEN-CLI가 초기화되지 않았습니다.'));
        console.log(chalk.white('초기화: open config init\n'));
        return;
      }

      console.log(chalk.yellow('\n⚠️  경고: 모든 설정이 초기화됩니다.'));
      console.log(chalk.white('세션 및 백업은 유지됩니다.\n'));

      // 실제 프로덕션에서는 inquirer로 확인 받기
      await configManager.initialize();
      await configManager.reset();

      console.log(chalk.green('✅ 설정이 초기화되었습니다.\n'));
    } catch (error) {
      console.error(chalk.red('❌ 설정 초기화 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      process.exit(1);
    }
  });

/**
 * config endpoints - 엔드포인트 목록 보기
 */
configCommand
  .command('endpoints')
  .description('모든 엔드포인트 목록 보기')
  .action(async () => {
    try {
      const isInitialized = await configManager.isInitialized();
      if (!isInitialized) {
        console.log(chalk.yellow('\n⚠️  OPEN-CLI가 초기화되지 않았습니다.'));
        console.log(chalk.white('초기화: open config init\n'));
        return;
      }

      await configManager.initialize();

      const endpoints = configManager.getAllEndpoints();
      const currentEndpoint = configManager.getCurrentEndpoint();

      if (endpoints.length === 0) {
        console.log(chalk.yellow('\n등록된 엔드포인트가 없습니다.'));
        console.log(chalk.white('엔드포인트 추가: open config endpoint add\n'));
        return;
      }

      console.log(chalk.cyan.bold('\n📡 등록된 엔드포인트 목록\n'));

      endpoints.forEach((endpoint, index) => {
        const isCurrent = endpoint.id === currentEndpoint?.id;
        const marker = isCurrent ? chalk.green('●') : chalk.dim('○');

        console.log(marker + ' ' + chalk.bold(endpoint.name) + ' ' + (isCurrent ? chalk.green('(현재)') : ''));
        console.log(chalk.dim('   ID: ' + endpoint.id));
        console.log(chalk.dim('   URL: ' + endpoint.baseUrl));
        console.log(chalk.dim('   모델: ' + endpoint.models.length + '개'));

        endpoint.models.forEach((model) => {
          const modelMarker = model.enabled ? '✓' : '✗';
          console.log(chalk.dim('     ' + modelMarker + ' ' + model.name + ' (' + model.id + ')'));
        });

        if (index < endpoints.length - 1) {
          console.log();
        }
      });

      console.log();
    } catch (error) {
      console.error(chalk.red('\n❌ 엔드포인트 목록 조회 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * config endpoint add - 새 엔드포인트 추가
 */
configCommand
  .command('endpoint add')
  .alias('endpoint-add')
  .description('새 엔드포인트 추가')
  .action(async () => {
    try {
      const isInitialized = await configManager.isInitialized();
      if (!isInitialized) {
        console.log(chalk.yellow('\n⚠️  OPEN-CLI가 초기화되지 않았습니다.'));
        console.log(chalk.white('초기화: open config init\n'));
        return;
      }

      await configManager.initialize();

      console.log(chalk.cyan.bold('\n➕ 새 엔드포인트 추가\n'));
      console.log(chalk.white('엔드포인트 정보를 입력해주세요:\n'));

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '엔드포인트 이름:',
          validate: (input: string) => input.trim().length > 0 || '이름을 입력해주세요.',
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: 'Base URL (HTTP/HTTPS):',
          validate: (input: string) => {
            const trimmed = input.trim();
            if (!trimmed) return 'URL을 입력해주세요.';
            if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
              return 'URL은 http:// 또는 https://로 시작해야 합니다.';
            }
            return true;
          },
        },
        {
          type: 'password',
          name: 'apiKey',
          message: 'API Key (선택사항, Enter로 스킵):',
          mask: '*',
        },
        {
          type: 'input',
          name: 'modelId',
          message: 'Model ID:',
          validate: (input: string) => input.trim().length > 0 || 'Model ID를 입력해주세요.',
        },
        {
          type: 'input',
          name: 'modelName',
          message: 'Model 이름 (표시용):',
        },
        {
          type: 'input',
          name: 'maxTokens',
          message: 'Max Tokens:',
          default: '100000',
          validate: (input: string) => {
            const num = parseInt(input);
            return (!isNaN(num) && num > 0) || 'Max Tokens는 양수여야 합니다.';
          },
        },
      ]);

      // 연결 테스트
      console.log(chalk.cyan('\n🔍 엔드포인트 연결 테스트 중...\n'));

      const spinner = ora('연결 확인 중...').start();

      const testResult = await LLMClient.testConnection(
        answers.baseUrl.trim(),
        answers.apiKey?.trim() || '',
        answers.modelId.trim()
      );

      if (!testResult.success) {
        spinner.fail('연결 실패');
        console.log(chalk.red('\n❌ ' + testResult.error + '\n'));
        console.log(chalk.yellow('설정을 확인하고 다시 시도해주세요.\n'));
        return;
      }

      spinner.succeed('연결 성공!');

      // 엔드포인트 추가
      const endpointId = 'ep-' + Date.now();
      const endpoint: EndpointConfig = {
        id: endpointId,
        name: answers.name.trim(),
        baseUrl: answers.baseUrl.trim(),
        apiKey: answers.apiKey?.trim() || undefined,
        models: [
          {
            id: answers.modelId.trim(),
            name: answers.modelName.trim() || answers.modelId.trim(),
            maxTokens: parseInt(answers.maxTokens),
            enabled: true,
            healthStatus: 'healthy',
            lastHealthCheck: new Date(),
          },
        ],
        priority: configManager.getAllEndpoints().length + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await configManager.addEndpoint(endpoint);

      console.log(chalk.green('\n엔드포인트가 추가되었습니다!\n'));
      console.log(chalk.white('  이름: ' + endpoint.name));
      console.log(chalk.white('  ID: ' + endpoint.id));
      console.log(chalk.white('  URL: ' + endpoint.baseUrl));
      console.log(chalk.white('  모델: ' + (endpoint.models[0]?.name || '') + '\n'));

      // 현재 엔드포인트로 전환할지 물어보기
      const switchAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'switch',
          message: '이 엔드포인트를 현재 엔드포인트로 설정하시겠습니까?',
          default: false,
        },
      ]);

      if (switchAnswer.switch) {
        await configManager.setCurrentEndpoint(endpointId);
        console.log(chalk.green('✅ 현재 엔드포인트가 변경되었습니다.\n'));
      }
    } catch (error) {
      console.error(chalk.red('\n❌ 엔드포인트 추가 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * config endpoint remove - 엔드포인트 삭제
 */
configCommand
  .command('endpoint remove <id>')
  .alias('endpoint-remove')
  .description('엔드포인트 삭제')
  .action(async (id: string) => {
    try {
      const isInitialized = await configManager.isInitialized();
      if (!isInitialized) {
        console.log(chalk.yellow('\n⚠️  OPEN-CLI가 초기화되지 않았습니다.'));
        return;
      }

      await configManager.initialize();

      const endpoints = configManager.getAllEndpoints();
      const endpoint = endpoints.find((ep) => ep.id === id);

      if (!endpoint) {
        console.log(chalk.red('\n엔드포인트를 찾을 수 없습니다: ' + id + '\n'));
        console.log(chalk.white('엔드포인트 목록: open config endpoints\n'));
        return;
      }

      console.log(chalk.yellow('\n다음 엔드포인트를 삭제하시겠습니까?\n'));
      console.log(chalk.white('  이름: ' + endpoint.name));
      console.log(chalk.white('  ID: ' + endpoint.id));
      console.log(chalk.white('  URL: ' + endpoint.baseUrl + '\n'));

      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: '정말 삭제하시겠습니까?',
          default: false,
        },
      ]);

      if (!answer.confirm) {
        console.log(chalk.yellow('취소되었습니다.\n'));
        return;
      }

      await configManager.removeEndpoint(id);
      console.log(chalk.green('✅ 엔드포인트가 삭제되었습니다.\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ 엔드포인트 삭제 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * config endpoint switch - 엔드포인트 전환
 */
configCommand
  .command('endpoint switch <id>')
  .alias('endpoint-switch')
  .description('현재 엔드포인트 전환')
  .action(async (id: string) => {
    try {
      const isInitialized = await configManager.isInitialized();
      if (!isInitialized) {
        console.log(chalk.yellow('\n⚠️  OPEN-CLI가 초기화되지 않았습니다.'));
        return;
      }

      await configManager.initialize();

      const endpoints = configManager.getAllEndpoints();
      const endpoint = endpoints.find((ep) => ep.id === id);

      if (!endpoint) {
        console.log(chalk.red('\n엔드포인트를 찾을 수 없습니다: ' + id + '\n'));
        console.log(chalk.white('엔드포인트 목록: open config endpoints\n'));
        return;
      }

      await configManager.setCurrentEndpoint(id);

      console.log(chalk.green('\n엔드포인트가 변경되었습니다!\n'));
      console.log(chalk.white('  이름: ' + endpoint.name));
      console.log(chalk.white('  URL: ' + endpoint.baseUrl));
      console.log(chalk.white('  모델: ' + (endpoint.models.find((m) => m.enabled)?.name || '') + '\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ 엔드포인트 전환 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * docs 명령어 - 로컬 문서 관리
 */
const docsCommand = program.command('docs').description('로컬 문서 관리 (마크다운 지식 베이스)');

/**
 * docs list - 모든 문서 목록
 */
docsCommand
  .command('list')
  .description('모든 문서 목록 보기')
  .action(async () => {
    try {
      const documents = await documentManager.listDocuments();

      if (documents.length === 0) {
        console.log(chalk.yellow('\n저장된 문서가 없습니다.\n'));
        console.log(chalk.white('새 문서 추가: open docs add\n'));
        return;
      }

      console.log(chalk.cyan.bold('\n📚 로컬 문서 목록\n'));

      documents.forEach((doc, index) => {
        const createdDate = new Date(doc.createdAt).toLocaleDateString('ko-KR');
        console.log(chalk.white('  ' + (index + 1) + '. ' + chalk.bold(doc.title)));
        console.log(chalk.dim('     ID: ' + doc.id));
        console.log(chalk.dim('     생성: ' + createdDate + ' | 길이: ' + doc.contentLength + '자'));

        if (doc.tags.length > 0) {
          console.log(chalk.dim('     태그: ' + doc.tags.join(', ')));
        }

        if (doc.preview) {
          console.log(chalk.dim('     "' + doc.preview + (doc.contentLength > 100 ? '...' : '') + '"'));
        }

        console.log();
      });

      console.log(chalk.dim('총 ' + documents.length + '개 문서\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ 문서 목록 조회 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * docs add - 새 문서 추가
 */
docsCommand
  .command('add')
  .description('새 문서 추가 (대화형)')
  .action(async () => {
    try {
      console.log(chalk.cyan.bold('\n📝 새 문서 추가\n'));

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'title',
          message: '문서 제목:',
          validate: (input: string) => {
            if (!input.trim()) {
              return '제목을 입력해주세요.';
            }
            return true;
          },
        },
        {
          type: 'editor',
          name: 'content',
          message: '문서 내용 (에디터가 열립니다):',
          default: '# 제목\n\n내용을 입력하세요...\n',
        },
        {
          type: 'input',
          name: 'tags',
          message: '태그 (쉼표로 구분, 선택사항):',
          default: '',
        },
      ]);

      const tags = answers.tags
        .split(',')
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0);

      const docId = await documentManager.addDocument(answers.title.trim(), answers.content, tags);

      console.log(chalk.green('\n✅ 문서가 추가되었습니다!\n'));
      console.log(chalk.white('  제목: ' + answers.title.trim()));
      console.log(chalk.white('  ID: ' + docId));
      console.log(chalk.white('  길이: ' + answers.content.length + '자'));
      if (tags.length > 0) {
        console.log(chalk.white('  태그: ' + tags.join(', ')));
      }
      console.log();
    } catch (error) {
      console.error(chalk.red('\n❌ 문서 추가 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * docs view <id> - 문서 내용 보기
 */
docsCommand
  .command('view <id>')
  .description('문서 내용 보기')
  .action(async (id: string) => {
    try {
      const document = await documentManager.getDocument(id);

      if (!document) {
        console.log(chalk.red('\n문서를 찾을 수 없습니다: ' + id + '\n'));
        console.log(chalk.white('문서 목록: open docs list\n'));
        return;
      }

      console.log(chalk.cyan.bold('\n📄 ' + document.metadata.title + '\n'));
      console.log(chalk.dim('ID: ' + document.metadata.id));
      console.log(chalk.dim('생성: ' + new Date(document.metadata.createdAt).toLocaleString('ko-KR')));
      console.log(chalk.dim('수정: ' + new Date(document.metadata.updatedAt).toLocaleString('ko-KR')));

      if (document.metadata.tags.length > 0) {
        console.log(chalk.dim('태그: ' + document.metadata.tags.join(', ')));
      }

      console.log(chalk.white('\n' + '─'.repeat(60) + '\n'));
      console.log(document.content);
      console.log(chalk.white('\n' + '─'.repeat(60) + '\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ 문서 조회 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * docs search <query> - 문서 검색
 */
docsCommand
  .command('search <query>')
  .description('문서 검색 (제목, 내용, 태그)')
  .action(async (query: string) => {
    try {
      console.log(chalk.cyan.bold('\n🔍 검색 중: "' + query + '"\n'));

      const spinner = ora('검색 중...').start();
      const results = await documentManager.searchDocuments(query);
      spinner.stop();

      if (results.length === 0) {
        console.log(chalk.yellow('검색 결과가 없습니다.\n'));
        return;
      }

      console.log(chalk.green('✅ ' + results.length + '개 문서 발견\n'));

      results.forEach((doc, index) => {
        const createdDate = new Date(doc.createdAt).toLocaleDateString('ko-KR');
        console.log(chalk.white('  ' + (index + 1) + '. ' + chalk.bold(doc.title)));
        console.log(chalk.dim('     ID: ' + doc.id));
        console.log(chalk.dim('     생성: ' + createdDate));

        if (doc.tags.length > 0) {
          console.log(chalk.dim('     태그: ' + doc.tags.join(', ')));
        }

        if (doc.preview) {
          console.log(chalk.dim('     "' + doc.preview + '..."'));
        }

        console.log();
      });
    } catch (error) {
      console.error(chalk.red('\n❌ 문서 검색 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * docs delete <id> - 문서 삭제
 */
docsCommand
  .command('delete <id>')
  .description('문서 삭제')
  .action(async (id: string) => {
    try {
      const document = await documentManager.getDocument(id);

      if (!document) {
        console.log(chalk.red('\n문서를 찾을 수 없습니다: ' + id + '\n'));
        return;
      }

      console.log(chalk.yellow.bold('\n⚠️  문서 삭제\n'));
      console.log(chalk.white('  제목: ' + document.metadata.title));
      console.log(chalk.white('  생성: ' + new Date(document.metadata.createdAt).toLocaleDateString('ko-KR')));
      console.log(chalk.white('  길이: ' + document.metadata.contentLength + '자\n'));

      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: '정말 삭제하시겠습니까?',
          default: false,
        },
      ]);

      if (!answer.confirm) {
        console.log(chalk.yellow('\n취소되었습니다.\n'));
        return;
      }

      await documentManager.deleteDocument(id);
      console.log(chalk.green('\n✅ 문서가 삭제되었습니다!\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ 문서 삭제 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * docs tags - 모든 태그 목록
 */
docsCommand
  .command('tags')
  .description('모든 태그 목록 보기')
  .action(async () => {
    try {
      const tags = await documentManager.getAllTags();

      if (tags.length === 0) {
        console.log(chalk.yellow('\n태그가 없습니다.\n'));
        return;
      }

      console.log(chalk.cyan.bold('\n🏷️  모든 태그\n'));

      for (let index = 0; index < tags.length; index++) {
        const tag = tags[index]!;
        const docs = await documentManager.getDocumentsByTag(tag);
        console.log(chalk.white('  ' + (index + 1) + '. ' + chalk.bold(tag) + chalk.dim(' (' + docs.length + '개 문서)')));
      }

      console.log(chalk.dim('\n총 ' + tags.length + '개 태그\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ 태그 목록 조회 실패:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * chat 명령어 - 간단한 대화 테스트
 */
program
  .command('chat <message>')
  .description('LLM과 간단한 대화 (테스트용)')
  .option('-s, --stream', '스트리밍 응답 사용')
  .option('--system <prompt>', '시스템 프롬프트')
  .action(async (message: string, options: { stream?: boolean; system?: string }) => {
    try {
      // ConfigManager 초기화 확인
      const isInitialized = await configManager.isInitialized();
      if (!isInitialized) {
        console.log(chalk.yellow('\n⚠️  OPEN-CLI가 초기화되지 않았습니다.'));
        console.log(chalk.white('초기화: open config init\n'));
        return;
      }

      await configManager.initialize();

      // LLMClient 생성
      const llmClient = createLLMClient();
      const modelInfo = llmClient.getModelInfo();

      console.log(chalk.cyan('\n💬 OPEN-CLI Chat\n'));
      console.log(chalk.dim('모델: ' + modelInfo.model));
      console.log(chalk.dim('엔드포인트: ' + modelInfo.endpoint + '\n'));

      if (options.stream) {
        // 스트리밍 응답
        console.log(chalk.green('🤖 Assistant: '));

        const spinner = ora('응답 생성 중...').start();
        let isFirstChunk = true;

        try {
          for await (const chunk of llmClient.sendMessageStream(message, options.system)) {
            if (isFirstChunk) {
              spinner.stop();
              isFirstChunk = false;
            }
            process.stdout.write(chalk.white(chunk));
          }
          console.log('\n');
        } catch (error) {
          spinner.stop();
          throw error;
        }
      } else {
        // 일반 응답
        const spinner = ora('응답 생성 중...').start();

        const response = await llmClient.sendMessage(message, options.system);

        spinner.succeed('응답 완료');
        console.log(chalk.green('\n🤖 Assistant:'));
        console.log(chalk.white(response));
        console.log();
      }
    } catch (error) {
      console.error(chalk.red('\n❌ 에러 발생:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * tools 명령어 - File Tools를 사용한 대화
 */
program
  .command('tools <message>')
  .description('File Tools를 사용하여 LLM과 대화 (파일 읽기/쓰기/검색 가능)')
  .option('--system <prompt>', '시스템 프롬프트')
  .action(async (message: string, options: { system?: string }) => {
    try {
      // ConfigManager 초기화 확인
      const isInitialized = await configManager.isInitialized();
      if (!isInitialized) {
        console.log(chalk.yellow('\n⚠️  OPEN-CLI가 초기화되지 않았습니다.'));
        console.log(chalk.white('초기화: open config init\n'));
        return;
      }

      await configManager.initialize();

      // LLMClient 생성
      const llmClient = createLLMClient();
      const modelInfo = llmClient.getModelInfo();

      // File Tools import
      const { FILE_TOOLS } = await import('./tools/file-tools.js');

      console.log(chalk.cyan('\n🛠️  OPEN-CLI Tools Mode\n'));
      console.log(chalk.dim('모델: ' + modelInfo.model));
      console.log(chalk.dim('엔드포인트: ' + modelInfo.endpoint));
      console.log(chalk.dim('사용 가능한 도구: read_file, write_file, list_files, find_files\n'));

      const spinner = ora('LLM 작업 중...').start();

      const result = await llmClient.sendMessageWithTools(
        message,
        FILE_TOOLS,
        options.system
      );

      spinner.succeed('작업 완료');

      // Tool 사용 내역 표시
      if (result.toolCalls.length > 0) {
        console.log(chalk.yellow('\n🔧 사용된 도구:\n'));
        result.toolCalls.forEach((call, index) => {
          console.log(chalk.white('  ' + (index + 1) + '. ' + call.tool));
          console.log(chalk.dim('     Args: ' + JSON.stringify(call.args)));
          const resultPreview = call.result.substring(0, 100) + (call.result.length > 100 ? '...' : '');
          console.log(chalk.dim('     Result: ' + resultPreview + '\n'));
        });
      }

      // 최종 응답
      console.log(chalk.green('🤖 Assistant:'));
      console.log(chalk.white(result.response));
      console.log();
    } catch (error) {
      console.error(chalk.red('\n❌ 에러 발생:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      console.log();
      process.exit(1);
    }
  });

/**
 * 에러 핸들링
 */
program.on('command:*', () => {
  console.error(chalk.red('⚠️  알 수 없는 명령어입니다.'));
  console.log(chalk.white('도움말: open help\n'));
  process.exit(1);
});

/**
 * CLI 프로그램 실행
 */
program.parse(process.argv);

// 명령어가 없으면 기본 동작 실행
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
