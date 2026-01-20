/**
 * User Interaction Tools - Barrel Export
 *
 * User interaction tools for Electron Agent
 * Total: 2 tools (tell_to_user, ask_to_user)
 */

import type { ToolDefinition } from '../../../llm-client';
import type { LLMSimpleTool, ToolResult } from '../common/types';
import { CORE_CATEGORIES } from '../common/constants';

// =============================================================================
// Types
// =============================================================================

export interface AskUserRequest {
  question: string;
  options: string[];
}

export interface AskUserResponse {
  selectedOption: string;
  isOther: boolean;
  customText?: string;
}

export type TellToUserCallback = (message: string) => void;
export type AskUserCallback = (request: AskUserRequest) => Promise<AskUserResponse>;

// Global callbacks - set by agent
let tellToUserCallback: TellToUserCallback | null = null;
let askUserCallback: AskUserCallback | null = null;

export function setTellToUserCallback(callback: TellToUserCallback | null): void {
  tellToUserCallback = callback;
}

export function setAskUserCallback(callback: AskUserCallback | null): void {
  askUserCallback = callback;
}

export function getTellToUserCallback(): TellToUserCallback | null {
  return tellToUserCallback;
}

export function getAskUserCallback(): AskUserCallback | null {
  return askUserCallback;
}

// =============================================================================
// tell_to_user Tool
// =============================================================================

const TELL_TO_USER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'tell_to_user',
    description: `Send a message directly to the user to explain what you're doing or provide status updates.
Use this tool to communicate with the user during task execution.
The message will be displayed immediately in the UI.`,
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: `A natural, conversational message for the user.
Examples:
- "Analyzing the files, please wait a moment"
- "Found the config file! Let me modify it now"
- "Ran the tests and 2 failed. Let me find the cause"
- "Almost done, wrapping up the work"`,
        },
      },
      required: ['message'],
    },
  },
};

async function executeTellToUser(args: Record<string, unknown>): Promise<ToolResult> {
  const message = args['message'] as string;

  if (!message || typeof message !== 'string') {
    return { success: false, error: 'message is required and must be a string' };
  }

  if (tellToUserCallback) {
    tellToUserCallback(message);
  }

  return { success: true, result: `Message sent to user: ${message}` };
}

export const tellToUserTool: LLMSimpleTool = {
  definition: TELL_TO_USER_DEFINITION,
  execute: executeTellToUser,
  categories: CORE_CATEGORIES,
  description: 'Send message to user',
};

// =============================================================================
// ask_to_user Tool
// =============================================================================

const ASK_TO_USER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'ask_to_user',
    description: `Ask the user a question with multiple choice options.

Use this tool when you need to:
- Clarify ambiguous requirements
- Get user preferences or decisions
- Confirm important actions before proceeding
- Offer multiple implementation approaches

The user will always have an "Other (custom input)" option to provide custom input,
so you only need to provide the main choices.

RULES:
- Provide 2-4 clear, distinct options
- Each option should be a viable choice
- Keep the question concise and specific`,
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user. Should be clear and specific.',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of main options for the user to choose from. Provide 2-4 options.',
          minItems: 2,
          maxItems: 4,
        },
      },
      required: ['question', 'options'],
    },
  },
};

async function executeAskToUser(args: Record<string, unknown>): Promise<ToolResult> {
  const question = args['question'] as string;
  const options = args['options'] as string[];

  // Validate inputs
  if (!question || typeof question !== 'string') {
    return { success: false, error: 'Invalid question: must be a non-empty string' };
  }

  if (!Array.isArray(options) || options.length < 2) {
    return { success: false, error: 'Invalid options: must be an array with at least 2 items' };
  }

  if (options.length > 4) {
    return { success: false, error: 'Too many options: maximum 4 options allowed' };
  }

  if (!askUserCallback) {
    return { success: false, error: 'User interaction is not available in current context' };
  }

  try {
    const response = await askUserCallback({ question, options });

    const resultText =
      response.isOther && response.customText
        ? `User provided custom response: "${response.customText}"`
        : `User selected: "${response.selectedOption}"`;

    return {
      success: true,
      result: resultText,
      metadata: {
        question,
        selectedOption: response.selectedOption,
        isOther: response.isOther,
        customText: response.customText,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error asking user: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export const askToUserTool: LLMSimpleTool = {
  definition: ASK_TO_USER_DEFINITION,
  execute: executeAskToUser,
  categories: CORE_CATEGORIES,
  description: 'Ask user a question with options',
};

// =============================================================================
// Export All User Tools
// =============================================================================

export const USER_TOOLS: LLMSimpleTool[] = [
  tellToUserTool,
  askToUserTool,
];
