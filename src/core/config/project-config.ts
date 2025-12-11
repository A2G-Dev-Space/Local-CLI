/**
 * Project Configuration Manager
 *
 * Loads and applies project-specific configuration from OPEN_CLI.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { FSWatcher } from 'fs';
import {
  ProjectConfiguration,
  CustomCommand,
  StyleGuide,
  ToolConfig,
  Constraint,
  ExecutionContext,
} from '../../types/index.js';

export class ProjectConfigManager {
  private configPath: string = 'OPEN_CLI.md';
  private config: ProjectConfiguration | null = null;
  private watcher: FSWatcher | null = null;
  private onChangeCallbacks: ((config: ProjectConfiguration) => void)[] = [];

  constructor(configPath?: string) {
    if (configPath) {
      this.configPath = configPath;
    }
  }

  /**
   * Load project configuration
   */
  async load(): Promise<ProjectConfiguration> {
    const fullPath = path.join(process.cwd(), this.configPath);

    if (!fs.existsSync(fullPath)) {
      // Create default config
      this.config = await this.createDefaultConfig();
      return this.config;
    }

    const content = await fs.promises.readFile(fullPath, 'utf-8');
    this.config = await this.parseConfig(content);

    // Start watching for changes
    this.startWatching(fullPath);

    return this.config;
  }

  /**
   * Parse configuration from markdown
   */
  private async parseConfig(markdown: string): Promise<ProjectConfiguration> {
    const config: ProjectConfiguration = {
      instructions: [],
      commands: [],
      styleGuides: [],
      tools: [],
      constraints: [],
      metadata: {}
    };

    // Parse markdown sections
    const sections = this.parseMarkdownSections(markdown);

    // Extract metadata from title and description
    const titleMatch = markdown.match(/^# (.+)$/m);
    if (titleMatch && titleMatch[1]) {
      config.metadata.name = titleMatch[1];
    }

    const descMatch = markdown.match(/^#[^\n]+\n\n([^\n]+)/);
    if (descMatch && descMatch[1]) {
      config.metadata.description = descMatch[1];
    }

    // Extract instructions
    if (sections['instructions'] || sections['project instructions']) {
      config.instructions = this.parseInstructions(
        sections['instructions'] || sections['project instructions'] || ''
      );
    }

    // Extract custom commands
    if (sections['commands'] || sections['custom commands']) {
      config.commands = this.parseCommands(
        sections['commands'] || sections['custom commands'] || ''
      );
    }

    // Extract style guides
    if (sections['style guide'] || sections['style']) {
      config.styleGuides = this.parseStyleGuides(
        sections['style guide'] || sections['style'] || ''
      );
    }

    // Extract tool configurations
    if (sections['tools'] || sections['tool configuration']) {
      config.tools = this.parseToolConfigs(
        sections['tools'] || sections['tool configuration'] || ''
      );
    }

    // Extract constraints
    if (sections['constraints'] || sections['rules']) {
      config.constraints = this.parseConstraints(
        sections['constraints'] || sections['rules'] || ''
      );
    }

    return config;
  }

  /**
   * Parse markdown into sections
   */
  private parseMarkdownSections(markdown: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = markdown.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      // Check for section header
      if (line.startsWith('## ')) {
        // Save previous section
        if (currentSection) {
          sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
        }

        // Start new section
        currentSection = line.substring(3).trim();
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
    }

    return sections;
  }

  /**
   * Parse instructions
   */
  private parseInstructions(content: string): string[] {
    const instructions: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        instructions.push(trimmed.substring(2));
      } else if (trimmed && !trimmed.startsWith('#')) {
        instructions.push(trimmed);
      }
    }

    return instructions;
  }

  /**
   * Parse custom commands
   */
  private parseCommands(content: string): CustomCommand[] {
    const commands: CustomCommand[] = [];
    const blocks = content.split(/^\s*###\s+/m);
    for (const block of blocks) {
      if (!block.trim()) continue;

      const lines = block.split('\n');
      const name = lines[0]?.trim();

      if (!name) continue;

      // Find description
      const description = lines.find(l => l.trim() && !l.includes('```'))?.trim() || '';

      // Find code block
      const codeStart = lines.findIndex(l => l.includes('```'));
      const codeEnd = lines.findIndex((l, i) => i > codeStart && l.includes('```'));

      let script = '';
      if (codeStart !== -1 && codeEnd !== -1) {
        script = lines.slice(codeStart + 1, codeEnd).join('\n');
      }

      if (name && script) {
        commands.push({
          name: name.toLowerCase().replace(/[^a-z0-9-]/g, ''),
          description,
          script,
          args: []
        });
      }
    }

    return commands;
  }

  /**
   * Parse style guides
   */
  private parseStyleGuides(content: string): StyleGuide[] {
    const guides: StyleGuide[] = [];
    const lines = content.split('\n');
    const rules: string[] = [];
    let currentGuideName = 'default';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('### ')) {
        // New guide section
        if (rules.length > 0) {
          guides.push({
            name: currentGuideName,
            rules: [...rules]
          });
          rules.length = 0;
        }
        currentGuideName = trimmed.substring(4);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        rules.push(trimmed.substring(2));
      }
    }

    // Add remaining rules
    if (rules.length > 0) {
      guides.push({
        name: currentGuideName,
        rules
      });
    }

    // If no guides found, create default from all bullet points
    if (guides.length === 0 && rules.length === 0) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          rules.push(trimmed.substring(2));
        }
      }

      if (rules.length > 0) {
        guides.push({
          name: 'default',
          rules
        });
      }
    }

    return guides;
  }

  /**
   * Parse tool configurations
   */
  private parseToolConfigs(content: string): ToolConfig[] {
    const tools: ToolConfig[] = [];

    // Try to parse JSON blocks
    const jsonBlocks = content.match(/```json[\s\S]*?```/g) || [];

    for (const block of jsonBlocks) {
      try {
        const json = block.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(json);

        if (parsed.name) {
          tools.push({
            name: parsed.name,
            config: parsed
          });
        }
      } catch (error) {
        console.debug('Failed to parse tool config JSON:', error);
      }
    }

    return tools;
  }

  /**
   * Parse constraints
   */
  private parseConstraints(content: string): Constraint[] {
    const constraints: Constraint[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const rule = trimmed.substring(2);
        let type: 'file' | 'code' | 'pattern' = 'pattern';
        let severity: 'error' | 'warning' | 'info' = 'warning';

        // Detect type from keywords
        if (rule.toLowerCase().includes('file') || rule.toLowerCase().includes('path')) {
          type = 'file';
        } else if (rule.toLowerCase().includes('code') || rule.toLowerCase().includes('function')) {
          type = 'code';
        }

        // Detect severity from keywords
        if (rule.toLowerCase().includes('must') || rule.toLowerCase().includes('always')) {
          severity = 'error';
        } else if (rule.toLowerCase().includes('should') || rule.toLowerCase().includes('prefer')) {
          severity = 'warning';
        } else if (rule.toLowerCase().includes('may') || rule.toLowerCase().includes('consider')) {
          severity = 'info';
        }

        constraints.push({ type, rule, severity });
      }
    }

    return constraints;
  }

  /**
   * Apply configuration to execution context
   */
  async applyToContext(context: ExecutionContext): Promise<ExecutionContext> {
    if (!this.config) {
      await this.load();
    }

    if (!this.config) {
      return context;
    }

    const modified = { ...context };

    // Add project instructions to system prompt
    if (this.config.instructions.length > 0) {
      modified.systemPrompt = `${context.systemPrompt}

## Project-specific Instructions

${this.config.instructions.map(i => `- ${i}`).join('\n')}`;
    }

    // Apply style guides as additional instructions
    for (const guide of this.config.styleGuides) {
      modified.additionalInstructions.push(
        `Style Guide (${guide.name}): ${guide.rules.join('; ')}`
      );
    }

    // Add constraints as additional instructions
    for (const constraint of this.config.constraints) {
      if (constraint.severity === 'error') {
        modified.additionalInstructions.push(
          `CONSTRAINT: ${constraint.rule}`
        );
      }
    }

    return modified;
  }

  /**
   * Start watching configuration file
   */
  private startWatching(filePath: string): void {
    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = fs.watch(filePath, async (eventType) => {
      if (eventType === 'change') {
        console.log('📝 OPEN_CLI.md configuration changed, reloading...');
        const content = await fs.promises.readFile(filePath, 'utf-8');
        this.config = await this.parseConfig(content);

        // Notify callbacks
        for (const callback of this.onChangeCallbacks) {
          callback(this.config);
        }
      }
    });
  }

  /**
   * Register change callback
   */
  onChange(callback: (config: ProjectConfiguration) => void): void {
    this.onChangeCallbacks.push(callback);
  }

  /**
   * Stop watching
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Create default configuration
   */
  private async createDefaultConfig(): Promise<ProjectConfiguration> {
    const defaultContent = `# OPEN_CLI Configuration

## Instructions

- Follow the project's coding standards
- Write comprehensive tests for all new features
- Update documentation when making changes
- Use TypeScript for all new code
- Maintain backwards compatibility

## Commands

### test
Run all tests with coverage
\`\`\`bash
npm test -- --coverage
\`\`\`

### lint
Check code quality
\`\`\`bash
npm run lint
\`\`\`

### build
Build the project
\`\`\`bash
npm run build
\`\`\`

## Style Guide

- Use 2 spaces for indentation
- Prefer const over let
- Use async/await over promises
- Add JSDoc comments for public APIs
- Keep functions under 50 lines
- Use descriptive variable names
- Follow TypeScript naming conventions

## Constraints

- Do not modify files in node_modules
- Always run tests before committing
- Keep functions under 50 lines
- Maintain test coverage above 80%
- Do not use any or unknown types
- Handle all error cases explicitly
- Add types for all function parameters

## Tools

Configure project-specific tools here.

---

*This is an auto-generated OPEN_CLI.md file. Customize it for your project.*`;

    // Write default config
    await fs.promises.writeFile(this.configPath, defaultContent, 'utf-8');

    return this.parseConfig(defaultContent);
  }

  /**
   * Get current configuration
   */
  getConfig(): ProjectConfiguration | null {
    return this.config;
  }

  /**
   * Get custom command by name
   */
  getCommand(name: string): CustomCommand | undefined {
    return this.config?.commands.find(c => c.name === name);
  }

  /**
   * Execute custom command
   */
  async executeCommand(name: string, args: string[] = []): Promise<{ success: boolean; output?: string; error?: string }> {
    const command = this.getCommand(name);
    if (!command) {
      return {
        success: false,
        error: `Command '${name}' not found`
      };
    }

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Replace args in script
      let script = command.script;
      args.forEach((arg, index) => {
        script = script.replace(`$${index + 1}`, arg);
        script = script.replace(`\${${index + 1}}`, arg);
      });

      const { stdout, stderr } = await execAsync(script, {
        cwd: process.cwd(),
        timeout: 60000
      });

      return {
        success: true,
        output: stdout,
        error: stderr
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default ProjectConfigManager;