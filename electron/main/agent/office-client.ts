/**
 * Office Client for Electron (Windows Native)
 *
 * Direct PowerShell COM automation for Microsoft Office.
 * Supports Word, Excel, and PowerPoint.
 *
 * This is simpler than the CLI version since we're running natively on Windows.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { logger } from '../logger';

// =============================================================================
// Types
// =============================================================================

export interface OfficeResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  [key: string]: unknown;
}

// =============================================================================
// Base Office Client (PowerShell execution)
// =============================================================================

class OfficeClientBase {
  protected commandTimeout = 30000;
  protected screenshotDir: string;

  constructor() {
    const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    this.screenshotDir = path.join(appDataDir, 'LOCAL-CLI-UI', 'screenshots', 'office');
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  /**
   * Execute PowerShell script and return JSON result
   */
  protected async executePowerShell(script: string): Promise<OfficeResponse> {
    return new Promise((resolve) => {
      const wrappedScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
try {
${script}
} catch {
  @{
    success = $false
    error = $_.Exception.Message
    details = $_.Exception.ToString()
  } | ConvertTo-Json -Compress
}
`;

      const encodedCommand = Buffer.from(wrappedScript, 'utf16le').toString('base64');

      const child = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        encodedCommand,
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString('utf-8');
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString('utf-8');
      });

      const timeoutId = setTimeout(() => {
        child.kill();
        resolve({ success: false, error: 'PowerShell execution timed out' });
      }, this.commandTimeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code !== 0 && !stdout.trim()) {
          logger.debug('[OfficeClient] PowerShell error: ' + stderr);
          resolve({ success: false, error: stderr || `PowerShell exited with code ${code}` });
          return;
        }

        const trimmed = stdout.trim();
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed);
            resolve(parsed);
          } catch {
            resolve({ success: true, message: trimmed });
          }
        } else {
          resolve({ success: true });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        logger.debug('[OfficeClient] PowerShell error: ' + error.message);
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * Check if Office is available
   */
  async isAvailable(): Promise<boolean> {
    // Check if we're on Windows
    if (process.platform !== 'win32') {
      return false;
    }

    const result = await this.executePowerShell(`
@{
  success = $true
  message = "PowerShell available"
} | ConvertTo-Json -Compress
`);
    return result.success;
  }
}

// =============================================================================
// Word Client
// =============================================================================

class WordClient extends OfficeClientBase {
  /**
   * Launch Word application
   */
  async launch(): Promise<OfficeResponse> {
    logger.info('[WordClient] Launching Word');
    return this.executePowerShell(`
$word = $null
try {
  $word = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Word.Application")
  @{ success = $true; message = "Word already running"; isNew = $false } | ConvertTo-Json -Compress
} catch {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $true
  @{ success = $true; message = "Word launched"; isNew = $true } | ConvertTo-Json -Compress
}
`);
  }

  /**
   * Create new document
   */
  async create(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.Documents.Add()
@{ success = $true; message = "New document created" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Open existing document
   */
  async open(filePath: string): Promise<OfficeResponse> {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    return this.executePowerShell(`
$word = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.Documents.Open("${absPath.replace(/\\/g, '\\\\')}")
@{ success = $true; message = "Document opened"; path = "${absPath.replace(/\\/g, '\\\\')}" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Write text to document
   */
  async write(text: string, style?: string): Promise<OfficeResponse> {
    const escapedText = text.replace(/"/g, '`"').replace(/\$/g, '`$');
    const styleCmd = style ? `$selection.Style = $word.ActiveDocument.Styles["${style}"]` : '';
    return this.executePowerShell(`
$word = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
${styleCmd}
$selection.TypeText("${escapedText}")
$selection.TypeParagraph()
@{ success = $true; message = "Text written" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Read document content
   */
  async read(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$content = $doc.Content.Text
@{ success = $true; content = $content; message = "Content read" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Save document
   */
  async save(filePath?: string): Promise<OfficeResponse> {
    if (filePath) {
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      return this.executePowerShell(`
$word = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.SaveAs([ref]"${absPath.replace(/\\/g, '\\\\')}")
@{ success = $true; message = "Document saved"; path = "${absPath.replace(/\\/g, '\\\\')}" } | ConvertTo-Json -Compress
`);
    }
    return this.executePowerShell(`
$word = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.Save()
@{ success = $true; message = "Document saved" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Export to PDF
   */
  async exportPdf(outputPath: string): Promise<OfficeResponse> {
    const absPath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
    return this.executePowerShell(`
$word = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.ExportAsFixedFormat("${absPath.replace(/\\/g, '\\\\')}", 17)
@{ success = $true; message = "Exported to PDF"; path = "${absPath.replace(/\\/g, '\\\\')}" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Close document
   */
  async close(save = true): Promise<OfficeResponse> {
    const saveArg = save ? '-3' : '0'; // wdSaveChanges = -1, wdDoNotSaveChanges = 0, wdPromptToSaveChanges = -2
    return this.executePowerShell(`
$word = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.Close(${saveArg})
@{ success = $true; message = "Document closed" } | ConvertTo-Json -Compress
`);
  }
}

// =============================================================================
// Excel Client
// =============================================================================

class ExcelClient extends OfficeClientBase {
  /**
   * Launch Excel application
   */
  async launch(): Promise<OfficeResponse> {
    logger.info('[ExcelClient] Launching Excel');
    return this.executePowerShell(`
$excel = $null
try {
  $excel = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Excel.Application")
  @{ success = $true; message = "Excel already running"; isNew = $false } | ConvertTo-Json -Compress
} catch {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $true
  @{ success = $true; message = "Excel launched"; isNew = $true } | ConvertTo-Json -Compress
}
`);
  }

  /**
   * Create new workbook
   */
  async create(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$excel = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Excel.Application")
$wb = $excel.Workbooks.Add()
@{ success = $true; message = "New workbook created" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Open existing workbook
   */
  async open(filePath: string): Promise<OfficeResponse> {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    return this.executePowerShell(`
$excel = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Excel.Application")
$wb = $excel.Workbooks.Open("${absPath.replace(/\\/g, '\\\\')}")
@{ success = $true; message = "Workbook opened"; path = "${absPath.replace(/\\/g, '\\\\')}" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Write value to cell
   */
  async writeCell(cell: string, value: string, sheet?: string): Promise<OfficeResponse> {
    const sheetCmd = sheet
      ? `$ws = $excel.ActiveWorkbook.Worksheets.Item("${sheet}")`
      : '$ws = $excel.ActiveSheet';
    const escapedValue = value.replace(/"/g, '`"').replace(/\$/g, '`$');
    return this.executePowerShell(`
$excel = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Excel.Application")
${sheetCmd}
$ws.Range("${cell}").Value2 = "${escapedValue}"
@{ success = $true; message = "Cell written"; cell = "${cell}" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Write values to range
   */
  async writeRange(startCell: string, values: string[][], sheet?: string): Promise<OfficeResponse> {
    const sheetCmd = sheet
      ? `$ws = $excel.ActiveWorkbook.Worksheets.Item("${sheet}")`
      : '$ws = $excel.ActiveSheet';

    const rows = values.length;
    const cols = values[0]?.length || 0;

    // Convert to PowerShell 2D array
    const psArray = values.map(row =>
      `@(${row.map(v => `"${v.replace(/"/g, '`"').replace(/\$/g, '`$')}"`).join(',')})`
    ).join(',');

    return this.executePowerShell(`
$excel = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Excel.Application")
${sheetCmd}
$values = @(${psArray})
$startRow = $ws.Range("${startCell}").Row
$startCol = $ws.Range("${startCell}").Column
for ($i = 0; $i -lt ${rows}; $i++) {
  for ($j = 0; $j -lt ${cols}; $j++) {
    $ws.Cells.Item($startRow + $i, $startCol + $j).Value2 = $values[$i][$j]
  }
}
@{ success = $true; message = "Range written"; startCell = "${startCell}"; rows = ${rows}; cols = ${cols} } | ConvertTo-Json -Compress
`);
  }

  /**
   * Read values from range
   */
  async readRange(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetCmd = sheet
      ? `$ws = $excel.ActiveWorkbook.Worksheets.Item("${sheet}")`
      : '$ws = $excel.ActiveSheet';
    return this.executePowerShell(`
$excel = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Excel.Application")
${sheetCmd}
$rangeObj = $ws.Range("${range}")
$rows = $rangeObj.Rows.Count
$cols = $rangeObj.Columns.Count
$result = @()
for ($i = 1; $i -le $rows; $i++) {
  $row = @()
  for ($j = 1; $j -le $cols; $j++) {
    $cellValue = $rangeObj.Cells.Item($i, $j).Value2
    if ($null -eq $cellValue) { $cellValue = "" }
    $row += [string]$cellValue
  }
  $result += ,@($row)
}
@{ success = $true; values = $result; rows = $rows; cols = $cols; message = "Range read" } | ConvertTo-Json -Compress -Depth 10
`);
  }

  /**
   * Set formula in cell
   */
  async setFormula(cell: string, formula: string, sheet?: string): Promise<OfficeResponse> {
    const sheetCmd = sheet
      ? `$ws = $excel.ActiveWorkbook.Worksheets.Item("${sheet}")`
      : '$ws = $excel.ActiveSheet';
    return this.executePowerShell(`
$excel = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Excel.Application")
${sheetCmd}
$ws.Range("${cell}").Formula = "${formula.replace(/"/g, '`"')}"
@{ success = $true; message = "Formula set"; cell = "${cell}"; formula = "${formula}" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Save workbook
   */
  async save(filePath?: string): Promise<OfficeResponse> {
    if (filePath) {
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      return this.executePowerShell(`
$excel = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Excel.Application")
$wb = $excel.ActiveWorkbook
$wb.SaveAs("${absPath.replace(/\\/g, '\\\\')}")
@{ success = $true; message = "Workbook saved"; path = "${absPath.replace(/\\/g, '\\\\')}" } | ConvertTo-Json -Compress
`);
    }
    return this.executePowerShell(`
$excel = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Excel.Application")
$wb = $excel.ActiveWorkbook
$wb.Save()
@{ success = $true; message = "Workbook saved" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Close workbook
   */
  async close(save = true): Promise<OfficeResponse> {
    const saveArg = save ? '$true' : '$false';
    return this.executePowerShell(`
$excel = [System.Runtime.Interopservices.Marshal]::GetActiveObject("Excel.Application")
$wb = $excel.ActiveWorkbook
$wb.Close(${saveArg})
@{ success = $true; message = "Workbook closed" } | ConvertTo-Json -Compress
`);
  }
}

// =============================================================================
// PowerPoint Client
// =============================================================================

class PowerPointClient extends OfficeClientBase {
  /**
   * Launch PowerPoint application
   */
  async launch(): Promise<OfficeResponse> {
    logger.info('[PowerPointClient] Launching PowerPoint');
    return this.executePowerShell(`
$ppt = $null
try {
  $ppt = [System.Runtime.Interopservices.Marshal]::GetActiveObject("PowerPoint.Application")
  @{ success = $true; message = "PowerPoint already running"; isNew = $false } | ConvertTo-Json -Compress
} catch {
  $ppt = New-Object -ComObject PowerPoint.Application
  $ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
  @{ success = $true; message = "PowerPoint launched"; isNew = $true } | ConvertTo-Json -Compress
}
`);
  }

  /**
   * Create new presentation
   */
  async create(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [System.Runtime.Interopservices.Marshal]::GetActiveObject("PowerPoint.Application")
$pres = $ppt.Presentations.Add([Microsoft.Office.Core.MsoTriState]::msoTrue)
@{ success = $true; message = "New presentation created" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Open existing presentation
   */
  async open(filePath: string): Promise<OfficeResponse> {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    return this.executePowerShell(`
$ppt = [System.Runtime.Interopservices.Marshal]::GetActiveObject("PowerPoint.Application")
$pres = $ppt.Presentations.Open("${absPath.replace(/\\/g, '\\\\')}")
@{ success = $true; message = "Presentation opened"; path = "${absPath.replace(/\\/g, '\\\\')}" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Add slide
   */
  async addSlide(options?: {
    layout?: 'title' | 'title_content' | 'blank' | 'two_content';
    title?: string;
    content?: string;
  }): Promise<OfficeResponse> {
    const layoutMap: Record<string, number> = {
      'title': 1,           // ppLayoutTitle
      'title_content': 2,   // ppLayoutText
      'blank': 7,           // ppLayoutBlank
      'two_content': 4,     // ppLayoutTwoColumnText
    };
    const layoutType = layoutMap[options?.layout || 'title_content'] || 2;

    const titleCmd = options?.title
      ? `$slide.Shapes.Title.TextFrame.TextRange.Text = "${options.title.replace(/"/g, '`"')}"`
      : '';

    // For content, try to find content placeholder
    const contentCmd = options?.content
      ? `
try {
  $contentShape = $slide.Shapes | Where-Object { $_.PlaceholderFormat.Type -eq 2 } | Select-Object -First 1
  if ($contentShape) {
    $contentShape.TextFrame.TextRange.Text = "${options.content.replace(/"/g, '`"')}"
  }
} catch {}
`
      : '';

    return this.executePowerShell(`
$ppt = [System.Runtime.Interopservices.Marshal]::GetActiveObject("PowerPoint.Application")
$pres = $ppt.ActivePresentation
$slideIndex = $pres.Slides.Count + 1
$slide = $pres.Slides.Add($slideIndex, ${layoutType})
${titleCmd}
${contentCmd}
@{ success = $true; message = "Slide added"; slideNumber = $slideIndex } | ConvertTo-Json -Compress
`);
  }

  /**
   * Write text to slide
   */
  async writeText(slideNumber: number, text: string, placeholder?: 'title' | 'content' | 'subtitle'): Promise<OfficeResponse> {
    const placeholderMap: Record<string, number> = {
      'title': 1,
      'subtitle': 2,
      'content': 2,
    };
    const phType = placeholderMap[placeholder || 'content'] || 2;

    return this.executePowerShell(`
$ppt = [System.Runtime.Interopservices.Marshal]::GetActiveObject("PowerPoint.Application")
$pres = $ppt.ActivePresentation
$slide = $pres.Slides.Item(${slideNumber})
if (${phType} -eq 1) {
  $slide.Shapes.Title.TextFrame.TextRange.Text = "${text.replace(/"/g, '`"')}"
} else {
  $contentShape = $slide.Shapes | Where-Object { $_.PlaceholderFormat.Type -eq ${phType} } | Select-Object -First 1
  if ($contentShape) {
    $contentShape.TextFrame.TextRange.Text = "${text.replace(/"/g, '`"')}"
  } else {
    $tb = $slide.Shapes.AddTextbox(1, 100, 200, 500, 300)
    $tb.TextFrame.TextRange.Text = "${text.replace(/"/g, '`"')}"
  }
}
@{ success = $true; message = "Text written to slide"; slideNumber = ${slideNumber} } | ConvertTo-Json -Compress
`);
  }

  /**
   * Save presentation
   */
  async save(filePath?: string): Promise<OfficeResponse> {
    if (filePath) {
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      return this.executePowerShell(`
$ppt = [System.Runtime.Interopservices.Marshal]::GetActiveObject("PowerPoint.Application")
$pres = $ppt.ActivePresentation
$pres.SaveAs("${absPath.replace(/\\/g, '\\\\')}")
@{ success = $true; message = "Presentation saved"; path = "${absPath.replace(/\\/g, '\\\\')}" } | ConvertTo-Json -Compress
`);
    }
    return this.executePowerShell(`
$ppt = [System.Runtime.Interopservices.Marshal]::GetActiveObject("PowerPoint.Application")
$pres = $ppt.ActivePresentation
$pres.Save()
@{ success = $true; message = "Presentation saved" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Export to PDF
   */
  async exportPdf(outputPath: string): Promise<OfficeResponse> {
    const absPath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
    return this.executePowerShell(`
$ppt = [System.Runtime.Interopservices.Marshal]::GetActiveObject("PowerPoint.Application")
$pres = $ppt.ActivePresentation
$pres.SaveAs("${absPath.replace(/\\/g, '\\\\')}", 32) # ppSaveAsPDF = 32
@{ success = $true; message = "Exported to PDF"; path = "${absPath.replace(/\\/g, '\\\\')}" } | ConvertTo-Json -Compress
`);
  }

  /**
   * Close presentation
   */
  async close(save = true): Promise<OfficeResponse> {
    const saveCmd = save ? '$pres.Save()' : '';
    return this.executePowerShell(`
$ppt = [System.Runtime.Interopservices.Marshal]::GetActiveObject("PowerPoint.Application")
$pres = $ppt.ActivePresentation
${saveCmd}
$pres.Close()
@{ success = $true; message = "Presentation closed" } | ConvertTo-Json -Compress
`);
  }
}

// =============================================================================
// Export Clients
// =============================================================================

export const wordClient = new WordClient();
export const excelClient = new ExcelClient();
export const powerPointClient = new PowerPointClient();

export default {
  word: wordClient,
  excel: excelClient,
  powerPoint: powerPointClient,
};
