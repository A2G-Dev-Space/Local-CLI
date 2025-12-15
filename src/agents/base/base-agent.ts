/**
 * Base Agent
 *
 * Abstract base class for all LLM-powered agents.
 * Provides common interface and utilities.
 */

import { LLMClient } from '../../core/llm/llm-client.js';
import { Message, ToolDefinition } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Agent execution context
 */
export interface AgentContext {
  /** Working directory */
  workingDirectory?: string;
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Result content */
  result?: string;
  /** Error message if failed */
  error?: string;
  /** Execution metadata */
  metadata?: {
    iterations?: number;
    toolCalls?: number;
    duration?: number;
  };
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Maximum iterations for tool loop */
  maxIterations?: number;
  /** LLM temperature */
  temperature?: number;
  /** Maximum tokens for response */
  maxTokens?: number;
}

/**
 * Abstract base class for agents
 */
export abstract class BaseAgent {
  /** Agent name for logging */
  abstract readonly name: string;
  /** Agent description */
  abstract readonly description: string;

  protected llmClient: LLMClient;
  protected config: AgentConfig;

  constructor(llmClient: LLMClient, config?: AgentConfig) {
    this.llmClient = llmClient;
    this.config = {
      maxIterations: config?.maxIterations ?? 10,
      temperature: config?.temperature ?? 0.3,
      maxTokens: config?.maxTokens ?? 4000,
    };
  }

  /**
   * Execute the agent
   */
  abstract execute(input: string, context?: AgentContext): Promise<AgentResult>;

  /**
   * Get tools available to this agent
   */
  protected abstract getTools(): ToolDefinition[];

  /**
   * Build system prompt for this agent
   */
  protected abstract buildSystemPrompt(context?: AgentContext): string;

  /**
   * Run tool loop with LLM
   */
  protected async runToolLoop(
    messages: Message[],
    toolExecutor: (toolName: string, args: Record<string, unknown>) => Promise<string>
  ): Promise<{ success: boolean; result: string; iterations: number }> {
    const tools = this.getTools();
    let iterations = 0;
    let finalResult = '';

    logger.enter(`${this.name}.runToolLoop`);

    while (iterations < this.config.maxIterations!) {
      iterations++;
      logger.flow(`${this.name} iteration ${iterations}`);

      const response = await this.llmClient.chatCompletion({
        messages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No response from LLM');
      }

      messages.push(assistantMessage);

      // Execute tool calls if present
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            logger.warn('Failed to parse tool arguments', { error, arguments: toolCall.function.arguments });
            messages.push({
              role: 'tool',
              content: 'Error: Invalid tool arguments. The arguments must be a valid JSON object.',
              tool_call_id: toolCall.id,
            });
            continue;
          }

          const result = await toolExecutor(toolCall.function.name, args);
          messages.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCall.id,
          });
        }
      } else {
        // No tool call - LLM provided final response
        finalResult = assistantMessage.content || '';
        break;
      }
    }

    logger.exit(`${this.name}.runToolLoop`, { iterations });

    return {
      success: true,
      result: finalResult,
      iterations,
    };
  }
}

export default BaseAgent;
