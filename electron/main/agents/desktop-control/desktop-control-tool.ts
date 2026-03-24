/**
 * Desktop Control Tool (LLMSimpleTool)
 *
 * Registers desktop_control_agent as an LLMSimpleTool
 * that the main planning/execution LLM can delegate to.
 * Manages its own VLM calls internally (no llmClient needed).
 *
 * This is an OptionalToolGroup tool — default disabled,
 * requires VL model and manual enable.
 *
 * CLI parity: src/agents/desktop-control/desktop-control-tool.ts (stub)
 */

import type { LLMSimpleTool } from '../../tools/types';
import { findVisionModel } from '../../tools/llm/simple/read-image-tool';
import { runDesktopControl } from './desktop-control-sub-agent';
import { DESKTOP_CONTROL_TOOL_DESCRIPTION } from './prompts';

/**
 * Create the desktop_control_agent tool.
 * Registered as LLMSimpleTool because it calls the VLM directly
 * instead of using the passed llmClient.
 */
export function createDesktopControlTool(): LLMSimpleTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'desktop_control_agent',
        description: DESKTOP_CONTROL_TOOL_DESCRIPTION,
        parameters: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Detailed description of the desktop task to perform. Be specific about what to click, type, or interact with.',
            },
            max_steps: {
              type: 'number',
              description: 'Maximum number of screenshot-analyze-act cycles (default: 30). Increase for complex multi-step tasks.',
            },
          },
          required: ['task'],
        },
      },
    },
    categories: ['llm-simple'],
    async execute(args: Record<string, unknown>) {
      // Validate VL model availability
      const vlModel = findVisionModel();
      if (!vlModel) {
        return {
          success: false,
          error: 'Desktop control requires a Vision Language Model (VL). No VL model is configured. Please go to Settings and select a VL model (e.g., Qwen3-VL, grok-fast-4-1).',
        };
      }

      const task = args['task'] as string;
      if (!task) {
        return { success: false, error: 'task parameter is required' };
      }

      const rawMaxSteps = args['max_steps'] as number | undefined;
      const maxSteps = typeof rawMaxSteps === 'number'
        ? Math.max(1, Math.min(Math.round(rawMaxSteps), 100))
        : 30;

      return runDesktopControl(task, { maxSteps });
    },
  };
}
