/**
 * TDD Workflow Manager
 *
 * Implements Test-Driven Development workflow with iterative implementation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  TDDRequest,
  TDDSession,
  TDDResult,
  Test,
  Implementation,
  TestResult,
  TestFailure,
  ImplementationContext,
} from '../types/index.js';
import { LLMClient } from '../core/llm-client.js';

const execAsync = promisify(exec);

// Simple ID generator
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export class TestRunner {
  async runTests(
    tests: Test[],
    implementation?: Implementation
  ): Promise<TestResult> {
    const startTime = Date.now();
    const failures: TestFailure[] = [];
    let passed = 0;
    let failed = 0;

    // Write tests to temporary directory
    const testDir = path.join(process.cwd(), '.open-cli', 'tdd-temp');
    await fs.mkdir(testDir, { recursive: true });

    try {
      // Write test files
      for (const test of tests) {
        const testFile = path.join(testDir, `${test.id}.test.ts`);
        await fs.writeFile(testFile, test.code, 'utf-8');
      }

      // Write implementation if provided
      if (implementation) {
        if (implementation.files) {
          for (const file of implementation.files) {
            const filePath = path.join(testDir, file.path);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, file.content, 'utf-8');
          }
        } else {
          // Write single implementation file
          const implFile = path.join(testDir, 'implementation.ts');
          await fs.writeFile(implFile, implementation.code, 'utf-8');
        }
      }

      // Run tests with Jest
      try {
        const { stdout } = await execAsync(
          `npx jest ${testDir} --json --testTimeout=10000`,
          {
            cwd: process.cwd(),
            timeout: 30000
          }
        );

        // Parse Jest output
        const result = this.parseJestOutput(stdout);
        passed = result.passed;
        failed = result.failed;
        failures.push(...result.failures);
      } catch (error: any) {
        // Jest returns non-zero exit code when tests fail
        if (error.stdout) {
          const result = this.parseJestOutput(error.stdout);
          passed = result.passed;
          failed = result.failed;
          failures.push(...result.failures);
        } else {
          // Test execution error
          failures.push({
            testName: 'Test Execution',
            message: error.message || 'Failed to run tests',
            stack: error.stack
          });
          failed = tests.length;
        }
      }

      return {
        passed,
        failed,
        total: tests.length,
        failures,
        duration: Date.now() - startTime
      };
    } finally {
      // Cleanup
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch (error) {
        console.debug('Failed to cleanup test directory:', error);
      }
    }
  }

  private parseJestOutput(output: string): {
    passed: number;
    failed: number;
    failures: TestFailure[];
  } {
    const failures: TestFailure[] = [];
    let passed = 0;
    let failed = 0;

    try {
      const json = JSON.parse(output);

      if (json.numPassedTests !== undefined) {
        passed = json.numPassedTests;
      }
      if (json.numFailedTests !== undefined) {
        failed = json.numFailedTests;
      }

      // Extract failures
      if (json.testResults) {
        for (const testResult of json.testResults) {
          if (testResult.assertionResults) {
            for (const assertion of testResult.assertionResults) {
              if (assertion.status === 'failed') {
                failures.push({
                  testName: assertion.fullName || assertion.title,
                  message: assertion.failureMessages?.[0] || 'Test failed',
                  stack: assertion.failureMessages?.join('\n')
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.debug('Failed to parse Jest output:', error);

      // Fallback parsing
      const passedMatch = output.match(/(\d+) passed/);
      const failedMatch = output.match(/(\d+) failed/);

      if (passedMatch) passed = parseInt(passedMatch[1] || '0');
      if (failedMatch) failed = parseInt(failedMatch[1] || '0');
    }

    return { passed, failed, failures };
  }
}

export class CodeGenerator {
  constructor(private llm: LLMClient) {}

  async generateTests(request: TDDRequest): Promise<Test[]> {
    const prompt = `Write comprehensive tests for the following requirement:

Requirement: ${request.requirement}

Test Framework: ${request.testFramework || 'jest'}
Language: ${request.language || 'typescript'}

Include:
- Happy path tests
- Edge cases
- Error scenarios
- Boundary conditions

Generate multiple test cases. Format as an array of objects:
[{
  "name": "test name",
  "description": "what it tests",
  "type": "unit|integration|e2e",
  "code": "complete test code"
}]`;

    const response = await this.llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a test generation expert. Write comprehensive, well-structured tests.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 2000
    });

    return this.parseTests(response.choices[0]?.message.content || '');
  }

  private parseTests(content: string): Test[] {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((t: any) => ({
          id: generateId(),
          name: t.name || 'Unnamed test',
          code: t.code || '',
          description: t.description,
          type: t.type || 'unit'
        }));
      }
    } catch (error) {
      console.debug('Failed to parse tests:', error);
    }

    // Fallback: extract code blocks
    const codeBlocks = content.match(/```(?:typescript|javascript|ts|js)?\n([\s\S]*?)```/g) || [];
    return codeBlocks.map((block, index) => {
      const code = block.replace(/```(?:typescript|javascript|ts|js)?\n|```/g, '');
      return {
        id: generateId(),
        name: `Test ${index + 1}`,
        code,
        type: 'unit' as const
      };
    });
  }

  async generateImplementation(context: ImplementationContext): Promise<Implementation> {
    const testCodes = context.tests.map(t => `// ${t.name}\n${t.code}`).join('\n\n');
    const failureDetails = context.failures?.map(f => `- ${f.testName}: ${f.message}`).join('\n') || 'None';

    const prompt = `Implement code to pass these tests:

Tests:
${testCodes}

${context.previousAttempts.length > 0 ? `
Previous attempt failed with:
${failureDetails}

Analyze the failures and fix the implementation.
` : 'This is the first implementation attempt.'}

Language: ${context.language || 'typescript'}

Requirements:
- DO NOT modify the tests
- Implement only the code needed to pass the tests
- Follow best practices
- Handle edge cases properly
- Include proper error handling

Provide the complete implementation.`;

    const response = await this.llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are an expert developer. Write clean, correct code that passes the tests.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const code = this.extractCode(response.choices[0]?.message.content || '');

    return {
      code,
      language: context.language || 'typescript',
      timestamp: Date.now()
    };
  }

  private extractCode(content: string): string {
    // Extract code from markdown code blocks
    const codeMatch = content.match(/```(?:typescript|javascript|ts|js)?\n([\s\S]*?)```/);
    if (codeMatch && codeMatch[1]) {
      return codeMatch[1];
    }

    // Return as-is if no code blocks found
    return content;
  }
}

export class TDDWorkflow {
  private testRunner: TestRunner;
  private codeGenerator: CodeGenerator;

  constructor(llmClient: LLMClient) {
    this.testRunner = new TestRunner();
    this.codeGenerator = new CodeGenerator(llmClient);
  }

  /**
   * Execute TDD workflow
   */
  async execute(request: TDDRequest): Promise<TDDResult> {
    const session: TDDSession = {
      id: generateId(),
      request,
      tests: [],
      implementations: [],
      iterations: [],
      status: 'in_progress'
    };

    console.log(`\n🧪 Starting TDD Workflow for: ${request.requirement}\n`);

    try {
      // Phase 1: Write tests first
      console.log('📝 Phase 1: Writing tests...');
      const tests = await this.codeGenerator.generateTests(request);
      session.tests = tests;
      console.log(`✅ Generated ${tests.length} test(s)`);

      // Phase 2: Verify tests fail (Red phase)
      console.log('\n🔴 Phase 2: Running tests (expecting failures)...');
      const initialRun = await this.testRunner.runTests(tests);
      console.log(`Results: ${initialRun.passed} passed, ${initialRun.failed} failed`);

      if (!this.allTestsFail(initialRun)) {
        console.warn('⚠️  Warning: Some tests passed without implementation');
        // Continue anyway - tests might have mocks or default behavior
      }

      // Phase 3: Implementation loop (Green phase)
      console.log('\n🟢 Phase 3: Implementation loop...');
      let iteration = 0;
      const maxIterations = request.maxIterations || 10;

      while (iteration < maxIterations) {
        iteration++;
        console.log(`\n  Iteration ${iteration}/${maxIterations}`);

        // Generate implementation
        console.log('  🔧 Generating implementation...');
        const implementation = await this.codeGenerator.generateImplementation({
          tests,
          previousAttempts: session.implementations,
          failures: this.getLatestFailures(session),
          language: request.language
        });

        session.implementations.push(implementation);

        // Run tests
        console.log('  🧪 Running tests...');
        const testResult = await this.testRunner.runTests(tests, implementation);

        // Record iteration
        session.iterations.push({
          number: iteration,
          implementation,
          testResult,
          timestamp: Date.now()
        });

        console.log(`  📊 Results: ${testResult.passed}/${testResult.total} passed`);

        // Check if all tests pass
        if (this.allTestsPass(testResult)) {
          session.status = 'completed';
          console.log(`\n✨ Success! All tests passed in ${iteration} iteration(s)!`);

          return {
            success: true,
            session,
            finalImplementation: implementation,
            iterations: iteration
          };
        }

        // Analyze failures for next iteration
        if (testResult.failures.length > 0) {
          console.log(`  ❌ ${testResult.failures.length} failure(s):`);
          for (const failure of testResult.failures.slice(0, 3)) {
            console.log(`     - ${failure.testName}: ${failure.message.substring(0, 100)}`);
          }

          const analysis = await this.analyzeFailures(testResult);
          session.failureAnalysis = analysis;
        }

        // Check timeout
        if (request.timeout) {
          const elapsed = Date.now() - session.iterations[0]!.timestamp;
          if (elapsed > request.timeout) {
            console.log('\n⏱️  Timeout reached');
            break;
          }
        }
      }

      // Max iterations reached
      session.status = 'failed';
      console.log(`\n❌ Failed: Max iterations reached without passing all tests`);

      return {
        success: false,
        error: 'Max iterations reached without passing all tests',
        session,
        iterations: iteration
      };
    } catch (error: any) {
      session.status = 'failed';
      console.error(`\n❌ TDD Workflow error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        session
      };
    }
  }

  /**
   * Check if all tests fail
   */
  private allTestsFail(result: TestResult): boolean {
    return result.failed > 0 && result.passed === 0;
  }

  /**
   * Check if all tests pass
   */
  private allTestsPass(result: TestResult): boolean {
    return result.failed === 0 && result.passed === result.total;
  }

  /**
   * Get latest failures from session
   */
  private getLatestFailures(session: TDDSession): TestFailure[] {
    if (session.iterations.length === 0) {
      return [];
    }

    const latest = session.iterations[session.iterations.length - 1];
    return latest?.testResult.failures || [];
  }

  /**
   * Analyze failures to guide next iteration
   */
  private async analyzeFailures(result: TestResult): Promise<string> {
    if (result.failures.length === 0) {
      return 'No failures to analyze';
    }

    const failureSummary = result.failures
      .map(f => `${f.testName}: ${f.message}`)
      .join('\n');

    // Simple categorization
    const categories: string[] = [];

    for (const failure of result.failures) {
      const msg = failure.message.toLowerCase();

      if (msg.includes('undefined') || msg.includes('null')) {
        if (!categories.includes('null-handling')) {
          categories.push('null-handling');
        }
      }
      if (msg.includes('type') || msg.includes('expected')) {
        if (!categories.includes('type-mismatch')) {
          categories.push('type-mismatch');
        }
      }
      if (msg.includes('syntax') || msg.includes('unexpected')) {
        if (!categories.includes('syntax-error')) {
          categories.push('syntax-error');
        }
      }
      if (msg.includes('timeout') || msg.includes('async')) {
        if (!categories.includes('async-issue')) {
          categories.push('async-issue');
        }
      }
    }

    return `Failure categories: ${categories.join(', ')}\n\nDetails:\n${failureSummary.substring(0, 500)}`;
  }
}

export default TDDWorkflow;