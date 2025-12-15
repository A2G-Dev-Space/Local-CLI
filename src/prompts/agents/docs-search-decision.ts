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

Given the user's message and available documentation folders, decide if searching the local documentation would be helpful.

## Available Documentation Structure:
{folder_structure}

## Rules:
- Answer ONLY "Yes" or "No" - nothing else
- Answer "Yes" if the user's question could potentially be answered or helped by searching this documentation
- Answer "No" if the question is clearly unrelated to the available documentation topics
- When in doubt, answer "Yes"

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
