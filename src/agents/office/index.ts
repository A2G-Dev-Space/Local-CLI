/**
 * Office Sub-Agents Index
 *
 * Agent as a Tool pattern for Office specialist agents.
 */

// Re-export from common (backward compatibility)
export { SubAgent as OfficeSubAgent, type SubAgentConfig as OfficeSubAgentConfig } from '../common/index.js';
export { COMPLETE_TOOL_DEFINITION } from '../common/index.js';

export {
  WORD_SYSTEM_PROMPT,
  EXCEL_SYSTEM_PROMPT,
  POWERPOINT_SYSTEM_PROMPT,
} from './prompts.js';
export { createWordWorkRequestTool } from './word-agent.js';
export { createExcelWorkRequestTool } from './excel-agent.js';
export { createPowerPointWorkRequestTool } from './powerpoint-agent.js';
