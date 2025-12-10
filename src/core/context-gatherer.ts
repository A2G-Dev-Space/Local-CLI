/**
 * Context Gatherer for Agent Loop
 *
 * Gathers context for agent loop execution.
 * File system exploration is DISABLED to prevent memory issues.
 */

import fs from 'fs/promises';
import path from 'path';
import {
  LoopContext,
  FileSystemContext,
  ProjectConfig,
  FailureAnalysis,
  TodoItem,
  ExecutionResult,
  VerificationFeedback,
} from '../types/index.js';

/**
 * Cleanup function - no-op since we don't spawn processes anymore
 */
export function cleanupActiveProcesses(): void {
  // No-op: file system exploration is disabled
}

export interface ContextRequest {
  todo: TodoItem;
  previousResults?: ExecutionResult[];
  previousFeedback?: VerificationFeedback[];
  iteration?: number;
}

export class ContextGatherer {
  /**
   * Gather comprehensive context for the agent loop
   */
  async gather(request: ContextRequest): Promise<LoopContext> {
    const context: LoopContext = {
      currentTodo: request.todo,
      previousResults: request.previousResults || [],
      fileSystemContext: await this.exploreFileSystem(request),
      feedback: request.previousFeedback || [],
      iteration: request.iteration,
    };

    // Load project configuration if exists
    const projectConfig = await this.loadProjectConfig();
    if (projectConfig) {
      context.projectConfig = projectConfig;
    }

    // Analyze previous failures if any
    if (context.feedback.length > 0) {
      context.failureAnalysis = await this.analyzeFailures(context.feedback);
    }

    return context;
  }

  /**
   * Explore file system - DISABLED to prevent memory issues
   * Returns minimal context without any shell commands
   */
  private async exploreFileSystem(_request: ContextRequest): Promise<FileSystemContext> {
    // Return empty context - no file system exploration
    // This prevents memory issues from find/grep commands
    return {
      structure: '',
      currentDirectory: process.cwd(),
      relevantMentions: '',
      relevantFiles: [],
    };
  }

  /**
   * Load project-specific configuration from OPEN_CLI.md
   */
  private async loadProjectConfig(): Promise<ProjectConfig | null> {
    const configPath = path.join(process.cwd(), 'OPEN_CLI.md');

    try {
      await fs.access(configPath);
      const content = await fs.readFile(configPath, 'utf-8');

      return this.parseProjectConfig(content);
    } catch (error) {
      // OPEN_CLI.md doesn't exist or can't be read
      return null;
    }
  }

  /**
   * Parse project configuration from markdown content
   */
  private parseProjectConfig(content: string): ProjectConfig {
    const config: ProjectConfig = {};

    // Extract project name
    const nameMatch = content.match(/^#\s+(.+)$/m);
    if (nameMatch && nameMatch[1]) {
      config.name = nameMatch[1];
    }

    // Extract description (first paragraph after title)
    const descMatch = content.match(/^#[^#]+\n\n([^\n]+)/);
    if (descMatch && descMatch[1]) {
      config.description = descMatch[1];
    }

    // Extract test command
    const testMatch = content.match(/test[:\s]+`([^`]+)`/i);
    if (testMatch && testMatch[1]) {
      config.testCommand = testMatch[1];
    }

    // Extract build command
    const buildMatch = content.match(/build[:\s]+`([^`]+)`/i);
    if (buildMatch && buildMatch[1]) {
      config.buildCommand = buildMatch[1];
    }

    // Extract rules (if any rules section exists)
    const rulesMatch = content.match(/##\s*Rules?\s*\n([\s\S]+?)(?=\n##|\n$)/i);
    if (rulesMatch && rulesMatch[1]) {
      config.rules = rulesMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
        .map(line => line.replace(/^[\s\-\*]+/, '').trim());
    }

    return config;
  }

  /**
   * Analyze previous failures to find patterns
   */
  private async analyzeFailures(feedback: VerificationFeedback[]): Promise<FailureAnalysis> {
    const failures = feedback.filter(f => !f.passed);

    const analysis: FailureAnalysis = {
      commonPatterns: [],
      suggestedFixes: [],
    };

    if (failures.length === 0) {
      return analysis;
    }

    // Group failures by rule
    const failuresByRule = new Map<string, VerificationFeedback[]>();
    failures.forEach(f => {
      const existing = failuresByRule.get(f.rule) || [];
      existing.push(f);
      failuresByRule.set(f.rule, existing);
    });

    // Find common patterns
    for (const [rule, feedbacks] of failuresByRule) {
      if (feedbacks.length > 1) {
        analysis.commonPatterns.push(`Multiple failures for rule: ${rule}`);
      }
    }

    // Collect all suggestions
    failures.forEach(f => {
      if (f.suggestions) {
        analysis.suggestedFixes.push(...f.suggestions);
      }
    });

    // Determine root cause (simplified heuristic)
    if (failures.some(f => f.message.includes('syntax'))) {
      analysis.rootCause = 'Syntax error in generated code';
    } else if (failures.some(f => f.message.includes('test'))) {
      analysis.rootCause = 'Test failures';
    } else if (failures.some(f => f.message.includes('type'))) {
      analysis.rootCause = 'Type checking errors';
    }

    return analysis;
  }
}

export default ContextGatherer;