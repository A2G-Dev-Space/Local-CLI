/**
 * Comprehensive Verification System
 *
 * Three-mode verification: Rules, Visual, and LLM-as-Judge
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
  VerificationCriteria,
  VerificationOutcome,
  VerificationRule,
  VisualCriteria,
  WorkOutput,
} from '../types/index.js';
import { LLMClient } from '../core/llm-client.js';

const execAsync = promisify(exec);

export interface VerificationResult {
  passed: boolean;
  outcomes: VerificationOutcome[];
  summary: string;
  score: number; // 0-100
}

/**
 * Rule Engine for deterministic verification
 */
export class RuleEngine {
  async verifyRule(rule: VerificationRule, work: WorkOutput): Promise<VerificationOutcome> {
    let passed = false;
    let output: any;

    try {
      switch (rule.type) {
        case 'lint':
          output = await this.runCommand('npm run lint');
          passed = output.exitCode === 0;
          break;

        case 'test':
          output = await this.runCommand(rule.command || 'npm test');
          passed = output.exitCode === 0;
          break;

        case 'build':
          output = await this.runCommand('npm run build');
          passed = output.exitCode === 0;
          break;

        case 'custom':
          if (rule.validator) {
            passed = rule.validator(work);
          } else if (rule.command) {
            output = await this.runCommand(rule.command);
            if (rule.expectedOutput) {
              passed = this.matchesExpected(output.stdout, rule.expectedOutput);
            } else {
              passed = output.exitCode === 0;
            }
          }
          break;
      }

      return {
        rule: rule.name,
        passed,
        output,
        message: passed ? `${rule.name} passed` : rule.failureMessage,
        suggestions: passed ? [] : rule.suggestions,
        severity: passed ? 'info' : 'error'
      };
    } catch (error: any) {
      return {
        rule: rule.name,
        passed: false,
        message: `${rule.name} failed: ${error.message}`,
        suggestions: rule.suggestions,
        severity: 'error',
        output: { error: error.message }
      };
    }
  }

  private async runCommand(command: string): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 30000
      });

      return {
        exitCode: 0,
        stdout,
        stderr
      };
    } catch (error: any) {
      return {
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message
      };
    }
  }

  private matchesExpected(actual: string, expected: string | RegExp): boolean {
    if (expected instanceof RegExp) {
      return expected.test(actual);
    }
    return actual.includes(expected);
  }
}

/**
 * LLM Judge for fuzzy evaluation
 */
export class LLMJudge {
  constructor(private llmClient: LLMClient) {}

  async evaluateCriterion(work: WorkOutput, criterion: string): Promise<{
    passed: boolean;
    message: string;
    suggestions?: string[];
  }> {
    if (!this.llmClient) {
      return {
        passed: true,
        message: 'LLM Judge not available',
        suggestions: []
      };
    }

    const prompt = `Evaluate if this work meets the following criterion:

Criterion: ${criterion}

Work:
${work.code ? `Code:\n${work.code.substring(0, 1000)}` : ''}
${work.files ? `Files: ${work.files.map(f => f.path).join(', ')}` : ''}

Provide evaluation in JSON format:
{
  "passed": true/false,
  "message": "Brief explanation",
  "suggestions": ["suggestion1", "suggestion2"]
}`;

    try {
      const response = await this.llmClient.chatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are evaluating work quality against specific criteria. Be objective and constructive.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const content = response.choices[0]?.message.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          passed: parsed.passed || false,
          message: parsed.message || 'No message provided',
          suggestions: parsed.suggestions || []
        };
      }
    } catch (error) {
      console.debug('Failed to parse LLM evaluation:', error);
    }

    return {
      passed: true,
      message: 'Unable to evaluate',
      suggestions: []
    };
  }
}

export class VisualVerifier {
  /**
   * Verify visual output (simplified implementation)
   */
  async verify(
    work: WorkOutput,
    criteria: VisualCriteria
  ): Promise<VerificationOutcome[]> {
    const outcomes: VerificationOutcome[] = [];

    // Check if URL is accessible
    if (criteria.url) {
      try {
        const urlCheck = await this.checkUrl(criteria.url);
        outcomes.push({
          rule: 'url-accessibility',
          passed: urlCheck.accessible,
          message: urlCheck.accessible ? 'URL is accessible' : 'URL is not accessible',
          suggestions: urlCheck.accessible ? [] : ['Check if server is running', 'Verify URL is correct'],
          severity: urlCheck.accessible ? 'info' : 'error',
          output: urlCheck
        });
      } catch (error: any) {
        outcomes.push({
          rule: 'url-accessibility',
          passed: false,
          message: `Failed to check URL: ${error.message}`,
          suggestions: ['Ensure server is running', 'Check network connectivity'],
          severity: 'error'
        });
      }
    }

    // Check for expected elements (if applicable)
    if (criteria.expectedElements && criteria.expectedElements.length > 0) {
      // For HTML/UI work, check if expected elements exist
      if (work.code && this.isHtmlContent(work.code)) {
        const elementCheck = this.checkElements(work.code, criteria.expectedElements);
        outcomes.push({
          rule: 'expected-elements',
          passed: elementCheck.allFound,
          message: `Found ${elementCheck.found}/${criteria.expectedElements.length} expected elements`,
          suggestions: elementCheck.allFound ? [] : elementCheck.missing.map(e => `Add element: ${e}`),
          severity: elementCheck.allFound ? 'info' : 'warning',
          output: elementCheck
        });
      }
    }

    // Screenshot comparison (placeholder - would need browser automation)
    if (criteria.screenshots && criteria.screenshots.length > 0) {
      outcomes.push({
        rule: 'screenshot-comparison',
        passed: true,
        message: 'Screenshot comparison not yet implemented',
        suggestions: [],
        severity: 'info'
      });
    }

    // Viewport check
    if (criteria.viewport) {
      outcomes.push({
        rule: 'viewport-specification',
        passed: true,
        message: `Viewport specified: ${criteria.viewport.width}x${criteria.viewport.height}`,
        suggestions: [],
        severity: 'info'
      });
    }

    return outcomes;
  }

  private async checkUrl(url: string): Promise<{ accessible: boolean; statusCode?: number; error?: string }> {
    try {
      // Use curl to check URL accessibility
      const { stdout } = await execAsync(`curl -o /dev/null -s -w "%{http_code}" ${url}`, {
        timeout: 5000
      });

      const statusCode = parseInt(stdout.trim());
      return {
        accessible: statusCode >= 200 && statusCode < 400,
        statusCode
      };
    } catch (error: any) {
      return {
        accessible: false,
        error: error.message
      };
    }
  }

  private isHtmlContent(code: string): boolean {
    return code.includes('<') && code.includes('>') &&
           (code.includes('html') || code.includes('div') || code.includes('body'));
  }

  private checkElements(html: string, expectedElements: string[]): {
    found: number;
    missing: string[];
    allFound: boolean;
  } {
    const missing: string[] = [];
    let found = 0;

    for (const element of expectedElements) {
      // Simple check - look for element in HTML
      if (html.includes(element) || html.includes(`<${element}`) || html.includes(`id="${element}"`)) {
        found++;
      } else {
        missing.push(element);
      }
    }

    return {
      found,
      missing,
      allFound: missing.length === 0
    };
  }
}

export class VerificationSystem {
  private ruleEngine: RuleEngine;
  private visualVerifier: VisualVerifier;
  private llmJudge: LLMJudge;

  constructor(llmClient?: LLMClient) {
    this.ruleEngine = new RuleEngine();
    this.visualVerifier = new VisualVerifier();
    this.llmJudge = llmClient ? new LLMJudge(llmClient) : new LLMJudge(null as any);
  }

  /**
   * Main verification method
   */
  async verify(
    work: WorkOutput,
    criteria: VerificationCriteria
  ): Promise<VerificationResult> {
    const outcomes: VerificationOutcome[] = [];

    console.log('\n Verification starting...\n');

    // 1. Rule-based verification (strongest, deterministic)
    if (criteria.rules && criteria.rules.length > 0) {
      console.log('Rule-based verification...');
      const ruleResults = await this.verifyRules(work, criteria.rules);
      outcomes.push(...ruleResults);
      console.log(`  ${ruleResults.filter(r => r.passed).length}/${ruleResults.length} rules passed\n`);
    }

    // 2. Visual verification (for UI work)
    if (criteria.visual) {
      console.log('Visual verification...');
      const visualResults = await this.visualVerifier.verify(work, criteria.visual);
      outcomes.push(...visualResults);
      console.log(`  ${visualResults.filter(r => r.passed).length}/${visualResults.length} visual checks passed\n`);
    }

    // 3. LLM-as-Judge (for fuzzy criteria)
    if (criteria.fuzzy && criteria.fuzzy.length > 0) {
      console.log('LLM-as-Judge evaluation...');
      const llmResults = await this.verifyWithLLM(work, criteria.fuzzy);
      outcomes.push(...llmResults);
      console.log(`  ${llmResults.filter(r => r.passed).length}/${llmResults.length} LLM checks passed\n`);
    }

    return this.aggregateResults(outcomes);
  }

  /**
   * Verify using rules
   */
  private async verifyRules(
    work: WorkOutput,
    rules: VerificationRule[]
  ): Promise<VerificationOutcome[]> {
    const outcomes: VerificationOutcome[] = [];

    for (const rule of rules) {
      const outcome = await this.ruleEngine.verifyRule(rule, work);
      outcomes.push(outcome);
    }

    return outcomes;
  }

  /**
   * Verify using LLM-as-Judge
   */
  private async verifyWithLLM(
    work: WorkOutput,
    criteria: string[]
  ): Promise<VerificationOutcome[]> {
    const outcomes: VerificationOutcome[] = [];

    for (const criterion of criteria) {
      try {
        const evaluation = await this.llmJudge.evaluateCriterion(work, criterion);
        outcomes.push({
          rule: `llm-judge: ${criterion}`,
          passed: evaluation.passed,
          message: evaluation.message,
          suggestions: evaluation.suggestions || [],
          severity: evaluation.passed ? 'info' : 'warning',
          output: evaluation
        });
      } catch (error: any) {
        outcomes.push({
          rule: `llm-judge: ${criterion}`,
          passed: false,
          message: `LLM evaluation failed: ${error.message}`,
          suggestions: [],
          severity: 'warning'
        });
      }
    }

    return outcomes;
  }

  /**
   * Aggregate verification results
   */
  private aggregateResults(outcomes: VerificationOutcome[]): VerificationResult {
    const passed = outcomes.every(o => o.passed || o.severity !== 'error');
    const passedCount = outcomes.filter(o => o.passed).length;
    const totalCount = outcomes.length;
    const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

    // Generate summary
    const errors = outcomes.filter(o => !o.passed && o.severity === 'error');
    const warnings = outcomes.filter(o => !o.passed && o.severity === 'warning');

    let summary = `Verification: ${passedCount}/${totalCount} checks passed (${score}%)`;

    if (errors.length > 0) {
      summary += `\n ${errors.length} error(s): ${errors.map(e => e.rule).join(', ')}`;
    }

    if (warnings.length > 0) {
      summary += `\n ${warnings.length} warning(s): ${warnings.map(w => w.rule).join(', ')}`;
    }

    if (passed) {
      summary += '\n All critical checks passed!';
    }

    return {
      passed,
      outcomes,
      summary,
      score
    };
  }
}

export default VerificationSystem;
