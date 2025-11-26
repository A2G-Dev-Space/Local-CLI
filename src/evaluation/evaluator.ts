import path from 'path';
import { parseTestCases, selectTestCases, TestCase } from './test-case-parser.js';
import {
  executeOpenChat,
  extractGeneratedCode,
  hasDocsSearch,
  ExecutionResult,
} from './subprocess-executor.js';
import { validateCode, ValidationResult } from './code-validator.js';
import {
  generateReport,
  saveReport,
  printSummary,
  TestResult,
  EvaluationReport,
} from './report-generator.js';

// Constants
const DEFAULT_PROMPTS_FILE_NAME = 'agno_prompts.md';
const DEFAULT_PROMPTS_DIR = 'src/evaluation';

export interface EvaluatorOptions {
  testCaseIds?: number[];
  timeout?: number;
  outputDir?: string;
  reportFormat?: 'markdown' | 'json' | 'both';
  verbose?: boolean;
}

export class AgnoCodeEvaluator {
  private options: Required<EvaluatorOptions>;

  constructor(options: EvaluatorOptions = {}) {
    this.options = {
      testCaseIds: options.testCaseIds ?? [],
      timeout: options.timeout ?? 300000, // 5 minutes
      outputDir: options.outputDir ?? path.join(process.cwd(), 'evaluation-reports'),
      reportFormat: options.reportFormat ?? 'markdown',
      verbose: options.verbose ?? false,
    };
  }

  /**
   * Run evaluation for all test cases
   */
  async evaluate(promptsPath: string): Promise<EvaluationReport> {
    this.log('Starting Agno Agent Code Generation Evaluation...\n');

    // Parse test cases
    this.log(`Parsing test cases from: ${promptsPath}`);
    const allTestCases = await parseTestCases(promptsPath);
    const testCases = selectTestCases(allTestCases, this.options.testCaseIds);

    this.log(`Found ${allTestCases.length} test cases`);
    if (this.options.testCaseIds.length > 0) {
      this.log(`Selected ${testCases.length} test cases: ${this.options.testCaseIds.join(', ')}`);
    }
    this.log('');

    // Execute tests
    const results: TestResult[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      if (!testCase) continue;

      this.log(`\n[${ i + 1}/${testCases.length}] Running Test Case ${testCase.id}...`);
      this.log(`Prompt: ${testCase.prompt}`);

      const result = await this.evaluateTestCase(testCase);
      results.push(result);

      const status = result.overallSuccess ? '✅ PASS' : '❌ FAIL';
      this.log(`Result: ${status} (${(result.execution.duration / 1000).toFixed(2)}s)`);
    }

    // Generate report
    this.log('\n\nGenerating evaluation report...');
    const report = generateReport(results);

    // Save report with organized folder structure
    if (this.options.reportFormat === 'markdown' || this.options.reportFormat === 'both') {
      const mdPath = await saveReport(report, this.options.outputDir, 'markdown');
      this.log(`Report saved to: ${mdPath}`);

      // Show folder structure
      const evalFolder = path.dirname(mdPath);
      this.log(`\nFolder structure:`);
      this.log(`  ${evalFolder}/`);
      this.log(`    ├── report.md`);
      for (const result of results) {
        if (result.codeBlocksFound > 0) {
          this.log(`    ├── test-${result.testCase.id}/`);
          this.log(`    │   ├── summary.md`);
          for (let i = 0; i < result.codeBlocksFound; i++) {
            this.log(`    │   └── code-block-${i + 1}.py`);
          }
        }
      }
    }

    if (this.options.reportFormat === 'json' || this.options.reportFormat === 'both') {
      const jsonPath = await saveReport(report, this.options.outputDir, 'json');
      this.log(`JSON report saved: ${jsonPath}`);
    }

    // Print summary
    printSummary(report);

    return report;
  }

  /**
   * Evaluate a single test case
   */
  private async evaluateTestCase(testCase: TestCase): Promise<TestResult> {
    // Execute open chat command
    const execution = await executeOpenChat(testCase.prompt, this.options.timeout);

    if (this.options.verbose) {
      this.log(`\nExecution output:\n${execution.stdout.substring(0, 500)}...\n`);
    }

    // Extract generated code
    const codeBlocks = extractGeneratedCode(execution.stdout);
    const codeBlocksFound = codeBlocks.length;

    this.log(`  Code blocks found: ${codeBlocksFound}`);

    // Check for docs search
    const usedDocsSearch = hasDocsSearch(execution.stdout);
    this.log(`  Docs search used: ${usedDocsSearch ? 'Yes' : 'No'}`);

    // Validate each code block
    const validationResults: ValidationResult[] = [];

    for (let i = 0; i < codeBlocks.length; i++) {
      const codeBlock = codeBlocks[i];
      if (!codeBlock) continue;

      this.log(`  Validating code block ${i + 1}...`);

      // Show code preview
      if (this.options.verbose && codeBlock) {
        const preview = codeBlock.split('\n').slice(0, 3).join('\n');
        this.log(`    Code preview:\n      ${preview.replace(/\n/g, '\n      ')}`);
        if (codeBlock.split('\n').length > 3) {
          this.log(`      ... (${codeBlock.split('\n').length - 3} more lines)`);
        }
      }

      const validation = await validateCode(codeBlock);
      validationResults.push(validation);

      // Show validation results
      this.log(`    Syntax valid: ${validation.syntaxValid}`);
      this.log(`    Imports valid: ${validation.importsValid}`);

      // Show detailed error information
      if (validation.syntaxErrors.length > 0) {
        this.log(`    Syntax errors:`);
        validation.syntaxErrors.forEach(err => {
          const lines = err.split('\n').slice(0, 5); // Show first 5 lines of error
          lines.forEach(line => this.log(`      ${line}`));
        });
      }

      if (validation.importIssues.length > 0) {
        this.log(`    Import issues:`);
        validation.importIssues.forEach(issue => this.log(`      - ${issue}`));
      }
    }

    // Determine overall success
    const overallSuccess = this.determineSuccess(
      execution,
      codeBlocksFound,
      usedDocsSearch,
      validationResults
    );

    return {
      testCase,
      execution,
      validation: validationResults,
      codeBlocks,              // Include extracted code blocks
      hasDocsSearch: usedDocsSearch,
      codeBlocksFound,
      overallSuccess,
    };
  }

  /**
   * Determine if test case passed
   */
  private determineSuccess(
    execution: ExecutionResult,
    codeBlocksFound: number,
    hasDocsSearch: boolean,
    validations: ValidationResult[]
  ): boolean {
    // Must execute successfully
    if (!execution.success) {
      return false;
    }

    // Must generate at least one code block
    if (codeBlocksFound === 0) {
      return false;
    }

    // Must use docs search
    if (!hasDocsSearch) {
      return false;
    }

    // All code blocks must be valid
    const allValid = validations.every(
      v => v.hasCode && v.syntaxValid && v.importsValid
    );

    return allValid;
  }

  /**
   * Log message if verbose mode enabled
   */
  private log(message: string): void {
    if (this.options.verbose || !message.startsWith('  ')) {
      console.log(message);
    }
  }
}

/**
 * Run evaluation from command line
 */
export async function runEvaluation(options: EvaluatorOptions = {}): Promise<void> {
  const promptsPath = path.join(
    process.cwd(),
    DEFAULT_PROMPTS_DIR,
    DEFAULT_PROMPTS_FILE_NAME
  );

  const evaluator = new AgnoCodeEvaluator({
    ...options,
    verbose: true, // Always verbose when run from CLI
  });

  try {
    await evaluator.evaluate(promptsPath);
    process.exit(0);
  } catch (error) {
    console.error('Evaluation failed:', error);
    process.exit(1);
  }
}
