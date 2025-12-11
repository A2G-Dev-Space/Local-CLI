#!/usr/bin/env npx tsx
/**
 * E2E 테스트 실행 스크립트
 *
 * 사용법:
 *   npm run test:e2e              # 전체 테스트 실행
 *   npm run test:e2e -- --verbose # 상세 로그
 *   npm run test:e2e -- --live    # 실시간 LLM 출력 스트리밍
 *   npm run test:e2e -- --filter file-tools  # 특정 카테고리만
 *   npm run test:e2e -- --test llm-basic-chat  # 특정 테스트만
 *   npm run test:e2e -- --fail-fast # 첫 실패 시 중단
 *
 * 카테고리:
 *   file-tools, llm-client, plan-execute, session, config,
 *   local-rag, integration, settings, demos, agno-eval
 */

import { E2ETestRunner } from './runner.js';
import { getAllScenarios, getScenarioStats } from './scenarios/index.js';
import chalk from 'chalk';

async function main() {
  // 커맨드라인 인자 파싱
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const live = args.includes('--live') || args.includes('--stream');
  const failFast = args.includes('--fail-fast') || args.includes('-f');
  const filterIndex = args.findIndex((a) => a === '--filter' || a === '-c');
  const filter = filterIndex !== -1 ? args[filterIndex + 1] : undefined;
  const testIndex = args.findIndex((a) => a === '--test' || a === '-t');
  const testId = testIndex !== -1 ? args[testIndex + 1] : undefined;
  const help = args.includes('--help') || args.includes('-h');
  const listOnly = args.includes('--list') || args.includes('-l');

  if (help) {
    printHelp();
    process.exit(0);
  }

  // 시나리오 통계 출력
  console.log();
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold.white('          OPEN-CLI E2E Test Suite                          ') + chalk.cyan('║'));
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
  console.log();

  const stats = getScenarioStats();
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  console.log(chalk.bold('테스트 시나리오 현황:'));
  console.log();

  for (const [category, count] of Object.entries(stats)) {
    const bar = '█'.repeat(count) + '░'.repeat(10 - Math.min(count, 10));
    console.log(`  ${chalk.cyan(category.padEnd(15))} ${chalk.gray(bar)} ${count}개`);
  }

  console.log();
  console.log(`  ${chalk.bold('총계:')} ${total}개 시나리오`);
  console.log();

  if (listOnly) {
    console.log(chalk.bold('\n등록된 시나리오 목록:\n'));
    const scenarios = getAllScenarios();
    for (const scenario of scenarios) {
      const status = scenario.enabled ? chalk.green('✓') : chalk.gray('○');
      console.log(`  ${status} [${chalk.cyan(scenario.category)}] ${scenario.name}`);
      console.log(chalk.gray(`     ${scenario.description}`));
    }
    process.exit(0);
  }

  // 옵션 출력
  console.log(chalk.bold('실행 옵션:'));
  console.log(`  Verbose:   ${verbose ? chalk.green('ON') : chalk.gray('OFF')}`);
  console.log(`  Live:      ${live ? chalk.green('ON') : chalk.gray('OFF')}`);
  console.log(`  Fail Fast: ${failFast ? chalk.green('ON') : chalk.gray('OFF')}`);
  console.log(`  Filter:    ${filter ? chalk.yellow(filter) : chalk.gray('없음')}`);
  console.log(`  Test ID:   ${testId ? chalk.yellow(testId) : chalk.gray('없음')}`);
  console.log();

  // 테스트 러너 생성 및 실행
  const runner = new E2ETestRunner({
    verbose,
    live,
    failFast,
    filter,
    testId,
    timeout: 120000,
  });

  // 모든 시나리오 등록
  runner.registerScenarios(getAllScenarios());

  // 테스트 실행
  console.log(chalk.yellow('테스트를 시작합니다... (LLM 연동으로 시간이 걸릴 수 있습니다)\n'));

  try {
    const report = await runner.run();

    // 종료 코드 결정
    if (report.summary.failed > 0) {
      console.log(chalk.red('\n일부 테스트가 실패했습니다.'));
      console.log(chalk.gray('PR 생성 전에 실패한 테스트를 수정해주세요.'));
      process.exit(1);
    } else {
      console.log(chalk.green('\n모든 테스트가 통과했습니다!'));
      console.log(chalk.gray('PR을 생성해도 좋습니다.'));
      process.exit(0);
    }
  } catch (error) {
    console.error(chalk.red('\n테스트 실행 중 에러가 발생했습니다:'));
    console.error(error);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
${chalk.bold('OPEN-CLI E2E 테스트 러너')}

${chalk.bold('사용법:')}
  npm run test:e2e [옵션]

${chalk.bold('옵션:')}
  -v, --verbose     상세 로그 출력
  --live, --stream  실시간 LLM/CLI 출력 스트리밍 (open-cli 동작 실시간 확인)
  -f, --fail-fast   첫 실패 시 테스트 중단
  -c, --filter <카테고리>  특정 카테고리만 실행
  -t, --test <ID>   특정 테스트 ID만 실행 (단일 테스트)
  -l, --list        시나리오 목록만 출력
  -h, --help        도움말 출력

${chalk.bold('카테고리:')}
  file-tools        파일 도구 테스트 (read, write, list, find)
  llm-client        LLM 클라이언트 테스트 (chat, stream, tools)
  plan-execute      Plan & Execute 테스트
  session           세션 관리 테스트
  config            설정 관리 테스트
  local-rag         로컬 RAG 테스트
  integration       통합 테스트
  settings          설정 UI 테스트
  demos             데모 스크립트 테스트
  agno-eval         Agno 코드 생성 평가 테스트

${chalk.bold('예시:')}
  npm run test:e2e                        # 전체 테스트
  npm run test:e2e -- --verbose           # 상세 로그
  npm run test:e2e -- --live              # 실시간 출력 (open-cli 동작 확인)
  npm run test:e2e -- --filter demos      # 데모 카테고리만
  npm run test:e2e -- --filter agno-eval  # Agno 평가만
  npm run test:e2e -- --test demo-hitl    # 단일 테스트만
  npm run test:e2e -- -v -f               # 상세 + 첫 실패시 중단
`);
}

// 실행
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
