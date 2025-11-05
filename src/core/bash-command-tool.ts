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
 * Execute bash command
 * Security: Restricted to ~/.open-cli/docs directory by default
 */
export async function executeBashCommand(
  command: string,
  cwd?: string
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    // Security validation: Block dangerous commands
    const dangerousCommands = [
      'rm -rf',
      'dd',
      'mkfs',
      'format',
      'sudo',
      'chmod 777',
      'curl',
      'wget',
      'nc',
      'netcat',
    ];

    // Check for dangerous patterns
    for (const dangerous of dangerousCommands) {
      if (command.includes(dangerous)) {
        return {
          success: false,
          error: `Command blocked for security reasons: contains "${dangerous}"`,
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
      timeout: 5000, // 5 second timeout
      maxBuffer: 1024 * 1024, // 1MB max buffer
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
        error: 'Command timeout: exceeded 5 second limit',
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

  // Extract the base command (first word)
  const baseCommand = command.trim().split(/\s+/)[0];

  // Check if it's in the allowed list
  return baseCommand ? allowedCommands.includes(baseCommand) : false;
}

/**
 * Sanitize command arguments
 */
export function sanitizeCommand(command: string): string {
  // Remove backticks and command substitution
  let sanitized = command.replace(/`/g, '');
  sanitized = sanitized.replace(/\$\(/g, '');

  // Remove semicolons to prevent command chaining (except in quotes)
  sanitized = sanitized.replace(/;(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/g, '');

  // Remove pipe characters to prevent command chaining (except in quotes)
  sanitized = sanitized.replace(/\|(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/g, '');

  // Remove ampersands to prevent background execution
  sanitized = sanitized.replace(/&/g, '');

  return sanitized.trim();
}

export default executeBashCommand;