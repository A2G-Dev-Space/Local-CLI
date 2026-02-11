/**
 * Excel Client
 *
 * Microsoft Excel automation via PowerShell COM.
 * Extends OfficeClientBase with Excel-specific operations.
 */

import { OfficeClientBase, OfficeResponse, ScreenshotResponse } from './office-client-base.js';

/**
 * Convert column letter (A, B, ..., Z, AA, AB, ...) to number (1, 2, ..., 26, 27, 28, ...)
 */
function columnLetterToNumber(column: string): number {
  let result = 0;
  for (let i = 0; i < column.length; i++) {
    result = result * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return result;
}

/**
 * Convert column number (1, 2, ..., 26, 27, 28, ...) to letter (A, B, ..., Z, AA, AB, ...)
 */
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
  protected override comProgId = 'Excel.Application';

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
}
$excel.DisplayAlerts = $false
$excel.Visible = $true
$workbook = $excel.Workbooks.Add()
$excel.DisplayAlerts = $true
@{ success = $true; message = "Created new workbook"; workbook_name = $workbook.Name } | ConvertTo-Json -Compress
`);
  }

  async excelOpen(filePath: string): Promise<OfficeResponse> {
    const windowsPath = this.toWindowsPath(filePath).replace(/'/g, "''");
    return this.executePowerShell(`
try {
  $excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
} catch {
  $excel = New-Object -ComObject Excel.Application
}
$excel.DisplayAlerts = $false
$excel.Visible = $true
$workbook = $excel.Workbooks.Open('${windowsPath}')
$excel.DisplayAlerts = $true
@{ success = $true; message = "Workbook opened"; workbook_name = $workbook.Name; path = $workbook.FullName } | ConvertTo-Json -Compress
`);
  }

  async excelWriteCell(
    cell: string,
    value: unknown,
    sheet?: string,
    options?: { fontName?: string; fontSize?: number; bold?: boolean; asText?: boolean }
  ): Promise<OfficeResponse> {
    const strValue = String(value);
    const escapedValue = strValue.replace(/'/g, "''");
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';

    // Auto-detect Korean and set font
    const hasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(strValue);
    const fontName = options?.fontName || (hasKorean ? 'Malgun Gothic' : '');

    // TEXT FIRST, FONT AFTER pattern (Microsoft recommended for Korean)
    const fontScript: string[] = [];
    if (fontName) fontScript.push(`$range.Font.Name = '${fontName.replace(/'/g, "''")}'`);
    if (options?.fontSize) fontScript.push(`$range.Font.Size = ${options.fontSize}`);
    if (options?.bold !== undefined) fontScript.push(`$range.Font.Bold = ${options.bold ? '$true' : '$false'}`);

    // Determine how to set the value:
    // - Numbers: set without quotes so Excel recognizes them
    // - Dates (YYYY-MM-DD, MM/DD/YYYY): use DateValue or let Excel parse
    // - asText option: force text format
    // - Otherwise: let Excel auto-detect (without forcing string)
    let valueScript: string;

    if (options?.asText) {
      // Force text format
      valueScript = `$range.NumberFormat = '@'; $range.Value = '${escapedValue}'`;
    } else if (typeof value === 'number' || (strValue !== '' && !isNaN(Number(strValue)) && strValue.trim() !== '')) {
      // Numeric value - don't quote
      valueScript = `$range.Value = ${strValue}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
      // ISO date format (YYYY-MM-DD) - convert to Excel date
      const [year, month, day] = strValue.split('-');
      valueScript = `$range.Value = (Get-Date -Year ${year} -Month ${month} -Day ${day}).ToOADate()`;
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(strValue)) {
      // US date format (MM/DD/YYYY) - let Excel parse
      valueScript = `$range.Value = '${escapedValue}'`;
    } else {
      // Default: set as-is and let Excel auto-detect
      valueScript = `$range.Value = '${escapedValue}'`;
    }

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${cell}')
${valueScript}
${fontScript.join('\n')}
@{ success = $true; message = "Value written to ${cell}" } | ConvertTo-Json -Compress
`);
  }

  async excelReadCell(cell: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
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
    const cols = Math.max(...values.map(row => row?.length || 0));
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';

    // Check for Korean text in any cell
    let hasKorean = false;

    // Helper to convert value to PowerShell format
    const toPsValue = (v: unknown): string => {
      const str = String(v);
      if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(str)) hasKorean = true;

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
      return `'${str.replace(/'/g, "''")}'`;
    };

    // Build proper 2D array (System.Object[,]) for Excel COM
    // PowerShell @(@(),@()) creates jagged arrays which Excel cannot assign to ranges
    const cellAssignments: string[] = [];
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (!row) continue;
      for (let j = 0; j < row.length; j++) {
        cellAssignments.push(`$data[${i},${j}] = ${toPsValue(row[j])}`);
      }
    }

    // TEXT FIRST, FONT AFTER pattern (Microsoft recommended for Korean)
    const fontScript = hasKorean ? "$range.Font.Name = 'Malgun Gothic'" : '';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$startRange = $sheet.Range('${startCell}')
$endCell = $sheet.Cells($startRange.Row + ${rows - 1}, $startRange.Column + ${cols - 1})
$range = $sheet.Range($startRange, $endCell)
$data = New-Object 'object[,]' ${rows},${cols}
${cellAssignments.join('\n')}
$range.Value = $data
${fontScript}
@{ success = $true; message = "Range written from ${startCell} (${rows}x${cols})" } | ConvertTo-Json -Compress
`);
  }

  async excelReadRange(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
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

  async excelSave(filePath?: string): Promise<OfficeResponse> {
    const windowsPath = filePath ? this.toWindowsPath(filePath).replace(/'/g, "''") : '';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${windowsPath ? `$workbook.SaveAs('${windowsPath}')` : '$workbook.Save()'}
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
if (${save ? '$true' : '$false'}) {
  foreach ($wb in $excel.Workbooks) { $wb.Save() }
}
$excel.Quit()
@{ success = $true; message = "Excel closed" } | ConvertTo-Json -Compress
`);
  }

  async excelSetFormula(cell: string, formula: string, sheet?: string): Promise<OfficeResponse> {
    const escapedFormula = formula.replace(/'/g, "''");
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${cell}').Formula = '${escapedFormula}'
@{ success = $true; message = "Formula set in ${cell}" } | ConvertTo-Json -Compress
`);
  }

  async excelSetFont(
    range: string,
    options: {
      fontName?: string;
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      color?: string;
    },
    sheet?: string
  ): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    const commands: string[] = [];
    if (options.fontName) commands.push(`$range.Font.Name = '${options.fontName.replace(/'/g, "''")}'`);
    if (options.fontSize) commands.push(`$range.Font.Size = ${options.fontSize}`);
    if (options.bold !== undefined) commands.push(`$range.Font.Bold = ${options.bold ? '$true' : '$false'}`);
    if (options.italic !== undefined) commands.push(`$range.Font.Italic = ${options.italic ? '$true' : '$false'}`);
    if (options.underline !== undefined) commands.push(`$range.Font.Underline = ${options.underline ? '2' : '0'}`);
    if (options.color) {
      const rgb = this.hexToRgb(options.color);
      if (rgb) commands.push(`$range.Font.Color = ${rgb.r + rgb.g * 256 + rgb.b * 65536}`);
    }

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
${commands.join('\n')}
@{ success = $true; message = "Font properties set for ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelSetAlignment(
    range: string,
    options: {
      horizontal?: 'left' | 'center' | 'right';
      vertical?: 'top' | 'center' | 'bottom';
      wrapText?: boolean;
      orientation?: number;
    },
    sheet?: string
  ): Promise<OfficeResponse> {
    const hAlignMap: Record<string, number> = { left: -4131, center: -4108, right: -4152 };
    const vAlignMap: Record<string, number> = { top: -4160, center: -4108, bottom: -4107 };
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    const commands: string[] = [];
    if (options.horizontal) commands.push(`$range.HorizontalAlignment = ${hAlignMap[options.horizontal]}`);
    if (options.vertical) commands.push(`$range.VerticalAlignment = ${vAlignMap[options.vertical]}`);
    if (options.wrapText !== undefined) commands.push(`$range.WrapText = ${options.wrapText ? '$true' : '$false'}`);
    if (options.orientation !== undefined) commands.push(`$range.Orientation = ${options.orientation}`);

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
${commands.join('\n')}
@{ success = $true; message = "Alignment set for ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelSetColumnWidth(column: string, width?: number, autoFit?: boolean, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
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
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
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
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').Merge()
@{ success = $true; message = "Cells merged: ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelSetBorder(
    range: string,
    options: {
      style?: 'thin' | 'medium' | 'thick' | 'double' | 'dotted' | 'dashed';
      color?: string;
      edges?: ('left' | 'right' | 'top' | 'bottom' | 'all')[];
    },
    sheet?: string
  ): Promise<OfficeResponse> {
    // xlContinuous=1, xlDash=-4115, xlDot=-4118, xlDouble=-4119
    // For weight: xlThin=2, xlMedium=-4138, xlThick=4
    const styleMap: Record<string, number> = { thin: 1, medium: 1, thick: 1, double: -4119, dotted: -4118, dashed: -4115 };
    const weightMap: Record<string, number> = { thin: 2, medium: -4138, thick: 4, double: 2, dotted: 2, dashed: 2 };
    const edgeMap: Record<string, number> = { left: 7, right: 10, top: 8, bottom: 9, all: -1 };
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    const edges = options.edges || ['all'];
    const borderStyle = options.style ? styleMap[options.style] : 1;
    const borderWeight = options.style ? weightMap[options.style] : 2;

    let borderScript = '';
    if (edges.includes('all')) {
      borderScript = `
$range.Borders.LineStyle = ${borderStyle}
$range.Borders.Weight = ${borderWeight}`;
    } else {
      borderScript = edges.map(e => `$range.Borders(${edgeMap[e]}).LineStyle = ${borderStyle}
$range.Borders(${edgeMap[e]}).Weight = ${borderWeight}`).join('\n');
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
    const rgb = this.hexToRgb(color);
    const colorValue = rgb ? rgb.r + rgb.g * 256 + rgb.b * 65536 : 0;
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').Interior.Color = ${colorValue}
@{ success = $true; message = "Fill color set for ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelSetNumberFormat(range: string, format: string, sheet?: string): Promise<OfficeResponse> {
    const escapedFormat = format.replace(/'/g, "''");
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').NumberFormat = '${escapedFormat}'
@{ success = $true; message = "Number format set for ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelAddSheet(name?: string, position?: 'start' | 'end' | string): Promise<OfficeResponse> {
    const escapedName = name?.replace(/'/g, "''") || '';
    let positionScript = '';
    if (position === 'start') {
      positionScript = ', [ref]$workbook.Sheets(1)';
    } else if (position === 'end') {
      positionScript = ', , [ref]$workbook.Sheets($workbook.Sheets.Count)';
    } else if (position) {
      positionScript = `, , [ref]$workbook.Sheets('${position.replace(/'/g, "''")}')`;
    }

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$newSheet = $workbook.Sheets.Add(${positionScript})
${escapedName ? `$newSheet.Name = '${escapedName}'` : ''}
@{ success = $true; message = "Sheet added"; sheet_name = $newSheet.Name } | ConvertTo-Json -Compress
`);
  }

  async excelDeleteSheet(name: string): Promise<OfficeResponse> {
    const escapedName = name.replace(/'/g, "''");
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$workbook.Sheets('${escapedName}').Delete()
@{ success = $true; message = "Sheet '${escapedName}' deleted" } | ConvertTo-Json -Compress
`);
  }

  async excelRenameSheet(oldName: string, newName: string): Promise<OfficeResponse> {
    const escapedOld = oldName.replace(/'/g, "''");
    const escapedNew = newName.replace(/'/g, "''");
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$workbook.Sheets('${escapedOld}').Name = '${escapedNew}'
@{ success = $true; message = "Sheet renamed from '${escapedOld}' to '${escapedNew}'" } | ConvertTo-Json -Compress
`);
  }

  async excelGetSheets(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$sheets = @()
foreach ($sheet in $workbook.Sheets) {
  $sheets += $sheet.Name
}
@{ success = $true; sheets = $sheets; count = $sheets.Count } | ConvertTo-Json -Compress
`);
  }

  async excelSortRange(
    range: string,
    sortColumn: string,
    ascending: boolean = true,
    hasHeader: boolean = true,
    sheet?: string
  ): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    const order = ascending ? 1 : 2; // xlAscending = 1, xlDescending = 2
    const header = hasHeader ? 1 : 2; // xlYes = 1, xlNo = 2

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
$sortKey = $sheet.Range('${sortColumn}1')

# Use Sort object for better compatibility
$sheet.Sort.SortFields.Clear()
$sheet.Sort.SortFields.Add($sortKey, 0, ${order})
$sheet.Sort.SetRange($range)
$sheet.Sort.Header = ${header}
$sheet.Sort.Apply()

@{ success = $true; message = "Range sorted by column ${sortColumn}" } | ConvertTo-Json -Compress
`);
  }

  async excelInsertRow(row: number, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
for ($i = 0; $i -lt ${count}; $i++) {
  $sheet.Rows(${row}).Insert()
}
@{ success = $true; message = "${count} row(s) inserted at row ${row}" } | ConvertTo-Json -Compress
`);
  }

  async excelDeleteRow(row: number, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Rows("${row}:${row + count - 1}").Delete()
@{ success = $true; message = "${count} row(s) deleted starting at row ${row}" } | ConvertTo-Json -Compress
`);
  }

  async excelInsertColumn(column: string, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
for ($i = 0; $i -lt ${count}; $i++) {
  $sheet.Columns('${column}').Insert()
}
@{ success = $true; message = "${count} column(s) inserted at column ${column}" } | ConvertTo-Json -Compress
`);
  }

  async excelDeleteColumn(column: string, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    const startColNum = columnLetterToNumber(column.toUpperCase());
    const endCol = columnNumberToLetter(startColNum + count - 1);
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Columns("${column}:${endCol}").Delete()
@{ success = $true; message = "${count} column(s) deleted starting at column ${column}" } | ConvertTo-Json -Compress
`);
  }

  async excelFreezePanes(row?: number, column?: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
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
    const sheetScript = sheet ? `$sheet = $workbook.Sheets('${sheet.replace(/'/g, "''")}')` : '$sheet = $workbook.ActiveSheet';
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$sheet.Range('${range}').AutoFilter()
@{ success = $true; message = "AutoFilter applied to ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelScreenshot(): Promise<ScreenshotResponse> {
    const result = await this.executePowerShell(`
Add-Type -AssemblyName System.Windows.Forms
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$sheet = $excel.ActiveWorkbook.ActiveSheet

# Get used range and copy as picture
$usedRange = $sheet.UsedRange
$usedRange.CopyPicture(1, 2)  # xlScreen=1, xlBitmap=2

# Get image from clipboard
Start-Sleep -Milliseconds 500
$img = [System.Windows.Forms.Clipboard]::GetImage()
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

@{
  success = $true
  image = $base64
  format = "png"
  encoding = "base64"
} | ConvertTo-Json -Compress
`);
    return result as ScreenshotResponse;
  }

  // -------------------------------------------------------------------------
  // Excel Charts
  // -------------------------------------------------------------------------

  async excelAddChart(
    dataRange: string,
    chartType: 'column' | 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'doughnut',
    options?: {
      title?: string;
      left?: number;
      top?: number;
      width?: number;
      height?: number;
      sheet?: string;
    }
  ): Promise<OfficeResponse> {
    // Excel chart types
    const chartTypeMap: Record<string, number> = {
      column: 51,      // xlColumnClustered
      bar: 57,         // xlBarClustered
      line: 4,         // xlLine
      pie: 5,          // xlPie
      area: 1,         // xlArea
      scatter: -4169,  // xlXYScatter
      doughnut: -4120, // xlDoughnut
    };
    const xlChartType = chartTypeMap[chartType] ?? 51;
    const escapedTitle = options?.title?.replace(/'/g, "''") || '';
    const hasKorean = options?.title ? /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(options.title) : false;

    const sheetScript = options?.sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${options.sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    const left = options?.left ?? 100;
    const top = options?.top ?? 100;
    const width = options?.width ?? 400;
    const height = options?.height ?? 300;

    // TEXT FIRST, FONT AFTER pattern (Microsoft recommended for Korean)
    const titleScript = escapedTitle ? `
$chart.HasTitle = $true
$chart.ChartTitle.Text = '${escapedTitle}'
${hasKorean ? "$chart.ChartTitle.Font.Name = 'Malgun Gothic'" : ''}` : '';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$range = $sheet.Range('${dataRange}')
$chartObj = $sheet.ChartObjects().Add(${left}, ${top}, ${width}, ${height})
$chart = $chartObj.Chart
$chart.SetSourceData($range)
$chart.ChartType = ${xlChartType}
${titleScript}
@{ success = $true; message = "Chart added"; chart_name = $chartObj.Name } | ConvertTo-Json -Compress
`);
  }

  async excelSetChartTitle(chartIndex: number, title: string, sheet?: string): Promise<OfficeResponse> {
    const escapedTitle = title.replace(/'/g, "''");
    const hasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(title);
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    // TEXT FIRST, FONT AFTER pattern (Microsoft recommended for Korean)
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$chartObj = $sheet.ChartObjects(${chartIndex})
$chart = $chartObj.Chart
$chart.HasTitle = $true
$chart.ChartTitle.Text = '${escapedTitle}'
${hasKorean ? "$chart.ChartTitle.Font.Name = 'Malgun Gothic'" : ''}
@{ success = $true; message = "Chart title set" } | ConvertTo-Json -Compress
`);
  }

  async excelDeleteChart(chartIndex: number, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.ChartObjects(${chartIndex}).Delete()
@{ success = $true; message = "Chart deleted" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Conditional Formatting
  // -------------------------------------------------------------------------

  async excelAddConditionalFormat(
    range: string,
    formatType: 'cellValue' | 'colorScale' | 'dataBar' | 'iconSet' | 'duplicates' | 'top10',
    options?: {
      operator?: 'greater' | 'less' | 'equal' | 'between' | 'notBetween';
      value1?: string | number;
      value2?: string | number;
      fillColor?: string;
      fontColor?: string;
      sheet?: string;
    }
  ): Promise<OfficeResponse> {
    const sheetScript = options?.sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${options.sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    // xlFormatConditionType: xlCellValue=1, xlColorScale=3, xlDataBar=4, xlIconSet=6, xlUniqueValues=8, xlTop10=5
    const typeMap: Record<string, number> = {
      cellValue: 1,
      colorScale: 3,
      dataBar: 4,
      iconSet: 6,
      duplicates: 8,
      top10: 5,
    };
    const conditionType = typeMap[formatType] ?? 1;

    // xlOperator: xlGreater=5, xlLess=6, xlEqual=3, xlBetween=1, xlNotBetween=2
    const operatorMap: Record<string, number> = {
      greater: 5,
      less: 6,
      equal: 3,
      between: 1,
      notBetween: 2,
    };
    const xlOperator = options?.operator ? operatorMap[options.operator] : 5;

    let formatScript = '';
    if (formatType === 'cellValue') {
      const formula1 = typeof options?.value1 === 'string' ? `"${options.value1}"` : options?.value1 ?? 0;
      const formula2 = options?.value2 !== undefined ?
        (typeof options.value2 === 'string' ? `"${options.value2}"` : options.value2) : '';

      formatScript = `
$fc = $range.FormatConditions.Add(${conditionType}, ${xlOperator}, ${formula1}${formula2 ? `, ${formula2}` : ''})`;

      if (options?.fillColor) {
        const rgb = this.hexToRgb(options.fillColor);
        if (rgb) {
          formatScript += `\n$fc.Interior.Color = ${rgb.r + rgb.g * 256 + rgb.b * 65536}`;
        }
      }
      if (options?.fontColor) {
        const rgb = this.hexToRgb(options.fontColor);
        if (rgb) {
          formatScript += `\n$fc.Font.Color = ${rgb.r + rgb.g * 256 + rgb.b * 65536}`;
        }
      }
    } else if (formatType === 'colorScale') {
      formatScript = '$range.FormatConditions.AddColorScale(3)';
    } else if (formatType === 'dataBar') {
      formatScript = '$range.FormatConditions.AddDataBar()';
    } else if (formatType === 'iconSet') {
      formatScript = '$range.FormatConditions.AddIconSetCondition()';
    } else if (formatType === 'duplicates') {
      formatScript = `$fc = $range.FormatConditions.AddUniqueValues()
$fc.DupeUnique = 1`;  // xlDuplicate
      if (options?.fillColor) {
        const rgb = this.hexToRgb(options.fillColor);
        if (rgb) {
          formatScript += `\n$fc.Interior.Color = ${rgb.r + rgb.g * 256 + rgb.b * 65536}`;
        }
      }
    } else if (formatType === 'top10') {
      formatScript = `$fc = $range.FormatConditions.AddTop10()
$fc.TopBottom = 1
$fc.Rank = 10`;
      if (options?.fillColor) {
        const rgb = this.hexToRgb(options.fillColor);
        if (rgb) {
          formatScript += `\n$fc.Interior.Color = ${rgb.r + rgb.g * 256 + rgb.b * 65536}`;
        }
      }
    }

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$range = $sheet.Range('${range}')
${formatScript}
@{ success = $true; message = "Conditional format added to ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelClearConditionalFormat(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Range('${range}').FormatConditions.Delete()
@{ success = $true; message = "Conditional formatting cleared from ${range}" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Data Validation
  // -------------------------------------------------------------------------

  async excelSetDataValidation(
    range: string,
    validationType: 'list' | 'whole' | 'decimal' | 'date' | 'textLength' | 'custom',
    options: {
      formula1?: string;
      formula2?: string;
      operator?: 'between' | 'notBetween' | 'equal' | 'notEqual' | 'greater' | 'less' | 'greaterEqual' | 'lessEqual';
      showInputMessage?: boolean;
      inputTitle?: string;
      inputMessage?: string;
      showErrorMessage?: boolean;
      errorTitle?: string;
      errorMessage?: string;
      sheet?: string;
    }
  ): Promise<OfficeResponse> {
    const sheetScript = options?.sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${options.sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    // xlDVType: xlValidateList=3, xlValidateWholeNumber=1, xlValidateDecimal=2, xlValidateDate=4, xlValidateTextLength=6, xlValidateCustom=7
    const typeMap: Record<string, number> = {
      list: 3,
      whole: 1,
      decimal: 2,
      date: 4,
      textLength: 6,
      custom: 7,
    };
    const dvType = typeMap[validationType] ?? 3;

    // xlDVAlertStyle: xlValidAlertStop=1
    // xlOperator
    const operatorMap: Record<string, number> = {
      between: 1,
      notBetween: 2,
      equal: 3,
      notEqual: 4,
      greater: 5,
      less: 6,
      greaterEqual: 7,
      lessEqual: 8,
    };
    const xlOperator = options.operator ? operatorMap[options.operator] : 1;

    const formula1 = options.formula1?.replace(/'/g, "''") || '';
    const formula2 = options.formula2?.replace(/'/g, "''") || '';

    const additionalSettings: string[] = [];
    if (options.showInputMessage !== false && (options.inputTitle || options.inputMessage)) {
      additionalSettings.push('$validation.ShowInput = $true');
      if (options.inputTitle) additionalSettings.push(`$validation.InputTitle = '${options.inputTitle.replace(/'/g, "''")}'`);
      if (options.inputMessage) additionalSettings.push(`$validation.InputMessage = '${options.inputMessage.replace(/'/g, "''")}'`);
    }
    if (options.showErrorMessage !== false && (options.errorTitle || options.errorMessage)) {
      additionalSettings.push('$validation.ShowError = $true');
      if (options.errorTitle) additionalSettings.push(`$validation.ErrorTitle = '${options.errorTitle.replace(/'/g, "''")}'`);
      if (options.errorMessage) additionalSettings.push(`$validation.ErrorMessage = '${options.errorMessage.replace(/'/g, "''")}'`);
    }

    // For list validation, operator parameter is not used
    const validationParams = validationType === 'list'
      ? `${dvType}, 1, 1, '${formula1}'`  // List: Type, AlertStyle, Operator (ignored), Formula1
      : `${dvType}, 1, ${xlOperator}, '${formula1}'${formula2 ? `, '${formula2}'` : ''}`;

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$range = $sheet.Range('${range}')
$range.Validation.Delete()
$range.Validation.Add(${validationParams})
$validation = $range.Validation
${additionalSettings.join('\n')}
@{ success = $true; message = "Data validation set on ${range}" } | ConvertTo-Json -Compress
`);
  }

  async excelClearDataValidation(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Range('${range}').Validation.Delete()
@{ success = $true; message = "Data validation cleared from ${range}" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Named Ranges
  // -------------------------------------------------------------------------

  async excelCreateNamedRange(name: string, range: string, sheet?: string): Promise<OfficeResponse> {
    const escapedName = name.replace(/'/g, "''");
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
${sheetScript}
$range = $sheet.Range('${range}')
$workbook.Names.Add('${escapedName}', $range)
@{ success = $true; message = "Named range '${escapedName}' created" } | ConvertTo-Json -Compress
`);
  }

  async excelGetNamedRanges(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$names = @()
foreach ($n in $workbook.Names) {
  $names += @{
    name = $n.Name
    refersTo = $n.RefersTo
    value = $n.Value
  }
}
@{ success = $true; named_ranges = $names } | ConvertTo-Json -Compress -Depth 5
`);
  }

  async excelDeleteNamedRange(name: string): Promise<OfficeResponse> {
    const escapedName = name.replace(/'/g, "''");
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$workbook = $excel.ActiveWorkbook
$workbook.Names('${escapedName}').Delete()
@{ success = $true; message = "Named range '${escapedName}' deleted" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Copy/Paste/Clear
  // -------------------------------------------------------------------------

  async excelCopyRange(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Range('${range}').Copy()
@{ success = $true; message = "Range ${range} copied to clipboard" } | ConvertTo-Json -Compress
`);
  }

  async excelPasteRange(destination: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Range('${destination}').Select()
$sheet.Paste()
@{ success = $true; message = "Pasted to ${destination}" } | ConvertTo-Json -Compress
`);
  }

  async excelClearRange(
    range: string,
    clearType: 'all' | 'contents' | 'formats' | 'comments' = 'all',
    sheet?: string
  ): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    const clearMethod = {
      all: 'Clear()',
      contents: 'ClearContents()',
      formats: 'ClearFormats()',
      comments: 'ClearComments()',
    }[clearType];

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Range('${range}').${clearMethod}
@{ success = $true; message = "Range ${range} cleared (${clearType})" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Hide/Show Rows & Columns
  // -------------------------------------------------------------------------

  async excelHideColumn(column: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Columns('${column}').Hidden = $true
@{ success = $true; message = "Column ${column} hidden" } | ConvertTo-Json -Compress
`);
  }

  async excelShowColumn(column: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Columns('${column}').Hidden = $false
@{ success = $true; message = "Column ${column} shown" } | ConvertTo-Json -Compress
`);
  }

  async excelHideRow(row: number, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Rows(${row}).Hidden = $true
@{ success = $true; message = "Row ${row} hidden" } | ConvertTo-Json -Compress
`);
  }

  async excelShowRow(row: number, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Rows(${row}).Hidden = $false
@{ success = $true; message = "Row ${row} shown" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Image & Hyperlink
  // -------------------------------------------------------------------------

  async excelAddImage(
    imagePath: string,
    cell: string,
    options?: { width?: number; height?: number; sheet?: string }
  ): Promise<OfficeResponse> {
    const windowsPath = this.toWindowsPath(imagePath).replace(/'/g, "''");
    const sheetScript = options?.sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${options.sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    const sizeScript = [];
    if (options?.width) sizeScript.push(`$pic.Width = ${options.width}`);
    if (options?.height) sizeScript.push(`$pic.Height = ${options.height}`);

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$cell = $sheet.Range('${cell}')
$pic = $sheet.Shapes.AddPicture('${windowsPath}', 0, -1, $cell.Left, $cell.Top, -1, -1)
${sizeScript.join('\n')}
@{ success = $true; message = "Image added at ${cell}" } | ConvertTo-Json -Compress
`);
  }

  async excelAddHyperlink(
    cell: string,
    url: string,
    displayText?: string,
    sheet?: string
  ): Promise<OfficeResponse> {
    const escapedUrl = url.replace(/'/g, "''");
    const escapedText = displayText?.replace(/'/g, "''") || url;
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$range = $sheet.Range('${cell}')
$sheet.Hyperlinks.Add($range, '${escapedUrl}', '', '', '${escapedText}')
@{ success = $true; message = "Hyperlink added to ${cell}" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Export & Print
  // -------------------------------------------------------------------------

  async excelExportPDF(outputPath: string, sheet?: string): Promise<OfficeResponse> {
    const windowsPath = this.toWindowsPath(outputPath).replace(/'/g, "''");
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')
$sheet.ExportAsFixedFormat(0, '${windowsPath}')` :
      `$excel.ActiveWorkbook.ExportAsFixedFormat(0, '${windowsPath}')`;

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
@{ success = $true; message = "Exported to PDF"; path = '${windowsPath}' } | ConvertTo-Json -Compress
`);
  }

  async excelPrint(copies: number = 1, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')
$sheet.PrintOut(1, 9999, ${copies})` :
      `$excel.ActiveWorkbook.PrintOut(1, 9999, ${copies})`;

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
@{ success = $true; message = "Print job sent (${copies} copies)" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Comments
  // -------------------------------------------------------------------------

  async excelAddComment(cell: string, text: string, _author?: string, sheet?: string): Promise<OfficeResponse> {
    const escapedText = text.replace(/'/g, "''");
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$cell = $sheet.Range('${cell}')
if ($cell.Comment -ne $null) { $cell.Comment.Delete() }
$comment = $cell.AddComment('${escapedText}')
$comment.Visible = $false
@{ success = $true; message = "Comment added to ${cell}" } | ConvertTo-Json -Compress
`);
  }

  async excelGetComment(cell: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
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
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$cell = $sheet.Range('${cell}')
if ($cell.Comment -ne $null) {
  $cell.Comment.Delete()
  @{ success = $true; message = "Comment deleted from ${cell}" } | ConvertTo-Json -Compress
} else {
  @{ success = $false; error = "No comment found at ${cell}" } | ConvertTo-Json -Compress
}
`);
  }

  // -------------------------------------------------------------------------
  // Excel Sheet Protection
  // -------------------------------------------------------------------------

  async excelProtectSheet(password?: string, sheet?: string): Promise<OfficeResponse> {
    const escapedPassword = password?.replace(/'/g, "''") || '';
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Protect('${escapedPassword}')
@{ success = $true; message = "Sheet protected" } | ConvertTo-Json -Compress
`);
  }

  async excelUnprotectSheet(password?: string, sheet?: string): Promise<OfficeResponse> {
    const escapedPassword = password?.replace(/'/g, "''") || '';
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Unprotect('${escapedPassword}')
@{ success = $true; message = "Sheet unprotected" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Unmerge Cells
  // -------------------------------------------------------------------------

  async excelUnmergeCells(range: string, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Range('${range}').UnMerge()
@{ success = $true; message = "Cells unmerged: ${range}" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Select/Activate Sheet
  // -------------------------------------------------------------------------

  async excelSelectSheet(name: string): Promise<OfficeResponse> {
    const escapedName = name.replace(/'/g, "''");
    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
$excel.ActiveWorkbook.Worksheets('${escapedName}').Activate()
@{ success = $true; message = "Sheet '${escapedName}' activated" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Find & Replace
  // -------------------------------------------------------------------------

  async excelFindReplace(
    find: string,
    replace: string,
    options?: {
      matchCase?: boolean;
      matchEntireCell?: boolean;
      range?: string;
      sheet?: string;
    }
  ): Promise<OfficeResponse> {
    const escapedFind = find.replace(/'/g, "''");
    const escapedReplace = replace.replace(/'/g, "''");
    const sheetScript = options?.sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${options.sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    const rangeScript = options?.range ?
      `$range = $sheet.Range('${options.range}')` :
      '$range = $sheet.UsedRange';

    const matchCase = options?.matchCase ? '$true' : '$false';
    const lookAt = options?.matchEntireCell ? '1' : '2';  // xlWhole=1, xlPart=2

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
${rangeScript}
$replaced = $range.Replace('${escapedFind}', '${escapedReplace}', ${lookAt}, 1, ${matchCase})
@{ success = $true; message = "Find and replace completed" } | ConvertTo-Json -Compress
`);
  }

  // -------------------------------------------------------------------------
  // Excel Group Rows
  // -------------------------------------------------------------------------

  async excelGroupRows(startRow: number, endRow: number, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Rows("${startRow}:${endRow}").Group()
@{ success = $true; message = "Rows ${startRow}-${endRow} grouped" } | ConvertTo-Json -Compress
`);
  }

  async excelUngroupRows(startRow: number, endRow: number, sheet?: string): Promise<OfficeResponse> {
    const sheetScript = sheet ?
      `$sheet = $excel.ActiveWorkbook.Worksheets('${sheet.replace(/'/g, "''")}')` :
      '$sheet = $excel.ActiveWorkbook.ActiveSheet';

    return this.executePowerShell(`
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
${sheetScript}
$sheet.Rows("${startRow}:${endRow}").Ungroup()
@{ success = $true; message = "Rows ${startRow}-${endRow} ungrouped" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Microsoft PowerPoint Operations
  // ===========================================================================


}

// Export singleton instance
export const excelClient = new ExcelClient();
export type { OfficeResponse, ScreenshotResponse };

