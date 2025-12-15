/**
 * Shared Codebase Understanding Rules
 *
 * Common rules for understanding codebase before making changes.
 */

/**
 * Codebase first rule - understand before modifying
 */
export const CODEBASE_FIRST_RULE = `
## CRITICAL - UNDERSTAND CODEBASE FIRST

For ANY coding-related task:
- Use list_files to understand project structure
- Use read_file to examine existing code patterns, conventions, and dependencies
- NEVER assume or guess about existing code - always verify first
- Follow the existing code style, naming conventions, and architectural patterns

This prevents breaking existing functionality and ensures consistency.
`.trim();

/**
 * Short version for space-constrained prompts
 */
export const CODEBASE_FIRST_SHORT = `
CRITICAL: Read existing code before modifying. Never assume - always verify first.
`.trim();

export default CODEBASE_FIRST_RULE;
