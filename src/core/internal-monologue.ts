/**
 * Internal Monologue System
 *
 * Implements extended thinking, question decomposition, and self-evaluation
 */

// Simple ID generator instead of using uuid package
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
import {
  Thought,
  Question,
  Evaluation,
  Plan,
  ThinkingSession,
  LoopContext,
} from '../types/index.js';
import { LLMClient } from './llm-client.js';

export interface ThinkingContext {
  task: string;
  context: LoopContext;
  constraints?: string[];
  background?: string;
}

export class InternalMonologue {
  private thinkingMode: 'standard' | 'extended' | 'deep';
  private maxThinkingTokens: number = 4000;
  private llm: LLMClient;

  constructor(llmClient: LLMClient, mode: 'standard' | 'extended' | 'deep' = 'standard') {
    this.llm = llmClient;
    this.thinkingMode = mode;

    // Adjust token limit based on mode
    switch (mode) {
      case 'deep':
        this.maxThinkingTokens = 8000;
        break;
      case 'extended':
        this.maxThinkingTokens = 4000;
        break;
      default:
        this.maxThinkingTokens = 2000;
    }
  }

  /**
   * Main thinking process
   */
  async think(context: ThinkingContext): Promise<ThinkingSession> {
    const session: ThinkingSession = {
      id: generateId(),
      thoughts: [],
      questions: [],
      evaluations: [],
      finalPlan: null,
      duration: 0,
      tokenCount: 0
    };

    const startTime = Date.now();

    try {
      // 1. Initial analysis
      const analysis = await this.analyzeTask(context.task, context.context);
      session.thoughts.push(analysis);

      // 2. Generate questions (Question Decomposition)
      const questions = await this.generateQuestions(analysis, context);
      session.questions = questions;

      // 3. Answer each question in separate context (for faithfulness)
      for (const question of questions) {
        const answer = await this.answerQuestion(
          question,
          context,
          session.thoughts
        );
        session.thoughts.push(answer);
        question.answered = true;
        question.answer = answer.content;
      }

      // 4. Generate approach options
      const options = await this.generateOptions(session.thoughts, context);

      // 5. Evaluate each option
      for (const option of options) {
        const evaluation = await this.evaluateOption(option, context);
        session.evaluations.push(evaluation);
      }

      // 6. Synthesize final plan
      session.finalPlan = await this.synthesizePlan(
        session.thoughts,
        session.evaluations,
        context
      );

      session.duration = Date.now() - startTime;
      session.tokenCount = this.countTokens(session);

      return session;
    } catch (error) {
      console.error('Error in thinking process:', error);
      session.duration = Date.now() - startTime;
      return session;
    }
  }

  /**
   * Analyze the task
   */
  private async analyzeTask(
    task: string,
    context: LoopContext
  ): Promise<Thought> {
    const prompt = `Analyze this task in detail:

Task: ${task}

Context:
- Current TODO: ${context.currentTodo.title}
- Previous attempts: ${context.previousResults.length}
- Iteration: ${context.iteration || 1}

Consider:
1. What exactly needs to be accomplished?
2. What are the key challenges?
3. What resources or tools are available?
4. What constraints exist?

Provide a thorough analysis.`;

    const response = await this.llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are analyzing a task to understand its requirements and challenges.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    return {
      type: 'analysis',
      content: response.choices[0]?.message.content || '',
      confidence: this.assessConfidence(response.choices[0]?.message.content || ''),
      timestamp: Date.now()
    };
  }

  /**
   * Generate questions for decomposition
   */
  private async generateQuestions(
    analysis: Thought,
    context: ThinkingContext
  ): Promise<Question[]> {
    const prompt = `Break down this task into simpler questions that, when answered, will provide a complete solution:

Task: ${context.task}
Analysis: ${analysis.content}

Generate 3-5 specific questions that:
- Address different aspects of the problem
- Are concrete and answerable
- Build towards a complete solution

Format as JSON array:
[{"text": "question", "priority": "high|medium|low"}]`;

    const response = await this.llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are decomposing a complex task into simpler questions.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 500
    });

    return this.parseQuestions(response.choices[0]?.message.content || '');
  }

  /**
   * Parse questions from LLM response
   */
  private parseQuestions(content: string): Question[] {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        // Fallback: create questions from text
        return [{
          id: generateId(),
          text: 'How should we approach this task?',
          priority: 'high',
          answered: false
        }];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((q: any) => ({
        id: generateId(),
        text: q.text || q.question || String(q),
        priority: q.priority || 'medium',
        answered: false
      }));
    } catch (error) {
      console.debug('Failed to parse questions:', error);
      return [{
        id: generateId(),
        text: 'What is the best approach for this task?',
        priority: 'high',
        answered: false
      }];
    }
  }

  /**
   * Answer a question in isolated context
   */
  private async answerQuestion(
    question: Question,
    context: ThinkingContext,
    previousThoughts: Thought[]
  ): Promise<Thought> {
    // Create isolated context for faithfulness
    const isolatedPrompt = `Answer this specific question based on the context:

Question: ${question.text}

Task: ${context.task}
Background: ${context.background || 'None provided'}

Provide a detailed, factual answer focusing only on this question.`;

    const response = await this.llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'Answer the specific question based on the context. Be detailed and accurate.'
        },
        { role: 'user', content: isolatedPrompt }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    const answer = response.choices[0]?.message.content || '';

    return {
      type: 'answer',
      content: answer,
      confidence: this.assessConfidence(answer),
      question: question.id,
      timestamp: Date.now()
    };
  }

  /**
   * Generate approach options
   */
  private async generateOptions(
    thoughts: Thought[],
    context: ThinkingContext
  ): Promise<string[]> {
    const thoughtSummary = thoughts
      .map(t => t.content)
      .join('\n\n');

    const prompt = `Based on the analysis and answers, generate 2-3 different approaches for completing this task:

Task: ${context.task}

Analysis and Answers:
${thoughtSummary.substring(0, 2000)}

Generate distinct approaches with different strategies.
Format as a numbered list.`;

    const response = await this.llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'Generate different approaches for solving the task.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 600
    });

    const content = response.choices[0]?.message.content || '';
    // Extract numbered items
    const options = content.split(/\d+\.\s+/)
      .filter(opt => opt.trim())
      .slice(0, 3);

    return options.length > 0 ? options : ['Direct implementation approach'];
  }

  /**
   * Evaluate an option
   */
  private async evaluateOption(
    option: string,
    context: ThinkingContext
  ): Promise<Evaluation> {
    const prompt = `Evaluate this approach for the task:

Task: ${context.task}
Approach: ${option}

Provide:
1. Score (0-10)
2. Pros (list)
3. Cons (list)
4. Potential risks
5. Recommendation (yes/no)

Format as JSON.`;

    const response = await this.llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'Evaluate the approach objectively.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return this.parseEvaluation(option, response.choices[0]?.message.content || '');
  }

  /**
   * Parse evaluation from LLM response
   */
  private parseEvaluation(option: string, content: string): Evaluation {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          option,
          score: parsed.score || 5,
          pros: Array.isArray(parsed.pros) ? parsed.pros : [parsed.pros || 'Feasible'],
          cons: Array.isArray(parsed.cons) ? parsed.cons : [parsed.cons || 'None identified'],
          risks: Array.isArray(parsed.risks) ? parsed.risks : [parsed.risks || 'Low risk'],
          recommendation: parsed.recommendation === true || parsed.recommendation === 'yes'
        };
      }
    } catch (error) {
      console.debug('Failed to parse evaluation:', error);
    }

    // Default evaluation
    return {
      option,
      score: 5,
      pros: ['Feasible approach'],
      cons: ['Requires implementation'],
      risks: ['Standard implementation risks'],
      recommendation: true
    };
  }

  /**
   * Synthesize final plan
   */
  private async synthesizePlan(
    thoughts: Thought[],
    evaluations: Evaluation[],
    context: ThinkingContext
  ): Promise<Plan> {
    // Select best option
    const bestOption = evaluations.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    const prompt = `Create a detailed implementation plan based on the selected approach:

Task: ${context.task}
Selected Approach: ${bestOption.option}
Evaluation Score: ${bestOption.score}/10

Key Insights from Analysis:
${thoughts.slice(0, 3).map(t => `- ${t.content.substring(0, 200)}`).join('\n')}

Create a step-by-step plan with:
1. Clear, actionable steps
2. Estimated time for completion
3. Alternative approaches if this fails

Format as JSON with structure:
{
  "steps": ["step1", "step2", ...],
  "estimatedTime": minutes,
  "confidence": 0-1,
  "alternatives": ["alt1", "alt2"]
}`;

    const response = await this.llm.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'Create a detailed, actionable implementation plan.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    return this.parsePlan(response.choices[0]?.message.content || '');
  }

  /**
   * Parse plan from LLM response
   */
  private parsePlan(content: string): Plan {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          steps: Array.isArray(parsed.steps) ? parsed.steps : ['Implement solution'],
          estimatedTime: parsed.estimatedTime || 30,
          confidence: parsed.confidence || 0.7,
          alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : []
        };
      }
    } catch (error) {
      console.debug('Failed to parse plan:', error);
    }

    // Default plan
    return {
      steps: ['Analyze requirements', 'Implement solution', 'Test and verify'],
      estimatedTime: 30,
      confidence: 0.5,
      alternatives: []
    };
  }

  /**
   * Assess confidence level
   */
  private assessConfidence(content: string): number {
    const uncertainPhrases = [
      'might', 'maybe', 'possibly', 'could be', 'not sure',
      'unclear', 'depends', 'uncertain', 'approximate'
    ];

    const confidentPhrases = [
      'definitely', 'certainly', 'clearly', 'obviously', 'must',
      'will', 'guaranteed', 'sure', 'exact'
    ];

    const lowerContent = content.toLowerCase();
    let confidence = 0.5;

    // Adjust based on presence of phrases
    for (const phrase of uncertainPhrases) {
      if (lowerContent.includes(phrase)) {
        confidence -= 0.1;
      }
    }

    for (const phrase of confidentPhrases) {
      if (lowerContent.includes(phrase)) {
        confidence += 0.1;
      }
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Count tokens in session (simplified)
   */
  private countTokens(session: ThinkingSession): number {
    let totalChars = 0;

    for (const thought of session.thoughts) {
      totalChars += thought.content.length;
    }

    for (const question of session.questions) {
      totalChars += question.text.length;
      if (question.answer) totalChars += question.answer.length;
    }

    for (const evaluation of session.evaluations) {
      totalChars += evaluation.option.length;
      totalChars += evaluation.pros.join('').length;
      totalChars += evaluation.cons.join('').length;
    }

    if (session.finalPlan) {
      totalChars += session.finalPlan.steps.join('').length;
      totalChars += session.finalPlan.alternatives.join('').length;
    }

    // Rough estimate: 4 chars = 1 token
    return Math.round(totalChars / 4);
  }

  /**
   * Set thinking mode
   */
  setMode(mode: 'standard' | 'extended' | 'deep'): void {
    this.thinkingMode = mode;
    switch (mode) {
      case 'deep':
        this.maxThinkingTokens = 8000;
        break;
      case 'extended':
        this.maxThinkingTokens = 4000;
        break;
      default:
        this.maxThinkingTokens = 2000;
    }
  }
}

export default InternalMonologue;