#!/usr/bin/env node

/**
 * A2G-CLI (AI2Go CLI)
 * 오프라인 기업 환경을 위한 완전한 로컬 LLM CLI 플랫폼
 *
 * Entry Point: CLI 애플리케이션의 진입점
 */

import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

/**
 * CLI 프로그램 설정
 */
program.name('a2g').description('A2G-CLI - 오프라인 기업용 AI 코딩 어시스턴트').version('0.1.0');

/**
 * 기본 명령어: 대화형 모드 시작
 */
program.action(() => {
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                      A2G-CLI v0.1.0                        ║'));
  console.log(chalk.cyan.bold('║              오프라인 기업용 AI 코딩 어시스턴트              ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.yellow('⚠️  A2G-CLI가 아직 초기 설정 단계입니다.'));
  console.log(chalk.white('Phase 1 기능이 현재 개발 중입니다.\n'));

  console.log(chalk.green('✅ 완료된 작업:'));
  console.log(chalk.white('  • 프로젝트 초기 설정'));
  console.log(chalk.white('  • TypeScript 및 빌드 환경 구성'));
  console.log(chalk.white('  • 기본 CLI 프레임워크 구축\n'));

  console.log(chalk.blue('📋 다음 작업:'));
  console.log(chalk.white('  • OpenAI Compatible API 클라이언트 구현'));
  console.log(chalk.white('  • 설정 파일 시스템 구축'));
  console.log(chalk.white('  • 파일 시스템 도구 구현\n'));

  console.log(chalk.dim('개발 진행 상황은 PROGRESS.md를 참조하세요.'));
});

/**
 * /help 명령어
 */
program
  .command('help')
  .description('도움말 표시')
  .action(() => {
    console.log(chalk.cyan.bold('\n📚 A2G-CLI 도움말\n'));
    console.log(chalk.white('사용법: a2g [command] [options]\n'));

    console.log(chalk.yellow('주요 명령어:'));
    console.log(chalk.white('  a2g              대화형 모드 시작'));
    console.log(chalk.white('  a2g help         도움말 표시'));
    console.log(chalk.white('  a2g version      버전 정보 표시\n'));

    console.log(chalk.dim('더 자세한 정보는 문서를 참조하세요.'));
    console.log(chalk.dim('https://github.com/your-repo/a2g-cli\n'));
  });

/**
 * 에러 핸들링
 */
program.on('command:*', () => {
  console.error(chalk.red('⚠️  알 수 없는 명령어입니다.'));
  console.log(chalk.white('도움말: a2g help\n'));
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
