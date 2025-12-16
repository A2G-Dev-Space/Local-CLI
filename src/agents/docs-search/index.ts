/**
 * Documentation Search Agent
 *
 * Redesigned agent that navigates hierarchical documentation structure.
 * Uses explicit termination via submit_findings tool.
 */

import { BaseAgent, AgentContext, AgentResult, AgentConfig } from '../base/base-agent.js';
import { LLMClient } from '../../core/llm/llm-client.js';
import { Message, ToolDefinition } from '../../types/index.js';
import { DOCS_SEARCH_SYSTEM_PROMPT, buildDocsSearchUserMessage } from '../../prompts/agents/docs-search.js';
import { DOCS_SEARCH_TOOLS, createDocsToolExecutor } from '../../tools/llm/agents/docs-search-tools.js';
import { logger } from '../../utils/logger.js';

/**
 * Progress callback for docs search (for UI updates)
 */
export type DocsSearchProgressCallback = (
  type: 'info' | 'tell_user' | 'complete',
  message: string,
  data?: { summary?: string; findings?: string; sources?: string[] }
) => void;

/**
 * Global progress callback (set from UI)
 */
let globalProgressCallback: DocsSearchProgressCallback | null = null;

/**
 * Set the global docs search progress callback
 */
export function setDocsSearchProgressCallback(callback: DocsSearchProgressCallback | null): void {
  globalProgressCallback = callback;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AgentConfig = {
  temperature: 0.3,
  maxTokens: 4000,
  // No maxIterations - agent terminates via submit_findings
};

/**
 * Safety limits
 */
const SOFT_ITERATION_LIMIT = 50;  // Warn after this many iterations
const HARD_ITERATION_LIMIT = 100; // Force stop after this many

/**
 * Documentation Search Agent
 */
export class DocsSearchAgent extends BaseAgent {
  readonly name = 'DocsSearchAgent';
  readonly description = 'Searches ~/.local-cli/docs using hierarchical navigation';

  constructor(llmClient: LLMClient, config?: Partial<AgentConfig>) {
    super(llmClient, { ...DEFAULT_CONFIG, ...config });
  }

  protected getTools(): ToolDefinition[] {
    return DOCS_SEARCH_TOOLS;
  }

  protected buildSystemPrompt(_context?: AgentContext): string {
    return DOCS_SEARCH_SYSTEM_PROMPT;
  }

  async execute(input: string, _context?: AgentContext): Promise<AgentResult> {
    logger.enter('DocsSearchAgent.execute', { query: input });
    logger.startTimer('docs-search-total');

    const progressCallback = globalProgressCallback;
    progressCallback?.('info', `Searching: "${input.slice(0, 50)}${input.length > 50 ? '...' : ''}"`);

    // Result container for submit_findings
    let finalResult: {
      summary: string;
      findings: string;
      sources: string[];
    } | null = null;

    // Create tool executor with callbacks
    const toolExecutor = createDocsToolExecutor(
      // onTellUser callback
      (message: string) => {
        progressCallback?.('tell_user', message);
        logger.debug('tell_to_user', { message });
      },
      // onComplete callback (submit_findings)
      (summary: string, findings: string, sources: string[]) => {
        finalResult = { summary, findings, sources };
        progressCallback?.('complete', summary, { summary, findings, sources });
        logger.debug('submit_findings', { summary, sourcesCount: sources.length });
      }
    );

    try {
      const messages: Message[] = [
        { role: 'system', content: DOCS_SEARCH_SYSTEM_PROMPT },
        { role: 'user', content: buildDocsSearchUserMessage(input) },
      ];

      let iterations = 0;

      // Main execution loop - terminates when submit_findings is called
      while (!finalResult) {
        iterations++;

        // Soft limit warning
        if (iterations === SOFT_ITERATION_LIMIT) {
          messages.push({
            role: 'system',
            content: `You have made ${SOFT_ITERATION_LIMIT} tool calls. Please wrap up your search and call submit_findings soon.`,
          });
          logger.warn('Docs search soft limit reached', { iterations });
        }

        // Hard limit - force stop
        if (iterations > HARD_ITERATION_LIMIT) {
          logger.error('Docs search hard limit exceeded', { iterations });
          return {
            success: false,
            error: `Search exceeded maximum iterations (${HARD_ITERATION_LIMIT}). Please try a more specific query.`,
          };
        }

        logger.flow(`Search iteration ${iterations}`);

        // Call LLM
        const response = await this.llmClient.chatCompletion({
          messages,
          tools: DOCS_SEARCH_TOOLS,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        });

        const assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) {
          throw new Error('No response from LLM');
        }

        messages.push(assistantMessage);

        // Process tool calls
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name;
            let args: Record<string, unknown>;

            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch {
              logger.warn('Failed to parse tool arguments', { toolName });
              messages.push({
                role: 'tool',
                content: 'Error: Invalid tool arguments',
                tool_call_id: toolCall.id,
              });
              continue;
            }

            // Log tool call for UI
            progressCallback?.('info', `${toolName}: ${this.formatToolArgs(toolName, args)}`);

            // Execute tool
            const result = await toolExecutor(toolName, args);

            messages.push({
              role: 'tool',
              content: result.success ? (result.result || 'Success') : `Error: ${result.error}`,
              tool_call_id: toolCall.id,
            });

            // Check if this was the termination tool
            if (result.terminate) {
              break;
            }
          }
        } else {
          // No tool calls - LLM responded with text only
          // This shouldn't happen with proper prompting, but handle it
          logger.warn('LLM responded without tool calls');
          messages.push({
            role: 'system',
            content: 'You must use tools to search documentation. Call list_directory to explore, or submit_findings to complete.',
          });
        }
      }

      const totalElapsed = logger.endTimer('docs-search-total');
      logger.exit('DocsSearchAgent.execute', { success: true, iterations });

      return {
        success: true,
        result: finalResult ? this.formatFinalResult(finalResult) : 'Error: Search completed without findings.',
        metadata: {
          iterations,
          duration: totalElapsed,
        },
      };
    } catch (error) {
      logger.endTimer('docs-search-total');
      logger.error('Documentation Search Failed', error instanceof Error ? error : new Error(String(error)));
      progressCallback?.('complete', 'Search failed', { summary: 'Error occurred', findings: '', sources: [] });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in docs search',
      };
    }
  }

  /**
   * Format tool arguments for display
   * Uses the reason if provided, otherwise falls back to path
   */
  private formatToolArgs(toolName: string, args: Record<string, unknown>): string {
    const reason = args['reason'] as string | undefined;

    switch (toolName) {
      case 'list_directory':
        return reason || (args['path'] ? `"${args['path']}"` : '(root)');
      case 'read_docs_file':
      case 'preview_file':
        return reason || `"${args['path']}"`;
      case 'tell_to_user':
        return (args['message'] as string)?.slice(0, 50) || '';
      case 'submit_findings':
        return 'Submitting report...';
      default:
        return JSON.stringify(args).slice(0, 50);
    }
  }

  /**
   * Format final result for display
   */
  private formatFinalResult(result: { summary: string; findings: string; sources: string[] }): string {
    const parts: string[] = [];

    parts.push(`## Summary\n${result.summary}`);
    parts.push(`\n## Findings\n${result.findings}`);

    if (result.sources.length > 0) {
      parts.push(`\n## Sources`);
      result.sources.forEach(source => {
        parts.push(`- ${source}`);
      });
    }

    return parts.join('\n');
  }
}

/**
 * Factory function to create DocsSearchAgent
 */
export function createDocsSearchAgent(llmClient: LLMClient, config?: Partial<AgentConfig>): DocsSearchAgent {
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

## Folder Structure

Organize your documentation hierarchically:
- Create folders for major categories
- Use sub-folders for specific topics
- Place .md files at appropriate levels

Example:
\`\`\`
~/.local-cli/docs/
├── README.md
├── tutorials/
│   ├── getting-started.md
│   └── advanced-usage.md
├── reference/
│   ├── api.md
│   └── configuration.md
└── agent_framework/
    ├── agno/
    │   ├── overview.md
    │   └── examples.md
    └── langchain/
        └── setup.md
\`\`\`
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
