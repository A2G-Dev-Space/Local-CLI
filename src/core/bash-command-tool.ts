/**
 * Bash Command Tool
 *
 * Executes bash commands safely in a restricted environment
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Configuration constants
 */
const BASH_COMMAND_TIMEOUT_MS = 5000; // 5 second timeout (reduced for safety)
const BASH_COMMAND_MAX_BUFFER_BYTES = 256 * 1024; // 256KB max buffer (reduced to prevent memory issues)

/**
 * Execute bash command
 * Security: Restricted to ~/.local-cli/docs directory by default
 */
export async function executeBashCommand(
  command: string,
  cwd?: string
): Promise<{ success: boolean; result?: string; error?: string; formattedDisplay?: string }> {
  try {
    // Security validation: Block dangerous commands
    // Use word boundaries to prevent false positives (e.g., "nc" in "agency")
    const dangerousPatterns = [
      /\brm\s+-rf\b/,
      /\bdd\b/,
      /\bmkfs\b/,
      /\bformat\b/,
      /\bsudo\b/,
      /\bchmod\s+777\b/,
      /\bcurl\b/,
      /\bwget\b/,
      /\bnc\b/,        // Match "nc" as a standalone command only
      /\bnetcat\b/,
    ];

    // Check for dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        const errorMsg = `Command blocked for security reasons: matches dangerous pattern "${pattern}"`;
        return {
          success: false,
          error: errorMsg,
          formattedDisplay: formatBashExecutionError(command, errorMsg),
        };
      }
    }

    // Safety: Prevent resource-intensive find/grep commands that could crash the system
    // Block recursive searches without depth limits or exclusions
    if (/\bfind\s+\.(?!\s+-maxdepth)/.test(command)) {
      // Allow "find . -maxdepth" but block bare "find ."
      const errorMsg = 'find command requires -maxdepth to prevent resource exhaustion';
      return {
        success: false,
        error: errorMsg,
        formattedDisplay: formatBashExecutionError(command, errorMsg),
      };
    }

    if (/\bgrep\s+-r\b/.test(command) && !command.includes('--include')) {
      // Block recursive grep without file type filter
      const errorMsg = 'grep -r requires --include pattern to prevent resource exhaustion';
      return {
        success: false,
        error: errorMsg,
        formattedDisplay: formatBashExecutionError(command, errorMsg),
      };
    }

    // Check for output redirection (prevent file overwrites)
    if (command.match(/>\s*\/|>>\s*\//)) {
      const errorMsg = 'Output redirection to absolute paths is not allowed';
      return {
        success: false,
        error: errorMsg,
        formattedDisplay: formatBashExecutionError(command, errorMsg),
      };
    }

    // Default working directory: ~/.local-cli/docs
    const docsPath = cwd || path.join(os.homedir(), '.local-cli', 'docs');

    // Ensure the docs directory exists
    const fs = await import('fs/promises');
    try {
      await fs.access(docsPath);
    } catch {
      // Create the directory if it doesn't exist
      await fs.mkdir(docsPath, { recursive: true });
    }

    // Execute command with timeout and buffer limits
    const { stdout, stderr } = await execAsync(command, {
      cwd: docsPath,
      timeout: BASH_COMMAND_TIMEOUT_MS,
      maxBuffer: BASH_COMMAND_MAX_BUFFER_BYTES,
      shell: '/bin/bash', // Use bash shell
    });

    // Combine stdout and stderr (keep empty string if no output)
    const output = stdout || stderr || '';

    // Generate formatted display for terminal UI
    const formattedDisplay = formatBashExecutionOutput(command, output.trim());

    return {
      success: true,
      result: output.trim() || 'Command executed successfully (no output)',
      formattedDisplay,
    };
  } catch (error: any) {
    // Handle different error types
    if (error.killed && error.signal === 'SIGTERM') {
      const errorMsg = `Command timeout: exceeded ${BASH_COMMAND_TIMEOUT_MS / 1000} second limit`;
      return {
        success: false,
        error: errorMsg,
        formattedDisplay: formatBashExecutionError(command, errorMsg),
      };
    }

    if (error.code === 'ENOENT') {
      const errorMsg = 'Command not found';
      return {
        success: false,
        error: errorMsg,
        formattedDisplay: formatBashExecutionError(command, errorMsg),
      };
    }

    // Handle exit code 1 for search commands (grep, find)
    // Exit code 1 for these commands means "no matches found", which is not an error
    const isSearchCommand = /\b(grep|find)\b/.test(command);
    if (isSearchCommand && error.code === 1) {
      // No matches found - this is a valid result, not an error
      const output = error.stdout || '';
      const formattedDisplay = formatBashExecutionOutput(command, output.trim());

      return {
        success: true,
        result: output.trim() || 'No matches found',
        formattedDisplay,
      };
    }

    // Return stderr if available, otherwise the error message
    const errorMessage = error.stderr || error.message || 'Unknown error';

    return {
      success: false,
      error: errorMessage,
      formattedDisplay: formatBashExecutionError(command, errorMessage),
    };
  }
}

/**
 * Validate if a command is safe to execute
 */
export function isCommandSafe(command: string): boolean {
  // List of allowed commands for docs search
  const allowedCommands = [
    'find',
    'grep',
    'cat',
    'ls',
    'tree',
    'head',
    'tail',
    'wc',
    'sort',
    'uniq',
    'awk',
    'sed',
    'echo',
    'pwd',
    'basename',
    'dirname',
  ];

  // Extract the base command (first word before any $, |, or ;)
  const baseCommand = command.trim().split(/\s+|[$|;]/)[0];

  // Check if base command is in the allowed list
  if (!baseCommand || !allowedCommands.includes(baseCommand)) {
    return false;
  }

  // Additional validation: if command contains $(command substitution),
  // ensure it only contains safe commands
  const commandSubstitutionPattern = /\$\(([^)]+)\)/g;
  let match;
  while ((match = commandSubstitutionPattern.exec(command)) !== null) {
    // match[1] is guaranteed to exist due to the regex pattern, but TypeScript needs explicit check
    if (!match[1]) {
      continue;
    }
    const substitutedCommand = match[1].trim();
    // Extract the base command from substitution
    const subBaseCommand = substitutedCommand.split(/\s+|[$|;]/)[0];
    if (!subBaseCommand || !allowedCommands.includes(subBaseCommand)) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize command arguments
 */
export function sanitizeCommand(command: string): string {
  // Remove backticks (backtick command substitution is not allowed)
  let sanitized = command.replace(/`/g, '');
  
  // Allow $(command) substitution only for safe commands (find, cat, sort)
  // We keep $( as it's needed, but we'll validate in isCommandSafe
  
  // Remove semicolons to prevent command chaining (except in quotes)
  sanitized = sanitized.replace(/;(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/g, '');

  // Allow pipe for safe commands (used in find | sort | cat chains)
  // Pipe is already handled by allowing it in the command chain
  
  // Remove ampersands to prevent background execution
  sanitized = sanitized.replace(/&/g, '');

  return sanitized.trim();
}

/**
 * Format bash execution error for terminal display
 */
function formatBashExecutionError(command: string, error: string): string {
  const lines: string[] = [];
  lines.push(`● Bash(${command})`);
  lines.push(`  ⎿  Error: ${error}`);
  return lines.join('\n');
}

/**
 * Check if command is a read command (should only show summary, not content)
 * Uses word boundary regex to avoid false positives (e.g., "my-catalog.sh")
 */
function isReadCommand(command: string): boolean {
  const readCommands = /\b(cat|head|tail|less|more)\b/;
  return readCommands.test(command);
}

/**
 * Format bash execution output for terminal display
 */
function formatBashExecutionOutput(command: string, output: string, maxLines: number = 20): string {
  const lines: string[] = [];

  // Add command header with ● indicator
  lines.push(`● Bash(${command})`);

  // Process output
  if (output) {
    const outputLines = output.split('\n').filter(line => line.trim());

    if (outputLines.length === 0) {
      lines.push('  ⎿  (no output)');
    } else {
      // Add summary line
      const summary = getBashOutputSummary(command, outputLines);
      if (summary) {
        lines.push(`  ⎿  ${summary}`);
      }

      // For read commands (cat, head, tail), only show summary, not the content
      const isRead = isReadCommand(command);

      if (!isRead) {
        // Add output lines (limited) for non-read commands
        const displayLines = outputLines.slice(0, maxLines);
        displayLines.forEach((line, idx) => {
          // First line uses ⎿ if no summary, rest use spaces for indent
          const prefix = idx === 0 && !summary ? '  ⎿  ' : '     ';
          lines.push(`${prefix}${line}`);
        });

        // Show truncation message if needed
        if (outputLines.length > maxLines) {
          lines.push(`     ... (${outputLines.length - maxLines} more lines)`);
        }
      } else if (!summary) {
        // If it's a read command but no summary was generated, show first line as summary
        lines.push(`  ⎿  Read ${outputLines.length} line${outputLines.length === 1 ? '' : 's'}`);
      }
    }
  } else {
    lines.push('  ⎿  (no output)');
  }

  return lines.join('\n');
}

/**
 * Generate a summary line based on command and output
 * Uses word boundary regex to avoid false positives (e.g., "build-docs.sh" matching "build")
 */
function getBashOutputSummary(command: string, outputLines: string[]): string | null {
  const lineCount = outputLines.length;

  // Search commands (find, grep)
  if (/\bfind\b/.test(command)) {
    if (lineCount === 0) {
      return 'Found 0 files';
    } else if (lineCount === 1) {
      return 'Found 1 file';
    } else {
      return `Found ${lineCount} files`;
    }
  }

  if (/\bgrep\b/.test(command)) {
    if (lineCount === 0) {
      return 'Found 0 matches';
    } else if (lineCount === 1) {
      return 'Found 1 match';
    } else {
      return `Found ${lineCount} matches`;
    }
  }

  // Read commands
  if (/\b(cat|head|tail)\b/.test(command)) {
    if (lineCount === 1) {
      return 'Read 1 line';
    } else {
      return `Read ${lineCount} lines`;
    }
  }

  // List commands
  if (/\bls\b/.test(command)) {
    if (lineCount === 0) {
      return 'Directory is empty';
    } else if (lineCount === 1) {
      return 'Found 1 item';
    } else {
      return `Found ${lineCount} items`;
    }
  }

  // Test/build commands
  if (/\b(test|jest)\b/.test(command) || command.includes('npm test')) {
    const hasPass = outputLines.some(line =>
      line.includes('passed') || line.includes('PASS') || line.includes('✓')
    );
    const hasFail = outputLines.some(line =>
      line.includes('failed') || line.includes('FAIL') || line.includes('✗')
    );

    if (hasPass && !hasFail) {
      return 'All tests passed';
    } else if (hasFail) {
      return 'Some tests failed';
    }
  }

  if (/\b(build|compile|tsc)\b/.test(command)) {
    const hasError = outputLines.some(line =>
      line.toLowerCase().includes('error')
    );

    if (hasError) {
      return 'Build completed with errors';
    } else {
      return 'Build completed successfully';
    }
  }

  // Default: no summary, just show output
  return null;
}

export default executeBashCommand;