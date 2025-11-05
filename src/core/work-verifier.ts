/**
 * Work Verifier for Agent Loop
 *
 * Verifies work through rule-based checks, visual verification, and LLM-as-Judge
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ExecutionResult,
  TodoItem,
  LoopContext,
  VerificationResult,
  VerificationFeedback,
  VerificationRule,
} from '../types/index.js';
import { LLMClient } from './llm-client.js';

const execAsync = promisify(exec);

export class WorkVerifier {
  private ruleEngine: RuleEngine;
  private llmJudge?: LLMJudge;

  constructor(llmClient?: LLMClient) {
    this.ruleEngine = new RuleEngine();
    if (llmClient) {
      this.llmJudge = new LLMJudge(llmClient);
    }
  }

  /**
   * Verify the executed action meets TODO requirements
   */
  async verify(
    action: ExecutionResult,
    todo: TodoItem,
    context: LoopContext
  ): Promise<VerificationResult> {
    const verifications: VerificationFeedback[] = [];

    // 1. Basic success check
    if (!action.success) {
      verifications.push({
        rule: 'execution_success',
        passed: false,
        message: `Action failed: ${action.error?.message || 'Unknown error'}`,
        severity: 'error',
        suggestions: ['Fix the error and retry', 'Try a different approach'],
      });
    } else {
      verifications.push({
        rule: 'execution_success',
        passed: true,
        message: 'Action executed successfully',
        severity: 'info',
      });
    }

    // 2. Rule-based verification (if rules are defined)
    const rules = this.extractRulesFromTodo(todo);
    if (rules.length > 0) {
      const ruleResults = await this.ruleEngine.verify(action, rules);
      verifications.push(...ruleResults);
    }

    // 3. Project-specific rules (from OPEN_CLI.md)
    if (context.projectConfig?.rules) {
      const projectRules = this.convertProjectRulesToVerificationRules(context.projectConfig.rules);
      const projectResults = await this.ruleEngine.verify(action, projectRules);
      verifications.push(...projectResults);
    }

    // 4. LLM-as-Judge for fuzzy criteria (if available)
    if (this.llmJudge && !this.hasOnlyDeterministicRules(todo)) {
      const llmResults = await this.llmJudge.evaluate(action, todo, context);
      verifications.push(...llmResults);
    }

    // Determine if work is complete
    const failures = verifications.filter(v => !v.passed && v.severity === 'error');
    const isComplete = failures.length === 0 && action.success;

    return {
      isComplete,
      feedback: verifications,
      summary: this.generateSummary(verifications),
      nextStepSuggestions: isComplete ? undefined : this.suggestNextSteps(failures),
    };
  }

  /**
   * Extract verification rules from TODO
   */
  private extractRulesFromTodo(todo: TodoItem): VerificationRule[] {
    const rules: VerificationRule[] = [];

    // Check if TODO mentions testing
    if (todo.description.toLowerCase().includes('test')) {
      rules.push({
        name: 'test-execution',
        type: 'test',
        description: 'Tests should pass',
        failureMessage: 'Tests failed to execute or did not pass',
        suggestions: ['Check test output for specific failures', 'Fix failing tests and retry'],
      });
    }

    // Check if TODO mentions linting
    if (todo.description.toLowerCase().includes('lint') ||
        todo.description.toLowerCase().includes('eslint')) {
      rules.push({
        name: 'lint-check',
        type: 'lint',
        description: 'Code should pass linting',
        failureMessage: 'Linting errors detected',
        suggestions: ['Run linter to see specific issues', 'Fix linting errors and retry'],
      });
    }

    // Check if TODO mentions building
    if (todo.description.toLowerCase().includes('build') ||
        todo.description.toLowerCase().includes('compile')) {
      rules.push({
        name: 'build-success',
        type: 'build',
        description: 'Project should build successfully',
        failureMessage: 'Build failed',
        suggestions: ['Check build output for errors', 'Fix compilation errors and retry'],
      });
    }

    return rules;
  }

  /**
   * Convert project rules to verification rules
   */
  private convertProjectRulesToVerificationRules(projectRules: string[]): VerificationRule[] {
    return projectRules.map((rule, index) => ({
      name: `project-rule-${index}`,
      type: 'custom' as const,
      description: rule,
      failureMessage: `Project rule not met: ${rule}`,
      suggestions: ['Review the project rule', 'Adjust implementation to meet the rule'],
    }));
  }

  /**
   * Check if TODO has only deterministic rules
   */
  private hasOnlyDeterministicRules(todo: TodoItem): boolean {
    const deterministicKeywords = ['test', 'lint', 'build', 'compile', 'format'];
    const fuzzyKeywords = ['improve', 'optimize', 'refactor', 'design', 'clean'];

    const description = todo.description.toLowerCase();
    const hasDeterministic = deterministicKeywords.some(k => description.includes(k));
    const hasFuzzy = fuzzyKeywords.some(k => description.includes(k));

    return hasDeterministic && !hasFuzzy;
  }

  /**
   * Generate summary of verification results
   */
  private generateSummary(verifications: VerificationFeedback[]): string {
    const passed = verifications.filter(v => v.passed).length;
    const failed = verifications.filter(v => !v.passed).length;

    let summary = `Verification: ${passed} passed, ${failed} failed`;

    if (failed > 0) {
      const errors = verifications.filter(v => !v.passed && v.severity === 'error');
      if (errors.length > 0) {
        summary += `. Errors: ${errors.map(e => e.rule).join(', ')}`;
      }
    }

    return summary;
  }

  /**
   * Suggest next steps based on failures
   */
  private suggestNextSteps(failures: VerificationFeedback[]): string[] {
    const suggestions: string[] = [];

    // Collect all suggestions from failures
    failures.forEach(f => {
      if (f.suggestions) {
        suggestions.push(...f.suggestions);
      }
    });

    // Add generic suggestions based on failure patterns
    if (failures.some(f => f.message.includes('syntax'))) {
      suggestions.push('Check syntax errors in the generated code');
    }
    if (failures.some(f => f.message.includes('undefined'))) {
      suggestions.push('Check for undefined variables or missing imports');
    }
    if (failures.some(f => f.message.includes('type'))) {
      suggestions.push('Fix TypeScript type errors');
    }

    // Deduplicate and limit
    return [...new Set(suggestions)].slice(0, 5);
  }
}

/**
 * Rule Engine for deterministic verification
 */
export class RuleEngine {
  async verify(
    action: ExecutionResult,
    rules: VerificationRule[]
  ): Promise<VerificationFeedback[]> {
    const feedback: VerificationFeedback[] = [];

    for (const rule of rules) {
      let result: VerificationFeedback;

      switch (rule.type) {
        case 'lint':
          result = await this.verifyLint();
          break;
        case 'test':
          result = await this.verifyTests(rule.testPattern);
          break;
        case 'build':
          result = await this.verifyBuild();
          break;
        case 'custom':
          result = await this.verifyCustom(rule, action);
          break;
        default:
          result = {
            rule: rule.description,
            passed: true,
            message: 'Rule type not implemented',
            severity: 'warning',
          };
      }

      feedback.push(result);
    }

    return feedback;
  }

  private async verifyLint(): Promise<VerificationFeedback> {
    try {
      // Try to run ESLint
      const { stdout, stderr } = await execAsync('npm run lint', {
        cwd: process.cwd(),
        timeout: 10000,
      });

      const hasErrors = stderr.includes('error') || stdout.includes('error');

      return {
        rule: 'lint',
        passed: !hasErrors,
        message: hasErrors ? 'Linting errors found' : 'No linting errors',
        severity: hasErrors ? 'error' : 'info',
        suggestions: hasErrors ? ['Run "npm run lint" to see specific errors'] : undefined,
      };
    } catch (error: any) {
      // Linting failed or lint command doesn't exist
      return {
        rule: 'lint',
        passed: false,
        message: `Lint check failed: ${error.message}`,
        severity: 'error',
        suggestions: ['Ensure ESLint is configured', 'Fix linting errors'],
      };
    }
  }

  private async verifyTests(pattern?: string): Promise<VerificationFeedback> {
    try {
      // Try to run tests
      const testCommand = pattern ? `npm test -- ${pattern}` : 'npm test';
      const { stdout } = await execAsync(testCommand, {
        cwd: process.cwd(),
        timeout: 30000,
      });

      const passed = stdout.includes('passed') || stdout.includes('PASS');
      const failed = stdout.includes('failed') || stdout.includes('FAIL');

      return {
        rule: 'test',
        passed: passed && !failed,
        message: failed ? 'Some tests failed' : 'All tests passed',
        severity: failed ? 'error' : 'info',
        suggestions: failed ? ['Fix failing tests', 'Check test output for details'] : undefined,
      };
    } catch (error: any) {
      // Tests failed to run
      return {
        rule: 'test',
        passed: false,
        message: `Test execution failed: ${error.message}`,
        severity: 'error',
        suggestions: ['Ensure tests are configured', 'Check if npm test command exists'],
      };
    }
  }

  private async verifyBuild(): Promise<VerificationFeedback> {
    try {
      // Try to build the project
      const { stderr } = await execAsync('npm run build', {
        cwd: process.cwd(),
        timeout: 30000,
      });

      const hasErrors = stderr.includes('error') || stderr.includes('Error');

      return {
        rule: 'build',
        passed: !hasErrors,
        message: hasErrors ? 'Build failed with errors' : 'Build completed successfully',
        severity: hasErrors ? 'error' : 'info',
        suggestions: hasErrors ? ['Fix compilation errors', 'Check build output'] : undefined,
      };
    } catch (error: any) {
      // Build failed
      return {
        rule: 'build',
        passed: false,
        message: `Build failed: ${error.message}`,
        severity: 'error',
        suggestions: ['Fix build errors', 'Check TypeScript configuration'],
      };
    }
  }

  private async verifyCustom(rule: VerificationRule, _action: ExecutionResult): Promise<VerificationFeedback> {
    // Simple implementation for custom rules
    // In a real implementation, this would be more sophisticated

    if (rule.command) {
      try {
        const { stdout } = await execAsync(rule.command, {
          cwd: process.cwd(),
          timeout: 10000,
        });

        const passed = rule.expectedOutput
          ? (rule.expectedOutput instanceof RegExp
              ? rule.expectedOutput.test(stdout)
              : stdout.includes(rule.expectedOutput))
          : true;

        return {
          rule: rule.description,
          passed,
          message: passed ? 'Custom rule passed' : 'Custom rule failed',
          severity: passed ? 'info' : 'error',
        };
      } catch (error: any) {
        return {
          rule: rule.description,
          passed: false,
          message: `Custom rule failed: ${error.message}`,
          severity: 'error',
        };
      }
    }

    // Default: pass custom rules without specific commands
    return {
      rule: rule.description,
      passed: true,
      message: 'Custom rule evaluated (no specific check)',
      severity: 'info',
    };
  }
}

/**
 * LLM Judge for fuzzy criteria evaluation
 */
export class LLMJudge {
  constructor(private llmClient: LLMClient) {}

  async evaluate(
    action: ExecutionResult,
    todo: TodoItem,
    _context: LoopContext
  ): Promise<VerificationFeedback[]> {
    const systemPrompt = `You are a code quality judge evaluating if a TODO has been completed successfully.

TODO: ${todo.title}
Description: ${todo.description}

Action taken: ${action.action}
${action.output ? `Output: ${JSON.stringify(action.output).slice(0, 500)}` : ''}

Evaluate if the action successfully completes the TODO requirements.
Consider:
1. Does the action address the TODO's main objective?
2. Is the implementation correct and complete?
3. Are there any obvious issues or missing parts?

Respond in JSON format:
{
  "passed": true/false,
  "message": "Brief explanation",
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;

    try {
      const response = await this.llmClient.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Evaluate the action and provide your judgment.' },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message.content || '';
      const judgment = this.parseJudgment(content);

      return [{
        rule: 'llm_judge',
        passed: judgment.passed,
        message: judgment.message,
        severity: judgment.passed ? 'info' : 'warning',
        suggestions: judgment.suggestions,
      }];
    } catch (error) {
      // If LLM judge fails, return a warning but don't block
      return [{
        rule: 'llm_judge',
        passed: true,
        message: 'LLM judge evaluation failed, assuming pass',
        severity: 'warning',
      }];
    }
  }

  private parseJudgment(content: string): {
    passed: boolean;
    message: string;
    suggestions?: string[];
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          passed: parsed.passed || false,
          message: parsed.message || 'No message provided',
          suggestions: parsed.suggestions,
        };
      }
    } catch (error) {
      console.debug('Failed to parse LLM judge response:', error);
    }

    // Default: assume pass if can't parse
    return {
      passed: true,
      message: 'Unable to parse judgment',
    };
  }
}

export default WorkVerifier;