/**
 * Office Sub-Agents Index
 *
 * Agent as a Tool pattern for Office specialist agents.
 *
 * CLI parity: electron/main/agents/office/index.ts
 */

// Re-export from common (backward compatibility)
export { SubAgent as OfficeSubAgent, type SubAgentConfig as OfficeSubAgentConfig } from '../common/index.js';
export { COMPLETE_TOOL_DEFINITION } from '../common/index.js';

export {
  WORD_SYSTEM_PROMPT,
  EXCEL_SYSTEM_PROMPT,
  POWERPOINT_SYSTEM_PROMPT,
} from './prompts.js';
// Word
export { createWordCreateRequestTool } from './word-create-agent.js';
export { createWordModifyRequestTool } from './word-agent.js';
// Excel
export { createExcelCreateRequestTool } from './excel-create-agent.js';
export { createExcelModifyRequestTool } from './excel-agent.js';
// PowerPoint
export { createPowerPointCreateRequestTool } from './powerpoint-create-agent.js';
export { createPowerPointModifyRequestTool } from './powerpoint-agent.js';
