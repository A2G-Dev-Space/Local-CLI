/**
 * Docs Search Tools - Barrel Export
 *
 * Documentation search tools for Electron Agent
 * Total: 1 tool (call_docs_search_agent)
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { getDocsPath } from '../../docs-manager';
import type { ToolDefinition } from '../../../llm-client';
import type { LLMSimpleTool, ToolResult } from '../common/types';
import { CORE_CATEGORIES } from '../common/constants';

// =============================================================================
// call_docs_search_agent Tool
// =============================================================================

const DOCS_SEARCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'call_docs_search_agent',
    description: `Search through downloaded documentation for relevant information.
Use this when you need to find specific API references, usage examples, or implementation details.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why you need this documentation',
        },
        query: {
          type: 'string',
          description: 'Search query (keywords or natural language)',
        },
        source: {
          type: 'string',
          enum: ['all', 'adk', 'agno'],
          description: 'Documentation source to search (default: all)',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results (default: 5)',
        },
      },
      required: ['reason', 'query'],
    },
  },
};

async function searchDocsRecursively(
  dirPath: string,
  keywords: string[],
  results: Array<{ file: string; title: string; excerpt: string; score: number }>,
  maxResults: number,
  depth: number = 0
): Promise<void> {
  if (depth > 5 || results.length >= maxResults) return;

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= maxResults) break;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await searchDocsRecursively(fullPath, keywords, results, maxResults, depth + 1);
    } else if (entry.name.endsWith('.md')) {
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const lowerContent = content.toLowerCase();

        // Calculate score based on keyword matches
        let score = 0;
        for (const keyword of keywords) {
          const matches = (lowerContent.match(new RegExp(keyword, 'g')) || []).length;
          score += matches;

          // Bonus for title/filename match
          if (entry.name.toLowerCase().includes(keyword)) {
            score += 5;
          }
        }

        if (score > 0) {
          // Extract title from first heading
          const titleMatch = content.match(/^#\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1] : entry.name.replace('.md', '');

          // Extract excerpt around first keyword match
          let excerpt = '';
          for (const keyword of keywords) {
            const idx = lowerContent.indexOf(keyword);
            if (idx !== -1) {
              const start = Math.max(0, idx - 100);
              const end = Math.min(content.length, idx + 200);
              excerpt = content.substring(start, end).replace(/\n/g, ' ').trim();
              if (start > 0) excerpt = '...' + excerpt;
              if (end < content.length) excerpt = excerpt + '...';
              break;
            }
          }

          results.push({
            file: fullPath,
            title,
            excerpt: excerpt || content.substring(0, 200) + '...',
            score,
          });
        }
      } catch {
        // Skip files that can't be read
      }
    }
  }
}

async function executeDocsSearch(args: Record<string, unknown>): Promise<ToolResult> {
  const query = args['query'] as string;
  const source = (args['source'] as string) || 'all';
  const maxResults = (args['max_results'] as number) || 5;

  if (!query || typeof query !== 'string') {
    return { success: false, error: 'query is required and must be a string' };
  }

  const docsPath = getDocsPath();

  // Check if docs exist
  if (!fsSync.existsSync(docsPath)) {
    return {
      success: false,
      error: 'Documentation not installed. Use the docs download feature in settings.',
    };
  }

  try {
    const searchResults: Array<{
      file: string;
      title: string;
      excerpt: string;
      score: number;
    }> = [];

    // Determine which directories to search
    // NOTE: UI downloads to flat structure (docsPath/sourceId), not nested structure
    const searchDirs: string[] = [];
    if (source === 'all' || source === 'adk') {
      // Check both flat structure (UI download) and nested structure (legacy)
      const adkPathFlat = path.join(docsPath, 'adk');
      const adkPathNested = path.join(docsPath, 'agent_framework', 'adk');
      if (fsSync.existsSync(adkPathFlat)) {
        searchDirs.push(adkPathFlat);
      } else if (fsSync.existsSync(adkPathNested)) {
        searchDirs.push(adkPathNested);
      }
    }
    if (source === 'all' || source === 'agno') {
      // Check both flat structure (UI download) and nested structure (legacy)
      const agnoPathFlat = path.join(docsPath, 'agno');
      const agnoPathNested = path.join(docsPath, 'agent_framework', 'agno');
      if (fsSync.existsSync(agnoPathFlat)) {
        searchDirs.push(agnoPathFlat);
      } else if (fsSync.existsSync(agnoPathNested)) {
        searchDirs.push(agnoPathNested);
      }
    }

    if (searchDirs.length === 0) {
      return {
        success: false,
        error: `No documentation found for source: ${source}`,
      };
    }

    // Parse query into keywords
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);

    // Search through docs
    for (const searchDir of searchDirs) {
      await searchDocsRecursively(searchDir, keywords, searchResults, maxResults * 2);
    }

    // Sort by score and limit results
    searchResults.sort((a, b) => b.score - a.score);
    const topResults = searchResults.slice(0, maxResults);

    if (topResults.length === 0) {
      return {
        success: true,
        result: `No documentation found for query: "${query}"`,
      };
    }

    // Format results
    const formattedResults = topResults.map((r, idx) => ({
      rank: idx + 1,
      file: r.file,
      title: r.title,
      excerpt: r.excerpt,
    }));

    return {
      success: true,
      result: JSON.stringify({
        query,
        results: formattedResults,
        total_found: topResults.length,
      }, null, 2),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Docs search failed: ${errorMessage}` };
  }
}

export const docsSearchTool: LLMSimpleTool = {
  definition: DOCS_SEARCH_DEFINITION,
  execute: executeDocsSearch,
  categories: CORE_CATEGORIES,
  description: 'Search documentation',
};

// =============================================================================
// Export All Docs Tools
// =============================================================================

export const DOCS_TOOLS: LLMSimpleTool[] = [
  docsSearchTool,
];
