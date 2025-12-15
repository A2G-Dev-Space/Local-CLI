/**
 * Documentation Search Agent Prompt
 *
 * Used for searching ~/.local-cli/docs directory.
 * Builds dynamic prompts based on framework detection.
 */

import { FrameworkDetection, getFrameworkPathsForDocs } from '../../core/agent-framework-handler.js';

/**
 * Configuration constants
 */
export const DOCS_SEARCH_CONFIG = {
  MAX_ITERATIONS: 15,
  MAX_OUTPUT_LENGTH: 50000,
  LLM_TEMPERATURE: 0.3,
  LLM_MAX_TOKENS: 4000,
};

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

Multi-Keyword Search Strategy:
When searching, ALWAYS consider synonyms AND word separator variations:
- Use OR patterns in find: find path \\( -name "*term1*.md" -o -name "*term2*.md" \\)
- Use regex in grep: grep -ril "term1\\|term2" path --include="*.md"
- For multi-word terms: try space, hyphen (-), underscore (_) variations

Examples:
- Inference/reasoning: find \\( -name "*reasoning*.md" -o -name "*inference*.md" \\)
- Agentic RAG: grep -ril "agentic.rag\\|agentic_rag\\|agentic-rag" path
- Stream/streaming: grep -ril "stream\\|streaming" path

Detected Keywords: ${keywordExamples}
-> Consider expanding with synonyms and related terms when searching`;
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

    const specificPath = frameworkDetection.basePath;
    const broadPath = frameworkDetection.category
      ? frameworkDetection.basePath.replace(`/${frameworkDetection.category}`, '')
      : frameworkDetection.basePath;

    searchStrategy = build4TierSearchStrategy(specificPath, broadPath, []);
  } else {
    searchStrategy = build4TierSearchStrategy('agent_framework', 'agent_framework', []);
  }

  return { searchHint, searchStrategy };
}

/**
 * Build system prompt for documentation search
 */
export function buildDocsSearchPrompt(frameworkDetection: FrameworkDetection, keywords: string[]): string {
  const { searchHint, searchStrategy } = buildFrameworkHints(frameworkDetection);
  const keywordHint = keywords.length > 0 ? ` Keywords: ${keywords.join(', ')}` : '';
  const frameworkPaths = getFrameworkPathsForDocs().map(({ name, path }) => `${name}: ${path}`).join(', ');

  return `Docs search expert for ~/.local-cli/docs.${searchHint}${keywordHint}

Tools: run_bash (find/grep/cat/head/ls)
${searchStrategy}
Paths: ${frameworkPaths}

NEVER use non-English in find -name (filenames are English only!)
Translate first, then use OR patterns: find \\( -name "*reasoning*.md" -o -name "*inference*.md" \\)

Rules:
- Translate non-English -> search ALL synonyms with OR patterns
- Multi-word terms -> include space/hyphen/underscore variations (e.g., "agentic rag" -> "agentic.rag\\|agentic_rag\\|agentic-rag")
- STOP after cat loads docs - answer immediately
- Max ${DOCS_SEARCH_CONFIG.MAX_ITERATIONS} calls
- Cite: [file.md] path/to/file.md

CWD: ~/.local-cli/docs`;
}

export default buildDocsSearchPrompt;
