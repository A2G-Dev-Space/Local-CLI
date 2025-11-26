import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Clean error messages by removing temporary file paths
 */
function cleanErrorMessage(errorMessage: string, tmpFilePath: string): string {
  // Remove the temporary file path from error messages
  let cleaned = errorMessage.replace(new RegExp(tmpFilePath, 'g'), '<code>');

  // Remove "Command failed:" prefix
  cleaned = cleaned.replace(/^Command failed:.*?\n/m, '');

  // Remove any remaining /tmp/... paths
  cleaned = cleaned.replace(/\/tmp\/[^\s"']+/g, '<temp>');

  // Clean up multiple newlines
  cleaned = cleaned.replace(/\n\n+/g, '\n');

  return cleaned.trim();
}

export interface ValidationResult {
  hasCode: boolean;
  importsValid: boolean;
  syntaxValid: boolean;
  importIssues: string[];
  syntaxErrors: string[];
  warnings: string[];
  codePreview?: string;        // First few lines of the code
  savedFilePath?: string;       // Path to saved file (only on failure)
}

/**
 * Validate generated Python code
 */
export async function validatePythonCode(code: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    hasCode: code.trim().length > 0,
    importsValid: true,
    syntaxValid: true,
    importIssues: [],
    syntaxErrors: [],
    warnings: [],
  };

  // Add code preview (first 5 lines or 200 characters)
  const codeLines = code.trim().split('\n');
  result.codePreview = codeLines.slice(0, 5).join('\n');
  if (codeLines.length > 5) {
    result.codePreview += '\n... (truncated)';
  }

  if (!result.hasCode) {
    return result;
  }

  // Create temporary file for validation
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'open-cli-eval-'));
  const tmpFile = path.join(tmpDir, 'test_code.py');

  try {
    await fs.writeFile(tmpFile, code, 'utf-8');

    // Check syntax using Python's compile
    try {
      const { stderr } = await execAsync(
        `python3 -m py_compile "${tmpFile}"`,
        { timeout: 10000 }
      );

      if (stderr) {
        result.syntaxValid = false;
        result.syntaxErrors.push(cleanErrorMessage(stderr, tmpFile));
      }
    } catch (error: any) {
      result.syntaxValid = false;
      const errorMsg = error.message || error.stderr || 'Unknown syntax error';
      result.syntaxErrors.push(cleanErrorMessage(errorMsg, tmpFile));
    }

    // Validate imports
    const importValidation = validatePythonImports(code);
    result.importsValid = importValidation.valid;
    result.importIssues = importValidation.issues;
    result.warnings = importValidation.warnings;
  } finally {
    // Cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  return result;
}

/**
 * Validate Python imports
 */
function validatePythonImports(code: string): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Extract import statements
  const importRegex = /^(?:from\s+[\w.]+\s+)?import\s+.+$/gm;
  const imports = code.match(importRegex) || [];

  let hasAgnoImport = false;

  for (const imp of imports) {
    // Check if it's an Agno import
    if (
      imp.includes('from agno') ||
      imp.includes('import agno') ||
      imp.includes('from Agent') ||
      imp.includes('import Agent')
    ) {
      hasAgnoImport = true;
    }

    // Check for common import issues
    if (imp.includes('*')) {
      warnings.push(`Wildcard import found: ${imp}`);
    }

    // Check for relative imports without proper package structure
    if (imp.match(/^from\s+\.+\s+import/)) {
      warnings.push(`Relative import found: ${imp}`);
    }
  }

  // Validate that Agno-related code has Agno imports
  const hasAgnoCode = code.includes('Agent(') ||
                      code.includes('Workflow(') ||
                      code.includes('@agent');

  if (hasAgnoCode && !hasAgnoImport) {
    issues.push('Code uses Agno framework but missing Agno imports');
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Validate TypeScript code
 */
export async function validateTypeScriptCode(code: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    hasCode: code.trim().length > 0,
    importsValid: true,
    syntaxValid: true,
    importIssues: [],
    syntaxErrors: [],
    warnings: [],
  };

  // Add code preview (first 5 lines or 200 characters)
  const codeLines = code.trim().split('\n');
  result.codePreview = codeLines.slice(0, 5).join('\n');
  if (codeLines.length > 5) {
    result.codePreview += '\n... (truncated)';
  }

  if (!result.hasCode) {
    return result;
  }

  // Create temporary file for validation
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'open-cli-eval-'));
  const tmpFile = path.join(tmpDir, 'test_code.ts');

  try {
    await fs.writeFile(tmpFile, code, 'utf-8');

    // Check syntax using TypeScript compiler
    try {
      const { stderr } = await execAsync(
        `npx tsc --noEmit --allowJs "${tmpFile}"`,
        { timeout: 15000, cwd: process.cwd() }
      );

      if (stderr && !stderr.includes('TS18003')) {
        // Ignore "No inputs were found" error
        result.syntaxValid = false;
        result.syntaxErrors.push(cleanErrorMessage(stderr, tmpFile));
      }
    } catch (error: any) {
      // TypeScript errors go to stdout, not stderr
      if (error.stdout) {
        result.syntaxValid = false;
        result.syntaxErrors.push(cleanErrorMessage(error.stdout, tmpFile));
      }
    }

    // Validate imports
    const importValidation = validateTypeScriptImports(code);
    result.importsValid = importValidation.valid;
    result.importIssues = importValidation.issues;
    result.warnings = importValidation.warnings;
  } finally {
    // Cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  return result;
}

/**
 * Validate TypeScript imports
 */
function validateTypeScriptImports(code: string): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Extract import statements
  const importRegex = /^import\s+.+$/gm;
  const imports = code.match(importRegex) || [];

  for (const imp of imports) {
    // Check for missing file extensions in ESM
    if (imp.includes("from '") || imp.includes('from "')) {
      const pathMatch = imp.match(/from\s+['"]([^'"]+)['"]/);
      if (pathMatch && pathMatch[1]) {
        const importPath = pathMatch[1];
        // Relative imports should have .js extension in ESM
        if (importPath.startsWith('.') && !importPath.endsWith('.js')) {
          issues.push(`ESM import missing .js extension: ${imp}`);
        }
      }
    }

    // Check for namespace imports
    if (imp.includes('* as')) {
      warnings.push(`Namespace import found: ${imp}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Auto-detect language and validate code
 */
export async function validateCode(code: string): Promise<ValidationResult> {
  // Try to detect language from code content
  const isPython =
    code.includes('def ') ||
    code.includes('import ') ||
    code.includes('from ') ||
    code.includes('class ') && code.includes(':');

  const isTypeScript =
    code.includes('interface ') ||
    code.includes('type ') ||
    code.includes(': string') ||
    code.includes(': number') ||
    code.includes('async ') && code.includes('=>');

  if (isPython) {
    return validatePythonCode(code);
  } else if (isTypeScript) {
    return validateTypeScriptCode(code);
  } else {
    // Try Python as default for Agno (which is Python-based)
    return validatePythonCode(code);
  }
}
