/**
 * PPT E2E Test - Direct OfficeSubAgent invocation
 */
import { configManager } from './src/core/config/config-manager.js';
import { ensureAuthenticated, syncModelsFromDashboard } from './src/core/auth/auth-gate.js';
import { LLMClient } from './src/core/llm/llm-client.js';
import { SubAgent as OfficeSubAgent } from './src/agents/common/sub-agent.js';
import { POWERPOINT_SYSTEM_PROMPT } from './src/agents/office/prompts.js';
import { POWERPOINT_TOOLS } from './src/tools/office/powerpoint-tools.js';
import { DASHBOARD_URL } from './src/constants.js';

async function main() {
  console.log('[PPT E2E Test] Starting...');

  await configManager.initialize();
  const creds = await ensureAuthenticated(DASHBOARD_URL);
  await syncModelsFromDashboard(DASHBOARD_URL, creds.token);

  const llmClient = new LLMClient(creds.token);
  console.log(`[Model] ${llmClient.getModelInfo().model}`);

  const agent = new OfficeSubAgent(
    llmClient,
    'powerpoint',
    POWERPOINT_TOOLS,
    POWERPOINT_SYSTEM_PROMPT,
    { maxIterations: 50, temperature: 0.3, maxTokens: 4000 }
  );

  const instruction = '5장짜리 PPT를 만드세요. 슬라이드 1: 표지 (제목: "2024년 하반기 사업 전략 보고서", 부제목: "2024년 7월 | 기획전략팀"). 슬라이드 2: 경영환경 분석 (시장 동향 3가지 불릿). 슬라이드 3: 핵심 추진 전략 (디지털 전환, 글로벌 확대, ESG 강화 각 1줄). 슬라이드 4: 기대 효과 (매출 20% 증가, 해외 비중 35%, 탄소 배출 30% 절감). 슬라이드 5: 감사합니다. 저장: C:\\temp\\office-test\\ppt-v9.pptx';

  console.log(`[Instruction] ${instruction.slice(0, 80)}...`);
  const start = Date.now();
  const result = await agent.run(instruction);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[Result] success=${result.success}`);
  console.log(`[Result] ${result.result?.slice(0, 200)}`);
  console.log(`[Meta] iterations=${result.metadata?.iterations}, toolCalls=${result.metadata?.toolCalls}, time=${elapsed}s`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
