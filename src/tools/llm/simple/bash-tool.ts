/**
 * Bash Tool
 *
 * LLM이 shell 명령어를 실행할 수 있게 해주는 도구
 * 보안을 위해 위험한 명령어는 차단
 */

import { spawn } from 'child_process';
import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult, ToolCategory } from '../../types.js';
import { logger } from '../../../utils/logger.js';

/**
 * 위험한 명령어 패턴 (차단)
 */
const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\s+[\/~]/i,           // rm -rf / or ~
  /\brm\s+-rf\s+\*/i,              // rm -rf *
  /\bdd\s+if=/i,                   // dd if=
  /\bmkfs\b/i,                     // mkfs
  /\b:(){ :|:& };:/,               // fork bomb
  /\bchmod\s+-R\s+777\s+\//i,      // chmod -R 777 /
  /\bsudo\s+rm/i,                  // sudo rm
  />\s*\/dev\/sd[a-z]/i,           // write to disk device
  /\bshutdown\b/i,                 // shutdown
  /\breboot\b/i,                   // reboot
  /\bhalt\b/i,                     // halt
  /\bpoweroff\b/i,                 // poweroff
];

/**
 * 명령어가 위험한지 체크
 */
function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}

/**
 * Bash 명령어 실행
 */
async function executeBash(
  command: string,
  cwd?: string,
  timeout: number = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

    const child = spawn(shell, shellArgs, {
      cwd: cwd || process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (!killed) {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 0,
        });
      }
    });

    child.on('error', (error) => {
      reject(error);
    });

    // Timeout handling
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', () => {
      clearTimeout(timer);
    });
  });
}

/**
 * Bash Tool Definition
 */
const BASH_TOOL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'bash',
    description: `Execute a shell command. Use this to run terminal commands like git, npm, docker, python, etc.

IMPORTANT:
- Do NOT use for file reading/writing - use read_file, create_file, edit_file instead
- Commands have a 30 second timeout by default
- Dangerous commands (rm -rf /, sudo rm, etc.) are blocked
- Output is truncated if too long`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing (in user's language).
Write as if you're talking to the user directly.
Examples:
- "Installing project dependencies"
- "Running tests to check the results"
- "Checking git status"
- "Running the build"`,
        },
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command (optional, defaults to current directory)',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (optional, default: 30000)',
        },
      },
      required: ['reason', 'command'],
    },
  },
};

/**
 * Bash Tool (LLM Simple)
 */
export const bashTool: LLMSimpleTool = {
  definition: BASH_TOOL_DEFINITION,
  categories: ['llm-simple'] as ToolCategory[],

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const command = args['command'] as string;
    const cwd = args['cwd'] as string | undefined;
    const timeout = (args['timeout'] as number) || 30000;

    logger.enter('bashTool.execute', { command, cwd, timeout });

    // Validate command
    if (!command || typeof command !== 'string') {
      return {
        success: false,
        error: 'command is required and must be a string',
      };
    }

    // Check for dangerous commands
    if (isDangerousCommand(command)) {
      logger.warn('Dangerous command blocked', { command });
      return {
        success: false,
        error: 'This command is blocked for safety reasons',
      };
    }

    try {
      const execResult = await executeBash(command, cwd, timeout);

      // Combine output
      let output = '';
      if (execResult.stdout) {
        output += execResult.stdout;
      }
      if (execResult.stderr) {
        output += (output ? '\n\n' : '') + `stderr:\n${execResult.stderr}`;
      }

      // Truncate if too long
      const MAX_OUTPUT_LENGTH = 50000;
      if (output.length > MAX_OUTPUT_LENGTH) {
        output = output.slice(0, MAX_OUTPUT_LENGTH) + '\n\n... [output truncated]';
      }

      // Add exit code if non-zero
      if (execResult.exitCode !== 0) {
        output += `\n\n[Exit code: ${execResult.exitCode}]`;
      }

      logger.exit('bashTool.execute', { exitCode: execResult.exitCode, outputLength: output.length });

      return {
        success: execResult.exitCode === 0,
        result: output || '(no output)',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('bashTool.execute failed', error as Error);

      return {
        success: false,
        error: `Error executing command: ${errorMessage}`,
      };
    }
  },
};

export default bashTool;
