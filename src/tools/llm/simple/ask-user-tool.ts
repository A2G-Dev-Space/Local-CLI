/**
 * @deprecated Use user-interaction-tools.ts instead
 * This file is kept for backward compatibility
 */

export {
  askToUserTool as AskToUserTool,
  askToUserTool,
  setAskUserCallback,
  clearAskUserCallback,
  hasAskUserCallback,
  type AskUserRequest,
  type AskUserResponse,
  type AskUserCallback,
} from './user-interaction-tools.js';

import { askToUserTool } from './user-interaction-tools.js';
export default askToUserTool;

/**
 * @deprecated Use askToUserTool.definition instead
 */
export function getAskToUserToolDefinition() {
  return askToUserTool.definition;
}
