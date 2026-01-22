/**
 * Word Client
 *
 * Microsoft Word automation via PowerShell COM.
 * Extends OfficeClientBase with Word-specific operations.
 */

import { OfficeClientBase, OfficeResponse, ScreenshotResponse } from './office-client-base';

export class WordClient extends OfficeClientBase {
  // ===========================================================================
  // Microsoft Word Operations
  // ===========================================================================

  async wordLaunch(): Promise<OfficeResponse> {
    return this.executePowerShell(`
try {
  $word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
  $word.Visible = $true
  @{ success = $true; message = "Connected to existing Word instance" } | ConvertTo-Json -Compress
} catch {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $true
  @{ success = $true; message = "Launched new Word instance" } | ConvertTo-Json -Compress
}
`);
  }

  async wordCreate(): Promise<OfficeResponse> {
    return this.executePowerShell(`
try {
  $word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
} catch {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $true
}
$doc = $word.Documents.Add()
@{ success = $true; message = "Created new document"; document_name = $doc.Name } | ConvertTo-Json -Compress
`);
  }

  async wordWrite(
    text: string,
    options?: { fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean; newParagraph?: boolean }
  ): Promise<OfficeResponse> {
    const escapedText = text.replace(/'/g, "''").replace(/`/g, '``');

    // Auto-detect Korean text and set appropriate font if not specified
    // Use 'Malgun Gothic' (English name) for compatibility with all Windows language settings
    const hasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
    let fontName = options?.fontName?.replace(/'/g, "''") || '';
    if (!fontName && hasKorean) {
      fontName = 'Malgun Gothic'; // Korean font (works on all Windows regardless of UI language)
    }

    const fontSize = options?.fontSize || 0;
    const bold = options?.bold ? '$true' : '$false';
    const italic = options?.italic ? '$true' : '$false';
    // Default to true: add paragraph break after writing (prevents formatting bleed)
    const newParagraph = options?.newParagraph !== false;

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection

${fontName ? `$selection.Font.Name = '${fontName}'` : ''}
${fontSize ? `$selection.Font.Size = ${fontSize}` : ''}
$selection.Font.Bold = ${bold}
$selection.Font.Italic = ${italic}

$selection.TypeText('${escapedText}')
${newParagraph ? '$selection.TypeParagraph()' : ''}
@{ success = $true; message = "Text written successfully" } | ConvertTo-Json -Compress
`);
  }

  async wordRead(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$content = $doc.Content.Text
@{
  success = $true
  document_name = $doc.Name
  content = $content
  character_count = $content.Length
} | ConvertTo-Json -Compress
`);
  }

  async wordSave(filePath?: string): Promise<OfficeResponse> {
    const windowsPath = filePath ? this.toWindowsPath(filePath).replace(/'/g, "''") : '';
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
${windowsPath ? `$doc.SaveAs([ref]'${windowsPath}')` : '$doc.Save()'}
@{ success = $true; message = "Document saved"; path = $doc.FullName } | ConvertTo-Json -Compress
`);
  }

  async wordOpen(filePath: string): Promise<OfficeResponse> {
    const windowsPath = this.toWindowsPath(filePath).replace(/'/g, "''");
    return this.executePowerShell(`
try {
  $word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
} catch {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $true
}
$doc = $word.Documents.Open('${windowsPath}')
@{ success = $true; message = "Document opened"; document_name = $doc.Name; path = $doc.FullName } | ConvertTo-Json -Compress
`);
  }

  async wordClose(save: boolean = false): Promise<OfficeResponse> {
    const saveOption = save ? '-1' : '0'; // wdSaveChanges = -1, wdDoNotSaveChanges = 0
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$word.ActiveDocument.Close(${saveOption})
@{ success = $true; message = "Document closed" } | ConvertTo-Json -Compress
`);
  }

  async wordQuit(save: boolean = false): Promise<OfficeResponse> {
    const saveOption = save ? '-1' : '0';
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$word.Quit(${saveOption})
@{ success = $true; message = "Word closed" } | ConvertTo-Json -Compress
`);
  }

  async wordSetFont(options: {
    fontName?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    highlightColor?: string;
  }): Promise<OfficeResponse> {
    const commands: string[] = [];
    if (options.fontName) commands.push(`$selection.Font.Name = '${options.fontName.replace(/'/g, "''")}'`);
    if (options.fontSize) commands.push(`$selection.Font.Size = ${options.fontSize}`);
    if (options.bold !== undefined) commands.push(`$selection.Font.Bold = ${options.bold ? '$true' : '$false'}`);
    if (options.italic !== undefined) commands.push(`$selection.Font.Italic = ${options.italic ? '$true' : '$false'}`);
    if (options.underline !== undefined) commands.push(`$selection.Font.Underline = ${options.underline ? '1' : '0'}`);
    if (options.color) {
      const rgb = this.hexToRgb(options.color);
      if (rgb) commands.push(`$selection.Font.Color = ${rgb.r + rgb.g * 256 + rgb.b * 65536}`);
    }

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
${commands.join('\n')}
@{ success = $true; message = "Font properties set" } | ConvertTo-Json -Compress
`);
  }

  async wordSetParagraph(options: {
    alignment?: 'left' | 'center' | 'right' | 'justify';
    lineSpacing?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    firstLineIndent?: number;
  }): Promise<OfficeResponse> {
    const alignmentMap: Record<string, number> = { left: 0, center: 1, right: 2, justify: 3 };
    const commands: string[] = [];
    if (options.alignment) commands.push(`$selection.ParagraphFormat.Alignment = ${alignmentMap[options.alignment]}`);
    if (options.lineSpacing) commands.push(`$selection.ParagraphFormat.LineSpacing = ${options.lineSpacing}`);
    if (options.spaceBefore) commands.push(`$selection.ParagraphFormat.SpaceBefore = ${options.spaceBefore}`);
    if (options.spaceAfter) commands.push(`$selection.ParagraphFormat.SpaceAfter = ${options.spaceAfter}`);
    if (options.firstLineIndent) commands.push(`$selection.ParagraphFormat.FirstLineIndent = ${options.firstLineIndent}`);

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
${commands.join('\n')}
@{ success = $true; message = "Paragraph formatting set" } | ConvertTo-Json -Compress
`);
  }

  async wordAddHyperlink(text: string, url: string): Promise<OfficeResponse> {
    const escapedText = text.replace(/'/g, "''");
    const escapedUrl = url.replace(/'/g, "''");
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$doc = $word.ActiveDocument
$range = $selection.Range
$doc.Hyperlinks.Add($range, '${escapedUrl}', '', '', '${escapedText}')
@{ success = $true; message = "Hyperlink added" } | ConvertTo-Json -Compress
`);
  }

  async wordAddTable(rows: number, cols: number, data?: string[][]): Promise<OfficeResponse> {
    let dataScript = '';
    let hasKorean = false;

    if (data) {
      const dataLines: string[] = [];
      for (let i = 0; i < data.length && i < rows; i++) {
        const row = data[i];
        if (!row) continue;
        for (let j = 0; j < row.length && j < cols; j++) {
          const cellValue = row[j];
          if (cellValue === undefined) continue;
          // Check for Korean text
          if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(cellValue)) hasKorean = true;
          const val = cellValue.replace(/'/g, "''");
          dataLines.push(`$table.Cell(${i + 1}, ${j + 1}).Range.Text = '${val}'`);
        }
      }
      dataScript = dataLines.join('\n');
    }

    // Set Korean font for the table if Korean text is detected
    const fontScript = hasKorean ? "$table.Range.Font.Name = 'Malgun Gothic'" : '';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$range = $word.Selection.Range
$table = $doc.Tables.Add($range, ${rows}, ${cols})
$table.Borders.Enable = $true
${fontScript}
${dataScript}
# Move cursor after the table and add a new paragraph
$tableEnd = $table.Range
$tableEnd.Collapse(0)  # wdCollapseEnd = 0
$tableEnd.Select()
$word.Selection.TypeParagraph()
@{ success = $true; message = "Table added with ${rows} rows and ${cols} columns" } | ConvertTo-Json -Compress
`);
  }

  async wordAddImage(imagePath: string, width?: number, height?: number): Promise<OfficeResponse> {
    const windowsPath = this.toWindowsPath(imagePath).replace(/'/g, "''");
    const sizeScript = width || height
      ? `
${width ? '$shape.Width = ' + width : ''}
${height ? '$shape.Height = ' + height : ''}`
      : '';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$shape = $selection.InlineShapes.AddPicture('${windowsPath}')
${sizeScript}
# Move cursor after the image
$selection.MoveRight(1, 1)  # wdCharacter = 1
@{ success = $true; message = "Image added" } | ConvertTo-Json -Compress
`);
  }

  async wordDeleteText(start: number, end: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$range = $doc.Range(${start}, ${end})
$range.Delete()
@{ success = $true; message = "Text deleted from position ${start} to ${end}" } | ConvertTo-Json -Compress
`);
  }

  async wordFindReplace(find: string, replace: string, replaceAll: boolean = true): Promise<OfficeResponse> {
    const escapedFind = find.replace(/'/g, "''");
    const escapedReplace = replace.replace(/'/g, "''");
    const replaceOption = replaceAll ? '2' : '1'; // wdReplaceAll = 2, wdReplaceOne = 1

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$findObj = $doc.Content.Find
$findObj.ClearFormatting()
$findObj.Replacement.ClearFormatting()
$findObj.Text = '${escapedFind}'
$findObj.Replacement.Text = '${escapedReplace}'
$found = $findObj.Execute([ref]'${escapedFind}', [ref]$false, [ref]$false, [ref]$false, [ref]$false, [ref]$false, [ref]$true, [ref]0, [ref]$false, [ref]'${escapedReplace}', [ref]${replaceOption})
@{ success = $true; message = "Find and replace completed"; found = $found } | ConvertTo-Json -Compress
`);
  }

  async wordSetStyle(styleName: string, preserveKoreanFont: boolean = true): Promise<OfficeResponse> {
    const escapedStyle = styleName.replace(/'/g, "''");

    // Preserve Korean font after style change to prevent garbled text
    const fontPreserveScript = preserveKoreanFont ? `
# Check if selection contains Korean text and preserve font
$selectedText = $selection.Text
if ($selectedText -match '[가-힣ㄱ-ㅎㅏ-ㅣ]') {
  $selection.Font.Name = 'Malgun Gothic'
}` : '';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$selection.Style = '${escapedStyle}'
${fontPreserveScript}
@{ success = $true; message = "Style '${escapedStyle}' applied" } | ConvertTo-Json -Compress
`);
  }

  async wordInsertBreak(breakType: 'page' | 'line' | 'section' = 'page'): Promise<OfficeResponse> {
    const breakTypeMap: Record<string, number> = { page: 7, line: 6, section: 2 }; // wdPageBreak, wdLineBreak, wdSectionBreakNextPage
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$selection.InsertBreak(${breakTypeMap[breakType]})
@{ success = $true; message = "${breakType} break inserted" } | ConvertTo-Json -Compress
`);
  }

  async wordGetSelection(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
@{
  success = $true
  text = $selection.Text
  start = $selection.Start
  end = $selection.End
  font_name = $selection.Font.Name
  font_size = $selection.Font.Size
} | ConvertTo-Json -Compress
`);
  }

  async wordSelectAll(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$word.ActiveDocument.Content.Select()
@{ success = $true; message = "All content selected" } | ConvertTo-Json -Compress
`);
  }

  async wordGoto(what: 'page' | 'line' | 'bookmark', target: number | string): Promise<OfficeResponse> {
    const whatMap: Record<string, number> = { page: 1, line: 3, bookmark: -1 };
    const isBookmark = what === 'bookmark';
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
${isBookmark
    ? `$selection.GoTo(-1, 0, 0, '${String(target).replace(/'/g, "''")}')`
    : `$selection.GoTo(${whatMap[what]}, 0, ${target})`}
@{ success = $true; message = "Moved to ${what} ${target}" } | ConvertTo-Json -Compress
`);
  }

  async wordInsertHeader(text: string, options?: { fontName?: string; fontSize?: number }): Promise<OfficeResponse> {
    const escapedText = text.replace(/'/g, "''");
    // Auto-detect Korean and set font
    const hasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
    const fontName = options?.fontName || (hasKorean ? 'Malgun Gothic' : '');

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$section = $doc.Sections(1)
$header = $section.Headers(1).Range
$header.Text = '${escapedText}'
${fontName ? `$header.Font.Name = '${fontName}'` : ''}
${options?.fontSize ? `$header.Font.Size = ${options.fontSize}` : ''}
@{ success = $true; message = "Header added" } | ConvertTo-Json -Compress
`);
  }

  async wordInsertFooter(text: string, options?: { fontName?: string; fontSize?: number }): Promise<OfficeResponse> {
    const escapedText = text.replace(/'/g, "''");
    // Auto-detect Korean and set font
    const hasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
    const fontName = options?.fontName || (hasKorean ? 'Malgun Gothic' : '');

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$section = $doc.Sections(1)
$footer = $section.Footers(1).Range
$footer.Text = '${escapedText}'
${fontName ? `$footer.Font.Name = '${fontName.replace(/'/g, "''")}'` : ''}
${options?.fontSize ? `$footer.Font.Size = ${options.fontSize}` : ''}
@{ success = $true; message = "Footer added" } | ConvertTo-Json -Compress
`);
  }

  async wordInsertPageNumber(alignment: 'left' | 'center' | 'right' = 'center'): Promise<OfficeResponse> {
    const alignMap: Record<string, number> = { left: 0, center: 1, right: 2 };
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$section = $doc.Sections(1)
$footer = $section.Footers(1)
$footer.PageNumbers.Add(${alignMap[alignment]})
@{ success = $true; message = "Page numbers added" } | ConvertTo-Json -Compress
`);
  }

  async wordExportToPDF(outputPath: string): Promise<OfficeResponse> {
    const windowsPath = this.toWindowsPath(outputPath).replace(/'/g, "''");
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.ExportAsFixedFormat('${windowsPath}', 17)  # 17 = wdExportFormatPDF
@{ success = $true; message = "Exported to PDF"; path = '${windowsPath}' } | ConvertTo-Json -Compress
`);
  }

  async wordPrint(copies: number = 1): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.PrintOut([ref]$false, [ref]$false, [ref]0, [ref]"", [ref]"", [ref]"", [ref]0, [ref]${copies})
@{ success = $true; message = "Print job sent (${copies} copies)" } | ConvertTo-Json -Compress
`);
  }

  async wordScreenshot(): Promise<ScreenshotResponse> {
    // Word screenshot via temporary file export
    const result = await this.executePowerShell(`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument

# Switch to Print Preview to get a good screenshot
$originalView = $word.ActiveWindow.View.Type
$word.ActiveWindow.View.Type = 3  # wdPrintView

try {
  # Method 1: Try CopyAsPicture on content
  $doc.Content.Select()
  $word.Selection.CopyAsPicture()
  Start-Sleep -Milliseconds 300

  $img = [System.Windows.Forms.Clipboard]::GetImage()

  if ($img -eq $null) {
    # Method 2: Fallback - capture the Word window
    $hwnd = $word.Application.Hwnd
    if ($hwnd -gt 0) {
      Add-Type @"
        using System;
        using System.Drawing;
        using System.Runtime.InteropServices;
        public class Screenshot {
          [DllImport("user32.dll")]
          public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
          [DllImport("user32.dll")]
          public static extern bool SetForegroundWindow(IntPtr hWnd);
          public struct RECT { public int Left, Top, Right, Bottom; }
          public static Bitmap CaptureWindow(IntPtr hwnd) {
            RECT rect;
            GetWindowRect(hwnd, out rect);
            int width = rect.Right - rect.Left;
            int height = rect.Bottom - rect.Top;
            if (width <= 0 || height <= 0) return null;
            Bitmap bmp = new Bitmap(width, height);
            using (Graphics g = Graphics.FromImage(bmp)) {
              g.CopyFromScreen(rect.Left, rect.Top, 0, 0, new Size(width, height));
            }
            return bmp;
          }
        }
"@
      [Screenshot]::SetForegroundWindow([IntPtr]$hwnd)
      Start-Sleep -Milliseconds 500
      $img = [Screenshot]::CaptureWindow([IntPtr]$hwnd)
    }
  }

  if ($img -eq $null) {
    @{ success = $false; error = "Failed to capture screenshot" } | ConvertTo-Json -Compress
    return
  }

  # Convert to base64
  $ms = New-Object System.IO.MemoryStream
  $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  $base64 = [Convert]::ToBase64String($bytes)
  $ms.Dispose()
  $img.Dispose()

  # Deselect
  $word.Selection.Collapse(1)

  @{
    success = $true
    image = $base64
    format = "png"
    encoding = "base64"
  } | ConvertTo-Json -Compress
} finally {
  # Restore original view
  $word.ActiveWindow.View.Type = $originalView
}
`);
    return result as ScreenshotResponse;
  }

  // -------------------------------------------------------------------------
  // Word Table Manipulation
  // -------------------------------------------------------------------------

  async wordSetTableCell(
    tableIndex: number,
    row: number,
    col: number,
    text: string,
    options?: { fontName?: string; fontSize?: number; bold?: boolean }
  ): Promise<OfficeResponse> {
    const escapedText = text.replace(/'/g, "''");
    const hasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
    let fontName = options?.fontName?.replace(/'/g, "''") || '';
    if (!fontName && hasKorean) {
      fontName = 'Malgun Gothic';
    }

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$table = $doc.Tables(${tableIndex})
$cell = $table.Cell(${row}, ${col})
$cell.Range.Text = '${escapedText}'
${fontName ? `$cell.Range.Font.Name = '${fontName}'` : ''}
${options?.fontSize ? `$cell.Range.Font.Size = ${options.fontSize}` : ''}
${options?.bold ? '$cell.Range.Font.Bold = -1' : ''}
@{ success = $true; message = "Table cell (${row},${col}) updated" } | ConvertTo-Json -Compress
`);
  }

  async wordMergeTableCells(
    tableIndex: number,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$table = $doc.Tables(${tableIndex})
$startCell = $table.Cell(${startRow}, ${startCol})
$endCell = $table.Cell(${endRow}, ${endCol})
$startCell.Merge($endCell)
@{ success = $true; message = "Table cells merged" } | ConvertTo-Json -Compress
`);
  }

  async wordSetTableStyle(tableIndex: number, styleName: string, preserveKoreanFont: boolean = true): Promise<OfficeResponse> {
    const escapedStyle = styleName.replace(/'/g, "''");

    // Map common style names to Word's built-in style constants (wdBuiltinStyle)
    // These work regardless of the UI language
    const styleConstMap: Record<string, number> = {
      'table grid': -176,
      'table normal': -106,
      '표 눈금': -176,       // Korean for Table Grid
      '표 보통': -106,       // Korean for Table Normal
    };

    const lowerStyleName = styleName.toLowerCase();
    const styleConst = styleConstMap[lowerStyleName];

    // Preserve Korean font after style change to prevent garbled text
    const fontPreserveScript = preserveKoreanFont ? `
# Check if table contains Korean text and preserve font
$tableText = $table.Range.Text
if ($tableText -match '[가-힣ㄱ-ㅎㅏ-ㅣ]') {
  $table.Range.Font.Name = 'Malgun Gothic'
}` : '';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$table = $doc.Tables(${tableIndex})
try {
  ${styleConst !== undefined
    ? `$table.Style = ${styleConst}`
    : `$table.Style = '${escapedStyle}'`}
  ${fontPreserveScript}
  @{ success = $true; message = "Table style set" } | ConvertTo-Json -Compress
} catch {
  # Try with style name directly if constant fails
  try {
    $table.Style = '${escapedStyle}'
    ${fontPreserveScript}
    @{ success = $true; message = "Table style set to '${escapedStyle}'" } | ConvertTo-Json -Compress
  } catch {
    @{ success = $false; error = "Style '${escapedStyle}' not found. Try: 'Table Grid', 'Table Normal', or numeric style index." } | ConvertTo-Json -Compress
  }
}
`);
  }

  async wordSetTableBorder(
    tableIndex: number,
    options: { style?: 'single' | 'double' | 'thick' | 'none'; color?: string }
  ): Promise<OfficeResponse> {
    // wdLineStyleSingle=1, wdLineStyleDouble=7, wdLineStyleThickThinLargeGap=14, wdLineStyleNone=0
    const styleMap: Record<string, number> = {
      single: 1,
      double: 7,
      thick: 14,
      none: 0,
    };
    const lineStyle = styleMap[options.style || 'single'] ?? 1;

    const colorValue = options.color ? (() => {
      const rgb = this.hexToRgb(options.color);
      return rgb ? rgb.r + rgb.g * 256 + rgb.b * 65536 : 0;
    })() : 0;

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$table = $doc.Tables(${tableIndex})

# Border indices: wdBorderTop=-1, wdBorderLeft=-2, wdBorderBottom=-3, wdBorderRight=-4
# wdBorderHorizontal=-5, wdBorderVertical=-6
$borderIndices = @(-1, -2, -3, -4)
foreach ($idx in $borderIndices) {
  $table.Borders.Item($idx).LineStyle = ${lineStyle}
  ${colorValue ? `$table.Borders.Item($idx).Color = ${colorValue}` : ''}
}

# Inside borders (may not exist for 1-row or 1-column tables)
try {
  $table.Borders.Item(-5).LineStyle = ${lineStyle}  # Horizontal inside
  ${colorValue ? `$table.Borders.Item(-5).Color = ${colorValue}` : ''}
} catch {}
try {
  $table.Borders.Item(-6).LineStyle = ${lineStyle}  # Vertical inside
  ${colorValue ? `$table.Borders.Item(-6).Color = ${colorValue}` : ''}
} catch {}

@{ success = $true; message = "Table border set" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Word Bookmark
  // -------------------------------------------------------------------------

  async wordAddBookmark(name: string, text?: string): Promise<OfficeResponse> {
    const escapedName = name.replace(/'/g, "''");
    const escapedText = text ? text.replace(/'/g, "''") : '';
    const originalTextLength = text ? text.length : 0;  // Use original length, not escaped
    const hasKorean = text ? /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text) : false;

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$selection = $word.Selection
${text ? `${hasKorean ? "$selection.Font.Name = 'Malgun Gothic'" : ''}
$selection.TypeText('${escapedText}')
$selection.MoveLeft(1, ${originalTextLength}, 1)` : ''}
$doc.Bookmarks.Add('${escapedName}', $selection.Range)
@{ success = $true; message = "Bookmark '${escapedName}' added" } | ConvertTo-Json -Compress
`);
  }

  async wordGetBookmarks(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$bookmarks = @()
foreach ($bm in $doc.Bookmarks) {
  $bookmarks += @{
    name = $bm.Name
    start = $bm.Range.Start
    end = $bm.Range.End
    text = $bm.Range.Text
  }
}
@{ success = $true; bookmarks = $bookmarks } | ConvertTo-Json -Compress -Depth 5
`);
  }

  async wordDeleteBookmark(name: string): Promise<OfficeResponse> {
    const escapedName = name.replace(/'/g, "''");
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
if ($doc.Bookmarks.Exists('${escapedName}')) {
  $doc.Bookmarks('${escapedName}').Delete()
  @{ success = $true; message = "Bookmark '${escapedName}' deleted" } | ConvertTo-Json -Compress
} else {
  @{ success = $false; error = "Bookmark '${escapedName}' not found" } | ConvertTo-Json -Compress
}
`);
  }

  async wordGotoBookmark(name: string): Promise<OfficeResponse> {
    const escapedName = name.replace(/'/g, "''");
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
if ($doc.Bookmarks.Exists('${escapedName}')) {
  $doc.Bookmarks('${escapedName}').Select()
  @{ success = $true; message = "Moved to bookmark '${escapedName}'" } | ConvertTo-Json -Compress
} else {
  @{ success = $false; error = "Bookmark '${escapedName}' not found" } | ConvertTo-Json -Compress
}
`);
  }

  // -------------------------------------------------------------------------
  // Word Comments
  // -------------------------------------------------------------------------

  async wordAddComment(commentText: string, author?: string): Promise<OfficeResponse> {
    const escapedText = commentText.replace(/'/g, "''");
    const escapedAuthor = author?.replace(/'/g, "''") || '';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$selection = $word.Selection
$comment = $doc.Comments.Add($selection.Range, '${escapedText}')
${escapedAuthor ? `$comment.Author = '${escapedAuthor}'` : ''}
@{ success = $true; message = "Comment added" } | ConvertTo-Json -Compress
`);
  }

  async wordGetComments(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$comments = @()
foreach ($c in $doc.Comments) {
  $comments += @{
    index = $c.Index
    author = $c.Author
    text = $c.Range.Text
    date = $c.Date.ToString("yyyy-MM-dd HH:mm:ss")
    scope = $c.Scope.Text
  }
}
@{ success = $true; comments = $comments; count = $doc.Comments.Count } | ConvertTo-Json -Compress -Depth 5
`);
  }

  async wordDeleteComment(index: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
if (${index} -le $doc.Comments.Count) {
  $doc.Comments(${index}).Delete()
  @{ success = $true; message = "Comment ${index} deleted" } | ConvertTo-Json -Compress
} else {
  @{ success = $false; error = "Comment index ${index} out of range" } | ConvertTo-Json -Compress
}
`);
  }

  async wordDeleteAllComments(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$count = $doc.Comments.Count
while ($doc.Comments.Count -gt 0) {
  $doc.Comments(1).Delete()
}
@{ success = $true; message = "Deleted $count comments" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Word Lists
  // -------------------------------------------------------------------------

  async wordCreateBulletList(items: string[]): Promise<OfficeResponse> {
    const itemsScript = items.map(item => {
      const escaped = item.replace(/'/g, "''");
      const hasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(item);
      // Set font BEFORE TypeText to prevent garbled Korean
      return `${hasKorean ? "$selection.Font.Name = 'Malgun Gothic'" : ''}
$selection.TypeText('${escaped}')
$selection.TypeParagraph()`;
    }).join('\n');

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$selection.Range.ListFormat.ApplyBulletDefault()
${itemsScript}
$selection.Range.ListFormat.RemoveNumbers()
@{ success = $true; message = "Bullet list created with ${items.length} items" } | ConvertTo-Json -Compress
`);
  }

  async wordCreateNumberedList(items: string[]): Promise<OfficeResponse> {
    const itemsScript = items.map(item => {
      const escaped = item.replace(/'/g, "''");
      const hasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(item);
      // Set font BEFORE TypeText to prevent garbled Korean
      return `${hasKorean ? "$selection.Font.Name = 'Malgun Gothic'" : ''}
$selection.TypeText('${escaped}')
$selection.TypeParagraph()`;
    }).join('\n');

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$selection.Range.ListFormat.ApplyNumberDefault()
${itemsScript}
$selection.Range.ListFormat.RemoveNumbers()
@{ success = $true; message = "Numbered list created with ${items.length} items" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Word Page Setup
  // -------------------------------------------------------------------------

  async wordSetPageMargins(options: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  }): Promise<OfficeResponse> {
    // Points (1 inch = 72 points)
    const commands: string[] = [];
    if (options.top !== undefined) commands.push(`$pageSetup.TopMargin = ${options.top}`);
    if (options.bottom !== undefined) commands.push(`$pageSetup.BottomMargin = ${options.bottom}`);
    if (options.left !== undefined) commands.push(`$pageSetup.LeftMargin = ${options.left}`);
    if (options.right !== undefined) commands.push(`$pageSetup.RightMargin = ${options.right}`);

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$pageSetup = $doc.PageSetup
${commands.join('\n')}
@{ success = $true; message = "Page margins updated" } | ConvertTo-Json -Compress
`);
  }

  async wordSetPageOrientation(orientation: 'portrait' | 'landscape'): Promise<OfficeResponse> {
    // wdOrientPortrait=0, wdOrientLandscape=1
    const value = orientation === 'landscape' ? 1 : 0;
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.PageSetup.Orientation = ${value}
@{ success = $true; message = "Page orientation set to ${orientation}" } | ConvertTo-Json -Compress
`);
  }

  async wordSetPageSize(size: 'A4' | 'Letter' | 'Legal' | 'A3' | 'B5' | 'custom', width?: number, height?: number): Promise<OfficeResponse> {
    // wdPaperA4=7, wdPaperLetter=2, wdPaperLegal=4, wdPaperA3=6, wdPaperB5=13
    const sizeMap: Record<string, number> = {
      A4: 7,
      Letter: 2,
      Legal: 4,
      A3: 6,
      B5: 13,
    };

    if (size === 'custom' && width && height) {
      return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.PageSetup.PageWidth = ${width}
$doc.PageSetup.PageHeight = ${height}
@{ success = $true; message = "Page size set to custom (${width}x${height})" } | ConvertTo-Json -Compress
`);
    }

    const paperSize = sizeMap[size] ?? 7;
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.PageSetup.PaperSize = ${paperSize}
@{ success = $true; message = "Page size set to ${size}" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Word Watermark
  // -------------------------------------------------------------------------

  async wordAddWatermark(text: string, options?: {
    fontName?: string;
    fontSize?: number;
    color?: string;
    semitransparent?: boolean;
  }): Promise<OfficeResponse> {
    const escapedText = text.replace(/'/g, "''");
    const fontName = options?.fontName?.replace(/'/g, "''") || 'Arial';
    const fontSize = options?.fontSize || 72;
    const colorValue = options?.color ? (() => {
      const rgb = this.hexToRgb(options.color);
      return rgb ? rgb.r + rgb.g * 256 + rgb.b * 65536 : 12632256; // default light gray
    })() : 12632256;
    const semitransparent = options?.semitransparent !== false ? '0.5' : '0';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument

# Store original view and switch to Print Layout to access headers
$originalView = $word.ActiveWindow.View.Type
$word.ActiveWindow.View.Type = 3  # wdPrintView

try {
  # Add watermark to header
  $section = $doc.Sections(1)
  $header = $section.Headers(1)  # wdHeaderFooterPrimary = 1

  # Create text effect shape (without Select to avoid view access issues)
  $shape = $header.Shapes.AddTextEffect(0, '${escapedText}', '${fontName}', ${fontSize}, 0, 0, 0, 0)
  $shape.Name = "PowerPlusWaterMarkObject"
  $shape.TextEffect.NormalizedHeight = 0
  $shape.Line.Visible = 0
  $shape.Fill.Visible = -1
  $shape.Fill.Solid()
  $shape.Fill.ForeColor.RGB = ${colorValue}
  $shape.Fill.Transparency = ${semitransparent}
  $shape.Rotation = 315
  $shape.LockAspectRatio = -1
  $shape.Height = 100
  $shape.Width = 350
  $shape.Left = -999995  # wdShapeCenter
  $shape.Top = -999995   # wdShapeCenter
  $shape.WrapFormat.AllowOverlap = -1
  $shape.WrapFormat.Type = 3  # wdWrapBehind

  @{ success = $true; message = "Watermark added" } | ConvertTo-Json -Compress
} finally {
  # Restore original view
  $word.ActiveWindow.View.Type = $originalView
}
`);
  }

  async wordRemoveWatermark(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument

# Switch to Print Layout view to access headers (wdPrintView = 3)
$word.ActiveWindow.View.Type = 3

foreach ($section in $doc.Sections) {
  $header = $section.Headers(1)
  foreach ($shape in $header.Shapes) {
    if ($shape.Name -like "*WaterMark*") {
      $shape.Delete()
    }
  }
}
@{ success = $true; message = "Watermark removed" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Word Textbox & Shapes
  // -------------------------------------------------------------------------

  async wordAddTextbox(
    text: string,
    left: number,
    top: number,
    width: number,
    height: number,
    options?: { fontName?: string; fontSize?: number; borderColor?: string; fillColor?: string }
  ): Promise<OfficeResponse> {
    const escapedText = text.replace(/'/g, "''");
    const hasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
    let fontName = options?.fontName?.replace(/'/g, "''") || '';
    if (!fontName && hasKorean) {
      fontName = 'Malgun Gothic';
    }

    const commands: string[] = [];
    if (fontName) commands.push(`$shape.TextFrame.TextRange.Font.Name = '${fontName}'`);
    if (options?.fontSize) commands.push(`$shape.TextFrame.TextRange.Font.Size = ${options.fontSize}`);
    if (options?.borderColor) {
      const rgb = this.hexToRgb(options.borderColor);
      if (rgb) {
        commands.push('$shape.Line.Visible = -1');
        commands.push(`$shape.Line.ForeColor.RGB = ${rgb.r + rgb.g * 256 + rgb.b * 65536}`);
      }
    }
    if (options?.fillColor) {
      const rgb = this.hexToRgb(options.fillColor);
      if (rgb) {
        commands.push('$shape.Fill.Visible = -1');
        commands.push(`$shape.Fill.ForeColor.RGB = ${rgb.r + rgb.g * 256 + rgb.b * 65536}`);
      }
    } else {
      commands.push('$shape.Fill.Visible = 0');
    }

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$shape = $doc.Shapes.AddTextbox(1, ${left}, ${top}, ${width}, ${height})
${fontName ? `$shape.TextFrame.TextRange.Font.Name = '${fontName}'` : ''}
$shape.TextFrame.TextRange.Text = '${escapedText}'
${commands.filter(c => !c.includes('Font.Name')).join('\n')}
@{ success = $true; message = "Textbox added"; shape_name = $shape.Name } | ConvertTo-Json -Compress
`);
  }

  async wordAddShape(
    shapeType: 'rectangle' | 'oval' | 'roundedRectangle' | 'triangle' | 'diamond' | 'arrow' | 'line',
    left: number,
    top: number,
    width: number,
    height: number,
    options?: { fillColor?: string; lineColor?: string; lineWeight?: number }
  ): Promise<OfficeResponse> {
    // Line is special - use AddLine instead of AddShape
    if (shapeType === 'line') {
      return this.wordAddLine(left, top, left + width, top + height, options);
    }

    // msoShapeRectangle=1, msoShapeOval=9, msoShapeRoundedRectangle=5,
    // msoShapeIsoscelesTriangle=7, msoShapeDiamond=4, msoShapeRightArrow=33
    const shapeMap: Record<string, number> = {
      rectangle: 1,
      oval: 9,
      roundedRectangle: 5,
      triangle: 7,
      diamond: 4,
      arrow: 33,
    };
    const shapeTypeValue = shapeMap[shapeType] ?? 1;

    const commands: string[] = [];
    if (options?.fillColor) {
      const rgb = this.hexToRgb(options.fillColor);
      if (rgb) {
        commands.push('$shape.Fill.Visible = -1');
        commands.push('$shape.Fill.Solid()');
        commands.push(`$shape.Fill.ForeColor.RGB = ${rgb.r + rgb.g * 256 + rgb.b * 65536}`);
      }
    }
    if (options?.lineColor) {
      const rgb = this.hexToRgb(options.lineColor);
      if (rgb) {
        commands.push('$shape.Line.Visible = -1');
        commands.push(`$shape.Line.ForeColor.RGB = ${rgb.r + rgb.g * 256 + rgb.b * 65536}`);
      }
    }
    if (options?.lineWeight) {
      commands.push(`$shape.Line.Weight = ${options.lineWeight}`);
    }

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$shape = $doc.Shapes.AddShape(${shapeTypeValue}, ${left}, ${top}, ${width}, ${height})
${commands.join('\n')}
@{ success = $true; message = "Shape added"; shape_name = $shape.Name } | ConvertTo-Json -Compress
`);
  }

  /**
   * Add a line shape to the document
   */
  private async wordAddLine(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options?: { lineColor?: string; lineWeight?: number }
  ): Promise<OfficeResponse> {
    const commands: string[] = [];
    if (options?.lineColor) {
      const rgb = this.hexToRgb(options.lineColor);
      if (rgb) {
        commands.push('$shape.Line.Visible = -1');
        commands.push(`$shape.Line.ForeColor.RGB = ${rgb.r + rgb.g * 256 + rgb.b * 65536}`);
      }
    }
    if (options?.lineWeight) {
      commands.push(`$shape.Line.Weight = ${options.lineWeight}`);
    }

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$shape = $doc.Shapes.AddLine(${startX}, ${startY}, ${endX}, ${endY})
${commands.join('\n')}
@{ success = $true; message = "Line added"; shape_name = $shape.Name } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Word Document Info
  // -------------------------------------------------------------------------

  async wordGetDocumentInfo(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$stats = $doc.ComputeStatistics(0)  # wdStatisticWords

@{
  success = $true
  name = $doc.Name
  path = $doc.FullName
  pages = $doc.ComputeStatistics(2)  # wdStatisticPages
  words = $doc.ComputeStatistics(0)  # wdStatisticWords
  characters = $doc.ComputeStatistics(3)  # wdStatisticCharacters
  characters_with_spaces = $doc.ComputeStatistics(5)  # wdStatisticCharactersWithSpaces
  paragraphs = $doc.ComputeStatistics(4)  # wdStatisticParagraphs
  lines = $doc.ComputeStatistics(1)  # wdStatisticLines
  saved = $doc.Saved
  read_only = $doc.ReadOnly
} | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Word Columns
  // -------------------------------------------------------------------------

  async wordSetColumns(count: number, spacing?: number): Promise<OfficeResponse> {
    // spacing is the gap between columns in points (1 inch = 72 points)
    const spacingScript = spacing !== undefined ? `$pageSetup.TextColumns.Spacing = ${spacing}` : '';
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$pageSetup = $doc.PageSetup
$pageSetup.TextColumns.SetCount(${count})
${spacingScript}
@{ success = $true; message = "Columns set to ${count}${spacing !== undefined ? ` with spacing ${spacing}pt` : ''}" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Word Undo/Redo
  // -------------------------------------------------------------------------

  async wordUndo(times: number = 1): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
for ($i = 0; $i -lt ${times}; $i++) {
  $doc.Undo()
}
@{ success = $true; message = "Undo performed ${times} time(s)" } | ConvertTo-Json -Compress
`);
  }

  async wordRedo(times: number = 1): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
for ($i = 0; $i -lt ${times}; $i++) {
  $doc.Redo()
}
@{ success = $true; message = "Redo performed ${times} time(s)" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Word Selection
  // -------------------------------------------------------------------------

  async wordGetSelectedText(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
@{
  success = $true
  text = $selection.Text
  start = $selection.Start
  end = $selection.End
  type = $selection.Type  # 0=none, 1=normal, 2=IP (insertion point)
} | ConvertTo-Json -Compress
`);
  }


}

// Export singleton instance
export const wordClient = new WordClient();
export type { OfficeResponse, ScreenshotResponse };

