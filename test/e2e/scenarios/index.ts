/**
 * 모든 E2E 테스트 시나리오 내보내기
 */

export { fileToolsScenarios } from './file-tools.js';
export { llmClientScenarios } from './llm-client.js';
export { planExecuteScenarios } from './plan-execute.js';
export { agentLoopScenarios } from './agent-loop.js';
export { sessionScenarios } from './session.js';
export { configScenarios } from './config.js';
export { localRagScenarios } from './local-rag.js';
export { integrationScenarios } from './integration.js';

import { fileToolsScenarios } from './file-tools.js';
import { llmClientScenarios } from './llm-client.js';
import { planExecuteScenarios } from './plan-execute.js';
import { agentLoopScenarios } from './agent-loop.js';
import { sessionScenarios } from './session.js';
import { configScenarios } from './config.js';
import { localRagScenarios } from './local-rag.js';
import { integrationScenarios } from './integration.js';
import { TestScenario } from '../types.js';

/**
 * 모든 시나리오를 하나의 배열로 반환
 */
export function getAllScenarios(): TestScenario[] {
  return [
    ...fileToolsScenarios,
    ...llmClientScenarios,
    ...planExecuteScenarios,
    ...agentLoopScenarios,
    ...sessionScenarios,
    ...configScenarios,
    ...localRagScenarios,
    ...integrationScenarios,
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
    'agent-loop': agentLoopScenarios.length,
    session: sessionScenarios.length,
    config: configScenarios.length,
    'local-rag': localRagScenarios.length,
    integration: integrationScenarios.length,
  };
}
