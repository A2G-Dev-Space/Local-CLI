/**
 * Office Sub-Agents Index
 *
 * Agent as a Tool pattern for Office specialist agents.
 *
 * CLI parity: src/agents/office/index.ts
 */

// Re-export from common (backward compatibility)
export { SubAgent as OfficeSubAgent, type SubAgentConfig as OfficeSubAgentConfig } from '../common/index';
export { COMPLETE_TOOL_DEFINITION } from '../common/index';

export {
  WORD_SYSTEM_PROMPT,
  EXCEL_SYSTEM_PROMPT,
  POWERPOINT_SYSTEM_PROMPT,
} from './prompts';
export { createWordWorkRequestTool } from './word-agent';
export { createExcelWorkRequestTool } from './excel-agent';
export { createPowerPointWorkRequestTool } from './powerpoint-agent';
