/**
 * Request Classifier
 *
 * Classifies user requests into:
 * - simple_response: Direct response without TODO
 * - requires_todo: Requires TODO list generation
 */

import { LLMClient } from './llm-client.js';
import { Message } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { CLASSIFIER_SYSTEM_PROMPT } from '../../prompts/agents/classifier.js';

/**
 * Classification result type
 */
export type RequestType = 'simple_response' | 'requires_todo';

export interface ClassificationResult {
  type: RequestType;
  confidence: number;
  reasoning: string;
}

/**
 * Request Classifier
 * Classifies user requests to determine appropriate handling method
 */
export class RequestClassifier {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    logger.enter('RequestClassifier.constructor');
    this.llmClient = llmClient;
    logger.exit('RequestClassifier.constructor');
  }

  /**
   * Classify user request
   */
  async classify(userRequest: string): Promise<ClassificationResult> {
    logger.enter('RequestClassifier.classify', { requestLength: userRequest.length });
    logger.startTimer('request-classification');

    const messages: Message[] = [
      { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
      { role: 'user', content: `Classify this request:\n\n${userRequest}` },
    ];

    try {
      const response = await this.llmClient.chatCompletion({
        messages,
        temperature: 0.1,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message.content || '';
      logger.vars({ name: 'llmResponse', value: content.substring(0, 100) });

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('Classification response is not JSON, using fallback');
        return this.fallbackClassification(userRequest);
      }

      const result = JSON.parse(jsonMatch[0]) as ClassificationResult;

      // Validate result
      if (!['simple_response', 'requires_todo'].includes(result.type)) {
        logger.warn('Invalid classification type, using fallback');
        return this.fallbackClassification(userRequest);
      }

      logger.state('Classification result', 'unknown', result.type);
      logger.vars(
        { name: 'type', value: result.type },
        { name: 'confidence', value: result.confidence },
        { name: 'reasoning', value: result.reasoning }
      );
      logger.endTimer('request-classification');
      logger.exit('RequestClassifier.classify', result);

      return result;
    } catch (error) {
      logger.error('Classification failed', error as Error);
      logger.endTimer('request-classification');
      return this.fallbackClassification(userRequest);
    }
  }

  /**
   * Fallback classification using keyword matching
   */
  private fallbackClassification(userRequest: string): ClassificationResult {
    logger.flow('Using fallback keyword-based classification');

    const todoKeywords = [
      'create', 'build', 'implement', 'develop', 'make',
      'setup', 'configure', 'install', 'deploy', 'design',
      'refactor', 'optimize', 'debug', 'fix', 'test',
      'write', 'generate', 'add', 'update', 'modify',
      'delete', 'remove', 'change', 'convert', 'migrate',
      '만들', '생성', '구현', '개발', '설정', '수정', '삭제', '변환',
    ];

    const simpleKeywords = [
      'what', 'how', 'why', 'explain', 'describe', 'tell',
      'show', 'list', 'find', 'search', 'help',
      '뭐', '무엇', '어떻게', '왜', '설명', '알려', '도움',
    ];

    const lowerRequest = userRequest.toLowerCase();

    const hasTodoKeyword = todoKeywords.some(k => lowerRequest.includes(k));
    const hasSimpleKeyword = simpleKeywords.some(k => lowerRequest.includes(k));

    let type: RequestType;
    let confidence: number;

    if (hasTodoKeyword && !hasSimpleKeyword) {
      type = 'requires_todo';
      confidence = 0.7;
    } else if (hasSimpleKeyword && !hasTodoKeyword) {
      type = 'simple_response';
      confidence = 0.7;
    } else if (hasTodoKeyword && hasSimpleKeyword) {
      // Both keywords present, prefer todo for action-oriented requests
      type = 'requires_todo';
      confidence = 0.5;
    } else {
      // Default to simple response for short requests
      type = userRequest.length < 50 ? 'simple_response' : 'requires_todo';
      confidence = 0.4;
    }

    const result: ClassificationResult = {
      type,
      confidence,
      reasoning: 'Fallback keyword-based classification',
    };

    logger.vars(
      { name: 'type', value: type },
      { name: 'confidence', value: confidence }
    );

    return result;
  }
}

export default RequestClassifier;
