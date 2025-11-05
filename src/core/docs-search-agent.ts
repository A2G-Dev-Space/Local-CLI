/**
 * Documentation Search Agent
 *
 * Uses a sub-LLM with bash tools to intelligently search documentation
 */

import { LLMClient } from './llm-client.js';
import { Message, ToolDefinition } from '../types/index.js';
import { executeBashCommand, isCommandSafe, sanitizeCommand } from './bash-command-tool.js';
import path from 'path';
import os from 'os';

/**
 * Bash command tool definition for LLM
 */
const RUN_BASH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'run_bash',
    description: 'Execute bash command to search and read documentation. Commands run in ~/.open-cli/docs directory.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Bash command to execute (e.g., find, grep, cat, ls, tree)',
        },
      },
      required: ['command'],
    },
  },
};

/**
 * Execute Docs Search Agent
 * Uses sub-LLM with bash tools to search ~/.open-cli/docs
 */
export async function executeDocsSearchAgent(
  llmClient: LLMClient,
  query: string
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    // System prompt: Documentation search expert
    const systemPrompt = `You are a documentation search expert for the ~/.open-cli/docs folder.

**Your Mission**:
Find information requested by the user in the ~/.open-cli/docs folder.

**Available Tools**:
- run_bash: Execute bash commands in the docs directory

**Useful Commands**:
- ls: List files and directories (e.g., ls -la)
- tree: Show directory structure (e.g., tree -L 2)
- find: Search for files by name (e.g., find . -name "*.md" -type f)
- grep: Search file contents (e.g., grep -r "keyword" . --include="*.md")
- cat: Read file contents (e.g., cat README.md)
- head/tail: Read first/last lines (e.g., head -20 file.md)

**Search Strategy**:
1. First, explore the folder structure (ls or tree)
2. Find relevant files by filename (find)
3. Search for keywords in file contents (grep)
4. Read relevant sections from files (cat, head, tail)
5. Synthesize information from multiple sources

**Important Rules**:
- Maximum 10 tool calls to find information
- Summarize findings clearly and concisely
- Include file paths when referencing information
- If information is not found, state "Information not found in documentation"
- Focus on finding the most relevant information

**Current working directory**: ~/.open-cli/docs`;

    // Initial messages
    const messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Find this information in the documentation:\n\n${query}`,
      },
    ];

    // Multi-iteration loop (max 10)
    const maxIterations = 10;
    let iteration = 0;
    let finalResult = '';

    while (iteration < maxIterations) {
      iteration++;

      // Call LLM with bash tool
      const response = await llmClient.chatCompletion({
        messages,
        tools: [RUN_BASH_TOOL],
        temperature: 0.3, // Lower temperature for more focused search
        max_tokens: 2000,
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No response from LLM');
      }

      messages.push(assistantMessage);

      // Execute tool calls if present
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.function.name === 'run_bash') {
            let args: { command: string };
            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch {
              messages.push({
                role: 'tool',
                content: 'Error: Invalid tool arguments',
                tool_call_id: toolCall.id,
              });
              continue;
            }

            // Sanitize and validate command
            const sanitized = sanitizeCommand(args.command);
            if (!isCommandSafe(sanitized)) {
              messages.push({
                role: 'tool',
                content: `Error: Command not allowed for security reasons: ${sanitized}`,
                tool_call_id: toolCall.id,
              });
              continue;
            }

            // Execute bash command
            const result = await executeBashCommand(sanitized);

            // Add tool result to messages
            let toolResult: string;
            if (result.success) {
              toolResult = result.result || 'Command executed successfully (no output)';
              // Truncate very long outputs
              if (toolResult.length > 3000) {
                toolResult = toolResult.substring(0, 2900) + '\n... (output truncated)';
              }
            } else {
              toolResult = `Error: ${result.error}`;
            }

            messages.push({
              role: 'tool',
              content: toolResult,
              tool_call_id: toolCall.id,
            });
          }
        }
      } else {
        // No tool call → LLM provided final response
        finalResult = assistantMessage.content || '';
        break;
      }
    }

    // Check if we got a result
    if (!finalResult) {
      // Reached max iterations, ask for summary
      messages.push({
        role: 'user',
        content: 'Please summarize what you found so far.',
      });

      const summaryResponse = await llmClient.chatCompletion({
        messages,
        temperature: 0.3,
        max_tokens: 1000,
      });

      finalResult = summaryResponse.choices[0]?.message.content ||
                   `Search completed but exceeded maximum iterations (${maxIterations}).`;
    }

    return {
      success: true,
      result: finalResult,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in docs search',
    };
  }
}

/**
 * Initialize docs directory with sample documentation
 */
export async function initializeDocsDirectory(): Promise<void> {
  const fs = await import('fs/promises');
  const docsPath = path.join(os.homedir(), '.open-cli', 'docs');

  try {
    // Create docs directory if it doesn't exist
    await fs.mkdir(docsPath, { recursive: true });

    // Check if README exists
    const readmePath = path.join(docsPath, 'README.md');
    try {
      await fs.access(readmePath);
    } catch {
      // Create a sample README
      const sampleReadme = `# OPEN-CLI Documentation

Welcome to the OPEN-CLI documentation directory!

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

## Example Structure

\`\`\`
~/.open-cli/docs/
├── README.md
├── api/
│   ├── authentication.md
│   └── endpoints.md
├── guides/
│   ├── getting-started.md
│   └── advanced-usage.md
└── reference/
    ├── configuration.md
    └── troubleshooting.md
\`\`\`
`;

      await fs.writeFile(readmePath, sampleReadme, 'utf-8');
      console.log('📚 Created sample documentation in ~/.open-cli/docs/');
    }
  } catch (error) {
    console.warn('Warning: Could not initialize docs directory:', error);
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
    const docsPath = path.join(os.homedir(), '.open-cli', 'docs');

    // Ensure docs directory exists
    await fs.mkdir(docsPath, { recursive: true });

    // Sanitize filename
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(docsPath, sanitizedFilename);

    // Write file
    await fs.writeFile(filePath, content, 'utf-8');

    return {
      success: true,
      path: filePath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add documentation',
    };
  }
}

export default executeDocsSearchAgent;