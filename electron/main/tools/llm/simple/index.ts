/**
 * LLM Simple Tools Export
 *
 * Re-exports from agent/tools for backward compatibility
 */

// File tools
export { FILE_TOOLS, setWorkingDirectory, getWorkingDirectory } from '../../../agent/tools/file';

// PowerShell tools
export { POWERSHELL_TOOLS } from '../../../agent/tools/powershell';

// TODO tools
export {
  TODO_TOOLS,
  setTodoWriteCallback,
  setGetTodosCallback,
  setFinalResponseCallback,
  clearFinalResponseCallbacks,
} from '../../../agent/tools/todo';

// User interaction tools
export { USER_TOOLS, setTellToUserCallback, setAskUserCallback } from '../../../agent/tools/user';
