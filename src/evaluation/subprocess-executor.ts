import { spawn } from 'child_process';
import path from 'path';

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  duration: number;
  error?: string;
}

/**
 * Execute 'open chat {prompt} --debug' command via subprocess
 */
export async function executeOpenChat(
  prompt: string,
  timeout: number = 300000 // 5 minutes default
): Promise<ExecutionResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const cliPath = path.join(process.cwd(), 'dist', 'cli.js');

    // Spawn the subprocess
    const child = spawn('node', [cliPath, 'chat', prompt], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FORCE_COLOR: '0', // Disable colors for easier parsing
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Set timeout
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    // Capture stdout and stream to terminal
    child.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text); // Real-time output to terminal
    });

    // Capture stderr and stream to terminal
    child.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text); // Real-time output to terminal
    });

    // Handle process exit
    child.on('close', (code) => {
      clearTimeout(timer);

      const duration = Date.now() - startTime;

      if (timedOut) {
        resolve({
          success: false,
          stdout,
          stderr,
          exitCode: null,
          duration,
          error: `Process timed out after ${timeout}ms`,
        });
      } else {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code,
          duration,
        });
      }
    });

    // Handle process errors
    child.on('error', (error) => {
      clearTimeout(timer);

      resolve({
        success: false,
        stdout,
        stderr,
        exitCode: null,
        duration: Date.now() - startTime,
        error: error.message,
      });
    });

    // Send newline to auto-exit after response (simulating user hitting Enter)
    // Wait a bit for the agent to process
    setTimeout(() => {
      child.stdin?.write('\n');
      child.stdin?.end();
    }, 2000);
  });
}

/**
 * Parse the output to extract generated code
 */
export function extractGeneratedCode(output: string): string[] {
  const codeBlocks: string[] = [];

  // Match markdown code blocks with REQUIRED language tags (python, py, typescript, ts, javascript, js)
  // This ensures we only capture actual code blocks, not plain text blocks
  const codeBlockRegex = /```(python|py|typescript|ts|javascript|js)\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(output)) !== null) {
    if (match[2]) {
      const code = match[2].trim();

      // Only filter out empty blocks
      if (code.length > 0) {
        codeBlocks.push(code);
      }
    }
  }

  return codeBlocks;
}

/**
 * Check if docs search was performed
 */
export function hasDocsSearch(output: string): boolean {
  // Look for indicators of docs search in debug output
  const indicators = [
    'DocsSearch triggered',
    'Documentation Search Agent Started',
    'Searching documentation for:',
    'Documentation Search Completed',
    'docs-search-agent',
    'DocsSearchAgent',
    'knowledge base',
  ];

  return indicators.some(indicator =>
    output.toLowerCase().includes(indicator.toLowerCase())
  );
}
