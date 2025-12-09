/**
 * Session 관리 테스트 시나리오
 * - 세션 저장
 * - 세션 로드
 * - 세션 목록 조회
 */

import { TestScenario } from '../types.js';

const TEST_SESSION_ID = `test-session-${Date.now()}`;

export const sessionScenarios: TestScenario[] = [
  {
    id: 'session-save',
    name: '세션 저장 테스트',
    description: '세션을 저장할 수 있는지 테스트합니다.',
    category: 'session',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: '세션 저장',
        action: { type: 'session_save', sessionId: TEST_SESSION_ID },
        validation: { type: 'equals', value: TEST_SESSION_ID },
      },
    ],
  },

  {
    id: 'session-load',
    name: '세션 로드 테스트',
    description: '저장된 세션을 로드할 수 있는지 테스트합니다.',
    category: 'session',
    enabled: true,
    timeout: 30000,
    setup: async () => {
      // 먼저 세션을 저장
      const { sessionManager } = await import('../../../src/core/session-manager.js');
      await sessionManager.saveSession(TEST_SESSION_ID + '-load', {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        todos: [],
      });
    },
    steps: [
      {
        name: '세션 로드',
        action: { type: 'session_load', sessionId: TEST_SESSION_ID + '-load' },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return (
              result !== null &&
              Array.isArray(result.messages) &&
              result.messages.length > 0
            );
          },
        },
      },
    ],
  },

  {
    id: 'session-list',
    name: '세션 목록 조회 테스트',
    description: '저장된 세션 목록을 조회할 수 있는지 테스트합니다.',
    category: 'session',
    enabled: true,
    timeout: 30000,
    setup: async () => {
      // 테스트용 세션 몇 개 생성
      const { sessionManager } = await import('../../../src/core/session-manager.js');
      await sessionManager.saveSession(`${TEST_SESSION_ID}-list-1`, {
        messages: [{ role: 'user', content: 'Test 1' }],
        todos: [],
      });
      await sessionManager.saveSession(`${TEST_SESSION_ID}-list-2`, {
        messages: [{ role: 'user', content: 'Test 2' }],
        todos: [],
      });
    },
    steps: [
      {
        name: '세션 목록 조회',
        action: { type: 'session_list' },
        validation: { type: 'is_array', minLength: 1 },
      },
    ],
  },

  {
    id: 'session-persistence',
    name: '세션 영속성 테스트',
    description: '세션 저장 후 로드했을 때 데이터가 유지되는지 테스트합니다.',
    category: 'session',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: '세션 저장 (메시지 포함)',
        action: {
          type: 'custom',
          fn: async () => {
            const { sessionManager } = await import('../../../src/core/session-manager.js');
            const sessionId = `${TEST_SESSION_ID}-persist`;
            await sessionManager.saveSession(sessionId, {
              messages: [
                { role: 'user', content: 'Persistence test message' },
                { role: 'assistant', content: 'Response message' },
              ],
              todos: [
                {
                  id: 'todo-1',
                  title: 'Test TODO',
                  description: 'Test description',
                  status: 'completed',
                  requiresDocsSearch: false,
                  dependencies: [],
                },
              ],
            });
            return sessionId;
          },
        },
        validation: { type: 'not_empty' },
      },
      {
        name: '세션 로드 및 데이터 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { sessionManager } = await import('../../../src/core/session-manager.js');
            const session = await sessionManager.loadSession(`${TEST_SESSION_ID}-persist`);
            return session;
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return (
              result !== null &&
              result.messages?.length === 2 &&
              result.messages[0].content === 'Persistence test message' &&
              result.todos?.length === 1 &&
              result.todos[0].title === 'Test TODO'
            );
          },
        },
      },
    ],
  },
];
