/**
 * Standard Tool Layer
 *
 * Handles simple, structured API calls using predefined tools
 */

import {
  Task,
  ExecutionLayer,
  LayerExecutionResult,
  ToolDefinition,
} from '../types/index.js';

export interface ToolSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}

export interface StandardTool {
  name: string;
  description: string;
  schema: ToolSchema;
  execute: (parameters: any) => Promise<any>;
}

export class StandardToolLayer implements ExecutionLayer {
  name = 'standard-tools';
  private tools: Map<string, StandardTool> = new Map();

  constructor() {
    this.registerBuiltInTools();
  }

  /**
   * Register built-in tools
   */
  private registerBuiltInTools(): void {
    // File system tools
    this.registerTool({
      name: 'read_file',
      description: 'Read contents of a file',
      schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          encoding: { type: 'string', default: 'utf-8' }
        },
        required: ['file_path']
      },
      execute: async (params) => {
        const fs = await import('fs/promises');
        return await fs.readFile(params.file_path, params.encoding || 'utf-8');
      }
    });

    this.registerTool({
      name: 'write_file',
      description: 'Write contents to a file',
      schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          content: { type: 'string' },
          encoding: { type: 'string', default: 'utf-8' }
        },
        required: ['file_path', 'content']
      },
      execute: async (params) => {
        const fs = await import('fs/promises');
        await fs.writeFile(params.file_path, params.content, params.encoding || 'utf-8');
        return { success: true, path: params.file_path };
      }
    });

    this.registerTool({
      name: 'list_directory',
      description: 'List contents of a directory',
      schema: {
        type: 'object',
        properties: {
          directory: { type: 'string' },
          recursive: { type: 'boolean', default: false }
        },
        required: ['directory']
      },
      execute: async (params) => {
        const fs = await import('fs/promises');
        const path = await import('path');

        if (params.recursive) {
          const results: string[] = [];
          const walk = async (dir: string) => {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
              const fullPath = path.join(dir, item.name);
              results.push(fullPath);
              if (item.isDirectory()) {
                await walk(fullPath);
              }
            }
          };
          await walk(params.directory);
          return results;
        } else {
          return await fs.readdir(params.directory);
        }
      }
    });

    // JSON tools
    this.registerTool({
      name: 'parse_json',
      description: 'Parse JSON string',
      schema: {
        type: 'object',
        properties: {
          json_string: { type: 'string' }
        },
        required: ['json_string']
      },
      execute: async (params) => {
        return JSON.parse(params.json_string);
      }
    });

    this.registerTool({
      name: 'stringify_json',
      description: 'Convert object to JSON string',
      schema: {
        type: 'object',
        properties: {
          object: { type: 'any' },
          pretty: { type: 'boolean', default: false }
        },
        required: ['object']
      },
      execute: async (params) => {
        return JSON.stringify(params.object, null, params.pretty ? 2 : undefined);
      }
    });
  }

  /**
   * Register a new tool
   */
  registerTool(tool: StandardTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Check if layer can handle the task
   */
  async canHandle(task: Task): Promise<boolean> {
    // Standard tool layer handles simple tasks with all tools available
    if (task.complexity !== 'simple') {
      return false;
    }

    // Check if we have all required tools
    for (const toolName of task.requiresTools) {
      if (!this.tools.has(toolName)) {
        return false;
      }
    }

    // Don't handle if task requires advanced features
    if (task.requiresDynamicCode ||
        task.requiresSystemAccess ||
        task.requiresParallelism ||
        task.requiresSkill) {
      return false;
    }

    return true;
  }

  /**
   * Execute task using standard tools
   */
  async execute(task: Task): Promise<LayerExecutionResult> {
    const startTime = Date.now();

    // Get the tool
    const toolName = task.toolName || task.requiresTools[0];
    if (!toolName) {
      return {
        success: false,
        error: 'No tool specified for execution',
        layer: this.name
      };
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
        layer: this.name
      };
    }

    // Validate parameters
    const validation = this.validateParameters(
      task.parameters || {},
      tool.schema
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors,
        layer: this.name
      };
    }

    // Execute tool
    try {
      const result = await tool.execute(task.parameters);
      return {
        success: true,
        output: result,
        layer: this.name,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        layer: this.name,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate parameters against schema
   */
  private validateParameters(
    parameters: Record<string, any>,
    schema: ToolSchema
  ): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Check required parameters
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in parameters)) {
          errors.push(`Missing required parameter: ${required}`);
        }
      }
    }

    // Validate types (simplified)
    for (const [key, value] of Object.entries(parameters)) {
      const propSchema = schema.properties[key];
      if (!propSchema) {
        errors.push(`Unknown parameter: ${key}`);
        continue;
      }

      // Basic type checking
      const expectedType = propSchema.type;
      const actualType = typeof value;

      if (expectedType === 'string' && actualType !== 'string') {
        errors.push(`Parameter ${key} must be a string`);
      } else if (expectedType === 'number' && actualType !== 'number') {
        errors.push(`Parameter ${key} must be a number`);
      } else if (expectedType === 'boolean' && actualType !== 'boolean') {
        errors.push(`Parameter ${key} must be a boolean`);
      } else if (expectedType === 'object' && typeof value !== 'object') {
        errors.push(`Parameter ${key} must be an object`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Get available tools
   */
  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema
      }
    }));
  }

  /**
   * Get tool by name
   */
  getTool(name: string): StandardTool | undefined {
    return this.tools.get(name);
  }
}

export default StandardToolLayer;