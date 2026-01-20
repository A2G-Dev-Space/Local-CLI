/**
 * PowerPoint Client for Electron (Windows Native)
 *
 * Microsoft PowerPoint automation via PowerShell COM.
 * All 79 methods from CLI, optimized for Windows Native.
 */

import { OfficeClientBase, OfficeResponse, ScreenshotResponse } from './office-client-base';

export class PowerPointClient extends OfficeClientBase {
  // ===========================================================================
  // Launch / Create / Open / Save / Close
  // ===========================================================================

  async powerpointLaunch(): Promise<OfficeResponse> {
    return this.executePowerShell(`
try {
  $ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
  @{ success = $true; message = "Connected to existing PowerPoint instance" } | ConvertTo-Json -Compress
} catch {
  $ppt = New-Object -ComObject PowerPoint.Application
  @{ success = $true; message = "Launched new PowerPoint instance" } | ConvertTo-Json -Compress
}
`);
  }

  async powerpointCreate(): Promise<OfficeResponse> {
    return this.executePowerShell(`
try {
  $ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
} catch {
  $ppt = New-Object -ComObject PowerPoint.Application
}
$presentation = $ppt.Presentations.Add(-1)
@{ success = $true; message = "Created new presentation"; presentation_name = $presentation.Name } | ConvertTo-Json -Compress
`);
  }

  async powerpointOpen(filePath: string): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(filePath));
    return this.executePowerShell(`
try {
  $ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
} catch {
  $ppt = New-Object -ComObject PowerPoint.Application
}
$presentation = $ppt.Presentations.Open('${winPath}')
@{ success = $true; message = "Presentation opened"; presentation_name = $presentation.Name; path = $presentation.FullName } | ConvertTo-Json -Compress
`);
  }

  async powerpointSave(filePath?: string): Promise<OfficeResponse> {
    if (filePath) {
      const winPath = this.escapePsString(this.toWindowsPath(filePath));
      return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$presentation.SaveAs('${winPath}')
@{ success = $true; message = "Presentation saved"; path = $presentation.FullName } | ConvertTo-Json -Compress
`);
    }
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$presentation.Save()
@{ success = $true; message = "Presentation saved"; path = $presentation.FullName } | ConvertTo-Json -Compress
`);
  }

  async powerpointClose(save: boolean = false): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
${save ? '$presentation.Save()' : ''}
$presentation.Close()
@{ success = $true; message = "Presentation closed" } | ConvertTo-Json -Compress
`);
  }

  async powerpointQuit(save: boolean = false): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
${save ? 'foreach ($pres in $ppt.Presentations) { $pres.Save() }' : ''}
$ppt.Quit()
@{ success = $true; message = "PowerPoint closed" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Slide Operations
  // ===========================================================================

  async powerpointAddSlide(layout: number = 1): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slideCount = $presentation.Slides.Count
$customLayout = $presentation.SlideMaster.CustomLayouts(${layout})
$slide = $presentation.Slides.AddSlide($slideCount + 1, $customLayout)
@{ success = $true; message = "Slide added"; slide_number = $slide.SlideIndex; layout = ${layout} } | ConvertTo-Json -Compress
`);
  }

  async powerpointDeleteSlide(slideNumber: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$presentation.Slides(${slideNumber}).Delete()
@{ success = $true; message = "Slide ${slideNumber} deleted" } | ConvertTo-Json -Compress
`);
  }

  async powerpointMoveSlide(fromIndex: number, toIndex: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$presentation.Slides(${fromIndex}).MoveTo(${toIndex})
@{ success = $true; message = "Slide moved from ${fromIndex} to ${toIndex}" } | ConvertTo-Json -Compress
`);
  }

  async powerpointDuplicateSlide(slideNumber: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$newSlide = $presentation.Slides(${slideNumber}).Duplicate()
@{ success = $true; message = "Slide duplicated"; new_slide_index = $newSlide.SlideIndex } | ConvertTo-Json -Compress
`);
  }

  async powerpointHideSlide(slideNumber: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$presentation.Slides(${slideNumber}).SlideShowTransition.Hidden = -1
@{ success = $true; message = "Slide ${slideNumber} hidden" } | ConvertTo-Json -Compress
`);
  }

  async powerpointShowSlide(slideNumber: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$presentation.Slides(${slideNumber}).SlideShowTransition.Hidden = 0
@{ success = $true; message = "Slide ${slideNumber} shown" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetSlideLayout(slideNumber: number, layoutIndex: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$presentation.Slides(${slideNumber}).Layout = ${layoutIndex}
@{ success = $true; message = "Slide layout set to ${layoutIndex}" } | ConvertTo-Json -Compress
`);
  }

  async powerpointGetSlideCount(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
@{ success = $true; slide_count = $presentation.Slides.Count } | ConvertTo-Json -Compress
`);
  }

  async powerpointGetSlideLayouts(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$layouts = @()
$master = $presentation.SlideMaster
for ($i = 1; $i -le $master.CustomLayouts.Count; $i++) {
  $layouts += @{ index = $i; name = $master.CustomLayouts($i).Name }
}
@{ success = $true; layouts = $layouts } | ConvertTo-Json -Compress -Depth 5
`);
  }

  // ===========================================================================
  // Text Operations
  // ===========================================================================

  async powerpointWriteText(slideNumber: number, shapeIndex: number, text: string,
    options?: { fontName?: string; fontSize?: number; bold?: boolean }): Promise<OfficeResponse> {
    const escaped = this.escapePsString(text);
    const hasKorean = this.hasKorean(text);
    const fontName = options?.fontName || (hasKorean ? 'Malgun Gothic' : '');

    const cmds: string[] = [];
    if (fontName) cmds.push(`$textRange.Font.Name = '${this.escapePsString(fontName)}'`);
    if (options?.fontSize) cmds.push(`$textRange.Font.Size = ${options.fontSize}`);
    if (options?.bold !== undefined) cmds.push(`$textRange.Font.Bold = ${options.bold ? '-1' : '0'}`);

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$shape = $slide.Shapes(${shapeIndex})
$textRange = $shape.TextFrame.TextRange
${cmds.join('\n')}
$textRange.Text = '${escaped}'
@{ success = $true; message = "Text written to slide ${slideNumber}, shape ${shapeIndex}" } | ConvertTo-Json -Compress
`);
  }

  async powerpointReadSlide(slideNumber: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$texts = @()
foreach ($shape in $slide.Shapes) {
  if ($shape.HasTextFrame -eq -1) {
    $texts += @{ shape_index = $shape.Index; shape_name = $shape.Name; text = $shape.TextFrame.TextRange.Text }
  }
}
@{ success = $true; slide_number = ${slideNumber}; shape_count = $slide.Shapes.Count; texts = $texts } | ConvertTo-Json -Compress -Depth 5
`);
  }

  async powerpointAddTextbox(slideNumber: number, text: string, left: number = 100, top: number = 100,
    width: number = 300, height: number = 50): Promise<OfficeResponse> {
    const escaped = this.escapePsString(text);
    const hasKorean = this.hasKorean(text);
    const fontScript = hasKorean ? "$textbox.TextFrame.TextRange.Font.Name = 'Malgun Gothic'" : '';

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$textbox = $slide.Shapes.AddTextbox(1, ${left}, ${top}, ${width}, ${height})
${fontScript}
$textbox.TextFrame.TextRange.Text = '${escaped}'
@{ success = $true; message = "Textbox added"; shape_index = $textbox.Index } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetFont(slideNumber: number, shapeIndex: number, options: {
    fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean; color?: string;
  }): Promise<OfficeResponse> {
    const cmds: string[] = [];
    if (options.fontName) cmds.push(`$textRange.Font.Name = '${this.escapePsString(options.fontName)}'`);
    if (options.fontSize) cmds.push(`$textRange.Font.Size = ${options.fontSize}`);
    if (options.bold !== undefined) cmds.push(`$textRange.Font.Bold = ${options.bold ? '-1' : '0'}`);
    if (options.italic !== undefined) cmds.push(`$textRange.Font.Italic = ${options.italic ? '-1' : '0'}`);
    if (options.color) cmds.push(`$textRange.Font.Color.RGB = ${this.hexToBgr(options.color)}`);

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$shape = $slide.Shapes(${shapeIndex})
$textRange = $shape.TextFrame.TextRange
${cmds.join('\n')}
@{ success = $true; message = "Font set for slide ${slideNumber}, shape ${shapeIndex}" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetTextAlignment(slideNumber: number, shapeIndex: number,
    horizontal: 'left' | 'center' | 'right' | 'justify', vertical?: 'top' | 'middle' | 'bottom'): Promise<OfficeResponse> {
    const hMap: Record<string, number> = { left: 1, center: 2, right: 3, justify: 4 };
    const vMap: Record<string, number> = { top: 1, middle: 3, bottom: 4 };

    const cmds: string[] = [`$shape.TextFrame.TextRange.ParagraphFormat.Alignment = ${hMap[horizontal]}`];
    if (vertical) cmds.push(`$shape.TextFrame.VerticalAnchor = ${vMap[vertical]}`);

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$shape = $slide.Shapes(${shapeIndex})
${cmds.join('\n')}
@{ success = $true; message = "Text alignment set" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetBulletList(slideNumber: number, shapeIndex: number,
    bulletType: 'none' | 'bullet' | 'numbered', bulletChar?: string): Promise<OfficeResponse> {
    const typeMap: Record<string, number> = { none: 0, bullet: 1, numbered: 2 };
    let bulletScript = `$shape.TextFrame.TextRange.ParagraphFormat.Bullet.Type = ${typeMap[bulletType]}`;
    if (bulletType === 'bullet' && bulletChar) {
      bulletScript += `\n$shape.TextFrame.TextRange.ParagraphFormat.Bullet.Character = [int][char]'${bulletChar}'`;
    }

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$shape = $slide.Shapes(${shapeIndex})
${bulletScript}
@{ success = $true; message = "Bullet style set to ${bulletType}" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetLineSpacing(slideNumber: number, shapeIndex: number, lineSpacing: number,
    spaceAfter?: number, spaceBefore?: number): Promise<OfficeResponse> {
    const cmds: string[] = [
      '$shape.TextFrame.TextRange.ParagraphFormat.LineRuleWithin = 0',
      `$shape.TextFrame.TextRange.ParagraphFormat.SpaceWithin = ${lineSpacing}`
    ];
    if (spaceAfter !== undefined) cmds.push(`$shape.TextFrame.TextRange.ParagraphFormat.SpaceAfter = ${spaceAfter}`);
    if (spaceBefore !== undefined) cmds.push(`$shape.TextFrame.TextRange.ParagraphFormat.SpaceBefore = ${spaceBefore}`);

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$shape = $slide.Shapes(${shapeIndex})
${cmds.join('\n')}
@{ success = $true; message = "Line spacing set" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetPlaceholderText(slideNumber: number,
    placeholderType: 'title' | 'subtitle' | 'body' | 'footer' | 'slideNumber' | 'date', text: string): Promise<OfficeResponse> {
    const escaped = this.escapePsString(text);
    const hasKorean = this.hasKorean(text);
    const typeMap: Record<string, number> = { title: 1, subtitle: 4, body: 2, footer: 5, slideNumber: 6, date: 16 };

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$placeholder = $null
foreach ($shape in $slide.Shapes) {
  if ($shape.Type -eq 14) {
    if ($shape.PlaceholderFormat.Type -eq ${typeMap[placeholderType]}) {
      $placeholder = $shape
      break
    }
  }
}
if ($placeholder) {
  ${hasKorean ? "$placeholder.TextFrame.TextRange.Font.Name = 'Malgun Gothic'" : ''}
  $placeholder.TextFrame.TextRange.Text = '${escaped}'
  @{ success = $true; message = "${placeholderType} placeholder text set" } | ConvertTo-Json -Compress
} else {
  @{ success = $false; error = "Placeholder type '${placeholderType}' not found" } | ConvertTo-Json -Compress
}
`);
  }

  async powerpointGetPlaceholders(slideNumber: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$placeholders = @()
foreach ($shape in $slide.Shapes) {
  if ($shape.Type -eq 14) {
    $placeholders += @{
      index = $shape.Index; name = $shape.Name
      type = $shape.PlaceholderFormat.Type; hasText = $shape.HasTextFrame
      text = if ($shape.HasTextFrame -eq -1) { $shape.TextFrame.TextRange.Text } else { "" }
    }
  }
}
@{ success = $true; slide = ${slideNumber}; placeholders = $placeholders } | ConvertTo-Json -Compress -Depth 5
`);
  }

  // ===========================================================================
  // Shapes
  // ===========================================================================

  async powerpointAddImage(slideNumber: number, imagePath: string, left: number = 100, top: number = 100,
    width?: number, height?: number): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(imagePath));
    const sizeScript = width !== undefined && height !== undefined
      ? `$shape.Width = ${width}; $shape.Height = ${height}` : '';

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$shape = $slide.Shapes.AddPicture('${winPath}', 0, -1, ${left}, ${top})
${sizeScript}
@{ success = $true; message = "Image added"; shape_index = $shape.Index } | ConvertTo-Json -Compress
`);
  }

  async powerpointAddShape(slideNumber: number, shapeType: 'rectangle' | 'oval' | 'triangle' | 'arrow' | 'star',
    left: number, top: number, width: number, height: number, fillColor?: string): Promise<OfficeResponse> {
    const shapeMap: Record<string, number> = { rectangle: 1, oval: 9, triangle: 7, arrow: 33, star: 92 };
    const fillScript = fillColor ? `$shape.Fill.ForeColor.RGB = ${this.hexToBgr(fillColor)}` : '';

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$shape = $slide.Shapes.AddShape(${shapeMap[shapeType] ?? 1}, ${left}, ${top}, ${width}, ${height})
${fillScript}
@{ success = $true; message = "${shapeType} shape added"; shape_index = $shape.Index } | ConvertTo-Json -Compress
`);
  }

  async powerpointDeleteShape(slideNumber: number, shapeIndex: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$presentation.Slides(${slideNumber}).Shapes(${shapeIndex}).Delete()
@{ success = $true; message = "Shape deleted" } | ConvertTo-Json -Compress
`);
  }

  async powerpointDuplicateShape(slideNumber: number, shapeIndex: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$newShape = $presentation.Slides(${slideNumber}).Shapes(${shapeIndex}).Duplicate()
@{ success = $true; message = "Shape duplicated"; new_shape_index = $newShape.Index } | ConvertTo-Json -Compress
`);
  }

  async powerpointRotateShape(slideNumber: number, shapeIndex: number, angle: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$presentation.Slides(${slideNumber}).Shapes(${shapeIndex}).Rotation = ${angle}
@{ success = $true; message = "Shape rotated to ${angle} degrees" } | ConvertTo-Json -Compress
`);
  }

  async powerpointGetShapeInfo(slideNumber: number, shapeIndex: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$shape = $presentation.Slides(${slideNumber}).Shapes(${shapeIndex})
@{
  success = $true; name = $shape.Name; type = $shape.Type
  left = $shape.Left; top = $shape.Top; width = $shape.Width; height = $shape.Height
  rotation = $shape.Rotation; visible = $shape.Visible; has_text = $shape.HasTextFrame
} | ConvertTo-Json -Compress
`);
  }

  async powerpointSetShapeName(slideNumber: number, shapeIndex: number, name: string): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$presentation.Slides(${slideNumber}).Shapes(${shapeIndex}).Name = '${this.escapePsString(name)}'
@{ success = $true; message = "Shape name set" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetShapeOpacity(slideNumber: number, shapeIndex: number, opacity: number): Promise<OfficeResponse> {
    const transparency = 1 - (opacity / 100);
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$presentation.Slides(${slideNumber}).Shapes(${shapeIndex}).Fill.Transparency = ${transparency}
@{ success = $true; message = "Shape opacity set to ${opacity}%" } | ConvertTo-Json -Compress
`);
  }

  async powerpointGetShapeList(slideNumber: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$slide = $presentation.Slides(${slideNumber})
$shapes = @()
for ($i = 1; $i -le $slide.Shapes.Count; $i++) {
  $s = $slide.Shapes($i)
  $shapes += @{ index = $i; name = $s.Name; type = $s.Type; left = $s.Left; top = $s.Top; width = $s.Width; height = $s.Height }
}
@{ success = $true; slide = ${slideNumber}; count = $slide.Shapes.Count; shapes = $shapes } | ConvertTo-Json -Compress -Depth 5
`);
  }

  async powerpointSetShapePosition(slideNumber: number, shapeIndex: number, left: number, top: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$shape = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex})
$shape.Left = ${left}; $shape.Top = ${top}
@{ success = $true; message = "Shape position set" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetShapeSize(slideNumber: number, shapeIndex: number, width: number, height: number,
    lockAspectRatio: boolean = false): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$shape = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex})
$shape.LockAspectRatio = ${lockAspectRatio ? '-1' : '0'}
$shape.Width = ${width}; $shape.Height = ${height}
@{ success = $true; message = "Shape size set" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetShapeStyle(slideNumber: number, shapeIndex: number, options: {
    fillColor?: string; fillTransparency?: number; lineColor?: string; lineWeight?: number;
    lineStyle?: 'solid' | 'dash' | 'dot' | 'dashDot'; noFill?: boolean; noLine?: boolean;
  }): Promise<OfficeResponse> {
    const cmds: string[] = [];
    if (options.noFill) cmds.push('$shape.Fill.Visible = 0');
    else if (options.fillColor) {
      cmds.push('$shape.Fill.Visible = -1', '$shape.Fill.Solid()', `$shape.Fill.ForeColor.RGB = ${this.hexToBgr(options.fillColor)}`);
    }
    if (options.fillTransparency !== undefined) cmds.push(`$shape.Fill.Transparency = ${options.fillTransparency / 100}`);
    if (options.noLine) cmds.push('$shape.Line.Visible = 0');
    else {
      if (options.lineColor) cmds.push('$shape.Line.Visible = -1', `$shape.Line.ForeColor.RGB = ${this.hexToBgr(options.lineColor)}`);
      if (options.lineWeight !== undefined) cmds.push(`$shape.Line.Weight = ${options.lineWeight}`);
      if (options.lineStyle) {
        const styleMap: Record<string, number> = { solid: 1, dash: 4, dot: 2, dashDot: 5 };
        cmds.push(`$shape.Line.DashStyle = ${styleMap[options.lineStyle]}`);
      }
    }

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$shape = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex})
${cmds.join('\n')}
@{ success = $true; message = "Shape style updated" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetTextboxBorder(slideNumber: number, shapeIndex: number, options: {
    color?: string; weight?: number; style?: 'solid' | 'dash' | 'dot'; visible?: boolean;
  }): Promise<OfficeResponse> {
    const cmds: string[] = [];
    if (options.visible === false) cmds.push('$shape.Line.Visible = 0');
    else {
      cmds.push('$shape.Line.Visible = -1');
      if (options.color) cmds.push(`$shape.Line.ForeColor.RGB = ${this.hexToBgr(options.color)}`);
      if (options.weight !== undefined) cmds.push(`$shape.Line.Weight = ${options.weight}`);
      if (options.style) {
        const styleMap: Record<string, number> = { solid: 1, dash: 4, dot: 2 };
        cmds.push(`$shape.Line.DashStyle = ${styleMap[options.style]}`);
      }
    }

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$shape = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex})
${cmds.join('\n')}
@{ success = $true; message = "Textbox border updated" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetTextboxFill(slideNumber: number, shapeIndex: number, options: {
    color?: string; transparency?: number; visible?: boolean;
  }): Promise<OfficeResponse> {
    const cmds: string[] = [];
    if (options.visible === false) cmds.push('$shape.Fill.Visible = 0');
    else {
      cmds.push('$shape.Fill.Visible = -1', '$shape.Fill.Solid()');
      if (options.color) cmds.push(`$shape.Fill.ForeColor.RGB = ${this.hexToBgr(options.color)}`);
      if (options.transparency !== undefined) cmds.push(`$shape.Fill.Transparency = ${options.transparency / 100}`);
    }

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$shape = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex})
${cmds.join('\n')}
@{ success = $true; message = "Textbox fill updated" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Z-Order & Alignment
  // ===========================================================================

  async powerpointBringToFront(slideNumber: number, shapeIndex: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex}).ZOrder(0)
@{ success = $true; message = "Shape brought to front" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSendToBack(slideNumber: number, shapeIndex: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex}).ZOrder(1)
@{ success = $true; message = "Shape sent to back" } | ConvertTo-Json -Compress
`);
  }

  async powerpointBringForward(slideNumber: number, shapeIndex: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex}).ZOrder(2)
@{ success = $true; message = "Shape brought forward" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSendBackward(slideNumber: number, shapeIndex: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex}).ZOrder(3)
@{ success = $true; message = "Shape sent backward" } | ConvertTo-Json -Compress
`);
  }

  async powerpointAlignShapes(slideNumber: number, shapeIndices: number[],
    alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): Promise<OfficeResponse> {
    const alignMap: Record<string, number> = { left: 0, center: 1, right: 2, top: 3, middle: 4, bottom: 5 };
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$slide = $ppt.ActivePresentation.Slides(${slideNumber})
$shapeRange = $slide.Shapes.Range(@(${shapeIndices.join(', ')}))
$shapeRange.Align(${alignMap[alignment]}, 0)
@{ success = $true; message = "Shapes aligned to ${alignment}" } | ConvertTo-Json -Compress
`);
  }

  async powerpointDistributeShapes(slideNumber: number, shapeIndices: number[],
    direction: 'horizontal' | 'vertical'): Promise<OfficeResponse> {
    const distributeType = direction === 'horizontal' ? 0 : 1;
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$slide = $ppt.ActivePresentation.Slides(${slideNumber})
$shapeRange = $slide.Shapes.Range(@(${shapeIndices.join(', ')}))
$shapeRange.Distribute(${distributeType}, 0)
@{ success = $true; message = "Shapes distributed ${direction}ly" } | ConvertTo-Json -Compress
`);
  }

  async powerpointGroupShapes(slideNumber: number, shapeIndices: number[]): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$slide = $ppt.ActivePresentation.Slides(${slideNumber})
$group = $slide.Shapes.Range(@(${shapeIndices.join(', ')})).Group()
@{ success = $true; message = "Shapes grouped"; group_index = $group.Index } | ConvertTo-Json -Compress
`);
  }

  async powerpointUngroupShapes(slideNumber: number, groupIndex: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$slide = $ppt.ActivePresentation.Slides(${slideNumber})
$shapeRange = $slide.Shapes(${groupIndex}).Ungroup()
@{ success = $true; message = "Group ungrouped"; shape_count = $shapeRange.Count } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Tables
  // ===========================================================================

  async powerpointAddTable(slideNumber: number, rows: number, cols: number,
    left: number = 100, top: number = 100, width: number = 400, height: number = 200,
    data?: string[][]): Promise<OfficeResponse> {
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
          lines.push(`$table.Cell(${i + 1}, ${j + 1}).Shape.TextFrame.TextRange.Text = '${this.escapePsString(val)}'`);
        }
      }
      dataScript = lines.join('\n');
    }

    const fontScript = hasKorean ? `
for ($r = 1; $r -le ${rows}; $r++) {
  for ($c = 1; $c -le ${cols}; $c++) {
    $table.Cell($r, $c).Shape.TextFrame.TextRange.Font.Name = 'Malgun Gothic'
  }
}` : '';

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$slide = $ppt.ActivePresentation.Slides(${slideNumber})
$table = $slide.Shapes.AddTable(${rows}, ${cols}, ${left}, ${top}, ${width}, ${height}).Table
${fontScript}
${dataScript}
@{ success = $true; message = "Table added"; shape_index = $slide.Shapes.Count } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetTableCell(slideNumber: number, shapeIndex: number, row: number, col: number, text: string,
    options?: { fontName?: string; fontSize?: number; bold?: boolean; fillColor?: string }): Promise<OfficeResponse> {
    const escaped = this.escapePsString(text);
    const hasKorean = this.hasKorean(text);
    const fontName = options?.fontName || (hasKorean ? 'Malgun Gothic' : '');

    const cmds: string[] = [];
    if (fontName) cmds.push(`$cell.Shape.TextFrame.TextRange.Font.Name = '${this.escapePsString(fontName)}'`);
    if (options?.fontSize) cmds.push(`$cell.Shape.TextFrame.TextRange.Font.Size = ${options.fontSize}`);
    if (options?.bold !== undefined) cmds.push(`$cell.Shape.TextFrame.TextRange.Font.Bold = ${options.bold ? '-1' : '0'}`);
    if (options?.fillColor) cmds.push(`$cell.Shape.Fill.ForeColor.RGB = ${this.hexToBgr(options.fillColor)}`);

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$table = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex}).Table
$cell = $table.Cell(${row}, ${col})
${cmds.filter(c => c.includes('Font.')).join('\n')}
$cell.Shape.TextFrame.TextRange.Text = '${escaped}'
${cmds.filter(c => !c.includes('Font.')).join('\n')}
@{ success = $true; message = "Table cell updated" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetTableStyle(slideNumber: number, shapeIndex: number, options: {
    borderColor?: string; borderWidth?: number; headerRowFill?: string; alternateRowFill?: string;
  }): Promise<OfficeResponse> {
    const cmds: string[] = [];
    if (options.borderColor) {
      const color = this.hexToBgr(options.borderColor);
      cmds.push(`
for ($r = 1; $r -le $table.Rows.Count; $r++) {
  for ($c = 1; $c -le $table.Columns.Count; $c++) {
    $cell = $table.Cell($r, $c)
    @(1,2,3,4) | ForEach-Object { $cell.Borders($_).ForeColor.RGB = ${color} }
  }
}`);
    }
    if (options.headerRowFill) {
      const color = this.hexToBgr(options.headerRowFill);
      cmds.push(`
for ($c = 1; $c -le $table.Columns.Count; $c++) {
  $table.Cell(1, $c).Shape.Fill.ForeColor.RGB = ${color}
}`);
    }
    if (options.alternateRowFill) {
      const color = this.hexToBgr(options.alternateRowFill);
      cmds.push(`
for ($r = 2; $r -le $table.Rows.Count; $r += 2) {
  for ($c = 1; $c -le $table.Columns.Count; $c++) {
    $table.Cell($r, $c).Shape.Fill.ForeColor.RGB = ${color}
  }
}`);
    }

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$table = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex}).Table
${cmds.join('\n')}
@{ success = $true; message = "Table style updated" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Animation & Transition
  // ===========================================================================

  async powerpointAddAnimation(slideNumber: number, shapeIndex: number,
    effect: string = 'fade', trigger: string = 'on_click'): Promise<OfficeResponse> {
    const effectMap: Record<string, number> = { fade: 3844, appear: 1, fly_in: 3844, zoom: 3845, wipe: 22 };
    const triggerMap: Record<string, number> = { on_click: 1, with_previous: 2, after_previous: 3 };

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$slide = $ppt.ActivePresentation.Slides(${slideNumber})
$shape = $slide.Shapes(${shapeIndex})
$effect = $slide.TimeLine.MainSequence.AddEffect($shape, ${effectMap[effect] || 3844}, 0, ${triggerMap[trigger] || 1})
@{ success = $true; message = "Animation '${effect}' added" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetTransition(slideNumber: number,
    transitionType: 'fade' | 'push' | 'wipe' | 'split' | 'reveal' | 'random' = 'fade', duration: number = 1): Promise<OfficeResponse> {
    const transitionMap: Record<string, number> = { fade: 3849, push: 3846, wipe: 3851, split: 3848, reveal: 3850, random: 0 };

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$slide = $ppt.ActivePresentation.Slides(${slideNumber})
$slide.SlideShowTransition.EntryEffect = ${transitionMap[transitionType]}
$slide.SlideShowTransition.Duration = ${duration}
@{ success = $true; message = "Transition '${transitionType}' set" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Background & Theme
  // ===========================================================================

  async powerpointSetBackground(slideNumber: number, options: { color?: string; imagePath?: string }): Promise<OfficeResponse> {
    let bgScript = '';
    if (options.color) {
      bgScript = `
$slide.FollowMasterBackground = 0
$slide.Background.Fill.Solid()
$slide.Background.Fill.ForeColor.RGB = ${this.hexToBgr(options.color)}`;
    } else if (options.imagePath) {
      const winPath = this.escapePsString(this.toWindowsPath(options.imagePath));
      bgScript = `
$slide.FollowMasterBackground = 0
$slide.Background.Fill.UserPicture('${winPath}')`;
    }

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$slide = $ppt.ActivePresentation.Slides(${slideNumber})
${bgScript}
@{ success = $true; message = "Background set" } | ConvertTo-Json -Compress
`);
  }

  async powerpointApplyTheme(themePath: string): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(themePath));
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$ppt.ActivePresentation.ApplyTheme('${winPath}')
@{ success = $true; message = "Theme applied" } | ConvertTo-Json -Compress
`);
  }

  async powerpointGetThemes(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$themesPath = [Environment]::GetFolderPath('CommonDocuments') + '\\Microsoft\\Templates\\Document Themes'
$themes = @()
if (Test-Path $themesPath) {
  Get-ChildItem -Path $themesPath -Filter "*.thmx" | ForEach-Object { $themes += @{ name = $_.BaseName; path = $_.FullName } }
}
$userThemesPath = [Environment]::GetFolderPath('MyDocuments') + '\\Custom Office Templates'
if (Test-Path $userThemesPath) {
  Get-ChildItem -Path $userThemesPath -Filter "*.thmx" -ErrorAction SilentlyContinue | ForEach-Object { $themes += @{ name = $_.BaseName; path = $_.FullName } }
}
@{ success = $true; themes = $themes } | ConvertTo-Json -Compress -Depth 5
`);
  }

  // ===========================================================================
  // Effects
  // ===========================================================================

  async powerpointSetShadow(slideNumber: number, shapeIndex: number, options: {
    visible?: boolean; type?: 'outer' | 'inner'; color?: string;
    blur?: number; offsetX?: number; offsetY?: number; transparency?: number;
  }): Promise<OfficeResponse> {
    const cmds: string[] = [];
    if (options.visible === false) cmds.push('$shape.Shadow.Visible = 0');
    else {
      cmds.push('$shape.Shadow.Visible = -1');
      cmds.push(`$shape.Shadow.Type = ${options.type === 'inner' ? '21' : '1'}`);
      if (options.color) cmds.push(`$shape.Shadow.ForeColor.RGB = ${this.hexToBgr(options.color)}`);
      if (options.blur !== undefined) cmds.push(`$shape.Shadow.Blur = ${options.blur}`);
      if (options.offsetX !== undefined) cmds.push(`$shape.Shadow.OffsetX = ${options.offsetX}`);
      if (options.offsetY !== undefined) cmds.push(`$shape.Shadow.OffsetY = ${options.offsetY}`);
      if (options.transparency !== undefined) cmds.push(`$shape.Shadow.Transparency = ${options.transparency / 100}`);
    }

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$shape = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex})
${cmds.join('\n')}
@{ success = $true; message = "Shadow effect updated" } | ConvertTo-Json -Compress
`);
  }

  async powerpointSetReflection(slideNumber: number, shapeIndex: number, options: {
    visible?: boolean; type?: number; blur?: number; offset?: number; size?: number; transparency?: number;
  }): Promise<OfficeResponse> {
    const cmds: string[] = [];
    if (options.visible === false) cmds.push('$shape.Reflection.Type = 0');
    else {
      cmds.push(`$shape.Reflection.Type = ${options.type || 1}`);
      if (options.blur !== undefined) cmds.push(`$shape.Reflection.Blur = ${options.blur}`);
      if (options.offset !== undefined) cmds.push(`$shape.Reflection.Offset = ${options.offset}`);
      if (options.size !== undefined) cmds.push(`$shape.Reflection.Size = ${options.size}`);
      if (options.transparency !== undefined) cmds.push(`$shape.Reflection.Transparency = ${options.transparency / 100}`);
    }

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$shape = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex})
${cmds.join('\n')}
@{ success = $true; message = "Reflection effect updated" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Sections & Notes
  // ===========================================================================

  async powerpointAddSection(sectionName: string, beforeSlide: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$sectionIndex = $ppt.ActivePresentation.SectionProperties.AddBeforeSlide(${beforeSlide}, '${this.escapePsString(sectionName)}')
@{ success = $true; message = "Section added"; section_index = $sectionIndex } | ConvertTo-Json -Compress
`);
  }

  async powerpointDeleteSection(sectionIndex: number, deleteSlides: boolean = false): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$ppt.ActivePresentation.SectionProperties.Delete(${sectionIndex}, ${deleteSlides ? '-1' : '0'})
@{ success = $true; message = "Section deleted" } | ConvertTo-Json -Compress
`);
  }

  async powerpointGetSections(): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$presentation = $ppt.ActivePresentation
$sections = @()
for ($i = 1; $i -le $presentation.SectionProperties.Count; $i++) {
  $sections += @{
    index = $i; name = $presentation.SectionProperties.Name($i)
    firstSlide = $presentation.SectionProperties.FirstSlide($i)
    slideCount = $presentation.SectionProperties.SlidesCount($i)
  }
}
@{ success = $true; count = $presentation.SectionProperties.Count; sections = $sections } | ConvertTo-Json -Compress -Depth 5
`);
  }

  async powerpointAddNote(slideNumber: number, noteText: string): Promise<OfficeResponse> {
    const escaped = this.escapePsString(noteText);
    const hasKorean = this.hasKorean(noteText);

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$slide = $ppt.ActivePresentation.Slides(${slideNumber})
$noteRange = $slide.NotesPage.Shapes.Placeholders(2).TextFrame.TextRange
${hasKorean ? "$noteRange.Font.Name = 'Malgun Gothic'" : ''}
$noteRange.Text = '${escaped}'
@{ success = $true; message = "Note added" } | ConvertTo-Json -Compress
`);
  }

  async powerpointGetNote(slideNumber: number): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$noteText = $ppt.ActivePresentation.Slides(${slideNumber}).NotesPage.Shapes.Placeholders(2).TextFrame.TextRange.Text
@{ success = $true; slide = ${slideNumber}; note = $noteText } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Media & Hyperlinks
  // ===========================================================================

  async powerpointAddHyperlink(slideNumber: number, shapeIndex: number, url: string, screenTip?: string): Promise<OfficeResponse> {
    const tipScript = screenTip ? `$link.ScreenTip = '${this.escapePsString(screenTip)}'` : '';
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$shape = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes(${shapeIndex})
$link = $shape.ActionSettings(1).Hyperlink
$link.Address = '${this.escapePsString(url)}'
${tipScript}
@{ success = $true; message = "Hyperlink added" } | ConvertTo-Json -Compress
`);
  }

  async powerpointAddVideo(slideNumber: number, videoPath: string, left: number = 100, top: number = 100,
    width: number = 400, height: number = 300): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(videoPath));
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$video = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes.AddMediaObject2('${winPath}', 0, -1, ${left}, ${top}, ${width}, ${height})
@{ success = $true; message = "Video added"; shape_index = $video.Index } | ConvertTo-Json -Compress
`);
  }

  async powerpointAddAudio(slideNumber: number, audioPath: string, left: number = 100, top: number = 100,
    playInBackground: boolean = false): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(audioPath));
    const bgScript = playInBackground ? `
$audio.AnimationSettings.PlaySettings.PlayOnEntry = -1
$audio.AnimationSettings.PlaySettings.HideWhileNotPlaying = -1
$audio.AnimationSettings.PlaySettings.LoopUntilStopped = 0` : '';

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$audio = $ppt.ActivePresentation.Slides(${slideNumber}).Shapes.AddMediaObject2('${winPath}', 0, -1, ${left}, ${top})
${bgScript}
@{ success = $true; message = "Audio added"; shape_index = $audio.Index } | ConvertTo-Json -Compress
`);
  }

  async powerpointAddChart(slideNumber: number, chartType: 'column' | 'bar' | 'line' | 'pie' | 'area' | 'scatter',
    left: number = 100, top: number = 100, width: number = 400, height: number = 300,
    data?: { categories: string[]; series: { name: string; values: number[] }[] }): Promise<OfficeResponse> {
    const chartTypeMap: Record<string, number> = { column: 51, bar: 57, line: 4, pie: 5, area: 1, scatter: -4169 };

    let dataScript = '';
    if (data) {
      const rows = data.series.length + 1;
      const cols = data.categories.length + 1;
      dataScript = `
$chart.ChartData.Activate()
$workbook = $chart.ChartData.Workbook
$sheet = $workbook.Worksheets(1)
$sheet.Cells.Clear()
`;
      for (let i = 0; i < data.categories.length; i++) {
        dataScript += `$sheet.Cells(1, ${i + 2}).Value = '${this.escapePsString(data.categories[i] || '')}'\n`;
      }
      for (let s = 0; s < data.series.length; s++) {
        const series = data.series[s];
        if (!series) continue;
        dataScript += `$sheet.Cells(${s + 2}, 1).Value = '${this.escapePsString(series.name)}'\n`;
        for (let v = 0; v < series.values.length; v++) {
          dataScript += `$sheet.Cells(${s + 2}, ${v + 2}).Value = ${series.values[v]}\n`;
        }
      }
      dataScript += `
$chart.SetSourceData($sheet.Range($sheet.Cells(1,1), $sheet.Cells(${rows}, ${cols})))
$workbook.Close()
`;
    }

    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$slide = $ppt.ActivePresentation.Slides(${slideNumber})
$chart = $slide.Shapes.AddChart2(-1, ${chartTypeMap[chartType]}, ${left}, ${top}, ${width}, ${height}).Chart
${dataScript}
@{ success = $true; message = "Chart added"; shape_index = $slide.Shapes.Count } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Export & Print & Slideshow
  // ===========================================================================

  async powerpointExportToPDF(outputPath: string): Promise<OfficeResponse> {
    const winPath = this.escapePsString(this.toWindowsPath(outputPath));
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$ppt.ActivePresentation.SaveAs('${winPath}', 32)
@{ success = $true; message = "Exported to PDF"; path = '${winPath}' } | ConvertTo-Json -Compress
`);
  }

  async powerpointStartSlideshow(fromSlide: number = 1): Promise<OfficeResponse> {
    return this.executePowerShell(`
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$settings = $ppt.ActivePresentation.SlideShowSettings
$settings.StartingSlide = ${fromSlide}
$settings.Run()
@{ success = $true; message = "Slideshow started from slide ${fromSlide}" } | ConvertTo-Json -Compress
`);
  }

  // ===========================================================================
  // Screenshot
  // ===========================================================================

  async powerpointScreenshot(): Promise<ScreenshotResponse> {
    const result = await this.executePowerShell(`
Add-Type -AssemblyName System.Windows.Forms
$ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$slide = $ppt.ActivePresentation.Slides($ppt.ActiveWindow.View.Slide.SlideIndex)
$tempPath = [System.IO.Path]::GetTempFileName() + ".png"
$slide.Export($tempPath, "PNG")
$bytes = [System.IO.File]::ReadAllBytes($tempPath)
$base64 = [Convert]::ToBase64String($bytes)
Remove-Item $tempPath -Force
@{ success = $true; image = $base64; format = "png"; encoding = "base64" } | ConvertTo-Json -Compress
`, 60000);
    return result as ScreenshotResponse;
  }
}

// Export singleton instance
export const powerpointClient = new PowerPointClient();
