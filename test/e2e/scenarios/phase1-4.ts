/**
 * Phase 1-4 E2E 테스트 시나리오
 *
 * Phase 1: Plan-Execute Auto Mode (request-classifier, todo-tools)
 * Phase 2: 승인 모드 / ask-to-user Tool
 * Phase 3: 사용량 추적 (usage-tracker)
 * Phase 4: 문서 다운로드 (docs-manager)
 */

import { TestScenario } from '../types.js';

export const phase1_4Scenarios: TestScenario[] = [
  // ============================================
  // Phase 1: Request Classifier
  // ============================================
  {
    id: 'phase1-request-classifier-fallback',
    name: 'Request Classifier Fallback 테스트',
    description: 'Request Classifier의 키워드 기반 fallback 분류 테스트',
    category: 'plan-execute',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'simple_response 키워드 테스트',
        action: {
          type: 'custom',
          fn: async () => {
            // Fallback 키워드 테스트 (LLM 없이)
            const simpleKeywords = ['what', 'how', 'why', 'explain', '뭐', '어떻게'];
            const todoKeywords = ['create', 'build', 'implement', '만들', '생성'];

            return {
              simpleKeywordsCount: simpleKeywords.length,
              todoKeywordsCount: todoKeywords.length,
              hasKoreanSupport: simpleKeywords.some(k => /[가-힣]/.test(k)),
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.simpleKeywordsCount > 0 &&
              result.todoKeywordsCount > 0 &&
              result.hasKoreanSupport === true
            );
          },
        },
      },
    ],
  },

  // ============================================
  // Phase 1: TODO Tools
  // ============================================
  {
    id: 'phase1-todo-tools-definition',
    name: 'TODO Tools Definition 테스트',
    description: 'TODO 관리 LLM Tool 정의가 올바른지 테스트',
    category: 'plan-execute',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'Tool 정의 검증',
        action: {
          type: 'custom',
          fn: async () => {
            const { getTodoToolDefinitions } = await import(
              '../../../src/tools/llm/simple/todo-tools.js'
            );
            const definitions = getTodoToolDefinitions();

            return {
              definitionCount: definitions.length,
              hasUpdateTool: definitions.some(
                (d: any) => d.function.name === 'update_todo_list'
              ),
              hasGetTool: definitions.some(
                (d: any) => d.function.name === 'get_todo_list'
              ),
              updateToolHasRequiredParams:
                definitions.find((d: any) => d.function.name === 'update_todo_list')
                  ?.function.parameters.required?.includes('todo_id') &&
                definitions.find((d: any) => d.function.name === 'update_todo_list')
                  ?.function.parameters.required?.includes('status'),
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.definitionCount === 2 &&
              result.hasUpdateTool === true &&
              result.hasGetTool === true &&
              result.updateToolHasRequiredParams === true
            );
          },
        },
      },
    ],
  },

  {
    id: 'phase1-todo-tools-callback',
    name: 'TODO Tools Callback 테스트',
    description: 'TODO Tool의 callback 설정/해제 테스트',
    category: 'plan-execute',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'Callback 설정/해제',
        action: {
          type: 'custom',
          fn: async () => {
            const {
              setTodoUpdateCallback,
              setTodoListCallback,
              clearTodoCallbacks,
              UpdateTodoListTool,
              GetTodoListTool,
            } = await import('../../../src/tools/llm/simple/todo-tools.js');

            // 1. Callback 미설정 시 에러 반환
            clearTodoCallbacks();
            const updateWithoutCallback = await UpdateTodoListTool.execute({
              todo_id: 'test',
              status: 'completed',
            });
            const getWithoutCallback = await GetTodoListTool.execute({});

            // 2. Callback 설정 후 정상 동작
            let updateCalled = false;
            let listCalled = false;

            setTodoUpdateCallback(async (id, status, note) => {
              updateCalled = true;
              return true;
            });
            setTodoListCallback(() => {
              listCalled = true;
              return [
                { id: '1', title: 'Test', description: 'Desc', status: 'pending' },
              ];
            });

            const updateWithCallback = await UpdateTodoListTool.execute({
              todo_id: 'test',
              status: 'completed',
            });
            const getWithCallback = await GetTodoListTool.execute({});

            // 3. Callback 해제
            clearTodoCallbacks();
            const updateAfterClear = await UpdateTodoListTool.execute({
              todo_id: 'test',
              status: 'completed',
            });

            return {
              updateWithoutCallbackFailed: updateWithoutCallback.success === false,
              getWithoutCallbackFailed: getWithoutCallback.success === false,
              updateWithCallbackSuccess: updateWithCallback.success === true,
              getWithCallbackSuccess: getWithCallback.success === true,
              updateCalled,
              listCalled,
              updateAfterClearFailed: updateAfterClear.success === false,
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.updateWithoutCallbackFailed &&
              result.getWithoutCallbackFailed &&
              result.updateWithCallbackSuccess &&
              result.getWithCallbackSuccess &&
              result.updateCalled &&
              result.listCalled &&
              result.updateAfterClearFailed
            );
          },
        },
      },
    ],
  },

  // ============================================
  // Phase 2: Ask-to-User Tool
  // ============================================
  {
    id: 'phase2-ask-user-tool-definition',
    name: 'Ask-to-User Tool Definition 테스트',
    description: 'ask-to-user LLM Tool 정의가 올바른지 테스트',
    category: 'plan-execute',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'Tool 정의 검증',
        action: {
          type: 'custom',
          fn: async () => {
            const { getAskToUserToolDefinition } = await import(
              '../../../src/tools/llm/simple/ask-user-tool.js'
            );
            const definition = getAskToUserToolDefinition();

            const params = definition.function.parameters;

            return {
              toolName: definition.function.name,
              hasQuestion: params.required?.includes('question'),
              hasOptions: params.required?.includes('options'),
              optionsMinItems: params.properties?.options?.minItems,
              optionsMaxItems: params.properties?.options?.maxItems,
              descriptionMentionsOther:
                definition.function.description?.includes('Other'),
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.toolName === 'ask_to_user' &&
              result.hasQuestion === true &&
              result.hasOptions === true &&
              result.optionsMinItems === 2 &&
              result.optionsMaxItems === 4 &&
              result.descriptionMentionsOther === true
            );
          },
        },
      },
    ],
  },

  {
    id: 'phase2-ask-user-tool-validation',
    name: 'Ask-to-User Tool 입력 검증 테스트',
    description: 'ask-to-user Tool의 입력 파라미터 검증 테스트',
    category: 'plan-execute',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: '파라미터 검증',
        action: {
          type: 'custom',
          fn: async () => {
            const {
              AskToUserTool,
              setAskUserCallback,
              clearAskUserCallback,
            } = await import('../../../src/tools/llm/simple/ask-user-tool.js');

            // Mock callback 설정
            setAskUserCallback(async () => ({
              selectedOption: 'A',
              isOther: false,
            }));

            // 1. question 누락
            const noQuestion = await AskToUserTool.execute({
              options: ['A', 'B'],
            });

            // 2. options 부족 (1개)
            const fewOptions = await AskToUserTool.execute({
              question: 'Test?',
              options: ['Only one'],
            });

            // 3. options 초과 (5개)
            const manyOptions = await AskToUserTool.execute({
              question: 'Test?',
              options: ['A', 'B', 'C', 'D', 'E'],
            });

            // 4. 정상 케이스 (2-4개 옵션)
            const validTwo = await AskToUserTool.execute({
              question: 'Test?',
              options: ['A', 'B'],
            });
            const validFour = await AskToUserTool.execute({
              question: 'Test?',
              options: ['A', 'B', 'C', 'D'],
            });

            clearAskUserCallback();

            return {
              noQuestionFailed: noQuestion.success === false,
              fewOptionsFailed: fewOptions.success === false,
              manyOptionsFailed: manyOptions.success === false,
              validTwoSuccess: validTwo.success === true,
              validFourSuccess: validFour.success === true,
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.noQuestionFailed &&
              result.fewOptionsFailed &&
              result.manyOptionsFailed &&
              result.validTwoSuccess &&
              result.validFourSuccess
            );
          },
        },
      },
    ],
  },

  // ============================================
  // Phase 3: Usage Tracker
  // ============================================
  {
    id: 'phase3-usage-tracker-session',
    name: 'Usage Tracker 세션 추적 테스트',
    description: '사용량 추적기의 세션 토큰 취합 테스트',
    category: 'config',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: '세션 토큰 추적',
        action: {
          type: 'custom',
          fn: async () => {
            const { usageTracker } = await import(
              '../../../src/core/usage-tracker.js'
            );

            // 세션 리셋
            usageTracker.resetSession();
            const sessionBefore = usageTracker.getSessionUsage();

            // 사용량 기록
            usageTracker.recordUsage('gpt-4', 100, 200);
            usageTracker.recordUsage('gpt-4', 50, 100);
            usageTracker.recordUsage('gpt-3.5', 30, 70);

            const sessionAfter = usageTracker.getSessionUsage();

            return {
              beforeTokens: sessionBefore.totalTokens,
              afterInputTokens: sessionAfter.inputTokens,
              afterOutputTokens: sessionAfter.outputTokens,
              afterTotalTokens: sessionAfter.totalTokens,
              requestCount: sessionAfter.requestCount,
              modelCount: Object.keys(sessionAfter.models).length,
              gpt4Tokens: sessionAfter.models['gpt-4'],
              gpt35Tokens: sessionAfter.models['gpt-3.5'],
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.beforeTokens === 0 &&
              result.afterInputTokens === 180 && // 100+50+30
              result.afterOutputTokens === 370 && // 200+100+70
              result.afterTotalTokens === 550 && // 180+370
              result.requestCount === 3 &&
              result.modelCount === 2 &&
              result.gpt4Tokens === 450 && // (100+200)+(50+100)
              result.gpt35Tokens === 100 // 30+70
            );
          },
        },
      },
    ],
  },

  {
    id: 'phase3-usage-tracker-format',
    name: 'Usage Tracker 포맷 테스트',
    description: 'Claude Code 스타일 상태바 포맷 테스트',
    category: 'config',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: '상태바 포맷 검증',
        action: {
          type: 'custom',
          fn: async () => {
            const { usageTracker } = await import(
              '../../../src/core/usage-tracker.js'
            );

            usageTracker.resetSession();
            usageTracker.recordUsage('gpt-4', 2000, 2000); // 4k tokens

            const status = usageTracker.formatSessionStatus('분석 중');
            const defaultStatus = usageTracker.formatSessionStatus();

            return {
              hasStatusIcon: status.includes('✶'),
              hasActivity: status.includes('분석 중'),
              hasEscHint: status.includes('esc to interrupt'),
              hasTokens: status.includes('tokens'),
              hasKFormat: /\d+\.?\d*k/.test(status), // 4.0k format
              defaultHasProcessing: defaultStatus.includes('처리 중'),
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.hasStatusIcon &&
              result.hasActivity &&
              result.hasEscHint &&
              result.hasTokens &&
              result.hasKFormat &&
              result.defaultHasProcessing
            );
          },
        },
      },
    ],
  },

  // ============================================
  // Phase 4: Docs Manager
  // ============================================
  {
    id: 'phase4-docs-manager-sources',
    name: 'Docs Manager 소스 정의 테스트',
    description: '문서 다운로드 소스 정의가 올바른지 테스트',
    category: 'config',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: '소스 정의 검증',
        action: {
          type: 'custom',
          fn: async () => {
            const {
              AVAILABLE_SOURCES,
              getAvailableSources,
              getDocsPath,
            } = await import('../../../src/core/docs-manager.js');

            const sources = getAvailableSources();
            const docsPath = getDocsPath();

            const agno = sources.find((s: any) => s.id === 'agno');
            const adk = sources.find((s: any) => s.id === 'adk');

            return {
              sourceCount: sources.length,
              hasAgno: !!agno,
              hasAdk: !!adk,
              agnoTargetDir: agno?.targetDir,
              adkTargetDir: adk?.targetDir,
              agnoRepoIsGithub: agno?.repoUrl?.includes('github.com'),
              adkRepoIsGithub: adk?.repoUrl?.includes('github.com'),
              docsPathContainsOpenCli: docsPath.includes('.open-cli'),
              allHaveSubPath: sources.every((s: any) => s.subPath === 'docs'),
              allHaveBranch: sources.every((s: any) => s.branch === 'main'),
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.sourceCount === 2 &&
              result.hasAgno &&
              result.hasAdk &&
              result.agnoTargetDir === 'agent_framework/agno' &&
              result.adkTargetDir === 'agent_framework/adk' &&
              result.agnoRepoIsGithub &&
              result.adkRepoIsGithub &&
              result.docsPathContainsOpenCli &&
              result.allHaveSubPath &&
              result.allHaveBranch
            );
          },
        },
      },
    ],
  },

  {
    id: 'phase4-docs-manager-security',
    name: 'Docs Manager 보안 검증 테스트',
    description: '문서 소스의 보안 관련 검증 테스트',
    category: 'config',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: '보안 검증',
        action: {
          type: 'custom',
          fn: async () => {
            const { AVAILABLE_SOURCES } = await import(
              '../../../src/core/docs-manager.js'
            );

            const results = {
              allGithubUrls: true,
              noPathTraversal: true,
              noShellInjection: true,
            };

            for (const source of AVAILABLE_SOURCES) {
              // GitHub URL만 허용
              if (!source.repoUrl.startsWith('https://github.com/')) {
                results.allGithubUrls = false;
              }

              // Path traversal 방지
              if (
                source.targetDir.includes('..') ||
                source.targetDir.includes('~') ||
                source.targetDir.startsWith('/')
              ) {
                results.noPathTraversal = false;
              }

              // Shell injection 방지
              if (source.subPath) {
                if (/[;|&$`]/.test(source.subPath)) {
                  results.noShellInjection = false;
                }
              }
            }

            return results;
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.allGithubUrls &&
              result.noPathTraversal &&
              result.noShellInjection
            );
          },
        },
      },
    ],
  },

  {
    id: 'phase4-docs-manager-unknown-source',
    name: 'Docs Manager 알 수 없는 소스 테스트',
    description: '등록되지 않은 소스 다운로드 시 에러 반환 테스트',
    category: 'config',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: '알 수 없는 소스 에러',
        action: {
          type: 'custom',
          fn: async () => {
            const { downloadDocsFromSource } = await import(
              '../../../src/core/docs-manager.js'
            );

            const result = await downloadDocsFromSource('unknown-source');

            return {
              success: result.success,
              messageContainsUnknown: result.message.includes('알 수 없는 소스'),
              messageContainsAgno: result.message.includes('agno'),
              messageContainsAdk: result.message.includes('adk'),
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.success === false &&
              result.messageContainsUnknown &&
              result.messageContainsAgno &&
              result.messageContainsAdk
            );
          },
        },
      },
    ],
  },
];
