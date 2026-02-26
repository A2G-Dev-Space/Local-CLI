/**
 * Office Sub-Agents Index
 *
 * Agent as a Tool 패턴의 Office 전문 에이전트 모듈.
 */

export { OfficeSubAgent, type OfficeSubAgentConfig } from './office-sub-agent.js';
export { COMPLETE_TOOL_DEFINITION } from './complete-tool.js';
export {
  WORD_SYSTEM_PROMPT,
  EXCEL_SYSTEM_PROMPT,
  POWERPOINT_SYSTEM_PROMPT,
} from './prompts.js';
export { createWordWorkRequestTool } from './word-agent.js';
export { createExcelWorkRequestTool } from './excel-agent.js';
export { createPowerPointWorkRequestTool } from './powerpoint-agent.js';
