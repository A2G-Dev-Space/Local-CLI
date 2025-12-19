/**
 * Git Commit Rules
 *
 * Rules for git operations when working in a git repository.
 * Only applied when .git folder is detected in the working directory.
 */

export const GIT_COMMIT_RULES = `
## Git Commit Rules

When the working directory is a git repository, follow these rules:

### 1. Co-Authored-By Trailer

When creating git commits, ALWAYS include this trailer at the end of the commit message:

\`\`\`
Co-Authored-By: Local-CLI <86968876+local-cli-bot@users.noreply.github.com>
\`\`\`

**Commit message format:**
\`\`\`bash
git commit -m "$(cat <<'EOF'
<type>: <description>

<optional body>

Co-Authored-By: Local-CLI <86968876+local-cli-bot@users.noreply.github.com>
EOF
)"
\`\`\`

**Example:**
\`\`\`bash
git commit -m "$(cat <<'EOF'
feat: add user authentication

Implemented JWT-based authentication with refresh tokens.

Co-Authored-By: Local-CLI <86968876+local-cli-bot@users.noreply.github.com>
EOF
)"
\`\`\`

### 2. Ask Before Commit

**IMPORTANT: When a task is completed, ALWAYS ask the user if they want to commit the changes to git.**

After completing file modifications or code changes:
1. Summarize what was done
2. Ask: "Would you like me to commit these changes to git?"
3. Wait for user confirmation before running \`git add\` and \`git commit\`

**Do NOT auto-commit without user permission.**

### 3. Commit Message Convention

Follow conventional commits format:
- \`feat:\` - New feature
- \`fix:\` - Bug fix
- \`refactor:\` - Code refactoring
- \`style:\` - Formatting, styling changes
- \`docs:\` - Documentation changes
- \`test:\` - Adding or updating tests
- \`chore:\` - Maintenance tasks
`;

export default GIT_COMMIT_RULES;
