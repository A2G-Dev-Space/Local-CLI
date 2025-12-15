/**
 * Documentation Search Agent
 *
 * Uses LLM with bash tools to intelligently search documentation.
 * Refactored from src/core/knowledge/docs-search-agent.ts
 */

import { BaseAgent, AgentContext, AgentResult, AgentConfig } from '../base/base-agent.js';
import { LLMClient } from '../../core/llm/llm-client.js';
import { Message, ToolDefinition } from '../../types/index.js';
import { executeBashCommand, isCommandSafe, sanitizeCommand } from '../../core/bash-command-tool.js';
import { detectFrameworkPath, TERM_MAPPING } from '../../core/agent-framework-handler.js';
import { buildDocsSearchPrompt, DOCS_SEARCH_CONFIG } from '../../prompts/agents/docs-search.js';
import { logger } from '../../utils/logger.js';
import { RUN_BASH_TOOL } from './tools.js';

/**
 * Stop words for keyword extraction
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must',
  'can', 'how', 'what', 'when', 'where', 'why', 'which', 'who', 'whom', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
  'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'use', 'using', 'create', 'make',
]);

/**
 * Extract keywords from query with term mapping support
 */
function extractKeywords(query: string): string[] {
  const expandedKeywords = new Set<string>();

  const words = query
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1);

  for (const word of words) {
    const lowerWord = word.toLowerCase();

    if (STOP_WORDS.has(lowerWord)) {
      continue;
    }

    for (const [key, values] of Object.entries(TERM_MAPPING)) {
      if (word.includes(key) || lowerWord === key) {
        values.forEach(v => expandedKeywords.add(v));
      }
    }

    if (word.length > 2 || /[가-힣]/.test(word)) {
      expandedKeywords.add(lowerWord);
    }
  }

  return [...expandedKeywords];
}

/**
 * Documentation Search Agent
 */
export class DocsSearchAgent extends BaseAgent {
  readonly name = 'DocsSearchAgent';
  readonly description = 'Searches ~/.local-cli/docs for documentation using bash tools';

  private executedCommands = new Set<string>();

  constructor(llmClient: LLMClient, config?: AgentConfig) {
    super(llmClient, {
      maxIterations: config?.maxIterations ?? DOCS_SEARCH_CONFIG.MAX_ITERATIONS,
      temperature: config?.temperature ?? DOCS_SEARCH_CONFIG.LLM_TEMPERATURE,
      maxTokens: config?.maxTokens ?? DOCS_SEARCH_CONFIG.LLM_MAX_TOKENS,
    });
  }

  protected getTools(): ToolDefinition[] {
    return [RUN_BASH_TOOL];
  }

  protected buildSystemPrompt(_context?: AgentContext): string {
    // Note: Context is not used here since we build prompt in execute()
    return '';
  }

  async execute(input: string, _context?: AgentContext): Promise<AgentResult> {
    logger.enter('DocsSearchAgent.execute', { query: input });
    logger.startTimer('docs-search-total');

    this.executedCommands.clear();

    try {
      const frameworkDetection = detectFrameworkPath(input);
      const keywords = extractKeywords(input);

      logger.debug('Documentation Search Agent Started', {
        query: input,
        framework: frameworkDetection.framework || 'none',
        basePath: frameworkDetection.basePath,
        keywords: keywords.join(', ') || 'none',
      });

      const systemPrompt = buildDocsSearchPrompt(frameworkDetection, keywords);

      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Find this information in the documentation:\n\n${input}` },
      ];

      let iterations = 0;
      let finalResult = '';
      const maxIterations = this.config.maxIterations ?? DOCS_SEARCH_CONFIG.MAX_ITERATIONS;

      while (iterations < maxIterations) {
        iterations++;
        logger.flow(`Search iteration ${iterations}/${maxIterations}`);

        const response = await this.llmClient.chatCompletion({
          messages,
          tools: [RUN_BASH_TOOL],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        });

        const assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) {
          throw new Error('No response from LLM');
        }

        messages.push(assistantMessage);

        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          for (const toolCall of assistantMessage.tool_calls) {
            if (toolCall.function.name === 'run_bash') {
              const result = await this.executeBashTool(toolCall);
              messages.push({
                role: 'tool',
                content: result,
                tool_call_id: toolCall.id,
              });
            }
          }
        } else {
          finalResult = assistantMessage.content || '';
          break;
        }
      }

      if (!finalResult) {
        messages.push({
          role: 'user',
          content: 'Please summarize what you found so far.',
        });

        const summaryResponse = await this.llmClient.chatCompletion({
          messages,
          temperature: 0.3,
          max_tokens: 1000,
        });

        finalResult = summaryResponse.choices[0]?.message.content ||
          `Search completed but exceeded maximum iterations (${maxIterations}).`;
      }

      const totalElapsed = logger.endTimer('docs-search-total');
      logger.exit('DocsSearchAgent.execute', { success: true, resultLength: finalResult.length });

      return {
        success: true,
        result: finalResult,
        metadata: {
          iterations,
          duration: totalElapsed,
        },
      };
    } catch (error) {
      logger.endTimer('docs-search-total');
      logger.error('Documentation Search Failed', error instanceof Error ? error : new Error(String(error)));

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in docs search',
      };
    }
  }

  private async executeBashTool(toolCall: { id: string; function: { arguments: string } }): Promise<string> {
    let args: { command: string };
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      logger.warn('Failed to parse tool arguments');
      return 'Error: Invalid tool arguments';
    }

    const sanitized = sanitizeCommand(args.command);

    if (!isCommandSafe(sanitized)) {
      logger.warn('Unsafe command blocked', { command: sanitized });
      return `Error: Command not allowed for security reasons: ${sanitized}`;
    }

    if (this.executedCommands.has(sanitized)) {
      logger.warn('Duplicate command detected - blocking', { command: sanitized });
      return `⚠️ STOP: This exact command was already executed. Based on the information you've gathered, provide your final answer NOW. Do not repeat the same search.`;
    }

    logger.debug('Executing bash command', { command: sanitized });

    const result = await executeBashCommand(sanitized);

    if (result.formattedDisplay) {
      logger.bashExecution(result.formattedDisplay);
    }

    if (result.success) {
      this.executedCommands.add(sanitized);
      let toolResult = result.result || 'Command executed successfully (no output)';

      if (toolResult.length > DOCS_SEARCH_CONFIG.MAX_OUTPUT_LENGTH) {
        logger.warn('Output truncated due to length', {
          originalLength: toolResult.length,
          maxLength: DOCS_SEARCH_CONFIG.MAX_OUTPUT_LENGTH,
        });
        toolResult = toolResult.substring(0, DOCS_SEARCH_CONFIG.MAX_OUTPUT_LENGTH - 100) +
          '\n... (output truncated - too many files, consider loading specific subset)';
      }

      return toolResult;
    } else {
      return `Error: ${result.error}`;
    }
  }
}

/**
 * Factory function to create DocsSearchAgent
 */
export function createDocsSearchAgent(llmClient: LLMClient, config?: AgentConfig): DocsSearchAgent {
  return new DocsSearchAgent(llmClient, config);
}

/**
 * Execute documentation search (convenience wrapper)
 */
export async function executeDocsSearchAgent(
  llmClient: LLMClient,
  query: string
): Promise<{ success: boolean; result?: string; error?: string }> {
  const agent = new DocsSearchAgent(llmClient);
  return agent.execute(query);
}

/**
 * Initialize docs directory with sample documentation
 */
export async function initializeDocsDirectory(): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');

  const docsPath = path.join(os.homedir(), '.local-cli', 'docs');

  try {
    await fs.mkdir(docsPath, { recursive: true });

    const readmePath = path.join(docsPath, 'README.md');
    try {
      await fs.access(readmePath);
    } catch {
      const sampleReadme = `# LOCAL-CLI Documentation

Welcome to the LOCAL-CLI documentation directory!

## Overview

This directory contains local documentation that can be searched by the AI assistant.

## Adding Documentation

Simply place your markdown (.md) files in this directory. The AI will be able to search and reference them.

## Supported File Types

- Markdown files (.md)
- Text files (.txt)
- JSON files (.json)
- YAML files (.yaml, .yml)

## Organization Tips

- Use descriptive filenames
- Organize files in subdirectories by topic
- Include a table of contents in longer documents
- Use consistent formatting
`;
      await fs.writeFile(readmePath, sampleReadme, 'utf-8');
    }
  } catch (error) {
    logger.error('Failed to initialize docs directory', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Add documentation file to the docs directory
 */
export async function addDocumentationFile(
  filename: string,
  content: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const fs = await import('fs/promises');
    const pathModule = await import('path');
    const os = await import('os');

    const docsPath = pathModule.join(os.homedir(), '.local-cli', 'docs');
    await fs.mkdir(docsPath, { recursive: true });

    const sanitizedFilename = pathModule.basename(filename);
    const filePath = pathModule.join(docsPath, sanitizedFilename);

    await fs.writeFile(filePath, content, 'utf-8');

    return { success: true, path: filePath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add documentation',
    };
  }
}

export default DocsSearchAgent;
