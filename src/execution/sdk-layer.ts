/**
 * Dynamic SDK Layer
 *
 * Handles dynamic code generation and system access
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as vm from 'vm';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Task,
  ExecutionLayer,
  LayerExecutionResult,
} from '../types/index.js';
import { LLMClient } from '../core/llm-client.js';

const execAsync = promisify(exec);

export interface SandboxOptions {
  language: string;
  timeout: number;
  memoryLimit: string;
}

export interface SandboxResult {
  output: any;
  logs: string[];
  errors?: string[];
}

export class BashExecutor {
  private readonly dangerousCommands = [
    'rm -rf /',
    'dd if=/dev/zero',
    'mkfs',
    'format',
    ':(){ :|:& };:',  // Fork bomb
    '> /dev/sda',
    'chmod -R 777 /',
  ];

  async execute(command: string): Promise<{ success: boolean; stdout?: string; stderr?: string }> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 10, // 10MB
      });

      return {
        success: true,
        stdout,
        stderr
      };
    } catch (error: any) {
      return {
        success: false,
        stderr: error.message
      };
    }
  }

  isSafe(command: string): boolean {
    const lowerCommand = command.toLowerCase();

    // Check for dangerous patterns
    for (const dangerous of this.dangerousCommands) {
      if (lowerCommand.includes(dangerous.toLowerCase())) {
        return false;
      }
    }

    // Check for dangerous operators
    if (command.includes('sudo rm') ||
        command.includes('sudo dd') ||
        command.includes('/dev/null') && command.includes('>')) {
      return false;
    }

    return true;
  }
}

export class CodeGenerator {
  constructor(private llmClient: LLMClient) {}

  async generate(options: {
    task: string;
    language: string;
    requirements: string[];
    context?: any;
  }): Promise<string> {
    const prompt = `Generate ${options.language} code for the following task:
Task: ${options.task}
Requirements: ${options.requirements.join(', ')}
Context: ${JSON.stringify(options.context || {})}

Generate only the code, no explanations. The code should be complete and executable.`;

    const response = await this.llmClient.chatCompletion({
      messages: [
        { role: 'system', content: 'You are a code generator. Generate clean, executable code.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    return response.choices[0]?.message.content || '';
  }
}

export class SandboxManager {
  private sandboxes: Map<string, any> = new Map();
  private nextId = 1;

  async create(options: SandboxOptions): Promise<Sandbox> {
    const id = `sandbox-${this.nextId++}`;
    const sandbox = new Sandbox(id, options);
    this.sandboxes.set(id, sandbox);
    return sandbox;
  }

  async cleanup(id: string): Promise<void> {
    const sandbox = this.sandboxes.get(id);
    if (sandbox) {
      await sandbox.cleanup();
      this.sandboxes.delete(id);
    }
  }
}

export class Sandbox {
  private context?: vm.Context;
  private tempDir?: string;

  constructor(
    public readonly id: string,
    private options: SandboxOptions
  ) {}

  async execute(code: string): Promise<SandboxResult> {
    const logs: string[] = [];
    const errors: string[] = [];

    if (this.options.language === 'javascript' || this.options.language === 'typescript') {
      return await this.executeJavaScript(code, logs, errors);
    } else if (this.options.language === 'python') {
      return await this.executePython(code, logs, errors);
    } else {
      throw new Error(`Unsupported language: ${this.options.language}`);
    }
  }

  private async executeJavaScript(
    code: string,
    logs: string[],
    errors: string[]
  ): Promise<SandboxResult> {
    // Create a sandboxed context
    const sandbox = {
      console: {
        log: (...args: any[]) => logs.push(args.join(' ')),
        error: (...args: any[]) => errors.push(args.join(' ')),
      },
      require: (module: string) => {
        // Only allow safe modules
        const safeModules = ['path', 'url', 'querystring', 'util'];
        if (safeModules.includes(module)) {
          return require(module);
        }
        throw new Error(`Module not allowed: ${module}`);
      },
      process: {
        env: process.env,
        version: process.version,
      },
      __result: undefined
    };

    this.context = vm.createContext(sandbox);

    try {
      // Wrap code to capture result
      const wrappedCode = `
        (function() {
          ${code}
        })();
        __result;
      `;

      const script = new vm.Script(wrappedCode);
      const result = await script.runInContext(this.context, {
        timeout: this.options.timeout,
        displayErrors: true
      });

      return {
        output: result,
        logs,
        errors
      };
    } catch (error: any) {
      errors.push(error.message);
      return {
        output: undefined,
        logs,
        errors
      };
    }
  }

  private async executePython(
    code: string,
    logs: string[],
    errors: string[]
  ): Promise<SandboxResult> {
    // Create temporary directory for Python execution
    this.tempDir = await fs.mkdtemp(path.join('/tmp', 'sandbox-'));
    const scriptPath = path.join(this.tempDir, 'script.py');

    // Write code to file
    await fs.writeFile(scriptPath, code);

    try {
      const { stdout, stderr } = await execAsync(`python3 ${scriptPath}`, {
        timeout: this.options.timeout,
        cwd: this.tempDir,
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: '1'
        }
      });

      if (stdout) logs.push(stdout);
      if (stderr) errors.push(stderr);

      // Try to parse output as JSON if possible
      let output: any;
      try {
        output = JSON.parse(stdout);
      } catch {
        output = stdout;
      }

      return {
        output,
        logs,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error: any) {
      errors.push(error.message);
      return {
        output: undefined,
        logs,
        errors
      };
    }
  }

  async cleanup(): Promise<void> {
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    }
    this.context = undefined;
  }
}

export class SDKLayer implements ExecutionLayer {
  name = 'sdk-dynamic';
  private bashExecutor: BashExecutor;
  private codeGenerator: CodeGenerator;
  private sandboxManager: SandboxManager;

  constructor(llmClient: LLMClient) {
    this.bashExecutor = new BashExecutor();
    this.codeGenerator = new CodeGenerator(llmClient);
    this.sandboxManager = new SandboxManager();
  }

  async canHandle(task: Task): Promise<boolean> {
    return task.requiresDynamicCode ||
           task.requiresSystemAccess ||
           task.complexity === 'moderate';
  }

  async execute(task: Task): Promise<LayerExecutionResult> {
    const startTime = Date.now();

    if (task.requiresDynamicCode) {
      return await this.executeDynamicCode(task, startTime);
    }

    if (task.requiresSystemAccess) {
      return await this.executeBashCommands(task, startTime);
    }

    return await this.executeHybrid(task, startTime);
  }

  private async executeDynamicCode(
    task: Task,
    startTime: number
  ): Promise<LayerExecutionResult> {
    try {
      // 1. Generate code based on task
      const code = await this.codeGenerator.generate({
        task: task.description,
        language: task.targetLanguage || 'javascript',
        requirements: task.requirements || [],
        context: task.context
      });

      // 2. Create sandbox environment
      const sandbox = await this.sandboxManager.create({
        language: task.targetLanguage || 'javascript',
        timeout: task.timeout || 30000,
        memoryLimit: task.memoryLimit || '512MB'
      });

      // 3. Execute in sandbox
      try {
        const result = await sandbox.execute(code);

        // 4. Validate output if schema provided
        if (task.expectedOutputSchema) {
          const validation = this.validateOutput(result.output, task.expectedOutputSchema);
          if (!validation.valid) {
            return {
              success: false,
              error: validation.errors,
              layer: this.name,
              generatedCode: code,
              sandbox: sandbox.id,
              logs: result.logs,
              executionTime: Date.now() - startTime
            };
          }
        }

        return {
          success: !result.errors || result.errors.length === 0,
          output: result.output,
          generatedCode: code,
          layer: this.name,
          sandbox: sandbox.id,
          logs: result.logs,
          error: result.errors ? result.errors.join(', ') : undefined,
          executionTime: Date.now() - startTime
        };
      } finally {
        await sandbox.cleanup();
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        layer: this.name,
        executionTime: Date.now() - startTime
      };
    }
  }

  private async executeBashCommands(
    task: Task,
    startTime: number
  ): Promise<LayerExecutionResult> {
    const commands = task.commands || await this.generateBashCommands(task);
    const results: any[] = [];
    const logs: string[] = [];

    for (const command of commands) {
      // Safety check
      if (!this.bashExecutor.isSafe(command)) {
        return {
          success: false,
          error: `Unsafe command blocked: ${command}`,
          layer: this.name,
          executionTime: Date.now() - startTime
        };
      }

      const result = await this.bashExecutor.execute(command);
      results.push(result);

      if (result.stdout) logs.push(result.stdout);
      if (result.stderr) logs.push(result.stderr);

      if (!result.success) {
        return {
          success: false,
          error: result.stderr,
          layer: this.name,
          commands,
          logs,
          executionTime: Date.now() - startTime
        };
      }
    }

    return {
      success: true,
      output: results,
      layer: this.name,
      commands,
      logs,
      executionTime: Date.now() - startTime
    };
  }

  private async executeHybrid(
    task: Task,
    startTime: number
  ): Promise<LayerExecutionResult> {
    // Combine code generation and bash execution as needed
    const results: any[] = [];
    const logs: string[] = [];

    // Generate and execute code if needed
    if (task.requiresDynamicCode) {
      const codeResult = await this.executeDynamicCode(task, startTime);
      results.push(codeResult);
      if (codeResult.logs) logs.push(...codeResult.logs);
      if (!codeResult.success) {
        return codeResult;
      }
    }

    // Execute bash commands if needed
    if (task.commands && task.commands.length > 0) {
      const bashResult = await this.executeBashCommands(task, startTime);
      results.push(bashResult);
      if (bashResult.logs) logs.push(...bashResult.logs);
      if (!bashResult.success) {
        return bashResult;
      }
    }

    return {
      success: true,
      output: results,
      layer: this.name,
      logs,
      executionTime: Date.now() - startTime
    };
  }

  private async generateBashCommands(task: Task): Promise<string[]> {
    // Use LLM to generate bash commands for the task
    // This is a simplified version - real implementation would be more sophisticated
    const basicCommands: string[] = [];

    if (task.description.includes('list') || task.description.includes('show')) {
      basicCommands.push('ls -la');
    }
    if (task.description.includes('create') && task.description.includes('directory')) {
      basicCommands.push(`mkdir -p ${task.parameters?.['directory'] || 'new_directory'}`);
    }
    if (task.description.includes('test')) {
      basicCommands.push('npm test');
    }

    return basicCommands.length > 0 ? basicCommands : ['echo "No commands generated"'];
  }

  private validateOutput(output: any, schema: any): { valid: boolean; errors?: string[] } {
    // Simplified schema validation
    const errors: string[] = [];

    if (schema.type) {
      const actualType = typeof output;
      if (schema.type !== actualType && !(schema.type === 'array' && Array.isArray(output))) {
        errors.push(`Expected type ${schema.type}, got ${actualType}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

export default SDKLayer;