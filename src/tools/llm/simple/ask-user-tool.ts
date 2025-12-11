/**
 * Ask-to-User LLM Tool
 *
 * LLM이 사용자에게 질문하고 응답을 받을 수 있는 도구
 * Phase 2: 승인 모드 / 자율 모드의 핵심 구성요소
 */

import { LLMSimpleTool, ToolResult, ToolCategory } from '../../types.js';
import { ToolDefinition } from '../../../types/index.js';
import { logger } from '../../../utils/logger.js';

/**
 * 사용자 질문 요청
 * - options: LLM이 제공하는 2-4개의 선택지
 * - "Other (직접 입력)" 옵션은 UI에서 자동 추가됨
 */
export interface AskUserRequest {
  question: string;
  options: string[];  // 2-4개의 선택지 (LLM이 결정)
}

/**
 * 사용자 응답
 */
export interface AskUserResponse {
  selectedOption: string;
  isOther: boolean;
  customText?: string;
}

/**
 * 사용자 질문 콜백 타입
 */
export type AskUserCallback = (request: AskUserRequest) => Promise<AskUserResponse>;

// Global callback - set by UI component
let askUserCallback: AskUserCallback | null = null;

/**
 * Set the ask-user callback
 */
export function setAskUserCallback(callback: AskUserCallback): void {
  logger.flow('Setting ask-user callback');
  askUserCallback = callback;
}

/**
 * Clear ask-user callback
 */
export function clearAskUserCallback(): void {
  logger.flow('Clearing ask-user callback');
  askUserCallback = null;
}

/**
 * Check if ask-user callback is available
 */
export function hasAskUserCallback(): boolean {
  return askUserCallback !== null;
}

/**
 * ask-to-user Tool Definition
 *
 * LLM이 결정해야 할 것:
 * - 질문 내용
 * - 선택지 개수 (최소 2개, 최대 4개)
 * - 각 선택지의 내용
 *
 * 사용자에게 표시되는 형태:
 * - LLM이 제공한 선택지들
 * - + "Other (직접 입력)" 옵션 (항상 표시)
 */
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

The user will always have an "Other (직접 입력)" option to provide custom input,
so you only need to provide the main choices.

RULES:
- Provide 2-4 clear, distinct options
- Each option should be a viable choice
- Keep the question concise and specific
- "Other" option is automatically added for custom input`,
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
          description: 'List of main options for the user to choose from. Provide 2-4 options. An "Other" option for custom input is automatically added.',
          minItems: 2,
          maxItems: 4,
        },
      },
      required: ['question', 'options'],
    },
  },
};

/**
 * ask-to-user Tool Implementation
 */
async function executeAskToUser(args: Record<string, unknown>): Promise<ToolResult> {
  logger.enter('executeAskToUser', args);

  const question = args['question'] as string;
  const options = args['options'] as string[];
  const allowOther = true; // Always allow "Other" option

  // Validate inputs
  if (!question || typeof question !== 'string') {
    logger.warn('Invalid question parameter');
    return {
      success: false,
      error: 'Invalid question: must be a non-empty string',
    };
  }

  if (!Array.isArray(options) || options.length < 2) {
    logger.warn('Invalid options parameter', { optionsLength: options?.length });
    return {
      success: false,
      error: 'Invalid options: must be an array with at least 2 items',
    };
  }

  if (options.length > 4) {
    logger.warn('Too many options', { optionsLength: options.length });
    return {
      success: false,
      error: 'Too many options: maximum 4 options allowed',
    };
  }

  if (!askUserCallback) {
    logger.warn('Ask-user callback not set');
    return {
      success: false,
      error: 'User interaction is not available in current context',
    };
  }

  try {
    logger.flow('Asking user question');
    logger.vars(
      { name: 'question', value: question },
      { name: 'optionCount', value: options.length },
      { name: 'allowOther', value: allowOther }
    );

    const response = await askUserCallback({
      question,
      options,
    });

    logger.debug('User responded', { selectedOption: response.selectedOption, isOther: response.isOther });

    const resultText = response.isOther && response.customText
      ? `User provided custom response: "${response.customText}"`
      : `User selected: "${response.selectedOption}"`;

    logger.exit('executeAskToUser', { success: true });
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
    logger.error('Error asking user', error as Error);
    return {
      success: false,
      error: `Error asking user: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * LLM Simple Tool: ask_to_user
 */
export const AskToUserTool: LLMSimpleTool = {
  definition: ASK_TO_USER_DEFINITION,
  execute: executeAskToUser,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'Ask user a question with options',
};

/**
 * Get ask-to-user tool definition
 */
export function getAskToUserToolDefinition(): ToolDefinition {
  return ASK_TO_USER_DEFINITION;
}

export default AskToUserTool;
