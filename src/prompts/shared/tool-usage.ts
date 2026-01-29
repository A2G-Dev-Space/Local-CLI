/**
 * Shared Tool Usage Guidelines
 *
 * Common tool usage instructions used across prompts.
 */

/**
 * Available tools description
 */
export const AVAILABLE_TOOLS = `
## Available Tools

- **read_file**: Read file contents to understand existing code
- **create_file**: Create a NEW file (fails if file exists)
- **edit_file**: Edit an EXISTING file by replacing specific lines
- **list_files**: List directory contents
- **find_files**: Search for files by pattern
- **search_content**: Search for text patterns in files (grep-like)
- **bash**: Execute shell commands (git, npm, etc.)
`.trim();

/**
 * File tool usage with TODO tools
 */
export const AVAILABLE_TOOLS_WITH_TODO = `
## Available Tools

- **read_file**: Read file contents to understand existing code
- **create_file**: Create a NEW file (fails if file exists)
- **edit_file**: Edit an EXISTING file by replacing specific lines
- **list_files**: List directory contents
- **find_files**: Search for files by pattern
- **search_content**: Search for text patterns in files (grep-like)
- **bash**: Execute shell commands (git, npm, etc.)
- **tell_to_user**: Send status updates to the user
- **ask_to_user**: Ask user a question with multiple choice options
- **write_todos**: Update entire TODO list (replaces current list)
- **call_docs_search_agent**: Search local documentation (~/.local-cli/docs)
`.trim();

/**
 * Tool reason parameter guidance
 */
export const TOOL_REASON_GUIDE = `
## CRITICAL - Tool "reason" Parameter

Every tool has a required "reason" parameter. This will be shown directly to the user.
Write naturally as if talking to the user. Examples:
- "Checking how the current authentication logic is implemented"
- "Fixing the buggy section"
- "Creating a new component file"

The reason helps users understand what you're doing and why.
Remember to write the reason in the user's language.
`.trim();

/**
 * File modification rules
 */
export const FILE_MODIFICATION_RULES = `
## File Modification Rules

- For NEW files: Use create_file
- For EXISTING files: First use read_file to see content, then use edit_file with exact line matches
`.trim();

export default {
  AVAILABLE_TOOLS,
  AVAILABLE_TOOLS_WITH_TODO,
  TOOL_REASON_GUIDE,
  FILE_MODIFICATION_RULES,
};
