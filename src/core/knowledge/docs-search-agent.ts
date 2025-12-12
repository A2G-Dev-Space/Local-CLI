/**
 * Documentation Search Agent
 *
 * Uses a sub-LLM with bash tools to intelligently search documentation
 */

import { LLMClient } from '../llm/llm-client.js';
import { Message, ToolDefinition } from '../../types/index.js';
import { executeBashCommand, isCommandSafe, sanitizeCommand } from '../bash-command-tool.js';
import { detectFrameworkPath, getFrameworkPathsForDocs, FrameworkDetection, TERM_MAPPING } from '../agent-framework-handler.js';
import { logger } from '../../utils/logger.js';
import path from 'path';
import os from 'os';

/**
 * Configuration constants
 */
const DOCS_SEARCH_MAX_ITERATIONS = 15;
const DOCS_SEARCH_MAX_OUTPUT_LENGTH = 50000;
const DOCS_SEARCH_LLM_TEMPERATURE = 0.3;
const DOCS_SEARCH_LLM_MAX_TOKENS = 4000;

/**
 * Bash command tool definition for LLM
 */
const RUN_BASH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'run_bash',
    description: 'Execute bash command to search and read documentation. Commands run in ~/.local-cli/docs directory.',
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

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'how', 'what', 'when', 'where', 'why', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'use', 'using', 'create', 'make']);

/**
 * Extract keywords from query with term mapping support
 * Handles Korean-to-English translation and synonym expansion
 */
function extractKeywords(query: string): string[] {
  const expandedKeywords = new Set<string>();

  // Extract words from query (supports both Korean and English)
  const words = query
    .replace(/[^\w\s가-힣]/g, ' ') // Keep Korean characters
    .split(/\s+/)
    .filter(word => word.length > 1);

  for (const word of words) {
    const lowerWord = word.toLowerCase();

    // Skip stop words (English only)
    if (STOP_WORDS.has(lowerWord)) {
      continue;
    }

    // Check if word or its substring matches term mapping
    for (const [key, values] of Object.entries(TERM_MAPPING)) {
      // Check if the word contains the mapping key (for Korean partial matches)
      if (word.includes(key) || lowerWord === key) {
        values.forEach(v => expandedKeywords.add(v));
      }
    }

    // Add original word if not too short
    if (word.length > 2 || /[가-힣]/.test(word)) {
      expandedKeywords.add(lowerWord);
    }
  }

  return [...expandedKeywords];
}

/**
 * Build 4-tier search strategy for all frameworks
 */
function build4TierSearchStrategy(specificPath: string, broadPath: string, keywords: string[]): string {
  const keywordExamples = keywords.length > 0 ? keywords.slice(0, 5).join(', ') : 'reasoning, streaming, agent';

  return `
4-Tier Search Strategy (follow in order, stop when found):
1. find ${specificPath} -name "*keyword*.md" (filename in specific dir)
2. find ${broadPath} -name "*keyword*.md" (filename in broad dir)
3. grep -ril "keyword" ${specificPath} --include="*.md" (content search)
4. grep -ril "keyword" ${broadPath} --include="*.md" (broad content)

💡 Multi-Keyword Search Strategy:
When searching, ALWAYS consider synonyms AND word separator variations:
- Use OR patterns in find: find path \\( -name "*term1*.md" -o -name "*term2*.md" \\)
- Use regex in grep: grep -ril "term1\\|term2" path --include="*.md"
- For multi-word terms: try space, hyphen (-), underscore (_) variations

Examples:
- Inference/reasoning: find \\( -name "*reasoning*.md" -o -name "*inference*.md" \\)
- Agentic RAG: grep -ril "agentic.rag\\|agentic_rag\\|agentic-rag" path
- Stream/streaming: grep -ril "stream\\|streaming" path

📌 Detected Keywords: ${keywordExamples}
→ Consider expanding with synonyms and related terms when searching`;
}

/**
 * Build framework-specific search hints and instructions
 */
function buildFrameworkHints(frameworkDetection: FrameworkDetection): {
  searchHint: string;
  searchStrategy: string;
} {
  let searchHint = '';
  let searchStrategy = '';

  if (frameworkDetection.framework) {
    const frameworkName = frameworkDetection.framework.toUpperCase();
    const categoryInfo = frameworkDetection.category
      ? ` (category: ${frameworkDetection.category})`
      : '';

    searchHint = `\n\n**FRAMEWORK DETECTED**: ${frameworkName}${categoryInfo}\n**Target Path**: ${frameworkDetection.basePath}`;

    // Determine specific and broad paths
    // basePath already includes category if it exists (e.g., agent_framework/agno/agent)
    const specificPath = frameworkDetection.basePath;
    const broadPath = frameworkDetection.category
      ? frameworkDetection.basePath.replace(`/${frameworkDetection.category}`, '')
      : frameworkDetection.basePath;

    // Always use 4-tier search strategy for all frameworks
    searchStrategy = build4TierSearchStrategy(specificPath, broadPath, []);
  } else {
    // Even without framework detection, use 4-tier strategy with docs root
    searchStrategy = build4TierSearchStrategy('agent_framework', 'agent_framework', []);
  }

  return { searchHint, searchStrategy };
}

/**
 * Build system prompt for documentation search
 */
function buildSystemPrompt(frameworkDetection: FrameworkDetection, keywords: string[]): string {
  const { searchHint, searchStrategy } = buildFrameworkHints(frameworkDetection);
  const keywordHint = keywords.length > 0 ? ` Keywords: ${keywords.join(', ')}` : '';
  const frameworkPaths = getFrameworkPathsForDocs().map(({ name, path }) => `${name}: ${path}`).join(', ');

  return `Docs search expert for ~/.local-cli/docs.${searchHint}${keywordHint}

Tools: run_bash (find/grep/cat/head/ls)
${searchStrategy}
Paths: ${frameworkPaths}

🚫 NEVER use non-English in find -name (filenames are English only!)
✅ Translate first, then use OR patterns: find \\( -name "*reasoning*.md" -o -name "*inference*.md" \\)

Rules:
- Translate non-English → search ALL synonyms with OR patterns
- Multi-word terms → include space/hyphen/underscore variations (e.g., "agentic rag" → "agentic.rag\\|agentic_rag\\|agentic-rag")
- STOP after cat loads docs - answer immediately
- Max ${DOCS_SEARCH_MAX_ITERATIONS} calls
- Cite: [file.md] path/to/file.md

CWD: ~/.local-cli/docs`;
}

/**
 * Execute Docs Search Agent
 * Uses sub-LLM with bash tools to search ~/.local-cli/docs
 */
export async function executeDocsSearchAgent(
  llmClient: LLMClient,
  query: string
): Promise<{ success: boolean; result?: string; error?: string }> {
  logger.enter('executeDocsSearchAgent', { query });
  logger.startTimer('docs-search-total');

  try {
    // Detect framework-specific path and requirements
    logger.flow('Detecting framework from query');
    const frameworkDetection = detectFrameworkPath(query);

    // Extract keywords from query for smart filtering
    logger.flow('Extracting keywords from query');
    const keywords = extractKeywords(query);

    // Log search initialization (debug only)
    logger.debug('Documentation Search Agent Started');
    logger.vars(
      { name: 'query', value: query },
      { name: 'framework', value: frameworkDetection.framework || 'none' },
      { name: 'basePath', value: frameworkDetection.basePath },
      { name: 'category', value: frameworkDetection.category || 'none' },
      { name: 'keywords', value: keywords.join(', ') || 'none' }
    );

    // Build system prompt
    logger.flow('Building system prompt for LLM');
    const systemPrompt = buildSystemPrompt(frameworkDetection, keywords);

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
    logger.flow('Starting multi-iteration search loop');
    const maxIterations = DOCS_SEARCH_MAX_ITERATIONS;
    let iteration = 0;
    let finalResult = '';
    
    // Track executed commands to prevent repetition
    const executedCommands = new Set<string>();

    logger.vars(
      { name: 'maxIterations', value: maxIterations }
    );

    while (iteration < maxIterations) {
      iteration++;
      logger.flow(`Search iteration ${iteration}/${maxIterations}`);
      logger.startTimer(`iteration-${iteration}`);

      // Call LLM with bash tool
      logger.flow('Calling LLM for documentation search');
      const response = await llmClient.chatCompletion({
        messages,
        tools: [RUN_BASH_TOOL],
        temperature: DOCS_SEARCH_LLM_TEMPERATURE, // Lower temperature for more focused search
        max_tokens: DOCS_SEARCH_LLM_MAX_TOKENS, // Increased for comprehensive documentation synthesis
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        logger.error('No response from LLM', new Error('Empty LLM response'));
        throw new Error('No response from LLM');
      }

      messages.push(assistantMessage);

      // Execute tool calls if present
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        logger.flow(`Processing ${assistantMessage.tool_calls.length} tool call(s)`);

        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.function.name === 'run_bash') {
            let args: { command: string };
            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch (parseError) {
              logger.warn('Failed to parse tool arguments', { error: parseError });
              messages.push({
                role: 'tool',
                content: 'Error: Invalid tool arguments',
                tool_call_id: toolCall.id,
              });
              continue;
            }

            // Sanitize and validate command
            const sanitized = sanitizeCommand(args.command);
            logger.verbose('Command sanitization', { original: args.command, sanitized });

            if (!isCommandSafe(sanitized)) {
              logger.warn('Unsafe command blocked', { command: sanitized });
              messages.push({
                role: 'tool',
                content: `Error: Command not allowed for security reasons: ${sanitized}`,
                tool_call_id: toolCall.id,
              });
              continue;
            }

            // Check for exact duplicate commands only
            if (executedCommands.has(sanitized)) {
              logger.warn('Duplicate command detected - blocking', { command: sanitized });
              messages.push({
                role: 'tool',
                content: `⚠️ STOP: This exact command was already executed. Based on the information you've gathered, provide your final answer NOW. Do not repeat the same search.`,
                tool_call_id: toolCall.id,
              });
              continue;
            }

            // Log the command being executed
            logger.debug(`Executing bash command`, { iteration, command: sanitized });

            // Execute bash command
            logger.startTimer('bash-execution');
            const result = await executeBashCommand(sanitized);
            logger.endTimer('bash-execution');

            // Log formatted display if available
            if (result.formattedDisplay) {
              logger.bashExecution(result.formattedDisplay);
            }

            // Add tool result to messages
            let toolResult: string;
            if (result.success) {
              // Track successful commands only (prevents retry blocking for syntax errors)
              executedCommands.add(sanitized);

              toolResult = result.result || 'Command executed successfully (no output)';

              // Log command results for specific operations
              if (sanitized.includes('find') && sanitized.includes('.md')) {
                const files = toolResult.trim().split('\n').filter(line => line.length > 0 && line.includes('.md'));
                const fileCount = files.length;
                logger.debug(`Found ${fileCount} markdown files`);
                if (files.length > 0 && files.length <= 10) {
                  logger.verbose('Found files:', { files });
                } else if (files.length > 10) {
                  logger.verbose('Found files (showing first 10):', { files: files.slice(0, 10) });
                }
              } else if (sanitized.includes('grep -ril') || sanitized.includes('grep -r')) {
                const files = toolResult.trim().split('\n').filter(line => line.length > 0);
                logger.debug(`Content search found ${files.length} matching files`);
                if (files.length > 0 && files.length <= 10) {
                  logger.verbose('Matching files:', { files });
                } else if (files.length > 10) {
                  logger.verbose('Matching files (showing first 10):', { files: files.slice(0, 10) });
                }
              } else if (sanitized.includes('head -n')) {
                const fileMatch = sanitized.match(/head -n \d+ (.+?)(?:\s|$)/);
                if (fileMatch) {
                  logger.debug(`Previewing file`, { file: fileMatch[1] });
                }
              } else if (sanitized.startsWith('cat ') && !sanitized.includes('$(')) {
                const files = sanitized.substring(4).split(/\s+/).filter(f => f.endsWith('.md'));
                if (files.length > 0) {
                  logger.debug(`Loading ${files.length} documentation file(s)`, { files });
                }
              }

              // Supports loading multiple complete markdown files without context loss
              // 50000 characters should be enough for ~10-15 typical documentation files
              if (toolResult.length > DOCS_SEARCH_MAX_OUTPUT_LENGTH) {
                logger.warn('Output truncated due to length', {
                  originalLength: toolResult.length,
                  maxLength: DOCS_SEARCH_MAX_OUTPUT_LENGTH
                });
                toolResult = toolResult.substring(0, DOCS_SEARCH_MAX_OUTPUT_LENGTH - 100) + '\n... (output truncated - too many files, consider loading specific subset)';
              }
            } else {
              toolResult = `Error: ${result.error}`;
              logger.warn(`Command execution failed`, { command: sanitized, error: result.error });
            }

            messages.push({
              role: 'tool',
              content: toolResult,
              tool_call_id: toolCall.id,
            });
          }
        }

        logger.endTimer(`iteration-${iteration}`);
      } else {
        // No tool call → LLM provided final response
        logger.flow('LLM provided final response (no tool calls)');
        finalResult = assistantMessage.content || '';
        logger.endTimer(`iteration-${iteration}`);
        break;
      }
    }

    // Check if we got a result
    if (!finalResult) {
      // Reached max iterations, ask for summary
      logger.flow('Reached max iterations - requesting summary');
      logger.warn(`Max iterations reached`, { iteration, maxIterations });

      messages.push({
        role: 'user',
        content: 'Please summarize what you found so far.',
      });

      logger.startTimer('summary-generation');
      const summaryResponse = await llmClient.chatCompletion({
        messages,
        temperature: 0.3,
        max_tokens: 1000,
      });
      logger.endTimer('summary-generation');

      finalResult = summaryResponse.choices[0]?.message.content ||
                   `Search completed but exceeded maximum iterations (${maxIterations}).`;
    }

    // Log search completion (debug only)
    const totalElapsed = logger.endTimer('docs-search-total');
    logger.debug('Documentation Search Completed', {
      iterations: iteration,
      maxIterations,
      totalTime: `${totalElapsed}ms`
    });

    logger.exit('executeDocsSearchAgent', { success: true, resultLength: finalResult.length });

    return {
      success: true,
      result: finalResult,
    };
  } catch (error) {
    logger.endTimer('docs-search-total'); // End timer even on error
    logger.error('Documentation Search Failed', error instanceof Error ? error : new Error(String(error)));
    logger.exit('executeDocsSearchAgent', { success: false, error: error instanceof Error ? error.message : String(error) });

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
  logger.enter('initializeDocsDirectory', {});

  const fs = await import('fs/promises');
  const docsPath = path.join(os.homedir(), '.local-cli', 'docs');

  try {
    logger.flow('Creating docs directory if not exists');
    // Create docs directory if it doesn't exist
    await fs.mkdir(docsPath, { recursive: true });
    logger.debug('Docs directory ensured', { path: docsPath });

    // Check if README exists
    const readmePath = path.join(docsPath, 'README.md');
    logger.flow('Checking if README.md exists');

    try {
      await fs.access(readmePath);
      logger.debug('README.md already exists', { path: readmePath });
    } catch {
      logger.flow('Creating sample README.md');
      // Create a sample README
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

## Example Structure

\`\`\`
~/.local-cli/docs/
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
      logger.debug('Created sample README.md', { path: readmePath });
    }

    logger.exit('initializeDocsDirectory', { success: true });
  } catch (error) {
    logger.error('Failed to initialize docs directory', error instanceof Error ? error : new Error(String(error)));
    logger.exit('initializeDocsDirectory', { success: false });
  }
}

/**
 * Add documentation file to the docs directory
 */
export async function addDocumentationFile(
  filename: string,
  content: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  logger.enter('addDocumentationFile', { filename, contentLength: content.length });

  try {
    const fs = await import('fs/promises');
    const docsPath = path.join(os.homedir(), '.local-cli', 'docs');

    // Ensure docs directory exists
    logger.flow('Ensuring docs directory exists');
    await fs.mkdir(docsPath, { recursive: true });

    // Sanitize filename
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(docsPath, sanitizedFilename);

    logger.vars(
      { name: 'originalFilename', value: filename },
      { name: 'sanitizedFilename', value: sanitizedFilename },
      { name: 'fullPath', value: filePath }
    );

    // Write file
    logger.flow('Writing documentation file');
    await fs.writeFile(filePath, content, 'utf-8');
    logger.debug('Documentation file added successfully', { path: filePath, size: content.length });

    logger.exit('addDocumentationFile', { success: true, path: filePath });

    return {
      success: true,
      path: filePath,
    };
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to add documentation file: ${filename}`, errorObj);
    logger.exit('addDocumentationFile', { success: false });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add documentation',
    };
  }
}

export default executeDocsSearchAgent;