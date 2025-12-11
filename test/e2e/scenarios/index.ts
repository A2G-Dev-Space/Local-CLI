/**
 * 모든 E2E 테스트 시나리오 내보내기
 */

export { fileToolsScenarios } from './file-tools.js';
export { llmClientScenarios } from './llm-client.js';
export { planExecuteScenarios } from './plan-execute.js';
export { sessionScenarios } from './session.js';
export { configScenarios } from './config.js';
export { localRagScenarios } from './local-rag.js';
export { integrationScenarios } from './integration.js';
export { settingsScenarios } from './settings.js';
export { demoScenarios } from './demos.js';
export { agnoEvaluationScenarios } from './agno-evaluation.js';
export { toolRegistryScenarios } from './tool-registry.js';
export { phase1_4Scenarios } from './phase1-4.js';

import { fileToolsScenarios } from './file-tools.js';
import { llmClientScenarios } from './llm-client.js';
import { planExecuteScenarios } from './plan-execute.js';
import { sessionScenarios } from './session.js';
import { configScenarios } from './config.js';
import { localRagScenarios } from './local-rag.js';
import { integrationScenarios } from './integration.js';
import { settingsScenarios } from './settings.js';
import { demoScenarios } from './demos.js';
import { agnoEvaluationScenarios } from './agno-evaluation.js';
import { toolRegistryScenarios } from './tool-registry.js';
import { phase1_4Scenarios } from './phase1-4.js';
import { TestScenario } from '../types.js';

/**
 * 모든 시나리오를 하나의 배열로 반환
 */
export function getAllScenarios(): TestScenario[] {
  return [
    ...fileToolsScenarios,
    ...llmClientScenarios,
    ...planExecuteScenarios,
    ...sessionScenarios,
    ...configScenarios,
    ...localRagScenarios,
    ...integrationScenarios,
    ...settingsScenarios,
    ...demoScenarios,
    ...agnoEvaluationScenarios,
    ...toolRegistryScenarios,
    ...phase1_4Scenarios,
  ];
}

/**
 * 카테고리별 시나리오 개수 반환
 */
export function getScenarioStats(): Record<string, number> {
  return {
    'file-tools': fileToolsScenarios.length,
    'llm-client': llmClientScenarios.length,
    'plan-execute': planExecuteScenarios.length,
    session: sessionScenarios.length,
    config: configScenarios.length,
    'local-rag': localRagScenarios.length,
    integration: integrationScenarios.length,
    settings: settingsScenarios.length,
    demos: demoScenarios.length,
    'agno-eval': agnoEvaluationScenarios.length,
    'tool-registry': toolRegistryScenarios.length,
    'phase1-4': phase1_4Scenarios.length,
  };
}
