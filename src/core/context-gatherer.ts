/**
 * Context Gatherer for Agent Loop
 *
 * Gathers comprehensive context through active file system exploration,
 * project configuration loading, and failure analysis
 */

import { exec } from 'child_process';
import { promisify } from 'util';
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

const execAsync = promisify(exec);

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
   * Explore file system using grep, find, ls commands
   */
  private async exploreFileSystem(request: ContextRequest): Promise<FileSystemContext> {
    const fsContext: FileSystemContext = {};

    try {
      // 1. Get directory structure
      const structureCmd = `find . -type f -name "*.ts" -o -name "*.js" -o -name "*.json" | head -20`;
      const { stdout: structure } = await execAsync(structureCmd, {
        cwd: process.cwd(),
        timeout: 5000,
      });
      fsContext.structure = structure.trim();
    } catch (error) {
      console.debug('Failed to get directory structure:', error);
    }

    try {
      // 2. Search for relevant mentions in documentation
      const keywords = request.todo.title.split(' ').slice(0, 3).join('|');
      const searchCmd = `grep -r "${keywords}" --include="*.md" --include="*.txt" 2>/dev/null | head -10`;
      const { stdout: mentions } = await execAsync(searchCmd, {
        cwd: process.cwd(),
        timeout: 5000,
      });
      fsContext.relevantMentions = mentions.trim();
    } catch (error) {
      console.debug('No relevant mentions found');
    }

    try {
      // 3. Get current directory listing
      const { stdout: dirListing } = await execAsync('ls -la', {
        cwd: process.cwd(),
        timeout: 2000,
      });
      fsContext.currentDirectory = dirListing.trim();
    } catch (error) {
      console.debug('Failed to get directory listing:', error);
    }

    // 4. Find relevant files based on TODO description
    if (request.todo.requiresDocsSearch) {
      fsContext.relevantFiles = await this.searchRelevantFiles(request.todo);
    }

    return fsContext;
  }

  /**
   * Search for relevant files based on TODO content
   */
  private async searchRelevantFiles(todo: TodoItem): Promise<string[]> {
    const relevantFiles: string[] = [];

    try {
      // Extract key terms from TODO
      const keywords = this.extractKeywords(todo.title + ' ' + todo.description);

      for (const keyword of keywords) {
        const searchCmd = `find . -type f \\( -name "*${keyword}*" -o -exec grep -l "${keyword}" {} \\; \\) 2>/dev/null | head -5`;
        const { stdout } = await execAsync(searchCmd, {
          cwd: process.cwd(),
          timeout: 5000,
        });

        const files = stdout.trim().split('\n').filter(f => f);
        relevantFiles.push(...files);
      }

      // Remove duplicates
      return [...new Set(relevantFiles)];
    } catch (error) {
      console.debug('Error searching relevant files:', error);
      return [];
    }
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

  /**
   * Extract keywords from text for searching
   */
  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were']);

    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Return unique keywords
    return [...new Set(words)].slice(0, 5);
  }
}

export default ContextGatherer;