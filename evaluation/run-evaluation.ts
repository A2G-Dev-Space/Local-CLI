#!/usr/bin/env node

import { runEvaluation } from './evaluator.js';

/**
 * CLI script to run Agno Agent code generation evaluation
 *
 * Usage:
 *   npm run evaluate              # Run all test cases
 *   npm run evaluate -- --test 1,2,3   # Run specific test cases
 *   npm run evaluate -- --timeout 600000  # Set custom timeout (10 min)
 *   npm run evaluate -- --format json     # Output JSON report
 *   npm run evaluate -- --format both     # Output both markdown and JSON
 */

interface CLIArgs {
  testCaseIds?: number[];
  timeout?: number;
  format?: 'markdown' | 'json' | 'both';
  outputDir?: string;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--test':
      case '-t': {
        const testArg = args[i + 1];
        if (testArg) {
          result.testCaseIds = testArg
            .split(',')
            .map(id => parseInt(id.trim(), 10))
            .filter(id => !isNaN(id));
          i++;
        }
        break;
      }

      case '--timeout': {
        const timeoutArg = args[i + 1];
        if (timeoutArg) {
          result.timeout = parseInt(timeoutArg, 10);
          i++;
        }
        break;
      }

      case '--format':
      case '-f': {
        const formatArg = args[i + 1];
        if (formatArg) {
          if (formatArg === 'markdown' || formatArg === 'json' || formatArg === 'both') {
            result.format = formatArg;
          }
          i++;
        }
        break;
      }

      case '--output':
      case '-o': {
        const outputArg = args[i + 1];
        if (outputArg) {
          result.outputDir = outputArg;
          i++;
        }
        break;
      }

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Agno Agent Code Generation Evaluation Tool

Usage:
  npm run evaluate [options]

Options:
  --test, -t <ids>       Run specific test cases (comma-separated)
                         Example: --test 1,2,3

  --timeout <ms>         Set execution timeout in milliseconds
                         Default: 300000 (5 minutes)
                         Example: --timeout 600000

  --format, -f <format>  Report format: markdown, json, or both
                         Default: markdown
                         Example: --format both

  --output, -o <dir>     Output directory for reports
                         Default: evaluation-reports/
                         Example: --output ./reports

  --help, -h             Show this help message

Examples:
  # Run all test cases
  npm run evaluate

  # Run specific test cases
  npm run evaluate -- --test 1,2,3

  # Run with custom timeout and JSON output
  npm run evaluate -- --timeout 600000 --format json

  # Run and save to custom directory
  npm run evaluate -- --output ./my-reports --format both
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Agno Agent Code Generation Evaluation                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (args.testCaseIds && args.testCaseIds.length > 0) {
    console.log(`Selected test cases: ${args.testCaseIds.join(', ')}`);
  } else {
    console.log('Running all test cases');
  }

  if (args.timeout) {
    console.log(`Timeout: ${args.timeout}ms (${(args.timeout / 1000).toFixed(0)}s)`);
  }

  if (args.format) {
    console.log(`Report format: ${args.format}`);
  }

  console.log('');

  await runEvaluation({
    testCaseIds: args.testCaseIds,
    timeout: args.timeout,
    reportFormat: args.format,
    outputDir: args.outputDir,
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
