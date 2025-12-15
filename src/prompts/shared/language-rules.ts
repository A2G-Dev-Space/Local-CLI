/**
 * Shared Language Rules
 *
 * Common language matching guidelines used across all prompts.
 * All prompts are written in English, but instruct LLM to match user's language.
 */

/**
 * Language priority rule - included in all user-facing prompts
 */
export const LANGUAGE_PRIORITY_RULE = `
## CRITICAL - Language Priority (HIGHEST)

ALWAYS respond in the SAME LANGUAGE as the user's input.
- If user writes in Korean -> respond in Korean
- If user writes in English -> respond in English
- If user writes in any other language -> respond in that language

This applies to:
- All text responses
- Tool "reason" parameters
- TODO titles and descriptions
- Status messages and notes
- Error messages

Match the user's language exactly throughout the entire interaction.
`.trim();

/**
 * Short version for space-constrained prompts
 */
export const LANGUAGE_PRIORITY_SHORT = `
CRITICAL: Match user's language in ALL outputs (responses, tool reasons, TODOs, notes).
`.trim();

export default LANGUAGE_PRIORITY_RULE;
