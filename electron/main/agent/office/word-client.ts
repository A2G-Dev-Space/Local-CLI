/**
 * Word Client for Electron (Windows Native)
 *
 * Microsoft Word automation via PowerShell COM.
 * All 52 methods from CLI, optimized for Windows Native.
 */

import { OfficeClientBase, OfficeResponse, ScreenshotResponse } from './office-client-base';

export class WordClient extends OfficeClientBase {
  // ===========================================================================
  // Launch / Create / Open / Save / Close
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

  async wordOpen(filePath: string): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(filePath));
    return this.executePowerShell(`
try {
  $word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
} catch {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $true
}
$doc = $word.Documents.Open('${winPath}')
@{ success = $true; message = "Document opened"; document_name = $doc.Name; path = $doc.FullName } | ConvertTo-Json -Compress
`);
  }

  async wordSave(filePath?: string): Promise<OfficeResponse> {
    if (filePath) {
      const winPath = this.escapePsString(this.toWindowsPath(filePath));
      return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.SaveAs([ref]'${winPath}')
@{ success = $true; message = "Document saved"; path = $doc.FullName } | ConvertTo-Json -Compress
`);
    }
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.Save()
@{ success = $true; message = "Document saved"; path = $doc.FullName } | ConvertTo-Json -Compress
`);
  }

  async wordClose(save: boolean = false): Promise<OfficeResponse> {
    const saveOption = save ? '-1' : '0'; // wdSaveChanges=-1, wdDoNotSaveChanges=0
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

  // ===========================================================================
  // Text Operations
  // ===========================================================================

  async wordWrite(
    text: string,
    options?: { fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean; newParagraph?: boolean }
  ): Promise<OfficeResponse> {
    const escaped = this.escapePsString(text);
    const hasKorean = this.hasKorean(text);
    const fontName = options?.fontName || (hasKorean ? 'Malgun Gothic' : '');
    const newParagraph = options?.newParagraph !== false;

    const cmds: string[] = [];
    if (fontName) cmds.push(`$selection.Font.Name = '${this.escapePsString(fontName)}'`);
    if (options?.fontSize) cmds.push(`$selection.Font.Size = ${options.fontSize}`);
    if (options?.bold !== undefined) cmds.push(`$selection.Font.Bold = ${options.bold ? '$true' : '$false'}`);
    if (options?.italic !== undefined) cmds.push(`$selection.Font.Italic = ${options.italic ? '$true' : '$false'}`);

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
${cmds.join('\n')}
$selection.TypeText('${escaped}')
${newParagraph ? '$selection.TypeParagraph()' : ''}
@{ success = $true; message = "Text written" } | ConvertTo-Json -Compress
`);
  }

  async wordRead(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$content = $doc.Content.Text
@{ success = $true; document_name = $doc.Name; content = $content; character_count = $content.Length } | ConvertTo-Json -Compress
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
    const findEsc = this.escapePsString(find);
    const replaceEsc = this.escapePsString(replace);
    const opt = replaceAll ? '2' : '1'; // wdReplaceAll=2, wdReplaceOne=1
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$findObj = $doc.Content.Find
$findObj.ClearFormatting()
$findObj.Replacement.ClearFormatting()
$findObj.Text = '${findEsc}'
$findObj.Replacement.Text = '${replaceEsc}'
$found = $findObj.Execute([ref]'${findEsc}', [ref]$false, [ref]$false, [ref]$false, [ref]$false, [ref]$false, [ref]$true, [ref]0, [ref]$false, [ref]'${replaceEsc}', [ref]${opt})
@{ success = $true; message = "Find and replace completed"; found = $found } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Font & Paragraph Formatting
  // ===========================================================================

  async wordSetFont(options: {
    fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean;
    underline?: boolean; color?: string;
  }): Promise<OfficeResponse> {
    const cmds: string[] = [];
    if (options.fontName) cmds.push(`$selection.Font.Name = '${this.escapePsString(options.fontName)}'`);
    if (options.fontSize) cmds.push(`$selection.Font.Size = ${options.fontSize}`);
    if (options.bold !== undefined) cmds.push(`$selection.Font.Bold = ${options.bold ? '$true' : '$false'}`);
    if (options.italic !== undefined) cmds.push(`$selection.Font.Italic = ${options.italic ? '$true' : '$false'}`);
    if (options.underline !== undefined) cmds.push(`$selection.Font.Underline = ${options.underline ? '1' : '0'}`);
    if (options.color) cmds.push(`$selection.Font.Color = ${this.hexToBgr(options.color)}`);

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
${cmds.join('\n')}
@{ success = $true; message = "Font properties set" } | ConvertTo-Json -Compress
`);
  }

  async wordSetParagraph(options: {
    alignment?: 'left' | 'center' | 'right' | 'justify';
    lineSpacing?: number; spaceBefore?: number; spaceAfter?: number; firstLineIndent?: number;
  }): Promise<OfficeResponse> {
    const alignMap: Record<string, number> = { left: 0, center: 1, right: 2, justify: 3 };
    const cmds: string[] = [];
    if (options.alignment) cmds.push(`$selection.ParagraphFormat.Alignment = ${alignMap[options.alignment]}`);
    if (options.lineSpacing) cmds.push(`$selection.ParagraphFormat.LineSpacing = ${options.lineSpacing}`);
    if (options.spaceBefore) cmds.push(`$selection.ParagraphFormat.SpaceBefore = ${options.spaceBefore}`);
    if (options.spaceAfter) cmds.push(`$selection.ParagraphFormat.SpaceAfter = ${options.spaceAfter}`);
    if (options.firstLineIndent) cmds.push(`$selection.ParagraphFormat.FirstLineIndent = ${options.firstLineIndent}`);

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
${cmds.join('\n')}
@{ success = $true; message = "Paragraph formatting set" } | ConvertTo-Json -Compress
`);
  }

  async wordSetStyle(styleName: string, preserveKoreanFont: boolean = true): Promise<OfficeResponse> {
    const escaped = this.escapePsString(styleName);
    const fontScript = preserveKoreanFont ? `
$text = $selection.Text
if ($text -match '[가-힣ㄱ-ㅎㅏ-ㅣ]') { $selection.Font.Name = 'Malgun Gothic' }` : '';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$selection.Style = '${escaped}'
${fontScript}
@{ success = $true; message = "Style applied" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Tables
  // ===========================================================================

  async wordAddTable(rows: number, cols: number, data?: string[][]): Promise<OfficeResponse> {
    let dataScript = '';
    let hasKorean = false;

    if (data) {
      const lines: string[] = [];
      for (let i = 0; i < data.length && i < rows; i++) {
        const row = data[i];
        if (!row) continue;
        for (let j = 0; j < row.length && j < cols; j++) {
          const val = row[j];
          if (val === undefined) continue;
          if (this.hasKorean(val)) hasKorean = true;
          lines.push(`$table.Cell(${i + 1}, ${j + 1}).Range.Text = '${this.escapePsString(val)}'`);
        }
      }
      dataScript = lines.join('\n');
    }

    const fontScript = hasKorean ? "$table.Range.Font.Name = 'Malgun Gothic'" : '';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$range = $word.Selection.Range
$table = $doc.Tables.Add($range, ${rows}, ${cols})
$table.Borders.Enable = $true
${fontScript}
${dataScript}
$tableEnd = $table.Range
$tableEnd.Collapse(0)
$tableEnd.Select()
$word.Selection.TypeParagraph()
@{ success = $true; message = "Table added with ${rows} rows and ${cols} columns" } | ConvertTo-Json -Compress
`);
  }

  async wordSetTableCell(
    tableIndex: number, row: number, col: number, text: string,
    options?: { fontName?: string; fontSize?: number; bold?: boolean }
  ): Promise<OfficeResponse> {
    const escaped = this.escapePsString(text);
    const hasKorean = this.hasKorean(text);
    const fontName = options?.fontName || (hasKorean ? 'Malgun Gothic' : '');

    const cmds: string[] = [];
    if (fontName) cmds.push(`$cell.Range.Font.Name = '${this.escapePsString(fontName)}'`);
    if (options?.fontSize) cmds.push(`$cell.Range.Font.Size = ${options.fontSize}`);
    if (options?.bold) cmds.push('$cell.Range.Font.Bold = -1');

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$table = $doc.Tables(${tableIndex})
$cell = $table.Cell(${row}, ${col})
$cell.Range.Text = '${escaped}'
${cmds.join('\n')}
@{ success = $true; message = "Table cell updated" } | ConvertTo-Json -Compress
`);
  }

  async wordMergeTableCells(tableIndex: number, startRow: number, startCol: number, endRow: number, endCol: number): Promise<OfficeResponse> {
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
    const escaped = this.escapePsString(styleName);
    const styleMap: Record<string, number> = { 'table grid': -176, 'table normal': -106, '표 눈금': -176, '표 보통': -106 };
    const styleConst = styleMap[styleName.toLowerCase()];
    const fontScript = preserveKoreanFont ? `
$text = $table.Range.Text
if ($text -match '[가-힣ㄱ-ㅎㅏ-ㅣ]') { $table.Range.Font.Name = 'Malgun Gothic' }` : '';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$table = $doc.Tables(${tableIndex})
try {
  ${styleConst !== undefined ? `$table.Style = ${styleConst}` : `$table.Style = '${escaped}'`}
  ${fontScript}
  @{ success = $true; message = "Table style set" } | ConvertTo-Json -Compress
} catch {
  @{ success = $false; error = "Style not found" } | ConvertTo-Json -Compress
}
`);
  }

  async wordSetTableBorder(tableIndex: number, options: { style?: 'single' | 'double' | 'thick' | 'none'; color?: string }): Promise<OfficeResponse> {
    const styleMap: Record<string, number> = { single: 1, double: 7, thick: 14, none: 0 };
    const lineStyle = styleMap[options.style || 'single'] ?? 1;
    const colorVal = options.color ? this.hexToBgr(options.color) : 0;

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$table = $doc.Tables(${tableIndex})
@(-1, -2, -3, -4) | ForEach-Object {
  $table.Borders.Item($_).LineStyle = ${lineStyle}
  ${colorVal ? `$table.Borders.Item($_).Color = ${colorVal}` : ''}
}
try { $table.Borders.Item(-5).LineStyle = ${lineStyle} } catch {}
try { $table.Borders.Item(-6).LineStyle = ${lineStyle} } catch {}
@{ success = $true; message = "Table border set" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Images & Hyperlinks
  // ===========================================================================

  async wordAddImage(imagePath: string, width?: number, height?: number): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(imagePath));
    const sizeScript = (width || height) ? `
${width ? '$shape.Width = ' + width : ''}
${height ? '$shape.Height = ' + height : ''}` : '';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$shape = $selection.InlineShapes.AddPicture('${winPath}')
${sizeScript}
$selection.MoveRight(1, 1)
@{ success = $true; message = "Image added" } | ConvertTo-Json -Compress
`);
  }

  async wordAddHyperlink(text: string, url: string): Promise<OfficeResponse> {
    const textEsc = this.escapePsString(text);
    const urlEsc = this.escapePsString(url);
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$doc = $word.ActiveDocument
$range = $selection.Range
$doc.Hyperlinks.Add($range, '${urlEsc}', '', '', '${textEsc}')
@{ success = $true; message = "Hyperlink added" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Bookmarks
  // ===========================================================================

  async wordAddBookmark(name: string, text?: string): Promise<OfficeResponse> {
    const nameEsc = this.escapePsString(name);
    const textEsc = text ? this.escapePsString(text) : '';
    const hasKorean = text ? this.hasKorean(text) : false;
    const textLen = text ? text.length : 0;

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$selection = $word.Selection
${text ? `${hasKorean ? "$selection.Font.Name = 'Malgun Gothic'" : ''}
$selection.TypeText('${textEsc}')
$selection.MoveLeft(1, ${textLen}, 1)` : ''}
$doc.Bookmarks.Add('${nameEsc}', $selection.Range)
@{ success = $true; message = "Bookmark added" } | ConvertTo-Json -Compress
`);
  }

  async wordGetBookmarks(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$bookmarks = @()
foreach ($bm in $doc.Bookmarks) {
  $bookmarks += @{ name = $bm.Name; start = $bm.Range.Start; end = $bm.Range.End; text = $bm.Range.Text }
}
@{ success = $true; bookmarks = $bookmarks } | ConvertTo-Json -Compress -Depth 5
`);
  }

  async wordDeleteBookmark(name: string): Promise<OfficeResponse> {
    const nameEsc = this.escapePsString(name);
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
if ($doc.Bookmarks.Exists('${nameEsc}')) {
  $doc.Bookmarks('${nameEsc}').Delete()
  @{ success = $true; message = "Bookmark deleted" } | ConvertTo-Json -Compress
} else {
  @{ success = $false; error = "Bookmark not found" } | ConvertTo-Json -Compress
}
`);
  }

  async wordGotoBookmark(name: string): Promise<OfficeResponse> {
    const nameEsc = this.escapePsString(name);
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
if ($doc.Bookmarks.Exists('${nameEsc}')) {
  $doc.Bookmarks('${nameEsc}').Select()
  @{ success = $true; message = "Moved to bookmark" } | ConvertTo-Json -Compress
} else {
  @{ success = $false; error = "Bookmark not found" } | ConvertTo-Json -Compress
}
`);
  }

  // ===========================================================================
  // Comments
  // ===========================================================================

  async wordAddComment(commentText: string, author?: string): Promise<OfficeResponse> {
    const textEsc = this.escapePsString(commentText);
    const authorEsc = author ? this.escapePsString(author) : '';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$selection = $word.Selection
$comment = $doc.Comments.Add($selection.Range, '${textEsc}')
${authorEsc ? `$comment.Author = '${authorEsc}'` : ''}
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
    index = $c.Index; author = $c.Author; text = $c.Range.Text
    date = $c.Date.ToString("yyyy-MM-dd HH:mm:ss"); scope = $c.Scope.Text
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
  @{ success = $true; message = "Comment deleted" } | ConvertTo-Json -Compress
} else {
  @{ success = $false; error = "Comment index out of range" } | ConvertTo-Json -Compress
}
`);
  }

  async wordDeleteAllComments(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$count = $doc.Comments.Count
while ($doc.Comments.Count -gt 0) { $doc.Comments(1).Delete() }
@{ success = $true; message = "Deleted $count comments" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Lists
  // ===========================================================================

  async wordCreateBulletList(items: string[]): Promise<OfficeResponse> {
    const script = items.map(item => {
      const esc = this.escapePsString(item);
      const hasK = this.hasKorean(item);
      return `${hasK ? "$selection.Font.Name = 'Malgun Gothic'" : ''}
$selection.TypeText('${esc}')
$selection.TypeParagraph()`;
    }).join('\n');

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$selection.Range.ListFormat.ApplyBulletDefault()
${script}
$selection.Range.ListFormat.RemoveNumbers()
@{ success = $true; message = "Bullet list created with ${items.length} items" } | ConvertTo-Json -Compress
`);
  }

  async wordCreateNumberedList(items: string[]): Promise<OfficeResponse> {
    const script = items.map(item => {
      const esc = this.escapePsString(item);
      const hasK = this.hasKorean(item);
      return `${hasK ? "$selection.Font.Name = 'Malgun Gothic'" : ''}
$selection.TypeText('${esc}')
$selection.TypeParagraph()`;
    }).join('\n');

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$selection.Range.ListFormat.ApplyNumberDefault()
${script}
$selection.Range.ListFormat.RemoveNumbers()
@{ success = $true; message = "Numbered list created with ${items.length} items" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Headers & Footers
  // ===========================================================================

  async wordInsertHeader(text: string, options?: { fontName?: string; fontSize?: number }): Promise<OfficeResponse> {
    const escaped = this.escapePsString(text);
    const hasKorean = this.hasKorean(text);
    const fontName = options?.fontName || (hasKorean ? 'Malgun Gothic' : '');

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$section = $doc.Sections(1)
$header = $section.Headers(1).Range
$header.Text = '${escaped}'
${fontName ? `$header.Font.Name = '${this.escapePsString(fontName)}'` : ''}
${options?.fontSize ? `$header.Font.Size = ${options.fontSize}` : ''}
@{ success = $true; message = "Header added" } | ConvertTo-Json -Compress
`);
  }

  async wordInsertFooter(text: string, options?: { fontName?: string; fontSize?: number }): Promise<OfficeResponse> {
    const escaped = this.escapePsString(text);
    const hasKorean = this.hasKorean(text);
    const fontName = options?.fontName || (hasKorean ? 'Malgun Gothic' : '');

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$section = $doc.Sections(1)
$footer = $section.Footers(1).Range
$footer.Text = '${escaped}'
${fontName ? `$footer.Font.Name = '${this.escapePsString(fontName)}'` : ''}
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

  // ===========================================================================
  // Page Setup
  // ===========================================================================

  async wordSetPageMargins(options: { top?: number; bottom?: number; left?: number; right?: number }): Promise<OfficeResponse> {
    const cmds: string[] = [];
    if (options.top !== undefined) cmds.push(`$pageSetup.TopMargin = ${options.top}`);
    if (options.bottom !== undefined) cmds.push(`$pageSetup.BottomMargin = ${options.bottom}`);
    if (options.left !== undefined) cmds.push(`$pageSetup.LeftMargin = ${options.left}`);
    if (options.right !== undefined) cmds.push(`$pageSetup.RightMargin = ${options.right}`);

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$pageSetup = $doc.PageSetup
${cmds.join('\n')}
@{ success = $true; message = "Page margins updated" } | ConvertTo-Json -Compress
`);
  }

  async wordSetPageOrientation(orientation: 'portrait' | 'landscape'): Promise<OfficeResponse> {
    const value = orientation === 'landscape' ? 1 : 0;
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.PageSetup.Orientation = ${value}
@{ success = $true; message = "Page orientation set to ${orientation}" } | ConvertTo-Json -Compress
`);
  }

  async wordSetPageSize(size: 'A4' | 'Letter' | 'Legal' | 'A3' | 'B5' | 'custom', width?: number, height?: number): Promise<OfficeResponse> {
    const sizeMap: Record<string, number> = { A4: 7, Letter: 2, Legal: 4, A3: 6, B5: 13 };

    if (size === 'custom' && width && height) {
      return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.PageSetup.PageWidth = ${width}
$doc.PageSetup.PageHeight = ${height}
@{ success = $true; message = "Page size set to custom" } | ConvertTo-Json -Compress
`);
    }

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.PageSetup.PaperSize = ${sizeMap[size] ?? 7}
@{ success = $true; message = "Page size set to ${size}" } | ConvertTo-Json -Compress
`);
  }

  async wordSetColumns(count: number, spacing?: number): Promise<OfficeResponse> {
    const spacingScript = spacing !== undefined ? `$pageSetup.TextColumns.Spacing = ${spacing}` : '';
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$pageSetup = $doc.PageSetup
$pageSetup.TextColumns.SetCount(${count})
${spacingScript}
@{ success = $true; message = "Columns set to ${count}" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Watermarks
  // ===========================================================================

  async wordAddWatermark(text: string, options?: { fontName?: string; fontSize?: number; color?: string; semitransparent?: boolean }): Promise<OfficeResponse> {
    const escaped = this.escapePsString(text);
    const fontName = options?.fontName || 'Arial';
    const fontSize = options?.fontSize || 72;
    const colorVal = options?.color ? this.hexToBgr(options.color) : 12632256;
    const transparency = options?.semitransparent !== false ? '0.5' : '0';

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$originalView = $word.ActiveWindow.View.Type
$word.ActiveWindow.View.Type = 3
try {
  $section = $doc.Sections(1)
  $header = $section.Headers(1)
  $shape = $header.Shapes.AddTextEffect(0, '${escaped}', '${this.escapePsString(fontName)}', ${fontSize}, 0, 0, 0, 0)
  $shape.Name = "PowerPlusWaterMarkObject"
  $shape.TextEffect.NormalizedHeight = 0
  $shape.Line.Visible = 0
  $shape.Fill.Visible = -1
  $shape.Fill.Solid()
  $shape.Fill.ForeColor.RGB = ${colorVal}
  $shape.Fill.Transparency = ${transparency}
  $shape.Rotation = 315
  $shape.LockAspectRatio = -1
  $shape.Height = 100
  $shape.Width = 350
  $shape.Left = -999995
  $shape.Top = -999995
  $shape.WrapFormat.AllowOverlap = -1
  $shape.WrapFormat.Type = 3
  @{ success = $true; message = "Watermark added" } | ConvertTo-Json -Compress
} finally {
  $word.ActiveWindow.View.Type = $originalView
}
`);
  }

  async wordRemoveWatermark(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$word.ActiveWindow.View.Type = 3
foreach ($section in $doc.Sections) {
  $header = $section.Headers(1)
  foreach ($shape in $header.Shapes) {
    if ($shape.Name -like "*WaterMark*") { $shape.Delete() }
  }
}
@{ success = $true; message = "Watermark removed" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Shapes & Textboxes
  // ===========================================================================

  async wordAddTextbox(text: string, left: number, top: number, width: number, height: number,
    options?: { fontName?: string; fontSize?: number; borderColor?: string; fillColor?: string }): Promise<OfficeResponse> {
    const escaped = this.escapePsString(text);
    const hasKorean = this.hasKorean(text);
    const fontName = options?.fontName || (hasKorean ? 'Malgun Gothic' : '');

    const cmds: string[] = [];
    if (fontName) cmds.push(`$shape.TextFrame.TextRange.Font.Name = '${this.escapePsString(fontName)}'`);
    if (options?.fontSize) cmds.push(`$shape.TextFrame.TextRange.Font.Size = ${options.fontSize}`);
    if (options?.borderColor) {
      cmds.push('$shape.Line.Visible = -1');
      cmds.push(`$shape.Line.ForeColor.RGB = ${this.hexToBgr(options.borderColor)}`);
    }
    if (options?.fillColor) {
      cmds.push('$shape.Fill.Visible = -1');
      cmds.push(`$shape.Fill.ForeColor.RGB = ${this.hexToBgr(options.fillColor)}`);
    } else {
      cmds.push('$shape.Fill.Visible = 0');
    }

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$shape = $doc.Shapes.AddTextbox(1, ${left}, ${top}, ${width}, ${height})
${fontName ? `$shape.TextFrame.TextRange.Font.Name = '${this.escapePsString(fontName)}'` : ''}
$shape.TextFrame.TextRange.Text = '${escaped}'
${cmds.filter(c => !c.includes('Font.Name')).join('\n')}
@{ success = $true; message = "Textbox added"; shape_name = $shape.Name } | ConvertTo-Json -Compress
`);
  }

  async wordAddShape(shapeType: 'rectangle' | 'oval' | 'roundedRectangle' | 'triangle' | 'diamond' | 'arrow' | 'line',
    left: number, top: number, width: number, height: number,
    options?: { fillColor?: string; lineColor?: string; lineWeight?: number }): Promise<OfficeResponse> {

    if (shapeType === 'line') {
      const cmds: string[] = [];
      if (options?.lineColor) {
        cmds.push('$shape.Line.Visible = -1');
        cmds.push(`$shape.Line.ForeColor.RGB = ${this.hexToBgr(options.lineColor)}`);
      }
      if (options?.lineWeight) cmds.push(`$shape.Line.Weight = ${options.lineWeight}`);

      return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$shape = $doc.Shapes.AddLine(${left}, ${top}, ${left + width}, ${top + height})
${cmds.join('\n')}
@{ success = $true; message = "Line added"; shape_name = $shape.Name } | ConvertTo-Json -Compress
`);
    }

    const shapeMap: Record<string, number> = { rectangle: 1, oval: 9, roundedRectangle: 5, triangle: 7, diamond: 4, arrow: 33 };
    const cmds: string[] = [];
    if (options?.fillColor) {
      cmds.push('$shape.Fill.Visible = -1');
      cmds.push('$shape.Fill.Solid()');
      cmds.push(`$shape.Fill.ForeColor.RGB = ${this.hexToBgr(options.fillColor)}`);
    }
    if (options?.lineColor) {
      cmds.push('$shape.Line.Visible = -1');
      cmds.push(`$shape.Line.ForeColor.RGB = ${this.hexToBgr(options.lineColor)}`);
    }
    if (options?.lineWeight) cmds.push(`$shape.Line.Weight = ${options.lineWeight}`);

    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$shape = $doc.Shapes.AddShape(${shapeMap[shapeType] ?? 1}, ${left}, ${top}, ${width}, ${height})
${cmds.join('\n')}
@{ success = $true; message = "Shape added"; shape_name = $shape.Name } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Navigation & Selection
  // ===========================================================================

  async wordInsertBreak(breakType: 'page' | 'line' | 'section' = 'page'): Promise<OfficeResponse> {
    const breakMap: Record<string, number> = { page: 7, line: 6, section: 2 };
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
$selection.InsertBreak(${breakMap[breakType]})
@{ success = $true; message = "${breakType} break inserted" } | ConvertTo-Json -Compress
`);
  }

  async wordGetSelection(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
@{ success = $true; text = $selection.Text; start = $selection.Start; end = $selection.End
   font_name = $selection.Font.Name; font_size = $selection.Font.Size } | ConvertTo-Json -Compress
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
${isBookmark ? `$selection.GoTo(-1, 0, 0, '${this.escapePsString(String(target))}')` : `$selection.GoTo(${whatMap[what]}, 0, ${target})`}
@{ success = $true; message = "Moved to ${what} ${target}" } | ConvertTo-Json -Compress
`);
  }

  async wordGetSelectedText(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$selection = $word.Selection
@{ success = $true; text = $selection.Text; start = $selection.Start; end = $selection.End; type = $selection.Type } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Undo / Redo
  // ===========================================================================

  async wordUndo(times: number = 1): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
for ($i = 0; $i -lt ${times}; $i++) { $doc.Undo() }
@{ success = $true; message = "Undo performed ${times} time(s)" } | ConvertTo-Json -Compress
`);
  }

  async wordRedo(times: number = 1): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
for ($i = 0; $i -lt ${times}; $i++) { $doc.Redo() }
@{ success = $true; message = "Redo performed ${times} time(s)" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Export & Print
  // ===========================================================================

  async wordExportToPDF(outputPath: string): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(outputPath));
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$doc.ExportAsFixedFormat('${winPath}', 17)
@{ success = $true; message = "Exported to PDF"; path = '${winPath}' } | ConvertTo-Json -Compress
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

  // ===========================================================================
  // Document Info
  // ===========================================================================

  async wordGetDocumentInfo(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
@{
  success = $true; name = $doc.Name; path = $doc.FullName
  pages = $doc.ComputeStatistics(2); words = $doc.ComputeStatistics(0)
  characters = $doc.ComputeStatistics(3); characters_with_spaces = $doc.ComputeStatistics(5)
  paragraphs = $doc.ComputeStatistics(4); lines = $doc.ComputeStatistics(1)
  saved = $doc.Saved; read_only = $doc.ReadOnly
} | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Screenshot
  // ===========================================================================

  async wordScreenshot(): Promise<ScreenshotResponse> {
    const result = await this.executePowerShell(`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$doc = $word.ActiveDocument
$originalView = $word.ActiveWindow.View.Type
$word.ActiveWindow.View.Type = 3
try {
  $doc.Content.Select()
  $word.Selection.CopyAsPicture()
  Start-Sleep -Milliseconds 300
  $img = [System.Windows.Forms.Clipboard]::GetImage()
  if ($img -eq $null) {
    $hwnd = $word.Application.Hwnd
    if ($hwnd -gt 0) {
      Add-Type @"
        using System; using System.Drawing; using System.Runtime.InteropServices;
        public class Screenshot {
          [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          public struct RECT { public int Left, Top, Right, Bottom; }
          public static Bitmap CaptureWindow(IntPtr hwnd) {
            RECT rect; GetWindowRect(hwnd, out rect);
            int w = rect.Right - rect.Left, h = rect.Bottom - rect.Top;
            if (w <= 0 || h <= 0) return null;
            Bitmap bmp = new Bitmap(w, h);
            using (Graphics g = Graphics.FromImage(bmp)) { g.CopyFromScreen(rect.Left, rect.Top, 0, 0, new Size(w, h)); }
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
  $ms = New-Object System.IO.MemoryStream
  $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  $base64 = [Convert]::ToBase64String($bytes)
  $ms.Dispose(); $img.Dispose()
  $word.Selection.Collapse(1)
  @{ success = $true; image = $base64; format = "png"; encoding = "base64" } | ConvertTo-Json -Compress
} finally {
  $word.ActiveWindow.View.Type = $originalView
}
`, 60000);
    return result as ScreenshotResponse;
  }
}

// Export singleton instance
export const wordClient = new WordClient();
