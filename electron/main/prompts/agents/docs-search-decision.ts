/**
 * Documentation Search Decision Prompt
 *
 * LLM-based decision for whether to search local documentation.
 * Returns Yes/No based on user message and available folder structure.
 */

/**
 * System prompt for docs search decision
 */
export const DOCS_SEARCH_DECISION_PROMPT = `You are a documentation search classifier.

## IMPORTANT: Offline Environment
This is an OFFLINE environment with NO external internet access.
The ONLY way to get up-to-date information is by searching the local documentation below.

## Available Documentation (depth 1):
{folder_structure}

## Rules:
- Answer ONLY "Yes" or "No" - nothing else
- Answer "Yes" ONLY when BOTH conditions are met:
  1. The user needs up-to-date or specific information (API docs, framework usage, library features, etc.)
  2. There is a folder name above that looks relevant to the topic
- Answer "No" if:
  - The question is about general coding/logic that doesn't need docs
  - No folder above seems related to the user's topic
  - The user is asking about this project's own codebase (not external docs)
- When in doubt, answer "No" (avoid unnecessary searches)

## User Message:
{user_message}

Your Answer (Yes or No):`;

/**
 * Retry prompt when response is not Yes/No
 */
export const DOCS_SEARCH_DECISION_RETRY_PROMPT = `Your previous response was not valid. You must answer with exactly "Yes" or "No".

Should the documentation be searched for this question?

Answer (Yes or No):`;

/**
 * Build the decision prompt with folder structure and user message
 */
export function buildDocsSearchDecisionPrompt(
  folderStructure: string,
  userMessage: string
): string {
  return DOCS_SEARCH_DECISION_PROMPT
    .replace('{folder_structure}', folderStructure)
    .replace('{user_message}', userMessage);
}

/**
 * Parse Yes/No response from LLM
 * @returns true for Yes, false for No, null for invalid
 */
export function parseDocsSearchDecision(response: string): boolean | null {
  const normalized = response.trim().toLowerCase();

  if (normalized === 'yes' || normalized.startsWith('yes')) {
    return true;
  }
  if (normalized === 'no' || normalized.startsWith('no')) {
    return false;
  }

  return null;
}

export default DOCS_SEARCH_DECISION_PROMPT;
