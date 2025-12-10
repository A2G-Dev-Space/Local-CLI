/**
 * Agent Loop Controller
 *
 * Main orchestrator for the gather → act → verify → repeat loop
 */

import { LLMClient } from './llm-client.js';
import { ContextGatherer, cleanupActiveProcesses } from './context-gatherer.js';
import { ActionExecutor } from './action-executor.js';
import { WorkVerifier } from './work-verifier.js';
import {
  TodoItem,
  Message,
  LoopContext,
  ExecutionResult,
  TodoExecutionResult,
  ProgressUpdate,
  ToolDefinition,
} from '../types/index.js';

export interface AgentLoopConfig {
  maxIterations?: number;
  verbose?: boolean;
  enableLLMJudge?: boolean;
  timeout?: number; // milliseconds
  contextGatherer?: ContextGatherer; // Allow injecting custom ContextGatherer for testing
  /** Delay between LLM calls in milliseconds (default: 1000ms for local LLM) */
  llmCallDelay?: number;
}

export class AgentLoopController {
  private contextGatherer: ContextGatherer;
  private actionExecutor: ActionExecutor;
  private workVerifier: WorkVerifier;
  private maxIterations: number;
  private verbose: boolean;
  private timeout?: number;
  private llmCallDelay: number;

  constructor(
    llmClient: LLMClient,
    availableTools: ToolDefinition[] = [],
    config: AgentLoopConfig = {}
  ) {
    this.maxIterations = config.maxIterations || 10;
    this.verbose = config.verbose || false;
    this.timeout = config.timeout;
    // Default 2 second delay between LLM calls to prevent overwhelming local LLM
    this.llmCallDelay = config.llmCallDelay ?? 2000;

    this.contextGatherer = config.contextGatherer || new ContextGatherer();
    this.actionExecutor = new ActionExecutor(llmClient, availableTools);
    this.workVerifier = new WorkVerifier(config.enableLLMJudge ? llmClient : undefined);
  }

  /**
   * Delay to prevent overwhelming local LLM
   */
  private async throttle(): Promise<void> {
    if (this.llmCallDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.llmCallDelay));
    }
  }

  /**
   * Execute a TODO with the agent loop methodology
   */
  async executeTodoWithLoop(
    todo: TodoItem,
    messages: Message[],
    onProgress?: (update: ProgressUpdate) => void
  ): Promise<TodoExecutionResult> {
    const startTime = Date.now();
    let currentIteration = 0;
    const executionResults: ExecutionResult[] = [];
    let context: LoopContext;

    this.log(`🔄 Starting Agent Loop for TODO: ${todo.title}`);
    this.log(`📝 Description: ${todo.description}`);

    try {
      // Initial context gathering
      context = await this.contextGatherer.gather({
        todo,
        iteration: currentIteration,
      });

      while (currentIteration < this.maxIterations) {
        // Check timeout
        if (this.timeout && Date.now() - startTime > this.timeout) {
          return {
            success: false,
            error: 'Agent loop timeout exceeded',
            iterations: currentIteration,
          };
        }

        currentIteration++;
        this.log(`\n━━━ Iteration ${currentIteration}/${this.maxIterations} ━━━`);

        // 1. Gather Context (update with feedback)
        this.log('📊 Gathering context...');
        context = await this.contextGatherer.gather({
          todo,
          previousResults: executionResults,
          previousFeedback: context.feedback,
          iteration: currentIteration,
        });

        // Log context insights
        if (this.verbose) {
          this.logContext(context);
        }

        // 2. Take Action (with throttle to prevent overwhelming local LLM)
        this.log('🎯 Taking action...');
        await this.throttle();
        const action = await this.actionExecutor.execute(context, messages);
        executionResults.push(action);

        this.log(`  Action: ${action.action}`);
        if (action.toolName) {
          this.log(`  Tool: ${action.toolName}`);
        }
        if (!action.success) {
          this.log(`  ❌ Failed: ${action.error?.message}`);
        } else {
          this.log(`  ✅ Success`);
        }

        // 3. Verify Work (with throttle)
        this.log('🔍 Verifying work...');
        await this.throttle();
        const verification = await this.workVerifier.verify(action, todo, context);

        this.log(`  ${verification.summary}`);
        if (this.verbose) {
          verification.feedback.forEach(f => {
            const emoji = f.passed ? '✅' : '❌';
            this.log(`    ${emoji} ${f.rule}: ${f.message}`);
          });
        }

        // 4. Decide to Repeat
        if (verification.isComplete) {
          this.log(`\n🎉 TODO completed successfully in ${currentIteration} iteration(s)!`);
          return {
            success: true,
            result: action.output,
            iterations: currentIteration,
            verificationReport: verification,
          };
        }

        // Add feedback to context for next iteration
        context.feedback.push(...verification.feedback);

        // Notify progress
        onProgress?.({
          iteration: currentIteration,
          action: action.action,
          verification: verification,
          willRetry: true,
        });

        // Log retry decision
        this.log('🔄 Work not complete, retrying with feedback...');
        if (verification.nextStepSuggestions && verification.nextStepSuggestions.length > 0) {
          this.log('  Suggestions for next iteration:');
          verification.nextStepSuggestions.forEach(s => {
            this.log(`    → ${s}`);
          });
        }
      }

      // Max iterations reached
      this.log(`\n⚠️ Max iterations (${this.maxIterations}) reached without completing TODO`);
      return {
        success: false,
        error: `Max iterations (${this.maxIterations}) reached without completing task`,
        iterations: this.maxIterations,
        lastVerification: context.feedback[context.feedback.length - 1],
      };
    } catch (error) {
      this.log(`\n❌ Agent Loop error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        iterations: currentIteration,
      };
    } finally {
      // Always cleanup child processes to prevent memory leaks and core dumps
      cleanupActiveProcesses();
    }
  }

  /**
   * Execute multiple TODOs with agent loop
   */
  async executeMultipleTodos(
    todos: TodoItem[],
    initialMessages: Message[] = [],
    onProgress?: (todoIndex: number, update: ProgressUpdate) => void
  ): Promise<{ results: TodoExecutionResult[]; messages: Message[] }> {
    const results: TodoExecutionResult[] = [];
    let messages = [...initialMessages];

    this.log(`\n📋 Executing ${todos.length} TODO(s) with Agent Loop...\n`);

    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];
      if (!todo) continue;

      this.log(`\n╔════════════════════════════════════════════════╗`);
      this.log(`║ TODO ${i + 1}/${todos.length}: ${todo.title.padEnd(30).slice(0, 30)} ║`);
      this.log(`╚════════════════════════════════════════════════╝`);

      // Check dependencies
      if (todo.dependencies && todo.dependencies.length > 0) {
        const allDepsCompleted = todo.dependencies.every(depId => {
          const depIndex = todos.findIndex(t => t.id === depId);
          return depIndex !== -1 && depIndex < i && results[depIndex]?.success;
        });

        if (!allDepsCompleted) {
          this.log('⚠️ Skipping due to unmet dependencies');
          results.push({
            success: false,
            error: 'Dependencies not met',
            iterations: 0,
          });
          continue;
        }
      }

      // Execute with agent loop
      const result = await this.executeTodoWithLoop(
        todo,
        messages,
        (update) => onProgress?.(i, update)
      );

      results.push(result);

      // Update messages with execution summary
      messages.push({
        role: 'assistant',
        content: result.success
          ? `✅ Completed: ${todo.title} (${result.iterations} iterations)`
          : `❌ Failed: ${todo.title} - ${result.error}`,
      });
    }

    // Summary
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    this.log(`\n╔════════════════════════════════════════════════╗`);
    this.log(`║                 EXECUTION SUMMARY               ║`);
    this.log(`╠════════════════════════════════════════════════╣`);
    this.log(`║ ✅ Completed: ${String(successCount).padEnd(5)} / ${todos.length}                        ║`);
    this.log(`║ ❌ Failed:    ${String(failCount).padEnd(5)} / ${todos.length}                        ║`);
    this.log(`║ 🔄 Total iterations: ${String(results.reduce((sum, r) => sum + r.iterations, 0)).padEnd(5)}                   ║`);
    this.log(`╚════════════════════════════════════════════════╝`);

    return { results, messages };
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  /**
   * Log context information
   */
  private logContext(context: LoopContext): void {
    this.log('  📁 File System Context:');
    if (context.fileSystemContext.relevantFiles && context.fileSystemContext.relevantFiles.length > 0) {
      this.log(`    Relevant files: ${context.fileSystemContext.relevantFiles.join(', ')}`);
    }
    if (context.fileSystemContext.relevantMentions) {
      this.log(`    Mentions found: ${context.fileSystemContext.relevantMentions.split('\n').length} line(s)`);
    }

    if (context.projectConfig) {
      this.log('  ⚙️ Project Config:');
      this.log(`    Name: ${context.projectConfig.name || 'Unknown'}`);
      if (context.projectConfig.testCommand) {
        this.log(`    Test: ${context.projectConfig.testCommand}`);
      }
      if (context.projectConfig.buildCommand) {
        this.log(`    Build: ${context.projectConfig.buildCommand}`);
      }
    }

    if (context.failureAnalysis) {
      this.log('  🔍 Failure Analysis:');
      if (context.failureAnalysis.rootCause) {
        this.log(`    Root cause: ${context.failureAnalysis.rootCause}`);
      }
      if (context.failureAnalysis.suggestedFixes.length > 0) {
        this.log(`    Fixes: ${context.failureAnalysis.suggestedFixes.join(', ')}`);
      }
    }
  }
}

export default AgentLoopController;