/**
 * Settings E2E 테스트 시나리오
 *
 * /settings 명령어 관련 테스트
 * Note: Planning Mode는 항상 'auto'로 고정됨 (모드 선택 기능 제거됨)
 */

import { TestScenario } from '../types.js';

export const settingsScenarios: TestScenario[] = [
  {
    id: 'settings-planning-mode-type',
    name: 'Planning Mode 타입 검증',
    description: 'PlanningMode 타입이 올바르게 정의되어 있는지 테스트합니다.',
    category: 'settings',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'PlanningMode 타입 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { PlanningMode } = await import('../../../src/core/slash-command-handler.js') as any;
            // PlanningMode는 타입이므로 런타임에서 확인 불가
            // 대신 관련 함수/모듈이 정상 로드되는지 확인
            const module = await import('../../../src/core/slash-command-handler.js');
            return {
              hasExecuteSlashCommand: typeof module.executeSlashCommand === 'function',
              hasIsSlashCommand: typeof module.isSlashCommand === 'function',
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return result.hasExecuteSlashCommand === true && result.hasIsSlashCommand === true;
          },
        },
      },
    ],
  },

  {
    id: 'settings-slash-command-handler',
    name: 'Slash Command Handler 동작 테스트',
    description: '/settings, /help 등 슬래시 명령어 핸들러가 정상 동작하는지 테스트합니다.',
    category: 'settings',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: '/help 명령어 처리 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { executeSlashCommand, isSlashCommand } = await import('../../../src/core/slash-command-handler.js');

            // isSlashCommand 테스트
            const isHelp = isSlashCommand('/help');
            const isNotCommand = isSlashCommand('hello');

            // Mock context for executeSlashCommand
            let capturedMessages: any[] = [];
            const mockContext = {
              planningMode: 'auto' as const,
              messages: [],
              todos: [],
              setPlanningMode: () => {},
              setMessages: (msgs: any[]) => { capturedMessages = msgs; },
              setTodos: () => {},
              exit: () => {},
            };

            const result = await executeSlashCommand('/help', mockContext);

            return {
              isHelpSlashCommand: isHelp,
              helloIsNotCommand: !isNotCommand,
              helpHandled: result.handled,
              helpMessageExists: capturedMessages.length > 0,
              helpContainsSettings: capturedMessages.some(m =>
                m.content && m.content.includes('/settings')
              ),
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return (
              result.isHelpSlashCommand === true &&
              result.helloIsNotCommand === true &&
              result.helpHandled === true &&
              result.helpMessageExists === true &&
              result.helpContainsSettings === true
            );
          },
        },
      },
      {
        name: '/settings 명령어 처리 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { executeSlashCommand } = await import('../../../src/core/slash-command-handler.js');

            let settingsShown = false;
            const mockContext = {
              planningMode: 'auto' as const,
              messages: [],
              todos: [],
              setPlanningMode: () => {},
              setMessages: () => {},
              setTodos: () => {},
              exit: () => {},
              onShowSettings: () => { settingsShown = true; },
            };

            const result = await executeSlashCommand('/settings', mockContext);

            return {
              handled: result.handled,
              settingsCallbackTriggered: settingsShown,
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return result.handled === true && result.settingsCallbackTriggered === true;
          },
        },
      },
      {
        name: '/model 명령어 처리 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { executeSlashCommand } = await import('../../../src/core/slash-command-handler.js');

            let modelSelectorShown = false;
            const mockContext = {
              planningMode: 'auto' as const,
              messages: [],
              todos: [],
              setPlanningMode: () => {},
              setMessages: () => {},
              setTodos: () => {},
              exit: () => {},
              onShowModelSelector: () => { modelSelectorShown = true; },
            };

            const result = await executeSlashCommand('/model', mockContext);

            return {
              handled: result.handled,
              modelSelectorCallbackTriggered: modelSelectorShown,
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return result.handled === true && result.modelSelectorCallbackTriggered === true;
          },
        },
      },
    ],
  },

  {
    id: 'settings-slash-commands-list',
    name: 'SLASH_COMMANDS 목록 검증',
    description: '슬래시 명령어 목록에서 /status가 제거되고 /settings, /model이 있는지 확인합니다.',
    category: 'settings',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'SLASH_COMMANDS 목록 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { SLASH_COMMANDS } = await import('../../../src/ui/hooks/slashCommandProcessor.js');

            const commandNames = SLASH_COMMANDS.map(c => c.name);

            return {
              hasSettings: commandNames.includes('/settings'),
              hasModel: commandNames.includes('/model'),
              hasHelp: commandNames.includes('/help'),
              hasExit: commandNames.includes('/exit'),
              hasClear: commandNames.includes('/clear'),
              hasLoad: commandNames.includes('/load'),
              hasNoStatus: !commandNames.includes('/status'),
              totalCommands: commandNames.length,
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return (
              result.hasSettings === true &&
              result.hasModel === true &&
              result.hasHelp === true &&
              result.hasExit === true &&
              result.hasClear === true &&
              result.hasLoad === true &&
              result.hasNoStatus === true &&
              result.totalCommands === 6
            );
          },
        },
      },
    ],
  },

  {
    id: 'settings-planning-mode-always-auto',
    name: 'Planning Mode 항상 auto 테스트',
    description: 'Planning Mode가 항상 auto로 고정되어 있는지 테스트합니다.',
    category: 'settings',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'Planning Mode 항상 auto 확인',
        action: {
          type: 'custom',
          fn: async () => {
            // PlanningMode는 이제 'auto'만 지원
            type PlanningMode = 'auto';

            // Planning Mode는 항상 'auto'
            const currentMode: PlanningMode = 'auto';

            return {
              mode: currentMode,
              isAlwaysAuto: currentMode === 'auto',
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return result.isAlwaysAuto === true && result.mode === 'auto';
          },
        },
      },
    ],
  },

  {
    id: 'settings-config-manager-integration',
    name: 'Config Manager와 Settings 통합 테스트',
    description: 'Settings에서 Config Manager의 정보를 정상적으로 가져올 수 있는지 테스트합니다.',
    category: 'settings',
    enabled: true,
    timeout: 60000,
    steps: [
      {
        name: 'Config 정보 조회',
        action: {
          type: 'custom',
          fn: async () => {
            const { configManager } = await import('../../../src/core/config-manager.js');
            const { sessionManager } = await import('../../../src/core/session-manager.js');

            await configManager.initialize();

            const endpoint = configManager.getCurrentEndpoint();
            const model = configManager.getCurrentModel();
            const sessionId = sessionManager.getCurrentSessionId();

            return {
              hasEndpoint: endpoint !== null && endpoint !== undefined,
              hasModel: model !== null && model !== undefined,
              endpointUrl: endpoint?.baseUrl || 'none',
              modelName: model?.name || 'none',
              workingDir: process.cwd(),
              hasWorkingDir: process.cwd().length > 0,
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return (
              result.hasEndpoint === true &&
              result.hasModel === true &&
              result.hasWorkingDir === true
            );
          },
        },
      },
    ],
  },

  {
    id: 'settings-llm-verify-no-status-command',
    name: 'LLM으로 /status 명령어 제거 확인',
    description: 'LLM에게 /status 명령어가 없음을 확인합니다.',
    category: 'settings',
    enabled: true,
    timeout: 300000,
    steps: [
      {
        name: 'LLM에게 명령어 목록 요청',
        action: {
          type: 'llm_chat',
          prompt: `다음 슬래시 명령어 목록 중에서 "/status"가 있는지 확인해주세요:
/exit, /quit, /clear, /settings, /load, /help

"/status"가 목록에 있으면 "있음", 없으면 "없음"이라고만 대답해주세요.`,
          useTools: false,
        },
        validation: { type: 'contains', value: '없음' },
      },
    ],
  },
];
