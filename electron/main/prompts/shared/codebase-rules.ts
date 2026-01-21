/**
 * Shared Codebase Understanding Rules
 *
 * Common rules for understanding codebase before making changes.
 */

/**
 * Codebase first rule - understand before modifying
 */
export const CODEBASE_FIRST_RULE = `
## CRITICAL - Read Before Write

ALWAYS read existing code before making changes:
1. Use \`read_file\` to understand current implementation
2. Use \`list_files\` or \`find_files\` to explore project structure
3. Only then use \`create_file\` or \`edit_file\`

Never modify code you haven't read. This prevents breaking existing functionality.
`.trim();

/**
 * Short version for space-constrained prompts
 */
export const CODEBASE_FIRST_SHORT = `
CRITICAL: Read existing code before modifying. Never assume - always verify first.
`.trim();

export default CODEBASE_FIRST_RULE;
