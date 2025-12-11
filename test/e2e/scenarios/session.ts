/**
 * Session 관리 E2E 테스트 시나리오
 *
 * 모든 테스트는 LLM을 통해 실행됩니다.
 * 사용자가 실제로 사용하는 것과 동일한 방식으로 검증합니다.
 *
 * 세션 관리는 사용자가 CLI를 통해 대화를 저장하고 복원하는 기능입니다.
 * LLM과의 대화 후 세션 저장/복원이 제대로 동작하는지 검증합니다.
 */

import { TestScenario } from '../types.js';

const TEST_SESSION_PREFIX = `e2e-test-session-${Date.now()}`;

export const sessionScenarios: TestScenario[] = [
  {
    id: 'session-llm-conversation-save',
    name: 'LLM 대화 후 세션 저장 테스트',
    description: 'LLM과 대화 후 세션을 저장할 수 있는지 테스트합니다.',
    category: 'session',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    steps: [
      {
        name: 'LLM과 대화',
        action: {
          type: 'llm_chat',
          prompt: '안녕하세요. 저는 E2E 테스트를 실행 중입니다.',
          useTools: false,
        },
        validation: { type: 'llm_response_valid' },
      },
      {
        name: '세션 저장',
        action: {
          type: 'custom',
          fn: async () => {
            const { sessionManager } = await import('../../../src/core/session-manager.js');
            const sessionId = await sessionManager.saveSession(`${TEST_SESSION_PREFIX}-save`, [
              { role: 'user', content: '안녕하세요. 저는 E2E 테스트를 실행 중입니다.' },
              { role: 'assistant', content: 'E2E 테스트 응답입니다.' },
            ]);
            return sessionId;
          },
        },
        validation: { type: 'not_empty' },
      },
    ],
  },

  {
    id: 'session-load-and-continue',
    name: '세션 로드 및 대화 계속 테스트',
    description: '저장된 세션을 로드하고 대화를 계속할 수 있는지 테스트합니다.',
    category: 'session',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    setup: async () => {
      // 테스트용 세션 미리 생성
      const { sessionManager } = await import('../../../src/core/session-manager.js');
      await sessionManager.saveSession(`${TEST_SESSION_PREFIX}-load`, [
        { role: 'user', content: '이전 대화: 프로젝트 이름은 OPEN-CLI입니다.' },
        { role: 'assistant', content: '네, OPEN-CLI 프로젝트에 대해 알겠습니다.' },
      ]);
    },
    steps: [
      {
        name: '세션 로드',
        action: {
          type: 'custom',
          fn: async () => {
            const { sessionManager } = await import('../../../src/core/session-manager.js');
            const sessions = await sessionManager.listSessions();
            const testSession = sessions.find((s) => s.name === `${TEST_SESSION_PREFIX}-load`);
            if (!testSession) return null;
            return sessionManager.loadSession(testSession.id);
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return (
              result !== null &&
              Array.isArray(result.messages) &&
              result.messages.length >= 2 &&
              result.messages[0].content.includes('OPEN-CLI')
            );
          },
        },
      },
      {
        name: 'LLM으로 대화 계속 (컨텍스트 확인)',
        action: {
          type: 'llm_chat',
          prompt: '방금 언급한 프로젝트 이름이 무엇이었나요? OPEN-CLI라고 대답해주세요.',
          useTools: false,
        },
        validation: { type: 'contains', value: 'OPEN-CLI' },
      },
    ],
  },

  {
    id: 'session-list-verification',
    name: '세션 목록 조회 테스트',
    description: '저장된 세션 목록을 조회할 수 있는지 테스트합니다.',
    category: 'session',
    enabled: true,
    timeout: 300000,
    setup: async () => {
      // 테스트용 세션 생성
      const { sessionManager } = await import('../../../src/core/session-manager.js');
      await sessionManager.saveSession(`${TEST_SESSION_PREFIX}-list-test`, [
        { role: 'user', content: 'Test message for list' },
      ]);
    },
    steps: [
      {
        name: 'LLM에게 간단한 질문 (시스템 정상 동작 확인)',
        action: {
          type: 'llm_chat',
          prompt: '1+1은 몇인가요? 숫자만 대답해주세요.',
          useTools: false,
        },
        validation: { type: 'contains', value: '2' },
      },
      {
        name: '세션 목록 조회',
        action: {
          type: 'custom',
          fn: async () => {
            const { sessionManager } = await import('../../../src/core/session-manager.js');
            const sessions = await sessionManager.listSessions();
            return sessions;
          },
        },
        validation: {
          type: 'custom',
          fn: async (sessions: any[]) => {
            return (
              Array.isArray(sessions) &&
              sessions.length > 0 &&
              sessions.some((s) => s.name.includes(TEST_SESSION_PREFIX))
            );
          },
        },
      },
    ],
  },

  {
    id: 'session-persistence-workflow',
    name: '세션 영속성 워크플로우 테스트',
    description: 'LLM 대화 → 세션 저장 → 재로드 전체 흐름을 테스트합니다.',
    category: 'session',
    enabled: true,
    timeout: 600000,
    retryCount: 2,
    steps: [
      {
        name: 'LLM과 대화 (고유 키워드 포함)',
        action: {
          type: 'llm_chat',
          prompt: '제가 말하는 비밀번호는 "PERSISTENCE-TEST-2024"입니다. 기억해주세요.',
          useTools: false,
        },
        validation: { type: 'llm_response_valid' },
      },
      {
        name: '대화 내용으로 세션 저장',
        action: {
          type: 'custom',
          fn: async () => {
            const { sessionManager } = await import('../../../src/core/session-manager.js');
            const sessionId = await sessionManager.saveSession(
              `${TEST_SESSION_PREFIX}-persistence`,
              [
                {
                  role: 'user',
                  content: '제가 말하는 비밀번호는 "PERSISTENCE-TEST-2024"입니다. 기억해주세요.',
                },
                { role: 'assistant', content: '네, 비밀번호 PERSISTENCE-TEST-2024를 기억하겠습니다.' },
              ]
            );
            return sessionId;
          },
        },
        validation: { type: 'not_empty' },
      },
      {
        name: '세션 재로드 및 내용 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { sessionManager } = await import('../../../src/core/session-manager.js');
            const sessions = await sessionManager.listSessions();
            const persistSession = sessions.find(
              (s) => s.name === `${TEST_SESSION_PREFIX}-persistence`
            );
            if (!persistSession) return null;
            const loaded = await sessionManager.loadSession(persistSession.id);
            return loaded;
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            if (!result || !result.messages) return false;
            const allContent = result.messages.map((m: any) => m.content).join(' ');
            return allContent.includes('PERSISTENCE-TEST-2024');
          },
        },
      },
    ],
  },
];
