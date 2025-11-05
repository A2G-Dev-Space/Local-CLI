/**
 * Agent Skills Meta-Layer
 *
 * Provides prompt-based meta-tools that modify agent behavior
 */

import {
  Task,
  ExecutionLayer,
  LayerExecutionResult,
  AgentSkill,
  ExecutionContext,
  Message,
} from '../types/index.js';
import { LLMClient } from '../core/llm-client.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class SkillLoader {
  private skillsDirectory = './skills';

  async load(skillName: string): Promise<AgentSkill> {
    try {
      // Try to load from file
      const skillPath = path.join(this.skillsDirectory, `${skillName}.json`);
      const content = await fs.readFile(skillPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Return default skill if file not found
      return this.getDefaultSkill(skillName);
    }
  }

  private getDefaultSkill(name: string): AgentSkill {
    const defaultSkills: Record<string, AgentSkill> = {
      'code-reviewer': {
        name: 'code-reviewer',
        description: 'Reviews code for quality, security, and best practices',
        promptExpansion: `You are now in code review mode.
Analyze code for:
- Security vulnerabilities (XSS, SQL injection, etc.)
- Performance issues
- Code style and maintainability
- Best practices
- Potential bugs

Provide detailed feedback with specific line references and improvement suggestions.`,
        requiredTools: ['read_file', 'parse_json'],
        contextModifications: [
          {
            type: 'add-instruction',
            value: 'Focus on code quality and security'
          },
          {
            type: 'set-parameter',
            key: 'temperature',
            value: 0.2
          }
        ]
      },
      'test-writer': {
        name: 'test-writer',
        description: 'Writes comprehensive test cases',
        promptExpansion: `You are now in test writing mode.
Generate comprehensive test cases that:
- Cover edge cases
- Test error conditions
- Verify happy paths
- Include unit, integration, and e2e tests as appropriate
- Follow testing best practices (AAA pattern, descriptive names, etc.)

Use appropriate testing frameworks and assertion libraries.`,
        requiredTools: ['write_file', 'read_file'],
        contextModifications: [
          {
            type: 'add-instruction',
            value: 'Generate thorough test coverage'
          },
          {
            type: 'enable-feature',
            feature: 'test-generation'
          }
        ]
      },
      'refactorer': {
        name: 'refactorer',
        description: 'Refactors code for improved structure and maintainability',
        promptExpansion: `You are now in refactoring mode.
Focus on:
- Extracting repeated code into functions
- Improving naming clarity
- Reducing complexity
- Applying design patterns where appropriate
- Maintaining backward compatibility
- Preserving all functionality

Document all changes and reasoning.`,
        requiredTools: ['read_file', 'write_file'],
        modelOverride: 'advanced',
        contextModifications: [
          {
            type: 'add-instruction',
            value: 'Preserve functionality while improving code structure'
          },
          {
            type: 'set-parameter',
            key: 'careful_mode',
            value: true
          }
        ]
      },
      'documentation-writer': {
        name: 'documentation-writer',
        description: 'Writes comprehensive documentation',
        promptExpansion: `You are now in documentation mode.
Create documentation that includes:
- Clear explanations of functionality
- Usage examples
- API references
- Installation/setup instructions
- Troubleshooting guides
- Best practices

Use appropriate markdown formatting and be thorough yet concise.`,
        requiredTools: ['write_file', 'read_file'],
        contextModifications: [
          {
            type: 'add-instruction',
            value: 'Create clear, comprehensive documentation'
          },
          {
            type: 'enable-feature',
            feature: 'markdown-formatting'
          }
        ]
      },
      'debugger': {
        name: 'debugger',
        description: 'Debugs and fixes code issues',
        promptExpansion: `You are now in debugging mode.
Approach:
1. Analyze error messages and stack traces
2. Identify root cause
3. Test hypotheses
4. Implement fixes
5. Verify fixes resolve the issue
6. Add tests to prevent regression

Document your debugging process and findings.`,
        requiredTools: ['read_file', 'write_file', 'execute_code'],
        contextModifications: [
          {
            type: 'add-instruction',
            value: 'Systematically identify and fix bugs'
          },
          {
            type: 'enable-feature',
            feature: 'step-by-step-debugging'
          }
        ]
      }
    };

    return defaultSkills[name] || {
      name,
      description: 'Generic skill',
      promptExpansion: `Execute the task with standard behavior.`,
      contextModifications: []
    };
  }

  async listAvailable(): Promise<string[]> {
    const builtInSkills = [
      'code-reviewer',
      'test-writer',
      'refactorer',
      'documentation-writer',
      'debugger'
    ];

    try {
      // Check for custom skills
      const files = await fs.readdir(this.skillsDirectory);
      const customSkills = files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));

      return [...new Set([...builtInSkills, ...customSkills])];
    } catch {
      return builtInSkills;
    }
  }
}

export class EnhancedExecutor {
  constructor(
    private context: ExecutionContext,
    private llmClient: LLMClient
  ) {}

  async execute(task: Task): Promise<any> {
    // Execute with enhanced context
    const messages: Message[] = [
      {
        role: 'system' as const,
        content: this.context.systemPrompt
      }
    ];

    // Add additional instructions
    if (this.context.additionalInstructions.length > 0) {
      messages.push({
        role: 'system' as const,
        content: `Additional instructions:\n${this.context.additionalInstructions.join('\n')}`
      });
    }

    // Add task description
    messages.push({
      role: 'user' as const,
      content: task.description
    });

    // Execute with modified parameters
    const response = await this.llmClient.chatCompletion({
      messages,
      model: this.context.model,
      temperature: this.context.parameters['temperature'] || 0.7,
      max_tokens: this.context.parameters['max_tokens'] || 2000,
      ...this.context.parameters
    });

    return {
      success: true,
      output: response.choices[0]?.message.content
    };
  }
}

export class SkillsLayer implements ExecutionLayer {
  name = 'skills';
  private skills: Map<string, AgentSkill> = new Map();
  private skillLoader: SkillLoader;
  private llm: LLMClient;

  constructor(llmClient: LLMClient) {
    this.skillLoader = new SkillLoader();
    this.llm = llmClient;
    this.loadBuiltInSkills();
  }

  private async loadBuiltInSkills(): Promise<void> {
    const skillNames = await this.skillLoader.listAvailable();
    for (const name of skillNames) {
      const skill = await this.skillLoader.load(name);
      this.skills.set(name, skill);
    }
  }

  async canHandle(task: Task): Promise<boolean> {
    // Skills are for complex workflows that need behavior modification
    return !!task.requiresSkill ||
           task.workflowComplexity === 'high' ||
           task.requiresBehaviorChange === true ||
           task.complexity === 'meta';
  }

  async execute(task: Task): Promise<LayerExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. Discover appropriate skill
      const skill = await this.discoverSkill(task);

      if (!skill) {
        return {
          success: false,
          error: 'No appropriate skill found for task',
          layer: this.name,
          executionTime: Date.now() - startTime
        };
      }

      // 2. Load skill definition
      const skillDef = await this.skillLoader.load(skill.name);

      // 3. Modify execution context
      const modifiedContext = await this.applySkill(
        task.context || this.getDefaultContext(),
        skillDef
      );

      // 4. Execute with modified context
      const executor = new EnhancedExecutor(modifiedContext, this.llm);
      const result = await executor.execute(task);

      return {
        success: result.success,
        output: result.output,
        layer: this.name,
        skillUsed: skill.name,
        contextModifications: skillDef.contextModifications,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        layer: this.name,
        executionTime: Date.now() - startTime
      };
    }
  }

  private async discoverSkill(task: Task): Promise<AgentSkill | null> {
    // If skill is explicitly specified
    if (typeof task.requiresSkill === 'string' && this.skills.has(task.requiresSkill)) {
      return this.skills.get(task.requiresSkill) || null;
    }

    // Use LLM to match task intent with available skills
    const skillDescriptions = Array.from(this.skills.values())
      .map(s => `${s.name}: ${s.description}`);

    const prompt = `Which skill best matches this task?

Task: ${task.description}

Available skills:
${skillDescriptions.join('\n')}

Respond with just the skill name, or "none" if no skill matches.`;

    const response = await this.llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a skill matcher. Select the most appropriate skill for the given task.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 50
    });

    const skillName = response.choices[0]?.message.content?.trim().toLowerCase();

    if (skillName && skillName !== 'none') {
      return this.skills.get(skillName) || null;
    }

    return null;
  }

  private async applySkill(
    context: ExecutionContext,
    skill: AgentSkill
  ): Promise<ExecutionContext> {
    const modified = { ...context };

    // 1. Expand prompt with skill instructions
    modified.systemPrompt = `${context.systemPrompt}\n\n${skill.promptExpansion}`;

    // 2. Modify available tools
    if (skill.requiredTools) {
      modified.availableTools = [
        ...new Set([...context.availableTools, ...skill.requiredTools])
      ];
    }

    // 3. Override model if specified
    if (skill.modelOverride) {
      modified.model = skill.modelOverride;
    }

    // 4. Apply context modifications
    for (const mod of skill.contextModifications || []) {
      switch (mod.type) {
        case 'add-instruction':
          if (mod.value) {
            modified.additionalInstructions.push(mod.value);
          }
          break;

        case 'set-parameter':
          if (mod.key && mod.value !== undefined) {
            modified.parameters[mod.key] = mod.value;
          }
          break;

        case 'enable-feature':
          if (mod.feature) {
            modified.features[mod.feature] = true;
          }
          break;
      }
    }

    return modified;
  }

  private getDefaultContext(): ExecutionContext {
    return {
      systemPrompt: 'You are a helpful AI assistant.',
      availableTools: [],
      model: 'default',
      additionalInstructions: [],
      parameters: {},
      features: {}
    };
  }

  /**
   * Register a custom skill
   */
  async registerSkill(skill: AgentSkill): Promise<void> {
    this.skills.set(skill.name, skill);

    // Optionally save to file
    try {
      const skillsDir = './skills';
      await fs.mkdir(skillsDir, { recursive: true });
      const skillPath = path.join(skillsDir, `${skill.name}.json`);
      await fs.writeFile(skillPath, JSON.stringify(skill, null, 2));
    } catch (error) {
      console.warn(`Failed to save skill ${skill.name}:`, error);
    }
  }

  /**
   * List all available skills
   */
  getAvailableSkills(): AgentSkill[] {
    return Array.from(this.skills.values());
  }
}

export default SkillsLayer;