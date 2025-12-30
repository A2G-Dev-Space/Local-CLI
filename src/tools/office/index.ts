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
 * Shutdown the Office server when tools are disabled
 */
export async function shutdownOfficeServer(): Promise<void> {
  const { officeClient } = await import('./office-client.js');
  try {
    if (await officeClient.isRunning()) {
      await officeClient.stopServer();
    }
  } catch {
    // Ignore errors during shutdown
  }
}
