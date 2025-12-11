/**
 * Planning LLM for Plan-and-Execute Architecture
 *
 * Converts user requests into executable TODO lists
 */

import { LLMClient } from './llm-client.js';
import { Message, TodoItem, PlanningResult, TodoStatus } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Planning LLM
 * Converts user requests into executable TODO lists
 */
export class PlanningLLM {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Convert user request to TODO list
   */
  async generateTODOList(userRequest: string): Promise<PlanningResult> {
    const systemPrompt = `
You are a task planning expert. Analyze user requests and create HIGH-LEVEL TODO items.

## CRITICAL: Create BIG GOAL TODOs with DETAILED Descriptions

**TODO Structure**:
- **title**: Short, high-level goal (e.g., "인증 시스템 구현", "API 엔드포인트 생성")
- **description**: VERY DETAILED execution plan including:
  - Specific files to create/modify
  - Key implementation details
  - Expected outputs
  - Step-by-step approach

## Examples

**BAD (too granular)**:
1. "Express 설치"
2. "라우터 파일 생성"
3. "GET 엔드포인트 추가"
4. "POST 엔드포인트 추가"

**GOOD (big goals, detailed descriptions)**:
1. title: "REST API 서버 구조 생성"
   description: "Express.js 기반 서버 구조를 생성합니다.
   - src/server.ts: 메인 서버 파일 (포트 3000, 미들웨어 설정)
   - src/routes/index.ts: 라우터 진입점
   - src/routes/api.ts: API 라우트 (/api/users, /api/posts)
   - package.json: express, cors, dotenv 의존성 추가
   각 파일은 TypeScript로 작성하고 ESM 모듈 방식 사용"

2. title: "CRUD 엔드포인트 구현"
   description: "사용자 관리 CRUD API를 구현합니다.
   - GET /api/users: 전체 사용자 목록 조회
   - GET /api/users/:id: 특정 사용자 조회
   - POST /api/users: 새 사용자 생성 (body: name, email)
   - PUT /api/users/:id: 사용자 정보 수정
   - DELETE /api/users/:id: 사용자 삭제
   응답 형식: { success: boolean, data: any, error?: string }"

## Rules

1. **Maximum 3-5 TODOs** - Keep goals big
2. **Description must be comprehensive** - Include all details needed for execution
3. **Each TODO = significant milestone** - Not a small step
4. **Sequential order** - List in execution order

## Response Format (JSON)

{
  "todos": [
    {
      "id": "1",
      "title": "High-level goal title (brief)",
      "description": "VERY DETAILED description with:\\n- Specific files and their purposes\\n- Implementation details\\n- Expected behavior\\n- Any configuration needed",
      "requiresDocsSearch": false,
      "dependencies": []
    }
  ],
  "complexity": "moderate"
}

Remember: Few TODOs with rich descriptions > Many small TODOs
`;

    const messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Break down this request into a TODO list:\n\n${userRequest}`,
      },
    ];

    try {
      const response = await this.llmClient.chatCompletion({
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message.content || '';

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Planning LLM did not return valid JSON');
      }

      const planningData = JSON.parse(jsonMatch[0]);

      // Create TodoItem array with proper status
      const todos: TodoItem[] = planningData.todos.map((todo: any, index: number) => ({
        id: todo.id || `todo-${Date.now()}-${index}`,
        title: todo.title,
        description: todo.description,
        status: 'pending' as TodoStatus,
        requiresDocsSearch: todo.requiresDocsSearch || false,
        dependencies: todo.dependencies || [],
      }));

      return {
        todos,
        estimatedTime: planningData.estimatedTime,
        complexity: planningData.complexity || 'moderate',
      };
    } catch (error) {
      logger.error('Planning LLM error:', error as Error);

      // Fallback: Create single TODO for the entire request
      return {
        todos: [
          {
            id: `todo-${Date.now()}`,
            title: 'Execute task',
            description: userRequest,
            status: 'pending',
            requiresDocsSearch: true,
            dependencies: [],
          },
        ],
        complexity: 'simple',
      };
    }
  }

  /**
   * Validate TODO dependencies
   */
  validateDependencies(todos: TodoItem[]): boolean {
    const todoIds = new Set(todos.map(t => t.id));

    for (const todo of todos) {
      for (const depId of todo.dependencies) {
        if (!todoIds.has(depId)) {
          logger.warn(`Invalid dependency: TODO ${todo.id} depends on non-existent TODO ${depId}`);
          return false;
        }
      }
    }

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (todoId: string): boolean => {
      visited.add(todoId);
      recursionStack.add(todoId);

      const todo = todos.find(t => t.id === todoId);
      if (todo) {
        for (const depId of todo.dependencies) {
          if (!visited.has(depId) && hasCycle(depId)) {
            return true;
          } else if (recursionStack.has(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(todoId);
      return false;
    };

    for (const todo of todos) {
      if (!visited.has(todo.id) && hasCycle(todo.id)) {
        logger.warn('Circular dependency detected in TODOs');
        return false;
      }
    }

    return true;
  }

  /**
   * Sort TODOs based on dependencies (topological sort)
   */
  sortByDependencies(todos: TodoItem[]): TodoItem[] {
    const sorted: TodoItem[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (todo: TodoItem) => {
      if (visited.has(todo.id)) return;
      if (visiting.has(todo.id)) {
        throw new Error('Circular dependency detected');
      }

      visiting.add(todo.id);

      // Visit dependencies first
      for (const depId of todo.dependencies) {
        const dep = todos.find(t => t.id === depId);
        if (dep) {
          visit(dep);
        }
      }

      visiting.delete(todo.id);
      visited.add(todo.id);
      sorted.push(todo);
    };

    for (const todo of todos) {
      if (!visited.has(todo.id)) {
        visit(todo);
      }
    }

    return sorted;
  }
}

export default PlanningLLM;