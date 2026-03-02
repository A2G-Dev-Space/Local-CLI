/**
 * Office E2E Test - All three agents with diverse scenarios
 */
import { configManager } from './src/core/config/config-manager.js';
import { ensureAuthenticated, syncModelsFromDashboard } from './src/core/auth/auth-gate.js';
import { LLMClient } from './src/core/llm/llm-client.js';
import { SubAgent as OfficeSubAgent } from './src/agents/common/sub-agent.js';
import { POWERPOINT_SYSTEM_PROMPT, WORD_SYSTEM_PROMPT, EXCEL_SYSTEM_PROMPT } from './src/agents/office/prompts.js';
import { POWERPOINT_TOOLS } from './src/tools/office/powerpoint-tools.js';
import { WORD_TOOLS } from './src/tools/office/word-tools.js';
import { EXCEL_TOOLS } from './src/tools/office/excel-tools.js';
import { DASHBOARD_URL } from './src/constants.js';

const SCENARIOS: Record<string, { app: string; tools: any; prompt: string; instruction: string }> = {
  // PPT scenarios
  'ppt-tech': {
    app: 'powerpoint',
    tools: 'POWERPOINT_TOOLS',
    prompt: 'POWERPOINT_SYSTEM_PROMPT',
    instruction: '5장짜리 PPT를 만드세요. 주제: AI 스타트업 투자 유치 피치덱. 슬라이드 1: 표지 (제목: "NeuralFlow AI", 부제목: "Series A Funding Pitch | 2024"). 슬라이드 2: 문제 정의 (현재 기업들이 겪는 데이터 분석의 3가지 주요 pain point를 자세히). 슬라이드 3: 솔루션 비교 (기존 방식 vs NeuralFlow 방식을 좌우 비교). 슬라이드 4: 핵심 성과 지표 (MAU 50만, 매출 성장률 300%, 고객 유지율 95%). 슬라이드 5: 감사합니다. 저장: C:\\temp\\office-test\\ppt-v12-tech.pptx',
  },
  'ppt-corp': {
    app: 'powerpoint',
    tools: 'POWERPOINT_TOOLS',
    prompt: 'POWERPOINT_SYSTEM_PROMPT',
    instruction: '5장짜리 PPT를 만드세요. 슬라이드 1: 표지 (제목: "2024년 하반기 사업 전략 보고서", 부제목: "2024년 7월 | 기획전략팀"). 슬라이드 2: 경영환경 분석 (시장 동향 3가지 불릿을 자세히). 슬라이드 3: 핵심 추진 전략 (디지털 전환, 글로벌 확대, ESG 강화 각각 서브불릿 포함). 슬라이드 4: 기대 효과 (매출 20% 증가, 해외 비중 35%, 탄소 배출 30% 절감). 슬라이드 5: 감사합니다. 저장: C:\\temp\\office-test\\ppt-v12-corp.pptx',
  },
  'ppt-modify': {
    app: 'powerpoint',
    tools: 'POWERPOINT_TOOLS',
    prompt: 'POWERPOINT_SYSTEM_PROMPT',
    instruction: 'C:\\temp\\office-test\\ppt-v12-corp.pptx 파일을 열어서 수정하세요. 1) 슬라이드 2의 제목을 "2025년 경영환경 전망"으로 변경. 2) 슬라이드 4에 새로운 지표 추가: "신규 고객 유치 50%↑". 3) 수정 후 C:\\temp\\office-test\\ppt-v15-modified.pptx로 저장.',
  },
  // Word scenarios
  'word-report': {
    app: 'word',
    tools: 'WORD_TOOLS',
    prompt: 'WORD_SYSTEM_PROMPT',
    instruction: '보고서를 작성해주세요. 제목: "2024년 3분기 마케팅 성과 보고서". 부제: "마케팅팀 | 2024년 10월". 내용: 1) 캠페인 실적 요약 (온라인 광고, SNS 마케팅, 이벤트 프로모션 각각 2-3줄 분석), 2) 채널별 성과 비교표 (채널, 예산, 도달수, 전환율, ROI 5열 × 4행), 3) 개선 과제 (3가지 불릿), 4) 다음 분기 계획 (3가지 불릿). 저장: C:\\temp\\office-test\\word-v10-report.docx',
  },
  'word-tech': {
    app: 'word',
    tools: 'WORD_TOOLS',
    prompt: 'WORD_SYSTEM_PROMPT',
    instruction: '기술 문서를 작성해주세요. 제목: "NeuralFlow API Integration Guide". 부제: "v2.0 | Developer Documentation". 내용: 1) Overview (시스템 아키텍처 개요 2-3줄), 2) Authentication (API Key 발급 방법, Bearer token 사용법), 3) Endpoints (POST /api/predict, GET /api/models 각각 설명 + 파라미터 표), 4) Error Handling (에러 코드 표: 400, 401, 403, 500). 저장: C:\\temp\\office-test\\word-v10-tech.docx',
  },
  'word-modify': {
    app: 'word',
    tools: 'WORD_TOOLS',
    prompt: 'WORD_SYSTEM_PROMPT',
    instruction: 'C:\\temp\\office-test\\word-v10-report.docx 파일을 열어서 수정하세요. 1) 제목을 "2024년 4분기 마케팅 성과 보고서"로 변경. 2) 부제를 "마케팅팀 | 2025년 1월"로 변경. 3) "개선 과제" 섹션에 4번째 불릿 추가: "• AI 기반 마케팅 자동화 도입". 4) 수정 후 C:\\temp\\office-test\\word-v12-modified.docx로 저장.',
  },
  // Excel scenarios
  'excel-finance': {
    app: 'excel',
    tools: 'EXCEL_TOOLS',
    prompt: 'EXCEL_SYSTEM_PROMPT',
    instruction: '매출 분석 보고서를 만드세요. 시트명: "2024 매출 분석". 제목: "2024년 분기별 매출 분석". 열: 분기, 국내매출, 해외매출, 합계, 전분기대비증감률. 데이터: Q1(1200만원, 800만원), Q2(1500만원, 950만원), Q3(1800만원, 1100만원), Q4(2100만원, 1300만원). 합계 행 추가. 저장: C:\\temp\\office-test\\excel-v14-finance.xlsx',
  },
  'excel-dashboard': {
    app: 'excel',
    tools: 'EXCEL_TOOLS',
    prompt: 'EXCEL_SYSTEM_PROMPT',
    instruction: 'KPI 대시보드를 만드세요. 시트명: "팀 KPI Dashboard". 제목: "개발팀 2024 Q3 KPI Dashboard". 열: KPI 항목, 목표, 실적, 달성률, 상태. 데이터: 코드 품질(버그율 5% 이하, 3.2%, 달성), 배포 속도(주 2회, 주 3회, 초과달성), 고객 만족도(4.5점, 4.3점, 미달), 테스트 커버리지(80%, 85%, 달성), 응답시간(200ms, 180ms, 달성). 저장: C:\\temp\\office-test\\excel-v17-dashboard.xlsx',
  },
  'excel-modify': {
    app: 'excel',
    tools: 'EXCEL_TOOLS',
    prompt: 'EXCEL_SYSTEM_PROMPT',
    instruction: 'C:\\temp\\office-test\\excel-v14-finance.xlsx 파일을 열어서 수정하세요. 1) Q4 국내매출을 2500만원으로 수정. 2) 새로운 행 추가: "Q5" 분기 (국내매출 2800만원, 해외매출 1500만원). 3) 합계 행의 수식을 Q5까지 포함하도록 업데이트. 4) 수정 후 C:\\temp\\office-test\\excel-v14-modified.xlsx로 저장.',
  },
};

async function main() {
  const scenario = process.argv[2];
  if (!scenario || !SCENARIOS[scenario]) {
    console.log('Usage: npx tsx test-office-all.ts <scenario>');
    console.log('Available scenarios:');
    for (const [key, val] of Object.entries(SCENARIOS)) {
      console.log(`  ${key} — ${val.app}: ${val.instruction.slice(0, 60)}...`);
    }
    process.exit(1);
  }

  const s = SCENARIOS[scenario];
  console.log(`[Test] ${scenario} (${s.app})`);

  await configManager.initialize();
  const creds = await ensureAuthenticated(DASHBOARD_URL);
  await syncModelsFromDashboard(DASHBOARD_URL, creds.token);

  const llmClient = new LLMClient(creds.token);
  console.log(`[Model] ${llmClient.getModelInfo().model}`);

  const toolsMap: Record<string, any> = { POWERPOINT_TOOLS, WORD_TOOLS, EXCEL_TOOLS };
  const promptsMap: Record<string, string> = { POWERPOINT_SYSTEM_PROMPT, WORD_SYSTEM_PROMPT, EXCEL_SYSTEM_PROMPT };

  const agent = new OfficeSubAgent(
    llmClient,
    s.app,
    toolsMap[s.tools],
    promptsMap[s.prompt],
    { maxIterations: 70, temperature: 0.3, maxTokens: 4000 }
  );

  console.log(`[Instruction] ${s.instruction.slice(0, 100)}...`);
  const start = Date.now();
  const result = await agent.run(s.instruction);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[Result] success=${result.success}`);
  console.log(`[Result] ${result.result?.slice(0, 300)}`);
  console.log(`[Meta] iterations=${result.metadata?.iterations}, toolCalls=${result.metadata?.toolCalls}, time=${elapsed}s`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
