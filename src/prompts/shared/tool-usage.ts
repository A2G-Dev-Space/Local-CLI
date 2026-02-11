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

/**
 * Tool call format guide - prevents tool name corruption from LLMs
 */
export const TOOL_CALL_FORMAT_GUIDE = `
## CRITICAL - Tool Call Format

Every response MUST be a tool call. Plain text without a tool call is REJECTED.

Rules:
1. **Tool name = EXACT registered name only** (e.g. \`read_file\`, \`edit_file\`, \`bash\`)
2. **No suffixes or tokens** - NEVER append \`<|channel|>\`, \`<|end|>\`, \`|reasoning\`, etc.
3. **Arguments = valid JSON** matching the tool schema

❌ \`bash<|channel|>commentary\` → ✅ \`bash\`
❌ \`bash<|end|>\` → ✅ \`bash\`
❌ \`edit_file|reasoning\` → ✅ \`edit_file\`
❌ Plain text without tool call → ✅ Always call a tool

### Correct tool call examples:

Reading a file:
\`\`\`json
{"name": "read_file", "arguments": {"reason": "기존 코드 확인", "file_path": "src/index.ts"}}
\`\`\`

Running a command:
\`\`\`json
{"name": "bash", "arguments": {"reason": "프로젝트 빌드", "command": "npm run build"}}
\`\`\`

Editing a file:
\`\`\`json
{"name": "edit_file", "arguments": {"reason": "버그 수정", "file_path": "src/app.ts", "old_string": "const x = 1;", "new_string": "const x = 2;"}}
\`\`\`
`.trim();

export default {
  AVAILABLE_TOOLS,
  AVAILABLE_TOOLS_WITH_TODO,
  TOOL_REASON_GUIDE,
  TOOL_CALL_FORMAT_GUIDE,
  FILE_MODIFICATION_RULES,
};
