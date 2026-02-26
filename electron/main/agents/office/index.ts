/**
 * Office Sub-Agents Index
 *
 * CLI parity: src/agents/office/index.ts
 */

export { OfficeSubAgent, type OfficeSubAgentConfig } from './office-sub-agent';
export { COMPLETE_TOOL_DEFINITION } from './complete-tool';
export {
  WORD_SYSTEM_PROMPT,
  EXCEL_SYSTEM_PROMPT,
  POWERPOINT_SYSTEM_PROMPT,
} from './prompts';
export { createWordWorkRequestTool } from './word-agent';
export { createExcelWorkRequestTool } from './excel-agent';
export { createPowerPointWorkRequestTool } from './powerpoint-agent';
