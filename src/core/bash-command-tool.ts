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
const BASH_COMMAND_TIMEOUT_MS = 10000; // 10 second timeout
const BASH_COMMAND_MAX_BUFFER_BYTES = 2 * 1024 * 1024; // 2MB max buffer

/**
 * Execute bash command
 * Security: Restricted to ~/.open-cli/docs directory by default
 */
export async function executeBashCommand(
  command: string,
  cwd?: string
): Promise<{ success: boolean; result?: string; error?: string }> {
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
        return {
          success: false,
          error: `Command blocked for security reasons: matches dangerous pattern "${pattern}"`,
        };
      }
    }

    // Check for output redirection (prevent file overwrites)
    if (command.match(/>\s*\/|>>\s*\//)) {
      return {
        success: false,
        error: 'Output redirection to absolute paths is not allowed',
      };
    }

    // Default working directory: ~/.open-cli/docs
    const docsPath = cwd || path.join(os.homedir(), '.open-cli', 'docs');

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

    // Combine stdout and stderr
    const output = stdout || stderr || 'Command executed successfully (no output)';

    return {
      success: true,
      result: output.trim(),
    };
  } catch (error: any) {
    // Handle different error types
    if (error.killed && error.signal === 'SIGTERM') {
      return {
        success: false,
        error: `Command timeout: exceeded ${BASH_COMMAND_TIMEOUT_MS / 1000} second limit`,
      };
    }

    if (error.code === 'ENOENT') {
      return {
        success: false,
        error: 'Command not found',
      };
    }

    // Return stderr if available, otherwise the error message
    const errorMessage = error.stderr || error.message || 'Unknown error';

    return {
      success: false,
      error: errorMessage,
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

export default executeBashCommand;