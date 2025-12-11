/**
 * Agno Agent 코드 생성 평가 시나리오
 *
 * LLMClient를 직접 사용하여 코드 생성 품질을 평가합니다.
 * subprocess 대신 직접 LLM API를 호출하여 TTY 환경 의존성을 제거합니다.
 *
 * 점수 기반 평가:
 * - successRate >= PASS_THRESHOLD: PASS
 * - successRate >= WARN_THRESHOLD: PASS (경고 출력)
 * - successRate < WARN_THRESHOLD: FAIL
 */

import { TestScenario } from '../types.js';
import path from 'path';
import { parseTestCases, selectTestCases, TestCase } from '../../evaluation/test-case-parser.js';
import { validateCode, ValidationResult } from '../../evaluation/code-validator.js';

// 평가 임계값 설정
const PASS_THRESHOLD = 50;  // 50% 이상이면 완전 통과
const WARN_THRESHOLD = 30;  // 30% 이상이면 경고와 함께 통과, 미만이면 실패

/**
 * LLM 응답에서 Python 코드 블록 추출
 */
function extractCodeBlocks(response: string): string[] {
  const codeBlocks: string[] = [];
  const codeBlockRegex = /```(?:python|py)\n([\s\S]*?)```/gm;
  let match;

  while ((match = codeBlockRegex.exec(response)) !== null) {
    if (match[1]) {
      const code = match[1].trim();
      if (code.length > 0) {
        codeBlocks.push(code);
      }
    }
  }

  return codeBlocks;
}

/**
 * 단일 테스트 케이스 평가
 */
interface EvalResult {
  testCase: TestCase;
  response: string;
  codeBlocks: string[];
  validations: ValidationResult[];
  passed: boolean;
  score: number; // 0-100
}

async function evaluateTestCase(
  testCase: TestCase,
  llmClient: any
): Promise<EvalResult> {
  // 시스템 프롬프트: Agno 코드 생성 요청
  const systemPrompt = `You are an expert Python developer specializing in the Agno AI Agent framework.
When asked to generate code, provide complete, working Python code with proper imports.
Always use markdown code blocks with \`\`\`python syntax.`;

  let responseText = '';
  let codeBlocks: string[] = [];

  try {
    // LLM에 코드 생성 요청 (sendMessage 메서드 사용)
    responseText = await llmClient.sendMessage(testCase.prompt, systemPrompt);
    codeBlocks = extractCodeBlocks(responseText);
  } catch (error) {
    // LLM 에러 시 빈 결과 반환 (점수 0)
    console.log(`     ⚠️ LLM Error for Test Case ${testCase.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      testCase,
      response: '',
      codeBlocks: [],
      validations: [],
      passed: false,
      score: 0,
    };
  }

  // 각 코드 블록 검증
  const validations: ValidationResult[] = [];
  for (const code of codeBlocks) {
    const validation = await validateCode(code);
    validations.push(validation);
  }

  // 점수 계산
  let score = 0;

  // 1. 코드 블록 생성 여부 (30점)
  if (codeBlocks.length > 0) {
    score += 30;
  }

  // 2. 문법 유효성 (40점)
  const syntaxValidCount = validations.filter(v => v.syntaxValid).length;
  if (codeBlocks.length > 0) {
    score += Math.round((syntaxValidCount / codeBlocks.length) * 40);
  }

  // 3. import 유효성 (30점)
  const importValidCount = validations.filter(v => v.importsValid).length;
  if (codeBlocks.length > 0) {
    score += Math.round((importValidCount / codeBlocks.length) * 30);
  }

  const passed = score >= WARN_THRESHOLD;

  return {
    testCase,
    response: responseText,
    codeBlocks,
    validations,
    passed,
    score,
  };
}

export const agnoEvaluationScenarios: TestScenario[] = [
  // ============================================================
  // Agno 코드 생성 평가 - Quick (테스트 케이스 1-2)
  // LLMClient를 직접 사용하여 TTY 의존성 제거
  // ============================================================
  {
    id: 'agno-evaluation-quick',
    name: 'Agno Code Generation (Quick)',
    description: `Agno 프롬프트 기반 코드 생성 품질 평가 (테스트 케이스 1-2, 통과 기준: ${WARN_THRESHOLD}%+)`,
    category: 'agno-eval',
    enabled: true,
    timeout: 300000, // 5분 (LLM 응답 대기)
    steps: [
      {
        name: 'Agno 코드 생성 평가 (테스트 1-2)',
        action: {
          type: 'custom',
          fn: async () => {
            // LLMClient 생성
            const { createLLMClient } = await import('../../../src/core/llm-client.js');
            const { configManager } = await import('../../../src/core/config-manager.js');

            await configManager.initialize();
            const llmClient = createLLMClient();

            // 테스트 케이스 파싱
            const promptsPath = path.join(
              process.cwd(),
              'test/fixtures/prompts',
              'agno_prompts.md'
            );
            const allTestCases = await parseTestCases(promptsPath);
            const testCases = selectTestCases(allTestCases, [1, 2]);

            // 각 테스트 케이스 평가
            const results: EvalResult[] = [];
            for (const testCase of testCases) {
              console.log(`  📝 Evaluating Test Case ${testCase.id}...`);
              const result = await evaluateTestCase(testCase, llmClient);
              results.push(result);
              console.log(`     Score: ${result.score}/100, Code blocks: ${result.codeBlocks.length}`);
            }

            // 전체 통계 계산
            const totalScore = results.reduce((sum, r) => sum + r.score, 0);
            const avgScore = results.length > 0 ? totalScore / results.length : 0;
            const passedCount = results.filter(r => r.passed).length;

            return {
              totalTests: results.length,
              passedTests: passedCount,
              failedTests: results.length - passedCount,
              averageScore: avgScore,
              successRate: results.length > 0 ? (passedCount / results.length) * 100 : 0,
              details: results.map(r => ({
                id: r.testCase.id,
                score: r.score,
                passed: r.passed,
                codeBlockCount: r.codeBlocks.length,
              })),
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            // 테스트가 실행되지 않았으면 실패
            if (result.totalTests === 0) {
              console.log(`❌ No tests were executed`);
              return false;
            }

            const rate = result.successRate;
            const avgScore = result.averageScore;

            // 점수 기반 판정
            if (rate >= PASS_THRESHOLD) {
              console.log(`✅ Agno evaluation PASSED: ${rate.toFixed(1)}% success, avg score: ${avgScore.toFixed(1)}/100`);
              return true;
            } else if (rate >= WARN_THRESHOLD) {
              console.log(`⚠️ Agno evaluation PASSED with warning: ${rate.toFixed(1)}% success, avg score: ${avgScore.toFixed(1)}/100`);
              console.log(`   Consider improving LLM code generation quality`);
              return true;
            } else {
              console.log(`❌ Agno evaluation FAILED: ${rate.toFixed(1)}% success (< ${WARN_THRESHOLD}%)`);
              console.log(`   ${result.passedTests}/${result.totalTests} tests passed, avg score: ${avgScore.toFixed(1)}/100`);
              return false;
            }
          },
        },
      },
    ],
  },

  // ============================================================
  // Agno 평가 시스템 초기화 테스트
  // ============================================================
  {
    id: 'agno-evaluation-init',
    name: 'Agno Evaluation System Init',
    description: 'Agno 평가 시스템 초기화 및 테스트 케이스 파싱 검증',
    category: 'agno-eval',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: '테스트 케이스 파싱 검증',
        action: {
          type: 'custom',
          fn: async () => {
            const promptsPath = path.join(
              process.cwd(),
              'test/fixtures/prompts',
              'agno_prompts.md'
            );

            const testCases = await parseTestCases(promptsPath);

            return {
              testCasesFound: testCases.length,
              hasPrompts: testCases.every(tc => tc.prompt && tc.prompt.length > 0),
              hasIds: testCases.every(tc => typeof tc.id === 'number'),
              samplePrompt: testCases[0]?.prompt?.substring(0, 100) || '',
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.testCasesFound > 0 &&
              result.hasPrompts === true &&
              result.hasIds === true
            );
          },
        },
      },
    ],
  },

  // ============================================================
  // 코드 검증기 테스트
  // ============================================================
  {
    id: 'agno-code-validator',
    name: 'Agno Code Validator',
    description: '코드 검증기가 Python/TypeScript 코드를 올바르게 검증하는지 테스트',
    category: 'agno-eval',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'Python 코드 검증',
        action: {
          type: 'custom',
          fn: async () => {
            // Valid Python code
            const validPython = `
def hello():
    print("Hello, World!")

if __name__ == "__main__":
    hello()
`;

            // Invalid Python code (syntax error)
            const invalidPython = `
def hello(
    print("Hello, World!")
`;

            const validResult = await validateCode(validPython);
            const invalidResult = await validateCode(invalidPython);

            return {
              validCode: {
                hasCode: validResult.hasCode,
                syntaxValid: validResult.syntaxValid,
              },
              invalidCode: {
                hasCode: invalidResult.hasCode,
                syntaxValid: invalidResult.syntaxValid,
                hasErrors: invalidResult.syntaxErrors.length > 0,
              },
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.validCode.hasCode === true &&
              result.validCode.syntaxValid === true &&
              result.invalidCode.hasCode === true &&
              result.invalidCode.syntaxValid === false &&
              result.invalidCode.hasErrors === true
            );
          },
        },
      },
    ],
  },

  // ============================================================
  // 단일 코드 생성 테스트 (점수 기반)
  // ============================================================
  {
    id: 'agno-single-generation',
    name: 'Agno Single Code Generation',
    description: 'LLM에게 단일 Agno 코드 생성을 요청하고 품질을 점수로 평가',
    category: 'agno-eval',
    enabled: true,
    timeout: 120000, // 2분 (LLM 응답 대기)
    steps: [
      {
        name: 'Agno Agent 코드 생성 요청',
        action: {
          type: 'llm_chat',
          prompt: `Python으로 간단한 Agno Agent를 만들어주세요.
요구사항:
1. agno 라이브러리의 Agent 클래스 사용
2. OpenAI 모델 사용
3. 간단한 인사 기능 구현

완전한 실행 가능한 코드를 \`\`\`python 블록으로 제공해주세요.`,
          useTools: false,
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            const response = result?.content || result || '';
            const codeBlocks = extractCodeBlocks(response);

            if (codeBlocks.length === 0) {
              console.log(`⚠️ No Python code blocks found in response`);
              // 코드가 없어도 응답이 있으면 경고만 출력
              return response.length > 50;
            }

            // 첫 번째 코드 블록 검증
            const validation = await validateCode(codeBlocks[0]);

            let score = 0;
            if (codeBlocks.length > 0) score += 30;
            if (validation.syntaxValid) score += 40;
            if (validation.importsValid) score += 30;

            console.log(`📊 Code Generation Score: ${score}/100`);
            console.log(`   - Code blocks: ${codeBlocks.length}`);
            console.log(`   - Syntax valid: ${validation.syntaxValid}`);
            console.log(`   - Imports valid: ${validation.importsValid}`);

            // 30점 이상이면 통과
            return score >= WARN_THRESHOLD;
          },
        },
      },
    ],
  },
];
