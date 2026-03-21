/**
 * Android Tool Registry
 *
 * 안드로이드 환경용 도구 레지스트리. CLI의 registry.ts와 동일한 패턴.
 */

import type { AndroidTool, AndroidToolResult, ToolCategory } from './types';
import type { ToolDefinition } from '../types';
import { browserTools } from './browser/browser-tools';
import { fileTools } from './file/file-tools';
import { shellTools } from './shell/shell-tools';
import { localhostTools } from './localhost/localhost-tools';

class AndroidToolRegistry {
  private tools: Map<string, AndroidTool> = new Map();
  private enabledCategories: Set<ToolCategory> = new Set(['browser', 'file', 'shell', 'localhost']);

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Register all tool categories
    [...browserTools, ...fileTools, ...shellTools, ...localhostTools].forEach(tool => {
      this.tools.set(tool.name, tool);
    });
  }

  register(tool: AndroidTool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  enableCategory(category: ToolCategory): void {
    this.enabledCategories.add(category);
  }

  disableCategory(category: ToolCategory): void {
    this.enabledCategories.delete(category);
  }

  getEnabledTools(): AndroidTool[] {
    return Array.from(this.tools.values())
      .filter(tool => this.enabledCategories.has(tool.category));
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.getEnabledTools().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<AndroidToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Tool '${name}' not found`,
      };
    }

    if (!this.enabledCategories.has(tool.category)) {
      return {
        success: false,
        output: '',
        error: `Tool category '${tool.category}' is disabled`,
      };
    }

    try {
      return await tool.execute(args);
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getTool(name: string): AndroidTool | undefined {
    return this.tools.get(name);
  }

  getToolsByCategory(category: ToolCategory): AndroidTool[] {
    return Array.from(this.tools.values())
      .filter(tool => tool.category === category);
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

export const androidToolRegistry = new AndroidToolRegistry();
