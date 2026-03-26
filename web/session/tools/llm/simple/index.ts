/**
 * LLM Simple Tools Index (Web Session)
 *
 * LLM이 tool_call로 호출하는 도구들 (Sub-LLM 없음)
 * Web session: 항상 bash 도구만 사용 (Docker Linux 환경)
 */

import { LLMSimpleTool } from '../../types.js';

// Common tools (all platforms)
export * from './file-tools.js';
export * from './todo-tools.js';
export * from './final-response-tool.js';

// Bash tools (Linux only in web session)
export * from './bash-tool.js';
import { bashTool } from './bash-tool.js';
import { BACKGROUND_BASH_TOOLS } from './background-bash-tool.js';
export { BACKGROUND_BASH_TOOLS } from './background-bash-tool.js';

/**
 * Get shell tools — always bash in web session (Docker Linux)
 */
export function getShellTools(): LLMSimpleTool[] {
  return [bashTool, ...BACKGROUND_BASH_TOOLS];
}
