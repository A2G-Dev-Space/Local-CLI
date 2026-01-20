/**
 * Excel Client for Electron (Windows Native)
 *
 * Microsoft Excel automation via PowerShell COM.
 * All 62 methods from CLI, optimized for Windows Native.
 */

import { OfficeClientBase, OfficeResponse, ScreenshotResponse } from './office-client-base';

// Column letter/number conversion helpers
function columnLetterToNumber(column: string): number {
  let result = 0;
  for (let i = 0; i < column.length; i++) {
    result = result * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return result;
}

function columnNumberToLetter(num: number): string {
  let result = '';
  while (num > 0) {
    num--;
    result = String.fromCharCode('A'.charCodeAt(0) + (num % 26)) + result;
    num = Math.floor(num / 26);
  }
  return result;
}

export class ExcelClient extends OfficeClientBase {
  // ===========================================================================
  // Launch / Create / Open / Save / Close
  // ===========================================================================

  async excelLaunch(): Promise<OfficeResponse> {
    return this.executePowerShell(`
try {
  $excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
  $excel.Visible = $true
  @{ success = $true; message = "Connected to existing Excel instance" } | ConvertTo-Json -Compress
} catch {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $true
  @{ success = $true; message = "Launched new Excel instance" } | ConvertTo-Json -Compress
}
`);
  }

  async excelCreate(): Promise<OfficeResponse> {
    return this.executePowerShell(`
try {
  $excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
} catch {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $true
}
$workbook = $excel.Workbooks.Add()
@{ success = $true; message = "Created new workbook"; workbook_name = $workbook.Name } | ConvertTo-Json -Compress
`);
  }

  async excelOpen(filePath: string): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(filePath));
    return this.executePowerShell(`
try {
  $excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
} catch {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $true
}
$workbook = $excel.Workbooks.Open('${winPath}')
@{ success = $true; message = "Workbook opened"; workbook_name = $workbook.Name; path = $workbook.FullName } | ConvertTo-Json -Compress
`);
  }

  async excelSave(filePath?: string): Promise<OfficeResponse> {
    if (filePath) {
      const winPath = this.escapePsString(this.toWindowsPath(filePath));
      return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$workbook.SaveAs('${winPath}')
@{ success = $true; message = "Workbook saved"; path = $workbook.FullName } | ConvertTo-Json -Compress
`);
    }
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$workbook.Save()
@{ success = $true; message = "Workbook saved"; path = $workbook.FullName } | ConvertTo-Json -Compress
`);
  }

  async excelClose(save: boolean = false): Promise<OfficeResponse> {
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$workbook.Close(${save ? '$true' : '$false'})
@{ success = $true; message = "Workbook closed" } | ConvertTo-Json -Compress
`);
  }

  async excelQuit(save: boolean = false): Promise<OfficeResponse> {
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${save ? 'foreach ($wb in $excel.Workbooks) { $wb.Save() }' : ''}
$excel.Quit()
@{ success = $true; message = "Excel closed" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Cell Operations
  // ===========================================================================

  async excelWriteCell(cell: string, value: unknown, sheet?: string,
    options?: { fontName?: string; fontSize?: number; bold?: boolean; asText?: boolean }): Promise<OfficeResponse> {
    const strValue = String(value);
    const escaped = this.escapePsString(strValue);
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const hasKorean = this.hasKorean(strValue);
    const fontName = options?.fontName || (hasKorean ? 'Malgun Gothic' : '');

    const cmds: string[] = [];
    if (fontName) cmds.push(`$range.Font.Name = '${this.escapePsString(fontName)}'`);
    if (options?.fontSize) cmds.push(`$range.Font.Size = ${options.fontSize}`);
    if (options?.bold !== undefined) cmds.push(`$range.Font.Bold = ${options.bold ? '$true' : '$false'}`);

    // Determine how to set the value:
    // - asText option: force text format
    // - Numbers: set without quotes so Excel recognizes them
    // - ISO Dates (YYYY-MM-DD): convert to Excel date (OADate)
    // - Otherwise: let Excel auto-detect
    let valueScript: string;

    if (options?.asText) {
      // Force text format
      valueScript = `$range.NumberFormat = '@'; $range.Value = '${escaped}'`;
    } else if (typeof value === 'number' || (strValue !== '' && !isNaN(Number(strValue)) && strValue.trim() !== '')) {
      // Numeric value - don't quote
      valueScript = `$range.Value = ${strValue}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
      // ISO date format (YYYY-MM-DD) - convert to Excel date
      const [year, month, day] = strValue.split('-');
      valueScript = `$range.Value = (Get-Date -Year ${year} -Month ${month} -Day ${day}).ToOADate()`;
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(strValue)) {
      // US date format (MM/DD/YYYY) - let Excel parse
      valueScript = `$range.Value = '${escaped}'`;
    } else {
      // Default: set as-is and let Excel auto-detect
      valueScript = `$range.Value = '${escaped}'`;
    }

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${cell}')
${cmds.join('\n')}
${valueScript}
@{ success = $true; message = "Value written to ${cell}" } | ConvertTo-Json -Compress
`);
  }

  async excelReadCell(cell: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$value = $sheet.Range('${cell}').Value2
@{ success = $true; cell = '${cell}'; value = $value } | ConvertTo-Json -Compress
`);
  }

  async excelWriteRange(startCell: string, values: unknown[][], sheet?: string): Promise<OfficeResponse> {
    const rows = values.length;
    const cols = values[0]?.length || 0;
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';

    // Check for Korean text in any cell
    let hasKorean = false;

    // Helper to convert value to PowerShell format
    // - Numbers: output without quotes
    // - ISO dates (YYYY-MM-DD): convert to OADate expression
    // - Default: string with escaped quotes
    const toPsValue = (v: unknown): string => {
      const str = String(v);
      if (this.hasKorean(str)) hasKorean = true;

      // Numbers: output without quotes
      if (typeof v === 'number' || (str !== '' && !isNaN(Number(str)) && str.trim() !== '')) {
        return str;
      }
      // ISO date (YYYY-MM-DD): convert to OADate expression
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [year, month, day] = str.split('-');
        return `([DateTime]::new(${year},${month},${day})).ToOADate()`;
      }
      // Default: string with escaped quotes
      return `'${this.escapePsString(str)}'`;
    };

    // Build PowerShell 2D array
    const arrayLines: string[] = [];
    for (const row of values) {
      if (!row) continue;
      const rowValues = row.map(v => toPsValue(v)).join(',');
      arrayLines.push(`@(${rowValues})`);
    }
    const arrayScript = `@(${arrayLines.join(',')})`;

    // Set Korean font if Korean text detected
    const fontScript = hasKorean ? "$range.Font.Name = 'Malgun Gothic'" : '';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$startRange = $sheet.Range('${startCell}')
$endCell = $sheet.Cells($startRange.Row + ${rows - 1}, $startRange.Column + ${cols - 1})
$range = $sheet.Range($startRange, $endCell)
${fontScript}
$data = ${arrayScript}
$range.Value = $data
@{ success = $true; message = "Range written from ${startCell} (${rows}x${cols})" } | ConvertTo-Json -Compress
`);
  }

  async excelReadRange(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
$values = $range.Value2
$rows = $range.Rows.Count
$cols = $range.Columns.Count
@{ success = $true; range = '${range}'; values = $values; rows = $rows; columns = $cols } | ConvertTo-Json -Compress -Depth 10
`);
  }

  // ===========================================================================
  // Formulas
  // ===========================================================================

  async excelSetFormula(cell: string, formula: string, sheet?: string): Promise<OfficeResponse> {
    const escaped = this.escapePsString(formula);
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${cell}').Formula = '${escaped}'
@{ success = $true; message = "Formula set in ${cell}" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Formatting
  // ===========================================================================

  async excelSetFont(range: string, options: {
    fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean;
    underline?: boolean; color?: string;
  }, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const cmds: string[] = [];
    if (options.fontName) cmds.push(`$range.Font.Name = '${this.escapePsString(options.fontName)}'`);
    if (options.fontSize) cmds.push(`$range.Font.Size = ${options.fontSize}`);
    if (options.bold !== undefined) cmds.push(`$range.Font.Bold = ${options.bold ? '$true' : '$false'}`);
    if (options.italic !== undefined) cmds.push(`$range.Font.Italic = ${options.italic ? '$true' : '$false'}`);
    if (options.underline !== undefined) cmds.push(`$range.Font.Underline = ${options.underline ? '2' : '0'}`);
    if (options.color) cmds.push(`$range.Font.Color = ${this.hexToBgr(options.color)}`);

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
${cmds.join('\n')}
@{ success = $true; message = "Font properties set for ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelSetAlignment(range: string, options: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'center' | 'bottom';
    wrapText?: boolean; orientation?: number;
  }, sheet?: string): Promise<OfficeResponse> {
    const hMap: Record<string, number> = { left: -4131, center: -4108, right: -4152 };
    const vMap: Record<string, number> = { top: -4160, center: -4108, bottom: -4107 };
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const cmds: string[] = [];
    if (options.horizontal) cmds.push(`$range.HorizontalAlignment = ${hMap[options.horizontal]}`);
    if (options.vertical) cmds.push(`$range.VerticalAlignment = ${vMap[options.vertical]}`);
    if (options.wrapText !== undefined) cmds.push(`$range.WrapText = ${options.wrapText ? '$true' : '$false'}`);
    if (options.orientation !== undefined) cmds.push(`$range.Orientation = ${options.orientation}`);

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
${cmds.join('\n')}
@{ success = $true; message = "Alignment set for ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelSetColumnWidth(column: string, width?: number, autoFit?: boolean, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$col = $sheet.Columns('${column}')
${autoFit ? '$col.AutoFit()' : `$col.ColumnWidth = ${width || 10}`}
@{ success = $true; message = "Column ${column} width set" } | ConvertTo-Json -Compress
`);
  }

  async excelSetRowHeight(row: number, height?: number, autoFit?: boolean, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$row = $sheet.Rows(${row})
${autoFit ? '$row.AutoFit()' : `$row.RowHeight = ${height || 15}`}
@{ success = $true; message = "Row ${row} height set" } | ConvertTo-Json -Compress
`);
  }

  async excelMergeCells(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').Merge()
@{ success = $true; message = "Cells merged: ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelUnmergeCells(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').UnMerge()
@{ success = $true; message = "Cells unmerged: ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelSetBorder(range: string, options: {
    style?: 'thin' | 'medium' | 'thick' | 'double' | 'dotted' | 'dashed';
    color?: string; edges?: ('left' | 'right' | 'top' | 'bottom' | 'all')[];
  }, sheet?: string): Promise<OfficeResponse> {
    const styleMap: Record<string, number> = { thin: 1, medium: 1, thick: 1, double: -4119, dotted: -4118, dashed: -4115 };
    const weightMap: Record<string, number> = { thin: 2, medium: -4138, thick: 4, double: 2, dotted: 2, dashed: 2 };
    const edgeMap: Record<string, number> = { left: 7, right: 10, top: 8, bottom: 9, all: -1 };
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const edges = options.edges || ['all'];
    const bStyle = styleMap[options.style || 'thin'];
    const bWeight = weightMap[options.style || 'thin'];

    let borderScript = '';
    if (edges.includes('all')) {
      borderScript = `$range.Borders.LineStyle = ${bStyle}\n$range.Borders.Weight = ${bWeight}`;
    } else {
      borderScript = edges.map(e =>
        `$range.Borders(${edgeMap[e]}).LineStyle = ${bStyle}\n$range.Borders(${edgeMap[e]}).Weight = ${bWeight}`
      ).join('\n');
    }

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
${borderScript}
@{ success = $true; message = "Border set for ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelSetFill(range: string, color: string, sheet?: string): Promise<OfficeResponse> {
    const colorVal = this.hexToBgr(color);
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').Interior.Color = ${colorVal}
@{ success = $true; message = "Fill color set for ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelSetNumberFormat(range: string, format: string, sheet?: string): Promise<OfficeResponse> {
    const escaped = this.escapePsString(format);
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').NumberFormat = '${escaped}'
@{ success = $true; message = "Number format set for ${range}" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Sheet Operations
  // ===========================================================================

  async excelAddSheet(name?: string, position?: 'start' | 'end' | string): Promise<OfficeResponse> {
    const escaped = name ? this.escapePsString(name) : '';
    let posScript = '';
    if (position === 'start') posScript = ', [ref]$workbook.Sheets(1)';
    else if (position === 'end') posScript = ', , [ref]$workbook.Sheets($workbook.Sheets.Count)';
    else if (position) posScript = `, , [ref]$workbook.Sheets('${this.escapePsString(position)}')`;

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$newSheet = $workbook.Sheets.Add(${posScript})
${escaped ? `$newSheet.Name = '${escaped}'` : ''}
@{ success = $true; message = "Sheet added"; sheet_name = $newSheet.Name } | ConvertTo-Json -Compress
`);
  }

  async excelDeleteSheet(name: string): Promise<OfficeResponse> {
    const escaped = this.escapePsString(name);
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$excel.DisplayAlerts = $false
$workbook.Sheets('${escaped}').Delete()
$excel.DisplayAlerts = $true
@{ success = $true; message = "Sheet '${escaped}' deleted" } | ConvertTo-Json -Compress
`);
  }

  async excelRenameSheet(oldName: string, newName: string): Promise<OfficeResponse> {
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$workbook.Sheets('${this.escapePsString(oldName)}').Name = '${this.escapePsString(newName)}'
@{ success = $true; message = "Sheet renamed" } | ConvertTo-Json -Compress
`);
  }

  async excelGetSheets(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$sheets = @()
foreach ($sheet in $workbook.Sheets) { $sheets += $sheet.Name }
@{ success = $true; sheets = $sheets; count = $sheets.Count } | ConvertTo-Json -Compress
`);
  }

  async excelSelectSheet(name: string): Promise<OfficeResponse> {
    const escaped = this.escapePsString(name);
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$excel.ActiveWorkbook.Worksheets('${escaped}').Activate()
@{ success = $true; message = "Sheet '${escaped}' activated" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Row & Column Operations
  // ===========================================================================

  async excelSortRange(range: string, sortColumn: string, ascending: boolean = true,
    hasHeader: boolean = true, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const order = ascending ? 1 : 2;
    const header = hasHeader ? 1 : 2;

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
$sortKey = $sheet.Range('${sortColumn}1')
$sheet.Sort.SortFields.Clear()
$sheet.Sort.SortFields.Add($sortKey, 0, ${order})
$sheet.Sort.SetRange($range)
$sheet.Sort.Header = ${header}
$sheet.Sort.Apply()
@{ success = $true; message = "Range sorted by column ${sortColumn}" } | ConvertTo-Json -Compress
`);
  }

  async excelInsertRow(row: number, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
for ($i = 0; $i -lt ${count}; $i++) { $sheet.Rows(${row}).Insert() }
@{ success = $true; message = "${count} row(s) inserted at row ${row}" } | ConvertTo-Json -Compress
`);
  }

  async excelDeleteRow(row: number, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Rows("${row}:${row + count - 1}").Delete()
@{ success = $true; message = "${count} row(s) deleted" } | ConvertTo-Json -Compress
`);
  }

  async excelInsertColumn(column: string, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
for ($i = 0; $i -lt ${count}; $i++) { $sheet.Columns('${column}').Insert() }
@{ success = $true; message = "${count} column(s) inserted at ${column}" } | ConvertTo-Json -Compress
`);
  }

  async excelDeleteColumn(column: string, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const startCol = columnLetterToNumber(column.toUpperCase());
    const endCol = columnNumberToLetter(startCol + count - 1);
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Columns("${column}:${endCol}").Delete()
@{ success = $true; message = "${count} column(s) deleted" } | ConvertTo-Json -Compress
`);
  }

  async excelHideColumn(column: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Columns('${column}').Hidden = $true
@{ success = $true; message = "Column ${column} hidden" } | ConvertTo-Json -Compress
`);
  }

  async excelShowColumn(column: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Columns('${column}').Hidden = $false
@{ success = $true; message = "Column ${column} shown" } | ConvertTo-Json -Compress
`);
  }

  async excelHideRow(row: number, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Rows(${row}).Hidden = $true
@{ success = $true; message = "Row ${row} hidden" } | ConvertTo-Json -Compress
`);
  }

  async excelShowRow(row: number, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Rows(${row}).Hidden = $false
@{ success = $true; message = "Row ${row} shown" } | ConvertTo-Json -Compress
`);
  }

  async excelGroupRows(startRow: number, endRow: number, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Rows("${startRow}:${endRow}").Group()
@{ success = $true; message = "Rows ${startRow}-${endRow} grouped" } | ConvertTo-Json -Compress
`);
  }

  async excelUngroupRows(startRow: number, endRow: number, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Rows("${startRow}:${endRow}").Ungroup()
@{ success = $true; message = "Rows ${startRow}-${endRow} ungrouped" } | ConvertTo-Json -Compress
`);
  }

  async excelFreezePanes(row?: number, column?: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const cellRef = `${column || 'A'}${row || 1}`;
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Activate()
$sheet.Range('${cellRef}').Select()
$excel.ActiveWindow.FreezePanes = $true
@{ success = $true; message = "Panes frozen at ${cellRef}" } | ConvertTo-Json -Compress
`);
  }

  async excelAutoFilter(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').AutoFilter()
@{ success = $true; message = "AutoFilter applied to ${range}" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Charts
  // ===========================================================================

  async excelAddChart(dataRange: string, chartType: 'column' | 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'doughnut',
    options?: { title?: string; left?: number; top?: number; width?: number; height?: number; sheet?: string }): Promise<OfficeResponse> {
    const chartTypeMap: Record<string, number> = {
      column: 51, bar: 57, line: 4, pie: 5, area: 1, scatter: -4169, doughnut: -4120
    };
    const xlType = chartTypeMap[chartType] ?? 51;
    const sheetScript = options?.sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(options.sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const hasKorean = options?.title ? this.hasKorean(options.title) : false;

    const titleScript = options?.title ? `
$chart.HasTitle = $true
${hasKorean ? "$chart.ChartTitle.Font.Name = 'Malgun Gothic'" : ''}
$chart.ChartTitle.Text = '${this.escapePsString(options.title)}'` : '';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${dataRange}')
$chartObj = $sheet.ChartObjects().Add(${options?.left ?? 100}, ${options?.top ?? 100}, ${options?.width ?? 400}, ${options?.height ?? 300})
$chart = $chartObj.Chart
$chart.SetSourceData($range)
$chart.ChartType = ${xlType}
${titleScript}
@{ success = $true; message = "Chart added"; chart_name = $chartObj.Name } | ConvertTo-Json -Compress
`);
  }

  async excelSetChartTitle(chartIndex: number, title: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const hasKorean = this.hasKorean(title);
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$chart = $sheet.ChartObjects(${chartIndex}).Chart
$chart.HasTitle = $true
${hasKorean ? "$chart.ChartTitle.Font.Name = 'Malgun Gothic'" : ''}
$chart.ChartTitle.Text = '${this.escapePsString(title)}'
@{ success = $true; message = "Chart title set" } | ConvertTo-Json -Compress
`);
  }

  async excelDeleteChart(chartIndex: number, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.ChartObjects(${chartIndex}).Delete()
@{ success = $true; message = "Chart deleted" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Conditional Formatting
  // ===========================================================================

  async excelAddConditionalFormat(range: string, formatType: 'cellValue' | 'colorScale' | 'dataBar' | 'iconSet' | 'duplicates' | 'top10',
    options?: { operator?: string; value1?: string | number; value2?: string | number; fillColor?: string; fontColor?: string; sheet?: string }): Promise<OfficeResponse> {
    const sheetScript = options?.sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(options.sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const typeMap: Record<string, number> = { cellValue: 1, colorScale: 3, dataBar: 4, iconSet: 6, duplicates: 8, top10: 5 };
    const opMap: Record<string, number> = { greater: 5, less: 6, equal: 3, between: 1, notBetween: 2 };

    let formatScript = '';
    if (formatType === 'cellValue') {
      const op = options?.operator ? opMap[options.operator] ?? 5 : 5;
      const v1 = typeof options?.value1 === 'string' ? `"${options.value1}"` : options?.value1 ?? 0;
      const v2 = options?.value2 !== undefined ? `, ${typeof options.value2 === 'string' ? `"${options.value2}"` : options.value2}` : '';
      formatScript = `$fc = $range.FormatConditions.Add(${typeMap[formatType]}, ${op}, ${v1}${v2})`;
      if (options?.fillColor) formatScript += `\n$fc.Interior.Color = ${this.hexToBgr(options.fillColor)}`;
      if (options?.fontColor) formatScript += `\n$fc.Font.Color = ${this.hexToBgr(options.fontColor)}`;
    } else if (formatType === 'colorScale') formatScript = '$range.FormatConditions.AddColorScale(3)';
    else if (formatType === 'dataBar') formatScript = '$range.FormatConditions.AddDataBar()';
    else if (formatType === 'iconSet') formatScript = '$range.FormatConditions.AddIconSetCondition()';
    else if (formatType === 'duplicates') {
      formatScript = `$fc = $range.FormatConditions.AddUniqueValues()\n$fc.DupeUnique = 1`;
      if (options?.fillColor) formatScript += `\n$fc.Interior.Color = ${this.hexToBgr(options.fillColor)}`;
    } else if (formatType === 'top10') {
      formatScript = `$fc = $range.FormatConditions.AddTop10()\n$fc.TopBottom = 1\n$fc.Rank = 10`;
      if (options?.fillColor) formatScript += `\n$fc.Interior.Color = ${this.hexToBgr(options.fillColor)}`;
    }

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
${formatScript}
@{ success = $true; message = "Conditional format added to ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelClearConditionalFormat(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').FormatConditions.Delete()
@{ success = $true; message = "Conditional formatting cleared" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Data Validation
  // ===========================================================================

  async excelSetDataValidation(range: string, validationType: 'list' | 'whole' | 'decimal' | 'date' | 'textLength' | 'custom',
    options: { formula1?: string; formula2?: string; operator?: string; inputTitle?: string; inputMessage?: string;
      errorTitle?: string; errorMessage?: string; sheet?: string }): Promise<OfficeResponse> {
    const sheetScript = options?.sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(options.sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const typeMap: Record<string, number> = { list: 3, whole: 1, decimal: 2, date: 4, textLength: 6, custom: 7 };
    const opMap: Record<string, number> = { between: 1, notBetween: 2, equal: 3, notEqual: 4, greater: 5, less: 6, greaterEqual: 7, lessEqual: 8 };
    const dvType = typeMap[validationType];
    const op = options.operator ? opMap[options.operator] : 1;
    const f1 = this.escapePsString(options.formula1 || '');
    const f2 = options.formula2 ? `, '${this.escapePsString(options.formula2)}'` : '';
    const params = validationType === 'list' ? `${dvType}, 1, 1, '${f1}'` : `${dvType}, 1, ${op}, '${f1}'${f2}`;

    const addCmds: string[] = [];
    if (options.inputTitle || options.inputMessage) {
      addCmds.push('$validation.ShowInput = $true');
      if (options.inputTitle) addCmds.push(`$validation.InputTitle = '${this.escapePsString(options.inputTitle)}'`);
      if (options.inputMessage) addCmds.push(`$validation.InputMessage = '${this.escapePsString(options.inputMessage)}'`);
    }
    if (options.errorTitle || options.errorMessage) {
      addCmds.push('$validation.ShowError = $true');
      if (options.errorTitle) addCmds.push(`$validation.ErrorTitle = '${this.escapePsString(options.errorTitle)}'`);
      if (options.errorMessage) addCmds.push(`$validation.ErrorMessage = '${this.escapePsString(options.errorMessage)}'`);
    }

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
$range.Validation.Delete()
$range.Validation.Add(${params})
$validation = $range.Validation
${addCmds.join('\n')}
@{ success = $true; message = "Data validation set on ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelClearDataValidation(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').Validation.Delete()
@{ success = $true; message = "Data validation cleared" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Named Ranges
  // ===========================================================================

  async excelCreateNamedRange(name: string, range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
$workbook.Names.Add('${this.escapePsString(name)}', $range)
@{ success = $true; message = "Named range '${name}' created" } | ConvertTo-Json -Compress
`);
  }

  async excelGetNamedRanges(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$names = @()
foreach ($n in $workbook.Names) {
  $names += @{ name = $n.Name; refersTo = $n.RefersTo; value = $n.Value }
}
@{ success = $true; named_ranges = $names } | ConvertTo-Json -Compress -Depth 5
`);
  }

  async excelDeleteNamedRange(name: string): Promise<OfficeResponse> {
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$workbook.Names('${this.escapePsString(name)}').Delete()
@{ success = $true; message = "Named range deleted" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Copy / Paste / Clear
  // ===========================================================================

  async excelCopyRange(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').Copy()
@{ success = $true; message = "Range ${range} copied" } | ConvertTo-Json -Compress
`);
  }

  async excelPasteRange(destination: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${destination}').Select()
$sheet.Paste()
@{ success = $true; message = "Pasted to ${destination}" } | ConvertTo-Json -Compress
`);
  }

  async excelClearRange(range: string, clearType: 'all' | 'contents' | 'formats' | 'comments' = 'all', sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const method = { all: 'Clear()', contents: 'ClearContents()', formats: 'ClearFormats()', comments: 'ClearComments()' }[clearType];
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').${method}
@{ success = $true; message = "Range ${range} cleared (${clearType})" } | ConvertTo-Json -Compress
`);
  }

  async excelFindReplace(find: string, replace: string,
    options?: { matchCase?: boolean; matchEntireCell?: boolean; range?: string; sheet?: string }): Promise<OfficeResponse> {
    const sheetScript = options?.sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(options.sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const rangeScript = options?.range ? `$range = $sheet.Range('${options.range}')` : '$range = $sheet.UsedRange';
    const lookAt = options?.matchEntireCell ? '1' : '2';
    const matchCase = options?.matchCase ? '$true' : '$false';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
${rangeScript}
$replaced = $range.Replace('${this.escapePsString(find)}', '${this.escapePsString(replace)}', ${lookAt}, 1, ${matchCase})
@{ success = $true; message = "Find and replace completed" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Images & Hyperlinks
  // ===========================================================================

  async excelAddImage(imagePath: string, cell: string, options?: { width?: number; height?: number; sheet?: string }): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(imagePath));
    const sheetScript = options?.sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(options.sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const sizeScript: string[] = [];
    if (options?.width) sizeScript.push(`$pic.Width = ${options.width}`);
    if (options?.height) sizeScript.push(`$pic.Height = ${options.height}`);

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$cell = $sheet.Range('${cell}')
$pic = $sheet.Shapes.AddPicture('${winPath}', 0, -1, $cell.Left, $cell.Top, -1, -1)
${sizeScript.join('\n')}
@{ success = $true; message = "Image added at ${cell}" } | ConvertTo-Json -Compress
`);
  }

  async excelAddHyperlink(cell: string, url: string, displayText?: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    const text = displayText || url;
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${cell}')
$sheet.Hyperlinks.Add($range, '${this.escapePsString(url)}', '', '', '${this.escapePsString(text)}')
@{ success = $true; message = "Hyperlink added to ${cell}" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Comments
  // ===========================================================================

  async excelAddComment(cell: string, text: string, _author?: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$cell = $sheet.Range('${cell}')
if ($cell.Comment -ne $null) { $cell.Comment.Delete() }
$comment = $cell.AddComment('${this.escapePsString(text)}')
$comment.Visible = $false
@{ success = $true; message = "Comment added to ${cell}" } | ConvertTo-Json -Compress
`);
  }

  async excelGetComment(cell: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$cell = $sheet.Range('${cell}')
if ($cell.Comment -ne $null) {
  @{ success = $true; has_comment = $true; text = $cell.Comment.Text() } | ConvertTo-Json -Compress
} else {
  @{ success = $true; has_comment = $false } | ConvertTo-Json -Compress
}
`);
  }

  async excelDeleteComment(cell: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$cell = $sheet.Range('${cell}')
if ($cell.Comment -ne $null) {
  $cell.Comment.Delete()
  @{ success = $true; message = "Comment deleted" } | ConvertTo-Json -Compress
} else {
  @{ success = $false; error = "No comment found" } | ConvertTo-Json -Compress
}
`);
  }

  // ===========================================================================
  // Protection
  // ===========================================================================

  async excelProtectSheet(password?: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Protect('${this.escapePsString(password || '')}')
@{ success = $true; message = "Sheet protected" } | ConvertTo-Json -Compress
`);
  }

  async excelUnprotectSheet(password?: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Unprotect('${this.escapePsString(password || '')}')
@{ success = $true; message = "Sheet unprotected" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Export & Print
  // ===========================================================================

  async excelExportPDF(outputPath: string, sheet?: string): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(outputPath));
    const sheetScript = sheet
      ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')\n$sheet.ExportAsFixedFormat(0, '${winPath}')`
      : `$workbook.ExportAsFixedFormat(0, '${winPath}')`;
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
@{ success = $true; message = "Exported to PDF"; path = '${winPath}' } | ConvertTo-Json -Compress
`);
  }

  async excelPrint(copies: number = 1, sheet?: string): Promise<OfficeResponse> {
    const printScript = sheet
      ? `$sheet = $workbook.Worksheets('${this.escapePsString(sheet)}')\n$sheet.PrintOut(1, 9999, ${copies})`
      : `$workbook.PrintOut(1, 9999, ${copies})`;
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${printScript}
@{ success = $true; message = "Print job sent (${copies} copies)" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Screenshot
  // ===========================================================================

  async excelScreenshot(): Promise<ScreenshotResponse> {
    const result = await this.executePowerShell(`
Add-Type -AssemblyName System.Windows.Forms
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$sheet = $excel.ActiveWorkbook.ActiveSheet
$usedRange = $sheet.UsedRange
$usedRange.CopyPicture(1, 2)
Start-Sleep -Milliseconds 500
$img = [System.Windows.Forms.Clipboard]::GetImage()
if ($img -eq $null) {
  @{ success = $false; error = "Failed to capture screenshot" } | ConvertTo-Json -Compress
  return
}
$ms = New-Object System.IO.MemoryStream
$img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$bytes = $ms.ToArray()
$base64 = [Convert]::ToBase64String($bytes)
$ms.Dispose(); $img.Dispose()
@{ success = $true; image = $base64; format = "png"; encoding = "base64" } | ConvertTo-Json -Compress
`, 60000);
    return result as ScreenshotResponse;
  }
}

// Export singleton instance
export const excelClient = new ExcelClient();
