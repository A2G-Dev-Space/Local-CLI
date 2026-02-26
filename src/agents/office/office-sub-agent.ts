/**
 * Office Sub-Agent
 *
 * 기존 Execution LLM과 동일한 iteration 루프로 동작하는 Office 전문 에이전트.
 * 각 앱(Word/Excel/PowerPoint)의 tools + complete tool만 가진 Execution LLM.
 */

import { LLMClient } from '../../core/llm/llm-client.js';
import { Message, ToolDefinition } from '../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../tools/types.js';
import { COMPLETE_TOOL_DEFINITION } from './complete-tool.js';
import { logger } from '../../utils/logger.js';

export interface OfficeSubAgentConfig {
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
}

export class OfficeSubAgent {
  private llmClient: LLMClient;
  private appName: string;
  private tools: LLMSimpleTool[];
  private toolMap: Map<string, LLMSimpleTool>;
  private systemPrompt: string;
  private maxIterations: number;
  private temperature: number;
  private maxTokens: number;

  constructor(
    llmClient: LLMClient,
    appName: string,
    tools: LLMSimpleTool[],
    systemPrompt: string,
    config?: OfficeSubAgentConfig
  ) {
    this.llmClient = llmClient;
    this.appName = appName;
    this.tools = tools;
    this.systemPrompt = systemPrompt;
    this.maxIterations = config?.maxIterations ?? 15;
    this.temperature = config?.temperature ?? 0.3;
    this.maxTokens = config?.maxTokens ?? 4000;

    // Build tool lookup map for fast access
    this.toolMap = new Map();
    for (const tool of tools) {
      this.toolMap.set(tool.definition.function.name, tool);
    }
  }

  /**
   * Run the sub-agent with the given instruction.
   * Same iteration pattern as the main Execution LLM.
   */
  async run(instruction: string): Promise<ToolResult> {
    const startTime = Date.now();
    let iterations = 0;
    let totalToolCalls = 0;

    logger.enter(`OfficeSubAgent[${this.appName}].run`);
    logger.info(`Sub-agent starting`, {
      appName: this.appName,
      toolCount: this.tools.length,
      instruction: instruction.slice(0, 100),
    });

    // Build tool definitions: app tools + complete tool
    const toolDefinitions: ToolDefinition[] = [
      ...this.tools.map((t) => t.definition),
      COMPLETE_TOOL_DEFINITION,
    ];

    // Initialize messages
    const messages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: instruction },
    ];

    // Execution iteration loop (same pattern as main Execution LLM)
    while (iterations < this.maxIterations) {
      iterations++;
      logger.flow(`OfficeSubAgent[${this.appName}] iteration ${iterations}`);

      const response = await this.llmClient.chatCompletion({
        messages,
        tools: toolDefinitions,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        return this.buildResult(false, undefined, 'No response from Sub-LLM', iterations, totalToolCalls, startTime);
      }

      messages.push(assistantMessage);

      // No tool calls = text response = done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        const content = assistantMessage.content || '';
        logger.flow(`OfficeSubAgent[${this.appName}] completed with text response`);
        return this.buildResult(true, content, undefined, iterations, totalToolCalls, startTime);
      }

      // Process tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let args: Record<string, unknown>;

        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          messages.push({
            role: 'tool',
            content: 'Error: Invalid JSON in tool arguments.',
            tool_call_id: toolCall.id,
          });
          continue;
        }

        // Handle complete tool
        if (toolName === 'complete') {
          const summary = (args['summary'] as string) || 'Task completed.';
          logger.flow(`OfficeSubAgent[${this.appName}] completed via complete tool`);
          return this.buildResult(true, summary, undefined, iterations, totalToolCalls, startTime);
        }

        // Execute app tool
        const tool = this.toolMap.get(toolName);
        if (!tool) {
          messages.push({
            role: 'tool',
            content: `Error: Unknown tool "${toolName}". Use only the provided tools.`,
            tool_call_id: toolCall.id,
          });
          continue;
        }

        totalToolCalls++;
        logger.info(`OfficeSubAgent[${this.appName}] executing tool`, { toolName, iteration: iterations });

        try {
          const result = await tool.execute(args);
          const resultText = result.success
            ? result.result || '(success, no output)'
            : `Error: ${result.error || 'Unknown error'}`;

          messages.push({
            role: 'tool',
            content: resultText,
            tool_call_id: toolCall.id,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          messages.push({
            role: 'tool',
            content: `Error executing ${toolName}: ${errorMsg}`,
            tool_call_id: toolCall.id,
          });
        }
      }
    }

    // Max iterations exceeded
    logger.warn(`OfficeSubAgent[${this.appName}] max iterations reached`, { maxIterations: this.maxIterations });
    return this.buildResult(
      true,
      `Sub-agent completed after ${this.maxIterations} iterations. ${totalToolCalls} tool calls executed.`,
      undefined,
      iterations,
      totalToolCalls,
      startTime
    );
  }

  private buildResult(
    success: boolean,
    result: string | undefined,
    error: string | undefined,
    iterations: number,
    toolCalls: number,
    startTime: number
  ): ToolResult {
    const duration = Date.now() - startTime;
    logger.exit(`OfficeSubAgent[${this.appName}].run`, { success, iterations, toolCalls, duration });
    return {
      success,
      result,
      error,
      metadata: { iterations, toolCalls, duration },
    };
  }
}
