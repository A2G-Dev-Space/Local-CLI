/**
 * Office Automation Module
 *
 * Microsoft Office (Word, Excel, PowerPoint) 자동화 도구
 * Windows의 office-server.exe와 HTTP로 통신
 */

export { officeClient } from './office-client.js';
export {
  WORD_TOOLS,
  EXCEL_TOOLS,
  POWERPOINT_TOOLS,
  OFFICE_TOOLS,
  // Individual tool exports
  wordLaunchTool,
  wordWriteTool,
  wordReadTool,
  wordSaveTool,
  wordScreenshotTool,
  wordCloseTool,
  excelLaunchTool,
  excelWriteCellTool,
  excelReadCellTool,
  excelWriteRangeTool,
  excelReadRangeTool,
  excelSaveTool,
  excelScreenshotTool,
  excelCloseTool,
  powerpointLaunchTool,
  powerpointAddSlideTool,
  powerpointWriteTextTool,
  powerpointReadSlideTool,
  powerpointSaveTool,
  powerpointScreenshotTool,
  powerpointCloseTool,
} from './office-tools.js';

/**
 * Start the Office server when tools are enabled
 * Returns true if server is running (started or already running)
 */
export async function startOfficeServer(): Promise<boolean> {
  const { officeClient } = await import('./office-client.js');
  try {
    // Check if already running
    if (await officeClient.isRunning()) {
      return true;
    }
    // Try to start
    return await officeClient.startServer();
  } catch {
    return false;
  }
}

// Track which Office tool groups are enabled
const enabledOfficeGroups = new Set<string>();

/**
 * Register an Office tool group as enabled
 */
export function registerOfficeGroupEnabled(groupId: string): void {
  enabledOfficeGroups.add(groupId);
}

/**
 * Unregister an Office tool group as disabled
 */
export function unregisterOfficeGroupEnabled(groupId: string): void {
  enabledOfficeGroups.delete(groupId);
}

/**
 * Check if any Office tool group is still enabled
 */
export function hasAnyOfficeGroupEnabled(): boolean {
  return enabledOfficeGroups.size > 0;
}

/**
 * Shutdown the Office server when ALL Office tools are disabled
 * Only shuts down if no Office tool groups remain enabled
 */
export async function shutdownOfficeServer(groupId?: string): Promise<void> {
  // Unregister this group
  if (groupId) {
    unregisterOfficeGroupEnabled(groupId);
  }

  // Only shutdown if no Office groups remain enabled
  if (hasAnyOfficeGroupEnabled()) {
    return; // Other Office tools still active, don't shutdown
  }

  const { officeClient } = await import('./office-client.js');
  try {
    if (await officeClient.isRunning()) {
      await officeClient.stopServer();
    }
  } catch {
    // Ignore errors during shutdown
  }
}
