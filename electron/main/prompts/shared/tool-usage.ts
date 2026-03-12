/**
 * Shared Tool Usage Guidelines
 *
 * Common tool usage instructions used across prompts.
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

/**
 * Available tools description (Windows/PowerShell)
 */
export const AVAILABLE_TOOLS = `
## Available Tools

- **read_file**: Read file contents to understand existing code
- **create_file**: Create a NEW file (fails if file exists)
- **edit_file**: Edit an EXISTING file by replacing specific lines
- **list_files**: List directory contents
- **find_files**: Search for files by pattern
- **search_content**: Search for text patterns in files (grep-like)
- **powershell**: Execute PowerShell commands (git, npm, etc.)
`.trim();

/**
 * File tool usage with TODO tools (Windows/PowerShell)
 */
export const AVAILABLE_TOOLS_WITH_TODO = `
## Available Tools

- **read_file**: Read file contents to understand existing code
- **create_file**: Create a NEW file (fails if file exists)
- **edit_file**: Edit an EXISTING file by replacing specific lines
- **list_files**: List directory contents
- **find_files**: Search for files by pattern
- **search_content**: Search for text patterns in files (grep-like)
- **powershell**: Execute PowerShell commands (git, npm, etc.)
- **tell_to_user**: Send status updates to the user
- **ask_to_user**: Ask user a question with multiple choice options
- **write_todos**: Update entire TODO list (replaces current list)


### Specialist Sub-Agent Tools (autonomous agents that run independently)
- **word_create_agent**: Autonomous Word CREATION agent — creates NEW documents from scratch with high-level section builders. Provide topic, sections, content, and save path.
- **word_modify_agent**: Autonomous Word MODIFY agent — edits EXISTING .docx files. Provide file path and specific changes needed.
- **excel_create_agent**: Autonomous Excel CREATION agent — creates NEW spreadsheets from scratch with high-level sheet builders. Provide data topic, columns, calculations, and save path.
- **excel_modify_agent**: Autonomous Excel MODIFY agent — edits EXISTING .xlsx files. Provide file path and specific changes needed.
- **powerpoint_create_agent**: Autonomous PowerPoint CREATION agent — creates NEW presentations from scratch with high-level builder tools. Provide topic, slide outline, content details, and save path.
- **powerpoint_modify_agent**: Autonomous PowerPoint MODIFY agent — edits EXISTING .pptx files. Provide file path and specific changes needed.
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
1. **Tool name = EXACT registered name only** (e.g. \`read_file\`, \`edit_file\`, \`powershell\`)
2. **No suffixes or tokens** - NEVER append \`<|channel|>\`, \`<|end|>\`, \`|reasoning\`, etc.
3. **Arguments = valid JSON** matching the tool schema

❌ \`powershell<|channel|>commentary\` → ✅ \`powershell\`
❌ \`edit_file<|end|>\` → ✅ \`edit_file\`
❌ \`read_file|reasoning\` → ✅ \`read_file\`
❌ Plain text without tool call → ✅ Always call a tool

### Correct tool call examples:

Reading a file:
\`\`\`json
{"name": "read_file", "arguments": {"reason": "Check existing code", "file_path": "src/index.ts"}}
\`\`\`

Running a command:
\`\`\`json
{"name": "powershell", "arguments": {"reason": "Build the project", "command": "npm run build"}}
\`\`\`

Editing a file:
\`\`\`json
{"name": "edit_file", "arguments": {"reason": "Fix the bug", "file_path": "src/app.ts", "old_string": "const x = 1;", "new_string": "const x = 2;"}}
\`\`\`
`.trim();

export default {
  AVAILABLE_TOOLS,
  AVAILABLE_TOOLS_WITH_TODO,
  TOOL_REASON_GUIDE,
  TOOL_CALL_FORMAT_GUIDE,
  FILE_MODIFICATION_RULES,
};
