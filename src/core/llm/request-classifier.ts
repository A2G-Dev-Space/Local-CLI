/**
 * Request Classifier
 *
 * LLM을 사용하여 사용자 요청을 분류합니다:
 * - simple_response: TODO 없이 바로 응답
 * - requires_todo: TODO 리스트 생성 필요
 */

import { LLMClient } from './llm-client.js';
import { Message } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

/**
 * 요청 분류 결과
 */
export type RequestType = 'simple_response' | 'requires_todo';

export interface ClassificationResult {
  type: RequestType;
  confidence: number;
  reasoning: string;
}

/**
 * Request Classifier
 * 사용자 요청을 분류하여 적절한 처리 방식을 결정
 */
export class RequestClassifier {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    logger.enter('RequestClassifier.constructor');
    this.llmClient = llmClient;
    logger.exit('RequestClassifier.constructor');
  }

  /**
   * 사용자 요청 분류
   */
  async classify(userRequest: string): Promise<ClassificationResult> {
    logger.enter('RequestClassifier.classify', { requestLength: userRequest.length });
    logger.startTimer('request-classification');

    const systemPrompt = `You are a request classifier. Analyze user requests and classify them.

**Classification Rules**:

1. **simple_response** - Use when:
   - Simple questions (what, how, why, explain)
   - Information lookup requests
   - Concept explanations
   - Short code snippets or examples
   - Conversations or greetings
   - Requests that can be answered in ONE response with 3 or fewer tool calls

2. **requires_todo** - Use when:
   - Create, build, implement, develop, make something
   - Multi-step tasks
   - File operations (create, edit, delete files)
   - Project setup or configuration
   - Code refactoring or optimization
   - Bug fixing that requires multiple changes
   - Tasks that need planning and execution
   - **IMPORTANT: If the task likely requires MORE than 3 tool calls or responses, use requires_todo**

**Quick Decision Guide**:
- Can this be done in ≤3 tool calls? → simple_response
- Will this need 4+ tool calls or multiple steps? → requires_todo
- When in doubt, prefer requires_todo for better task tracking

**Response Format** (JSON only):
{
  "type": "simple_response" | "requires_todo",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Respond with JSON only, no other text.`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
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
