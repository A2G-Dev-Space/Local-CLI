/**
 * E2E 테스트 러너 (에뮬레이터)
 *
 * 모든 기능을 실제 LLM과 연동하여 테스트합니다.
 * 초보 개발자도 `npm run test:e2e` 명령어로 쉽게 실행할 수 있습니다.
 */

import chalk from 'chalk';
import {
  TestScenario,
  TestResult,
  StepResult,
  TestReport,
  TestRunnerOptions,
  TestAction,
  TestValidation,
  TestStatus,
} from './types.js';

export class E2ETestRunner {
  private scenarios: TestScenario[] = [];
  private options: TestRunnerOptions;
  private results: TestResult[] = [];

  constructor(options: TestRunnerOptions = {}) {
    this.options = {
      verbose: false,
      live: false,
      failFast: false,
      timeout: 60000,
      parallel: false,
      ...options,
    };

    // live 모드에서는 verbose도 자동 활성화
    if (this.options.live) {
      this.options.verbose = true;
    }
  }

  /**
   * 시나리오 등록
   */
  registerScenario(scenario: TestScenario): void {
    this.scenarios.push(scenario);
  }

  /**
   * 여러 시나리오 등록
   */
  registerScenarios(scenarios: TestScenario[]): void {
    this.scenarios.push(...scenarios);
  }

  /**
   * 전체 테스트 실행
   */
  async run(): Promise<TestReport> {
    const startedAt = new Date();
    this.results = [];

    this.printHeader();

    // 필터링
    let scenariosToRun = this.scenarios.filter((s) => s.enabled);

    // 특정 테스트 ID로 필터링 (가장 우선)
    if (this.options.testId) {
      scenariosToRun = scenariosToRun.filter(
        (s) => s.id === this.options.testId || s.id.includes(this.options.testId!)
      );
    } else if (this.options.filter) {
      // 카테고리로 필터링
      scenariosToRun = scenariosToRun.filter(
        (s) => s.category === this.options.filter || s.id.includes(this.options.filter!)
      );
    }

    this.log(`\n${chalk.cyan('=')} 총 ${chalk.bold(scenariosToRun.length)}개 시나리오 실행\n`);

    // 순차 실행 (재시도 로직 포함)
    for (const scenario of scenariosToRun) {
      const maxRetries = scenario.retryCount || 0;
      let result: TestResult | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          this.log(chalk.yellow(`  ↻ 재시도 ${attempt}/${maxRetries}...`));
        }

        result = await this.runScenario(scenario);

        if (result.status === 'passed') {
          break; // 성공하면 바로 종료
        }

        // 마지막 시도가 아니면 잠시 대기
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.results.push(result!);

      // 프로세스 정리 (core dump 방지)
      await this.cleanupChildProcesses();

      // 테스트 간 딜레이 (로컬 LLM 과부하 방지)
      this.log(chalk.gray('  ⏳ 다음 테스트 전 대기 중...'));
      await new Promise(resolve => setTimeout(resolve, 5000));

      if (this.options.failFast && result!.status === 'failed') {
        this.log(chalk.red('\n[FAIL FAST] 테스트 중단됨\n'));
        break;
      }
    }

    const finishedAt = new Date();
    const report = this.generateReport(startedAt, finishedAt);
    this.printReport(report);

    return report;
  }

  /**
   * 단일 시나리오 실행
   */
  private async runScenario(scenario: TestScenario): Promise<TestResult> {
    const startedAt = new Date();
    const stepResults: StepResult[] = [];
    let status: TestStatus = 'passed';
    let error: Error | undefined;

    this.logScenarioStart(scenario);

    try {
      // Setup
      if (scenario.setup) {
        this.logStep('Setup', 'running');
        await scenario.setup();
        this.logStep('Setup', 'passed');
      }

      // Steps 실행
      for (const step of scenario.steps) {
        const stepResult = await this.runStep(step, scenario.timeout);
        stepResults.push(stepResult);

        if (stepResult.status === 'failed') {
          status = 'failed';
          error = stepResult.error;
          if (this.options.failFast) break;
        }
      }

      // Teardown
      if (scenario.teardown) {
        this.logStep('Teardown', 'running');
        await scenario.teardown();
        this.logStep('Teardown', 'passed');
      }
    } catch (e) {
      status = 'failed';
      error = e instanceof Error ? e : new Error(String(e));
    }

    const finishedAt = new Date();
    const duration = finishedAt.getTime() - startedAt.getTime();

    const result: TestResult = {
      scenario,
      status,
      duration,
      steps: stepResults,
      error,
      startedAt,
      finishedAt,
    };

    this.logScenarioEnd(result);

    return result;
  }

  /**
   * 단일 스텝 실행
   */
  private async runStep(step: TestStep, timeout?: number): Promise<StepResult> {
    const startedAt = Date.now();
    let result: any;
    let status: TestStatus = 'passed';
    let error: Error | undefined;

    this.logStep(step.name, 'running');

    try {
      // 타임아웃 처리
      const timeoutMs = timeout || this.options.timeout || 60000;
      result = await Promise.race([
        this.executeAction(step.action),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      // 결과 출력 (verbose 모드)
      if (this.options.verbose && result !== undefined) {
        this.logVerbose('Action Result', result);
      }

      // 검증
      const isValid = await this.validate(step.validation, result);
      if (!isValid) {
        throw new Error(`Validation failed for step: ${step.name}`);
      }

      this.logStep(step.name, 'passed');
    } catch (e) {
      status = 'failed';
      error = e instanceof Error ? e : new Error(String(e));
      this.logStep(step.name, 'failed', error.message);
    }

    const duration = Date.now() - startedAt;

    return {
      step,
      status,
      duration,
      result,
      error,
    };
  }

  /**
   * 액션 실행
   */
  private async executeAction(action: TestAction): Promise<any> {
    switch (action.type) {
      case 'llm_chat':
        return this.actionLLMChat(action.prompt, action.useTools);

      case 'llm_stream':
        return this.actionLLMStream(action.prompt);

      case 'file_read':
        return this.actionFileRead(action.path);

      case 'file_write':
        return this.actionFileWrite(action.path, action.content);

      case 'file_list':
        return this.actionFileList(action.directory);

      case 'file_find':
        return this.actionFileFind(action.pattern, action.directory);

      case 'plan_generate':
        return this.actionPlanGenerate(action.userRequest);

      case 'plan_execute':
        return this.actionPlanExecute(action.todos);


      case 'docs_search':
        return this.actionDocsSearch(action.query, action.searchPath);

      case 'session_save':
        return this.actionSessionSave(action.sessionId);

      case 'session_load':
        return this.actionSessionLoad(action.sessionId);

      case 'session_list':
        return this.actionSessionList();

      case 'config_get':
        return this.actionConfigGet(action.key);

      case 'config_set':
        return this.actionConfigSet(action.key, action.value);

      case 'custom':
        return action.fn();

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  /**
   * 결과 검증
   */
  private async validate(validation: TestValidation, result: any): Promise<boolean> {
    switch (validation.type) {
      case 'exists':
        return result !== undefined && result !== null;

      case 'not_empty':
        if (typeof result === 'string') return result.length > 0;
        if (Array.isArray(result)) return result.length > 0;
        if (typeof result === 'object') return Object.keys(result).length > 0;
        return result !== undefined && result !== null;

      case 'contains':
        return typeof result === 'string' && result.includes(validation.value);

      case 'not_contains':
        return typeof result === 'string' && !result.includes(validation.value);

      case 'equals':
        return JSON.stringify(result) === JSON.stringify(validation.value);

      case 'matches':
        return typeof result === 'string' && new RegExp(validation.pattern).test(result);

      case 'is_array':
        if (!Array.isArray(result)) return false;
        if (validation.minLength !== undefined) return result.length >= validation.minLength;
        return true;

      case 'is_object':
        if (typeof result !== 'object' || result === null) return false;
        if (validation.hasKeys) {
          return validation.hasKeys.every((key) => key in result);
        }
        return true;

      case 'file_exists':
        return this.checkFileExists(validation.path);

      case 'file_not_exists':
        return !(await this.checkFileExists(validation.path));

      case 'file_contains':
        return this.checkFileContains(validation.path, validation.content);

      case 'llm_response_valid':
        return (
          typeof result === 'string' &&
          result.length > 0 &&
          !result.toLowerCase().includes('error')
        );

      case 'todos_generated':
        if (!Array.isArray(result)) return false;
        if (validation.minCount !== undefined) return result.length >= validation.minCount;
        return result.length > 0;

      case 'custom':
        return validation.fn(result);

      default:
        throw new Error(`Unknown validation type: ${(validation as any).type}`);
    }
  }

  // ====== Action Implementations ======

  private async actionLLMChat(prompt: string, useTools?: boolean): Promise<string> {
    const { LLMClient } = await import('../../src/core/llm/llm-client.js');
    const { configManager } = await import('../../src/core/config/config-manager.js');

    await configManager.initialize();

    // LLMClient는 인자 없이 생성 - configManager에서 설정을 가져옴
    const client = new LLMClient();

    if (useTools) {
      const { FILE_TOOLS } = await import('../../src/tools/llm/simple/file-tools.js');
      // sendMessageWithTools는 { response, toolCalls } 객체를 반환
      const result = await client.sendMessageWithTools(prompt, FILE_TOOLS);
      return result.response;
    }

    return client.sendMessage(prompt);
  }

  private async actionLLMStream(prompt: string): Promise<string> {
    const { LLMClient } = await import('../../src/core/llm/llm-client.js');
    const { configManager } = await import('../../src/core/config/config-manager.js');

    await configManager.initialize();

    // LLMClient는 인자 없이 생성 - configManager에서 설정을 가져옴
    const client = new LLMClient();

    let fullResponse = '';
    const messages = [{ role: 'user' as const, content: prompt }];

    // chatCompletionStream은 LLMStreamChunk를 yield함
    for await (const chunk of client.chatCompletionStream({ messages })) {
      const content = chunk.choices?.[0]?.delta?.content || '';
      fullResponse += content;
      if (this.options.verbose) {
        process.stdout.write(content);
      }
    }

    if (this.options.verbose) {
      console.log();
    }

    return fullResponse;
  }

  private async actionFileRead(filePath: string): Promise<string> {
    const { executeReadFile } = await import('../../src/tools/llm/simple/file-tools.js');
    const result = await executeReadFile(filePath);
    if (!result.success) {
      throw new Error(result.error || 'File read failed');
    }
    return result.result || '';
  }

  private async actionFileWrite(filePath: string, content: string): Promise<string> {
    const { executeWriteFile } = await import('../../src/tools/llm/simple/file-tools.js');
    const result = await executeWriteFile(filePath, content);
    if (!result.success) {
      throw new Error(result.error || 'File write failed');
    }
    return result.result || '';
  }

  private async actionFileList(directory: string): Promise<any[]> {
    const { executeListFiles } = await import('../../src/tools/llm/simple/file-tools.js');
    const result = await executeListFiles(directory || '.', false);
    if (!result.success) {
      throw new Error(result.error || 'File list failed');
    }
    // 결과는 JSON 문자열이므로 파싱
    try {
      return JSON.parse(result.result || '[]');
    } catch {
      return [];
    }
  }

  private async actionFileFind(pattern: string, directory?: string): Promise<any[]> {
    const { executeFindFiles } = await import('../../src/tools/llm/simple/file-tools.js');
    const result = await executeFindFiles(pattern, directory || '.');
    if (!result.success) {
      throw new Error(result.error || 'File find failed');
    }
    // 결과는 JSON 문자열이므로 파싱
    try {
      return JSON.parse(result.result || '[]');
    } catch {
      // JSON이 아닌 경우 (no match 메시지 등)
      return [];
    }
  }

  private async actionPlanGenerate(userRequest: string): Promise<any[]> {
    const { PlanningLLM } = await import('../../src/core/llm/planning-llm.js');
    const { LLMClient } = await import('../../src/core/llm/llm-client.js');
    const { configManager } = await import('../../src/core/config/config-manager.js');

    await configManager.initialize();

    // LLMClient는 인자 없이 생성 - configManager에서 설정을 가져옴
    const llmClient = new LLMClient();

    const planningLLM = new PlanningLLM(llmClient);
    const result = await planningLLM.generateTODOList(userRequest);
    return result.todos || [];
  }

  private async actionPlanExecute(todos: any[]): Promise<any> {
    // Plan Execute는 복잡하므로 Orchestrator를 직접 사용
    const { PlanExecuteOrchestrator } = await import(
      '../../src/orchestration/orchestrator.js'
    );
    const { LLMClient } = await import('../../src/core/llm/llm-client.js');
    const { configManager } = await import('../../src/core/config/config-manager.js');

    await configManager.initialize();

    // LLMClient는 인자 없이 생성 - configManager에서 설정을 가져옴
    const llmClient = new LLMClient();

    const orchestrator = new PlanExecuteOrchestrator(llmClient, {
      verbose: this.options.verbose,
    });

    // execute 메서드 사용 (todos를 userRequest 문자열로 변환)
    const userRequest = todos.map((t: any) => t.title || t.description || String(t)).join(', ');
    return orchestrator.execute(userRequest);
  }

  private async actionDocsSearch(query: string, _searchPath?: string): Promise<string> {
    const { executeDocsSearchAgent } = await import('../../src/core/knowledge/docs-search-agent.js');
    const { LLMClient } = await import('../../src/core/llm/llm-client.js');
    const { configManager } = await import('../../src/core/config/config-manager.js');

    await configManager.initialize();

    // LLMClient는 인자 없이 생성 - configManager에서 설정을 가져옴
    const llmClient = new LLMClient();

    const result = await executeDocsSearchAgent(llmClient, query);
    if (!result.success) {
      throw new Error(result.error || 'Docs search failed');
    }
    return result.result || '';
  }

  private async actionSessionSave(sessionName?: string): Promise<string> {
    const { sessionManager } = await import('../../src/core/session/session-manager.js');
    const name = sessionName || `test-session-${Date.now()}`;
    const messages = [{ role: 'user' as const, content: 'Test message' }];
    const sessionId = await sessionManager.saveSession(name, messages);
    return sessionId;
  }

  private async actionSessionLoad(sessionId: string): Promise<any> {
    const { sessionManager } = await import('../../src/core/session/session-manager.js');
    return sessionManager.loadSession(sessionId);
  }

  private async actionSessionList(): Promise<any[]> {
    const { sessionManager } = await import('../../src/core/session/session-manager.js');
    return sessionManager.listSessions();
  }

  private async actionConfigGet(key?: string): Promise<any> {
    const { configManager } = await import('../../src/core/config/config-manager.js');
    await configManager.initialize();
    const config = configManager.getConfig();
    if (key) {
      return (config as any)[key];
    }
    return config;
  }

  private async actionConfigSet(key: string, value: any): Promise<void> {
    const { configManager } = await import('../../src/core/config/config-manager.js');
    await configManager.initialize();
    // updateSettings만 지원 - settings 관련 키만 변경 가능
    await configManager.updateSettings({ [key]: value });
  }

  // ====== Helper Methods ======

  private async checkFileExists(path: string): Promise<boolean> {
    const fs = await import('fs/promises');
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async checkFileContains(path: string, content: string): Promise<boolean> {
    const fs = await import('fs/promises');
    try {
      const fileContent = await fs.readFile(path, 'utf-8');
      return fileContent.includes(content);
    } catch {
      return false;
    }
  }

  // ====== Logging ======

  private log(message: string): void {
    console.log(message);
  }

  private logVerbose(label: string, data: any): void {
    if (this.options.verbose) {
      console.log(chalk.gray(`  [${label}]:`), typeof data === 'string' ? data.substring(0, 200) : data);
    }
  }

  private printHeader(): void {
    console.log();
    console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.white('          OPEN-CLI E2E Test Runner                         ') + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.gray('          모든 기능을 실제 LLM으로 검증합니다               ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
  }

  private logScenarioStart(scenario: TestScenario): void {
    console.log();
    console.log(
      chalk.cyan('┌─') +
        chalk.bold(` [${scenario.category}] ${scenario.name}`) +
        chalk.gray(` (${scenario.id})`)
    );
    console.log(chalk.cyan('│ ') + chalk.gray(scenario.description));
  }

  private logScenarioEnd(result: TestResult): void {
    const statusIcon = result.status === 'passed' ? chalk.green('✓') : chalk.red('✗');
    const statusText =
      result.status === 'passed'
        ? chalk.green('PASSED')
        : chalk.red('FAILED');
    const duration = chalk.gray(`${result.duration}ms`);

    console.log(chalk.cyan('│'));
    console.log(chalk.cyan('└─') + ` ${statusIcon} ${statusText} ${duration}`);

    if (result.error) {
      console.log(chalk.red(`   Error: ${result.error.message}`));
    }
  }

  private logStep(name: string, status: TestStatus, errorMsg?: string): void {
    let icon: string;
    let color: typeof chalk.green;

    switch (status) {
      case 'running':
        icon = '○';
        color = chalk.yellow;
        break;
      case 'passed':
        icon = '✓';
        color = chalk.green;
        break;
      case 'failed':
        icon = '✗';
        color = chalk.red;
        break;
      default:
        icon = '○';
        color = chalk.gray;
    }

    const line = chalk.cyan('│  ') + color(`${icon} ${name}`);
    if (status === 'running') {
      process.stdout.write(line + '\r');
    } else {
      console.log(line + (errorMsg ? chalk.red(` - ${errorMsg}`) : ''));
    }
  }

  private generateReport(startedAt: Date, finishedAt: Date): TestReport {
    const passed = this.results.filter((r) => r.status === 'passed').length;
    const failed = this.results.filter((r) => r.status === 'failed').length;
    const skipped = this.results.filter((r) => r.status === 'skipped').length;

    return {
      summary: {
        total: this.results.length,
        passed,
        failed,
        skipped,
        duration: finishedAt.getTime() - startedAt.getTime(),
      },
      results: this.results,
      startedAt,
      finishedAt,
    };
  }

  private printReport(report: TestReport): void {
    const { summary } = report;

    console.log();
    console.log(chalk.cyan('════════════════════════════════════════════════════════════'));
    console.log(chalk.bold('                        테스트 결과 요약'));
    console.log(chalk.cyan('════════════════════════════════════════════════════════════'));
    console.log();

    // 결과 막대 그래프
    const barLength = 40;
    const passedBar = Math.round((summary.passed / summary.total) * barLength);
    const failedBar = Math.round((summary.failed / summary.total) * barLength);

    console.log(
      '  ' +
        chalk.green('█'.repeat(passedBar)) +
        chalk.red('█'.repeat(failedBar)) +
        chalk.gray('░'.repeat(barLength - passedBar - failedBar))
    );
    console.log();

    // 숫자
    console.log(`  ${chalk.bold('Total:')}   ${summary.total}`);
    console.log(`  ${chalk.green('Passed:')}  ${summary.passed}`);
    console.log(`  ${chalk.red('Failed:')}  ${summary.failed}`);
    console.log(`  ${chalk.gray('Skipped:')} ${summary.skipped}`);
    console.log(`  ${chalk.cyan('Duration:')} ${(summary.duration / 1000).toFixed(2)}s`);
    console.log();

    // 실패한 테스트 상세
    const failedResults = report.results.filter((r) => r.status === 'failed');
    if (failedResults.length > 0) {
      console.log(chalk.red('실패한 테스트:'));
      for (const result of failedResults) {
        console.log(chalk.red(`  ✗ ${result.scenario.name}`));
        if (result.error) {
          console.log(chalk.gray(`    ${result.error.message}`));
        }
        // 실패한 스텝
        const failedSteps = result.steps.filter((s) => s.status === 'failed');
        for (const step of failedSteps) {
          console.log(chalk.gray(`    - ${step.step.name}: ${step.error?.message}`));
        }
      }
      console.log();
    }

    // 최종 결과
    if (summary.failed === 0) {
      console.log(chalk.green.bold('  ✓ 모든 테스트가 통과했습니다!'));
    } else {
      console.log(chalk.red.bold(`  ✗ ${summary.failed}개 테스트가 실패했습니다.`));
    }

    console.log();
    console.log(chalk.cyan('════════════════════════════════════════════════════════════'));
  }

  /**
   * 자식 프로세스 정리 (core dump 방지)
   */
  private async cleanupChildProcesses(): Promise<void> {
    try {
      // 잠시 대기하여 프로세스가 정리될 시간을 줌
      await new Promise(resolve => setTimeout(resolve, 200));

      // 가비지 컬렉션 유도
      if (global.gc) {
        global.gc();
      }
    } catch {
      // 정리 실패는 무시
    }
  }
}

// TestStep import를 위한 타입 export
import type { TestStep } from './types.js';
