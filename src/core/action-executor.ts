/**
 * Action Executor for Agent Loop
 *
 * Generates action plans from context and executes them safely
 */

import { LLMClient } from './llm-client.js';
import {
  LoopContext,
  ExecutionResult,
  ActionPlan,
  Message,
  ToolDefinition,
} from '../types/index.js';
import { FILE_TOOLS, executeFileTool } from '../tools/file-tools.js';
import { executeBashCommand } from './bash-command-tool.js';
import { logger } from '../utils/logger.js';

export interface ActionValidation {
  safe: boolean;
  reason?: string;
  warnings?: string[];
}

export class ActionExecutor {
  constructor(
    private llmClient: LLMClient,
    private availableTools: ToolDefinition[] = FILE_TOOLS
  ) {}

  /**
   * Execute an action based on the current context
   */
  async execute(
    context: LoopContext,
    messages: Message[]
  ): Promise<ExecutionResult> {
    try {
      // 1. Generate action plan based on context
      const actionPlan = await this.generateActionPlan(context, messages);

      // 2. Validate action safety
      const validation = await this.validateAction(actionPlan);
      if (!validation.safe) {
        return {
          action: actionPlan.description,
          success: false,
          output: null,
          error: new Error(`Action blocked: ${validation.reason}`),
          timestamp: new Date().toISOString(),
        };
      }

      // Log warnings if any
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('⚠️ Action warnings:', validation.warnings.join(', '));
      }

      // 3. Execute the action
      const result = await this.executeAction(actionPlan);

      return {
        action: actionPlan.description,
        toolName: actionPlan.toolName,
        output: result,
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        action: 'Failed to generate or execute action',
        success: false,
        output: null,
        error: error as Error,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate an action plan using LLM based on context
   */
  private async generateActionPlan(
    context: LoopContext,
    messages: Message[]
  ): Promise<ActionPlan> {
    const systemPrompt = this.buildActionSystemPrompt(context);

    // Build user prompt with context
    let userPrompt = `Based on the context and any previous feedback, what specific action should be taken next?\n\n`;
    userPrompt += `Current TODO: ${context.currentTodo.title}\n`;
    userPrompt += `Description: ${context.currentTodo.description}\n`;
    userPrompt += `Iteration: ${context.iteration || 0}\n`;

    if (context.feedback.length > 0) {
      userPrompt += `\nPrevious feedback:\n`;
      context.feedback.forEach(f => {
        userPrompt += `- [${f.passed ? 'PASS' : 'FAIL'}] ${f.rule}: ${f.message}\n`;
      });
    }

    if (context.failureAnalysis) {
      userPrompt += `\nFailure analysis:\n`;
      if (context.failureAnalysis.rootCause) {
        userPrompt += `Root cause: ${context.failureAnalysis.rootCause}\n`;
      }
      if (context.failureAnalysis.suggestedFixes.length > 0) {
        userPrompt += `Suggested fixes: ${context.failureAnalysis.suggestedFixes.join(', ')}\n`;
      }
    }

    userPrompt += `\nFile system context:\n`;
    if (context.fileSystemContext.currentDirectory) {
      userPrompt += `Current directory files:\n${context.fileSystemContext.currentDirectory}\n`;
    }
    if (context.fileSystemContext.relevantFiles && context.fileSystemContext.relevantFiles.length > 0) {
      userPrompt += `Relevant files: ${context.fileSystemContext.relevantFiles.join(', ')}\n`;
    }

    userPrompt += `\nProvide your action plan in JSON format:
{
  "description": "Clear description of what you will do",
  "toolName": "name of tool to use (if applicable)",
  "parameters": { /* tool parameters */ },
  "reasoning": "Why this action will help complete the TODO"
}`;

    const response = await this.llmClient.chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-5), // Include last 5 messages for context
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more focused actions
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message.content || '';
    return this.parseActionPlan(content);
  }

  /**
   * Build system prompt for action generation
   */
  private buildActionSystemPrompt(context: LoopContext): string {
    let prompt = `You are an expert software engineer executing tasks systematically.

Your goal is to complete the current TODO by taking specific, executable actions.
Each action should be concrete and verifiable.

Available tools:
`;

    // List available tools
    this.availableTools.forEach(tool => {
      prompt += `- ${tool.function.name}: ${tool.function.description}\n`;
    });

    prompt += `
Rules:
1. Take ONE specific action at a time
2. Use tools when appropriate for file operations
3. Learn from previous feedback to avoid repeating mistakes
4. Focus on completing the TODO requirements
5. If stuck after multiple failures, try a different approach
`;

    if (context.projectConfig) {
      prompt += `\nProject Configuration:\n`;
      prompt += `Name: ${context.projectConfig.name || 'Unknown'}\n`;
      if (context.projectConfig.rules && context.projectConfig.rules.length > 0) {
        prompt += `Rules: ${context.projectConfig.rules.join(', ')}\n`;
      }
      if (context.projectConfig.testCommand) {
        prompt += `Test command: ${context.projectConfig.testCommand}\n`;
      }
      if (context.projectConfig.buildCommand) {
        prompt += `Build command: ${context.projectConfig.buildCommand}\n`;
      }
    }

    return prompt;
  }

  /**
   * Parse action plan from LLM response
   */
  private parseActionPlan(content: string): ActionPlan {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          description: parsed.description || 'Execute action',
          toolName: parsed.toolName,
          parameters: parsed.parameters || {},
          reasoning: parsed.reasoning,
        };
      }
    } catch (error) {
      console.debug('Failed to parse action plan JSON:', error);
    }

    // Fallback: Create action plan from text
    return {
      description: content.slice(0, 200),
      reasoning: 'Unable to parse structured action plan',
    };
  }

  /**
   * Validate if an action is safe to execute
   */
  private async validateAction(actionPlan: ActionPlan): Promise<ActionValidation> {
    const warnings: string[] = [];

    // Check for dangerous operations
    const dangerousPatterns = [
      { pattern: /rm\s+-rf\s+\//i, reason: 'Attempting to delete root directory' },
      { pattern: /:(){ :|:& };:/i, reason: 'Fork bomb detected' },
      { pattern: /dd\s+if=.*of=\/dev\/sd/i, reason: 'Direct disk write operation' },
      { pattern: /chmod\s+777\s+\//i, reason: 'Attempting to make root world-writable' },
    ];

    const actionStr = JSON.stringify(actionPlan);
    for (const dangerous of dangerousPatterns) {
      if (dangerous.pattern.test(actionStr)) {
        return {
          safe: false,
          reason: dangerous.reason,
        };
      }
    }

    // Check for potentially risky operations
    if (actionPlan.toolName === 'write_file') {
      const path = actionPlan.parameters?.['file_path'];
      if (path && typeof path === 'string' && (path.startsWith('/etc/') || path.startsWith('/sys/'))) {
        warnings.push('Writing to system directory');
      }
    }

    // Validate tool exists if specified
    if (actionPlan.toolName) {
      const toolExists = this.availableTools.some(
        t => t.function.name === actionPlan.toolName
      );
      if (!toolExists) {
        return {
          safe: false,
          reason: `Unknown tool: ${actionPlan.toolName}`,
        };
      }
    }

    return {
      safe: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Execute the validated action plan
   */
  private async executeAction(actionPlan: ActionPlan): Promise<any> {
    // If a specific tool is specified, use it
    if (actionPlan.toolName) {
      // Check if it's a file tool
      const fileToolNames = ['read_file', 'write_file', 'list_files', 'find_files'];
      if (fileToolNames.includes(actionPlan.toolName)) {
        const result = await executeFileTool(actionPlan.toolName, actionPlan.parameters || {});
        if (result.success) {
          return result.result;
        } else {
          throw new Error(result.error);
        }
      }

      // Check if it's a bash command
      if (actionPlan.toolName === 'bash' || actionPlan.toolName === 'run_bash') {
        const command = actionPlan.parameters?.['command'];
        if (command && typeof command === 'string') {
          const result = await executeBashCommand(command);

          // Log formatted display if available
          if (result.formattedDisplay) {
            logger.bashExecution(result.formattedDisplay);
          }

          if (result.success) {
            return result.result;
          } else {
            throw new Error(result.error);
          }
        }
      }

      throw new Error(`Tool execution not implemented: ${actionPlan.toolName}`);
    }

    // If no tool specified, return the action description as a placeholder
    return {
      message: 'Action executed (no tool specified)',
      description: actionPlan.description,
      reasoning: actionPlan.reasoning,
    };
  }
}

export default ActionExecutor;