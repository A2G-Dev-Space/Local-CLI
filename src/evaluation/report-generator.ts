import fs from 'fs/promises';
import path from 'path';
import { TestCase } from './test-case-parser.js';
import { ExecutionResult } from './subprocess-executor.js';
import { ValidationResult } from './code-validator.js';

export interface TestResult {
  testCase: TestCase;
  execution: ExecutionResult;
  validation: ValidationResult[];
  codeBlocks: string[];        // Extracted code blocks
  hasDocsSearch: boolean;
  codeBlocksFound: number;
  overallSuccess: boolean;
}

export interface EvaluationReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestResult[];
  summary: {
    averageDuration: number;
    docsSearchUsageRate: number;
    codeGenerationRate: number;
    syntaxValidRate: number;
    importValidRate: number;
  };
}

/**
 * Generate evaluation report
 */
export function generateReport(results: TestResult[]): EvaluationReport {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.overallSuccess).length;
  const failedTests = totalTests - passedTests;

  const totalDuration = results.reduce((sum, r) => sum + r.execution.duration, 0);
  const averageDuration = totalTests > 0 ? totalDuration / totalTests : 0;

  const docsSearchCount = results.filter(r => r.hasDocsSearch).length;
  const docsSearchUsageRate = totalTests > 0 ? (docsSearchCount / totalTests) * 100 : 0;

  const codeGenerationCount = results.filter(r => r.codeBlocksFound > 0).length;
  const codeGenerationRate = totalTests > 0 ? (codeGenerationCount / totalTests) * 100 : 0;

  const syntaxValidCount = results.filter(r =>
    r.validation.every(v => v.syntaxValid)
  ).length;
  const syntaxValidRate = totalTests > 0 ? (syntaxValidCount / totalTests) * 100 : 0;

  const importValidCount = results.filter(r =>
    r.validation.every(v => v.importsValid)
  ).length;
  const importValidRate = totalTests > 0 ? (importValidCount / totalTests) * 100 : 0;

  return {
    timestamp: new Date().toISOString(),
    totalTests,
    passedTests,
    failedTests,
    results,
    summary: {
      averageDuration,
      docsSearchUsageRate,
      codeGenerationRate,
      syntaxValidRate,
      importValidRate,
    },
  };
}

/**
 * Format report as markdown
 */
export function formatReportAsMarkdown(report: EvaluationReport): string {
  const lines: string[] = [];

  lines.push('# Agno Agent Code Generation Evaluation Report');
  lines.push('');
  lines.push(`**Generated**: ${new Date(report.timestamp).toLocaleString()}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Tests**: ${report.totalTests}`);
  lines.push(`- **Passed**: ${report.passedTests} (${((report.passedTests / report.totalTests) * 100).toFixed(1)}%)`);
  lines.push(`- **Failed**: ${report.failedTests} (${((report.failedTests / report.totalTests) * 100).toFixed(1)}%)`);
  lines.push('');

  lines.push('### Metrics');
  lines.push('');
  lines.push(`- **Average Duration**: ${(report.summary.averageDuration / 1000).toFixed(2)}s`);
  lines.push(`- **Docs Search Usage**: ${report.summary.docsSearchUsageRate.toFixed(1)}%`);
  lines.push(`- **Code Generation Rate**: ${report.summary.codeGenerationRate.toFixed(1)}%`);
  lines.push(`- **Syntax Validity Rate**: ${report.summary.syntaxValidRate.toFixed(1)}%`);
  lines.push(`- **Import Validity Rate**: ${report.summary.importValidRate.toFixed(1)}%`);
  lines.push('');

  // Detailed Results
  lines.push('## Detailed Results');
  lines.push('');

  for (const result of report.results) {
    const status = result.overallSuccess ? '✅ PASS' : '❌ FAIL';
    lines.push(`### Test Case ${result.testCase.id}: ${status}`);
    lines.push('');
    lines.push(`**Prompt**: ${result.testCase.prompt}`);
    lines.push('');
    lines.push(`**Expected Files**: ${result.testCase.filePaths.length} files`);
    lines.push('');

    // Execution Info
    lines.push('#### Execution');
    lines.push('');
    lines.push(`- Duration: ${(result.execution.duration / 1000).toFixed(2)}s`);
    lines.push(`- Exit Code: ${result.execution.exitCode ?? 'N/A'}`);
    lines.push(`- Success: ${result.execution.success ? 'Yes' : 'No'}`);

    if (result.execution.error) {
      lines.push(`- Error: ${result.execution.error}`);
    }
    lines.push('');

    // Code Analysis
    lines.push('#### Code Analysis');
    lines.push('');
    lines.push(`- Code Blocks Found: ${result.codeBlocksFound}`);
    lines.push(`- Docs Search Used: ${result.hasDocsSearch ? 'Yes' : 'No'}`);
    lines.push('');

    // Validation Results
    if (result.validation.length > 0) {
      lines.push('#### Validation Results');
      lines.push('');

      for (let i = 0; i < result.validation.length; i++) {
        const validation = result.validation[i];
        if (!validation) continue;

        lines.push(`**Code Block ${i + 1}**:`);
        lines.push('');
        lines.push(`- Has Code: ${validation.hasCode ? 'Yes' : 'No'}`);
        lines.push(`- Syntax Valid: ${validation.syntaxValid ? '✅' : '❌'}`);
        lines.push(`- Imports Valid: ${validation.importsValid ? '✅' : '❌'}`);

        if (validation.syntaxErrors.length > 0) {
          lines.push('');
          lines.push('**Syntax Errors**:');
          lines.push('```');
          validation.syntaxErrors.forEach(err => lines.push(err));
          lines.push('```');
        }

        if (validation.importIssues.length > 0) {
          lines.push('');
          lines.push('**Import Issues**:');
          validation.importIssues.forEach(issue => lines.push(`- ${issue}`));
        }

        if (validation.warnings.length > 0) {
          lines.push('');
          lines.push('**Warnings**:');
          validation.warnings.forEach(warning => lines.push(`- ${warning}`));
        }

        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format report as JSON
 */
export function formatReportAsJSON(report: EvaluationReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Save report to file with organized folder structure
 */
export async function saveReport(
  report: EvaluationReport,
  outputDir: string,
  format: 'markdown' | 'json' = 'markdown'
): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Create a folder for this evaluation run
  const evalFolderName = `eval-${timestamp}`;
  const evalFolder = path.join(outputDir, evalFolderName);
  await fs.mkdir(evalFolder, { recursive: true });

  // Save the main report
  const reportFilename = format === 'markdown' ? 'report.md' : 'report.json';
  const reportPath = path.join(evalFolder, reportFilename);

  const content =
    format === 'markdown'
      ? formatReportAsMarkdown(report)
      : formatReportAsJSON(report);

  await fs.writeFile(reportPath, content, 'utf-8');

  // Save code blocks for each test result
  for (const result of report.results) {
    if (result.codeBlocks.length > 0) {
      const testFolderName = `test-${result.testCase.id}`;
      const testFolder = path.join(evalFolder, testFolderName);
      await fs.mkdir(testFolder, { recursive: true });

      // Save each code block
      for (let i = 0; i < result.codeBlocks.length; i++) {
        const codeBlock = result.codeBlocks[i];
        if (!codeBlock) continue;

        // Determine file extension based on code content
        const ext = detectLanguageExtension(codeBlock);
        const codeFilename = `code-block-${i + 1}.${ext}`;
        const codeFilePath = path.join(testFolder, codeFilename);

        await fs.writeFile(codeFilePath, codeBlock, 'utf-8');
      }

      // Also save a summary file for this test
      const testSummary = generateTestSummary(result);
      const summaryPath = path.join(testFolder, 'summary.md');
      await fs.writeFile(summaryPath, testSummary, 'utf-8');
    }
  }

  return reportPath;
}

/**
 * Detect language extension from code content
 */
function detectLanguageExtension(code: string): string {
  // Check for Python patterns
  if (
    code.includes('import ') ||
    code.includes('from ') ||
    code.includes('def ') ||
    /^\s*#.*python/im.test(code)
  ) {
    return 'py';
  }

  // Check for TypeScript patterns
  if (
    code.includes('interface ') ||
    code.includes('type ') ||
    code.includes(': string') ||
    code.includes(': number')
  ) {
    return 'ts';
  }

  // Check for JavaScript patterns
  if (
    code.includes('const ') ||
    code.includes('let ') ||
    code.includes('function ') ||
    code.includes('=>')
  ) {
    return 'js';
  }

  // Default to Python (most common for Agno)
  return 'py';
}

/**
 * Generate a summary for a single test result
 */
function generateTestSummary(result: TestResult): string {
  const lines: string[] = [];

  lines.push(`# Test Case ${result.testCase.id} Summary`);
  lines.push('');
  lines.push(`**Status**: ${result.overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
  lines.push('');
  lines.push(`**Prompt**: ${result.testCase.prompt}`);
  lines.push('');

  // Execution info
  lines.push('## Execution');
  lines.push('');
  lines.push(`- Duration: ${(result.execution.duration / 1000).toFixed(2)}s`);
  lines.push(`- Exit Code: ${result.execution.exitCode ?? 'N/A'}`);
  lines.push(`- Success: ${result.execution.success ? 'Yes' : 'No'}`);
  if (result.execution.error) {
    lines.push(`- Error: ${result.execution.error}`);
  }
  lines.push('');

  // Code analysis
  lines.push('## Code Analysis');
  lines.push('');
  lines.push(`- Code Blocks Found: ${result.codeBlocksFound}`);
  lines.push(`- Docs Search Used: ${result.hasDocsSearch ? 'Yes' : 'No'}`);
  lines.push('');

  // Validation results
  if (result.validation.length > 0) {
    lines.push('## Validation Results');
    lines.push('');

    for (let i = 0; i < result.validation.length; i++) {
      const validation = result.validation[i];
      if (!validation) continue;

      lines.push(`### Code Block ${i + 1}`);
      lines.push('');
      lines.push(`- Syntax Valid: ${validation.syntaxValid ? '✅' : '❌'}`);
      lines.push(`- Imports Valid: ${validation.importsValid ? '✅' : '❌'}`);

      if (validation.syntaxErrors.length > 0) {
        lines.push('');
        lines.push('**Syntax Errors**:');
        lines.push('```');
        validation.syntaxErrors.forEach(err => lines.push(err));
        lines.push('```');
      }

      if (validation.importIssues.length > 0) {
        lines.push('');
        lines.push('**Import Issues**:');
        validation.importIssues.forEach(issue => lines.push(`- ${issue}`));
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Print summary to console
 */
export function printSummary(report: EvaluationReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('EVALUATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${report.totalTests}`);
  console.log(`Passed: ${report.passedTests} (${((report.passedTests / report.totalTests) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${report.failedTests} (${((report.failedTests / report.totalTests) * 100).toFixed(1)}%)`);
  console.log('');
  console.log('Metrics:');
  console.log(`  Average Duration: ${(report.summary.averageDuration / 1000).toFixed(2)}s`);
  console.log(`  Docs Search Usage: ${report.summary.docsSearchUsageRate.toFixed(1)}%`);
  console.log(`  Code Generation Rate: ${report.summary.codeGenerationRate.toFixed(1)}%`);
  console.log(`  Syntax Validity Rate: ${report.summary.syntaxValidRate.toFixed(1)}%`);
  console.log(`  Import Validity Rate: ${report.summary.importValidRate.toFixed(1)}%`);
  console.log('='.repeat(60) + '\n');
}
