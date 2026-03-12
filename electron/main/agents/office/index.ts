/**
 * Office Sub-Agents Index
 *
 * Agent as a Tool pattern for Office specialist agents.
 *
 * Electron parity: src/agents/office/index.ts
 */

// Re-export from common (backward compatibility)
export { SubAgent as OfficeSubAgent, type SubAgentConfig as OfficeSubAgentConfig } from '../common/index';
export { COMPLETE_TOOL_DEFINITION } from '../common/index';

export {
  WORD_SYSTEM_PROMPT,
  EXCEL_SYSTEM_PROMPT,
  POWERPOINT_SYSTEM_PROMPT,
} from './prompts';
// Word
export { createWordCreateRequestTool } from './word-create-agent';
export { createWordModifyRequestTool } from './word-agent';
// Excel
export { createExcelCreateRequestTool } from './excel-create-agent';
export { createExcelModifyRequestTool } from './excel-agent';
// PowerPoint
export { createPowerPointCreateRequestTool } from './powerpoint-create-agent';
export { createPowerPointModifyRequestTool } from './powerpoint-agent';
