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

    // Spawn the subprocess with non-interactive mode
    const child = spawn('node', [cliPath, 'chat', prompt, '--non-interactive'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FORCE_COLOR: '0', // Disable colors for easier parsing
        CI: '1',          // Signal CI environment (disables Ink UI)
        NO_TTY: '1',      // Additional signal for non-TTY environment
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
 * Check if code is a complete program (not just a snippet)
 * Uses pattern-based detection without counting individual lines
 */
function isCompleteProgram(code: string): boolean {
  const lines = code.split('\n').filter(line => line.trim().length > 0);

  // Too short to be a complete program (less than 8 non-empty lines)
  if (lines.length < 8) {
    return false;
  }

  // 1. Check for Python main block
  if (code.includes('if __name__ == "__main__":') || code.includes("if __name__ == '__main__':")) {
    return true;
  }

  // 2. Check for file name comment in the first few lines
  const firstFewLines = lines.slice(0, 5).join('\n');

  // Python: # filename.py (strict: must be valid filename pattern at line start/end)
  // Must start with lowercase or underscore, end with .py/ts/js, and have nothing else on the line
  if (/^#\s*[a-z_][a-z0-9_-]*\.(py|ts|js)\s*$/m.test(firstFewLines)) {
    return true;
  }

  // TypeScript/JavaScript: // filename.ts or /* filename.ts */
  // Must start with lowercase or underscore, end with .py/ts/js, and have nothing else on the line
  if (/^(\/\/|\/\*)\s*[a-z_][a-z0-9_-]*\.(py|ts|js)(\s*\*\/)?\s*$/m.test(firstFewLines)) {
    return true;
  }

  // 3. Check for imports (indicates it's likely a complete program)
  const hasImports = /^\s*(from\s+[\w.]+\s+)?import\s+/m.test(code);

  // 4. Check for class or function definitions
  const hasClassDef = /^\s*class\s+\w+/m.test(code);
  const hasFunctionDef = /^\s*def\s+\w+/m.test(code);
  const hasAsyncDef = /^\s*async\s+(def|function)\s+\w+/m.test(code);

  // If it has imports AND (class or function definitions), it's a complete program
  if (hasImports && (hasClassDef || hasFunctionDef || hasAsyncDef)) {
    return true;
  }

  // 5. If it has multiple function/class definitions (library code)
  const functionCount = (code.match(/^\s*def\s+\w+/gm) || []).length;
  const classCount = (code.match(/^\s*class\s+\w+/gm) || []).length;
  if (functionCount >= 2 || classCount >= 1) {
    return true;
  }

  // 6. If it has imports and is reasonably long (10+ lines), assume it's a complete program
  // This catches executable scripts without class/function definitions
  if (hasImports && lines.length >= 10) {
    return true;
  }

  return false;
}

/**
 * Parse the output to extract generated code
 */
export function extractGeneratedCode(output: string): string[] {
  const codeBlocks: string[] = [];

  // Match Python markdown code blocks only
  // Uses ^ to match closing ``` only at line start, ignoring backticks in comments
  const codeBlockRegex = /```(?:python|py)\n([\s\S]*?)^```/gm;
  let match;

  while ((match = codeBlockRegex.exec(output)) !== null) {
    if (match[1]) {
      const code = match[1].trim();

      // Only include complete programs, not snippets
      if (code.length > 0 && isCompleteProgram(code)) {
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
