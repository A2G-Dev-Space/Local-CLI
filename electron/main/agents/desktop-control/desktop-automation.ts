/**
 * Desktop Automation via PowerShell
 *
 * Provides screenshot capture, mouse control, and keyboard control
 * using PowerShell + Windows native APIs (user32.dll, System.Drawing).
 *
 * Consistent with existing Office tools pattern (PowerShell COM automation).
 *
 * CLI parity: N/A — Electron exclusive feature
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../../utils/logger';

const execFileAsync = promisify(execFile);

/**
 * Temporary directory for screenshots
 */
const TEMP_DIR = path.join(os.tmpdir(), 'local-cli-desktop-control');

/**
 * Ensure temp directory exists
 */
function ensureTempDir(): void {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/**
 * Execute a PowerShell command and return stdout
 */
async function execPowerShell(script: string, timeoutMs: number = 10000): Promise<string> {
  const { stdout, stderr } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-Command', script,
  ], {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024, // 1MB — screenshot is file-based, stdout only has resolution string
    windowsHide: true,
  });

  if (stderr && stderr.trim()) {
    logger.warn('PowerShell stderr', { stderr: stderr.slice(0, 500) });
  }

  return stdout;
}

// =============================================================================
// Screen Capture
// =============================================================================

/**
 * Capture the entire screen as a JPEG file and return base64 data.
 * Uses low quality (40) to minimize token usage in VLM.
 */
export async function captureScreen(): Promise<{ base64: string; width: number; height: number }> {
  ensureTempDir();
  const filePath = path.join(TEMP_DIR, `screenshot_${Date.now()}.jpg`);

  // PowerShell: capture screen using System.Drawing, save as JPEG with quality control
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$graphics.Dispose()
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]40)
$bitmap.Save('${filePath.replace(/'/g, "''")}', $encoder, $encoderParams)
$bitmap.Dispose()
Write-Output "$($bounds.Width)x$($bounds.Height)"
`;

  const output = await execPowerShell(script, 15000);
  // Use non-anchored match — PowerShell may emit assembly warnings before our output
  const match = output.match(/(\d+)x(\d+)/);
  const width = match ? parseInt(match[1]!, 10) : 1920;
  const height = match ? parseInt(match[2]!, 10) : 1080;

  // Read file as base64, then delete temp file immediately
  let base64: string;
  try {
    const buffer = fs.readFileSync(filePath);
    base64 = buffer.toString('base64');
  } finally {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }

  return { base64, width, height };
}

/**
 * Get DPI scale factor for the primary screen.
 * Returns 1.0 for 100%, 1.25 for 125%, 1.5 for 150%, 2.0 for 200%, etc.
 */
export async function getDpiScaleFactor(): Promise<number> {
  try {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$graphics = [System.Drawing.Graphics]::FromHwnd([IntPtr]::Zero)
$dpiX = $graphics.DpiX
$graphics.Dispose()
Write-Output ($dpiX / 96)
`;
    const output = await execPowerShell(script, 5000);
    const factor = parseFloat(output.trim());
    return isNaN(factor) ? 1.0 : factor;
  } catch {
    return 1.0;
  }
}

/**
 * Get screen dimensions
 */
export async function getScreenDimensions(): Promise<{ width: number; height: number }> {
  try {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Output "$($bounds.Width)x$($bounds.Height)"
`;
    const output = await execPowerShell(script, 5000);
    const match = output.trim().match(/^(\d+)x(\d+)$/);
    return {
      width: match ? parseInt(match[1]!, 10) : 1920,
      height: match ? parseInt(match[2]!, 10) : 1080,
    };
  } catch {
    return { width: 1920, height: 1080 };
  }
}

// =============================================================================
// Mouse Control
// =============================================================================

/**
 * Move mouse to absolute screen coordinates and click
 */
export async function mouseClick(x: number, y: number, button: 'left' | 'right' = 'left'): Promise<void> {
  const downFlag = button === 'right' ? '0x0008' : '0x0002';
  const upFlag = button === 'right' ? '0x0010' : '0x0004';

  const script = `
Add-Type -MemberDefinition '
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
' -Name Win32 -Namespace User32
[User32.Win32]::SetCursorPos(${x}, ${y})
[User32.Win32]::mouse_event(${downFlag}, 0, 0, 0, 0)
Start-Sleep -Milliseconds 50
[User32.Win32]::mouse_event(${upFlag}, 0, 0, 0, 0)
`;
  await execPowerShell(script);
}

/**
 * Double-click at coordinates
 */
export async function mouseDoubleClick(x: number, y: number): Promise<void> {
  const script = `
Add-Type -MemberDefinition '
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
' -Name Win32 -Namespace User32
$LEFTDOWN = 0x0002; $LEFTUP = 0x0004
[User32.Win32]::SetCursorPos(${x}, ${y})
[User32.Win32]::mouse_event($LEFTDOWN, 0, 0, 0, 0); Start-Sleep -Milliseconds 30; [User32.Win32]::mouse_event($LEFTUP, 0, 0, 0, 0)
Start-Sleep -Milliseconds 80
[User32.Win32]::mouse_event($LEFTDOWN, 0, 0, 0, 0); Start-Sleep -Milliseconds 30; [User32.Win32]::mouse_event($LEFTUP, 0, 0, 0, 0)
`;
  await execPowerShell(script);
}

/**
 * Scroll at coordinates
 */
export async function mouseScroll(x: number, y: number, direction: 'up' | 'down', clicks: number = 3): Promise<void> {
  const wheelDelta = direction === 'up' ? 120 * clicks : -120 * clicks;
  const script = `
Add-Type -MemberDefinition '
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
' -Name Win32 -Namespace User32
$WHEEL = 0x0800
[User32.Win32]::SetCursorPos(${x}, ${y})
[User32.Win32]::mouse_event($WHEEL, 0, 0, ${wheelDelta}, 0)
`;
  await execPowerShell(script);
}

/**
 * Drag from (x1,y1) to (x2,y2)
 */
export async function mouseDrag(x1: number, y1: number, x2: number, y2: number): Promise<void> {
  const script = `
Add-Type -MemberDefinition '
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
' -Name Win32 -Namespace User32
$LEFTDOWN = 0x0002; $LEFTUP = 0x0004
[User32.Win32]::SetCursorPos(${x1}, ${y1})
Start-Sleep -Milliseconds 50
[User32.Win32]::mouse_event($LEFTDOWN, 0, 0, 0, 0)
Start-Sleep -Milliseconds 100
[User32.Win32]::SetCursorPos(${x2}, ${y2})
Start-Sleep -Milliseconds 100
[User32.Win32]::mouse_event($LEFTUP, 0, 0, 0, 0)
`;
  await execPowerShell(script);
}

// =============================================================================
// Keyboard Control
// =============================================================================

/**
 * Type text using SendKeys (supports Unicode)
 */
export async function typeText(text: string): Promise<void> {
  // Escape special SendKeys characters
  // CRITICAL: braces must be escaped FIRST in a single pass to avoid corruption
  // Newlines/tabs must be converted to SendKeys equivalents to avoid breaking PS script
  const escaped = text
    .replace(/[{}]/g, match => match === '{' ? '{{}' : '{}}')
    .replace(/\r?\n/g, '{ENTER}')
    .replace(/\r/g, '{ENTER}')
    .replace(/\t/g, '{TAB}')
    .replace(/\+/g, '{+}')
    .replace(/%/g, '{%}')
    .replace(/\^/g, '{^}')
    .replace(/~/g, '{~}')
    .replace(/\(/g, '{(}')
    .replace(/\)/g, '{)}')
    .replace(/\[/g, '{[}')
    .replace(/\]/g, '{]}');

  const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${escaped.replace(/'/g, "''")}')
`;
  await execPowerShell(script);
}

/**
 * Press a single key
 */
export async function pressKey(key: string): Promise<void> {
  const keyMap: Record<string, string> = {
    'enter': '{ENTER}',
    'tab': '{TAB}',
    'escape': '{ESC}',
    'backspace': '{BACKSPACE}',
    'delete': '{DELETE}',
    'space': ' ',
    'up': '{UP}',
    'down': '{DOWN}',
    'left': '{LEFT}',
    'right': '{RIGHT}',
    'home': '{HOME}',
    'end': '{END}',
    'pageup': '{PGUP}',
    'pagedown': '{PGDN}',
    'f1': '{F1}', 'f2': '{F2}', 'f3': '{F3}', 'f4': '{F4}',
    'f5': '{F5}', 'f6': '{F6}', 'f7': '{F7}', 'f8': '{F8}',
    'f9': '{F9}', 'f10': '{F10}', 'f11': '{F11}', 'f12': '{F12}',
  };

  const sendKey = keyMap[key.toLowerCase()];
  if (!sendKey) {
    // Only allow single printable characters as unmapped keys — prevent injection
    if (key.length !== 1 || /[{}+%^~()\[\]'"\n\r]/.test(key)) {
      throw new Error(`Unsupported key: ${key}`);
    }
  }
  const finalKey = sendKey || key;
  const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${finalKey.replace(/'/g, "''")}')
`;
  await execPowerShell(script);
}

/**
 * Press a hotkey combination (e.g., Ctrl+C, Alt+F4)
 */
export async function pressHotkey(keys: string[]): Promise<void> {
  const modifiers: string[] = [];
  const regularKeys: string[] = [];
  let hasWin = false;

  for (const key of keys) {
    const lower = key.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') modifiers.push('^');
    else if (lower === 'alt') modifiers.push('%');
    else if (lower === 'shift') modifiers.push('+');
    else if (lower === 'win') hasWin = true;
    else regularKeys.push(key);
  }

  // Win key combinations require keybd_event (SendKeys doesn't support Win key)
  if (hasWin) {
    const vkCodes: string[] = ['$VK_LWIN = 0x5B'];
    const keydowns: string[] = ['[User32.Win32]::keybd_event($VK_LWIN, 0, 0, 0)'];
    const keyups: string[] = ['[User32.Win32]::keybd_event($VK_LWIN, 0, 2, 0)'];

    // Include Ctrl/Alt/Shift modifiers in keybd_event path (not just regular keys)
    for (const mod of modifiers) {
      if (mod === '^') {
        vkCodes.push('$VK_CTRL = 0xA2');
        keydowns.push('[User32.Win32]::keybd_event($VK_CTRL, 0, 0, 0)');
        keyups.unshift('[User32.Win32]::keybd_event($VK_CTRL, 0, 2, 0)');
      } else if (mod === '%') {
        vkCodes.push('$VK_ALT = 0xA4');
        keydowns.push('[User32.Win32]::keybd_event($VK_ALT, 0, 0, 0)');
        keyups.unshift('[User32.Win32]::keybd_event($VK_ALT, 0, 2, 0)');
      } else if (mod === '+') {
        vkCodes.push('$VK_SHIFT = 0xA0');
        keydowns.push('[User32.Win32]::keybd_event($VK_SHIFT, 0, 0, 0)');
        keyups.unshift('[User32.Win32]::keybd_event($VK_SHIFT, 0, 2, 0)');
      }
    }

    // Map regular keys to virtual key codes — validate to prevent injection
    for (const rk of regularKeys) {
      if (!/^[a-zA-Z0-9]$/.test(rk)) {
        throw new Error(`Invalid key for Win+hotkey: ${rk}. Only single alphanumeric characters allowed.`);
      }
      const vkName = `$VK_${rk.toUpperCase()}`;
      const charCode = `0x${rk.toUpperCase().charCodeAt(0).toString(16)}`;
      vkCodes.push(`${vkName} = ${charCode}`);
      keydowns.push(`[User32.Win32]::keybd_event(${vkName}, 0, 0, 0)`);
      keyups.unshift(`[User32.Win32]::keybd_event(${vkName}, 0, 2, 0)`);
    }

    const script = `
Add-Type -MemberDefinition '
[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
' -Name Win32 -Namespace User32
${vkCodes.join('; ')}
${keydowns.join('\nStart-Sleep -Milliseconds 30\n')}
Start-Sleep -Milliseconds 50
${keyups.join('\nStart-Sleep -Milliseconds 30\n')}
`;
    await execPowerShell(script);
    return;
  }

  // Non-Win hotkeys via SendKeys
  const specialKeyMap: Record<string, string> = {
    'enter': '{ENTER}', 'tab': '{TAB}', 'escape': '{ESC}',
    'delete': '{DELETE}', 'backspace': '{BACKSPACE}',
    'up': '{UP}', 'down': '{DOWN}', 'left': '{LEFT}', 'right': '{RIGHT}',
    'home': '{HOME}', 'end': '{END}',
    'f1': '{F1}', 'f2': '{F2}', 'f3': '{F3}', 'f4': '{F4}',
    'f5': '{F5}', 'f6': '{F6}', 'f7': '{F7}', 'f8': '{F8}',
    'f9': '{F9}', 'f10': '{F10}', 'f11': '{F11}', 'f12': '{F12}',
  };

  if (regularKeys.length === 0) {
    throw new Error('hotkey requires at least one non-modifier key');
  }

  let sendStr = modifiers.join('');
  if (regularKeys.length === 1) {
    const mapped = specialKeyMap[regularKeys[0]!.toLowerCase()];
    if (!mapped) {
      // Validate: single printable character only
      if (regularKeys[0]!.length !== 1 || /[{}+%^~()\[\]'"\n\r]/.test(regularKeys[0]!)) {
        throw new Error(`Unsupported hotkey target: ${regularKeys[0]}`);
      }
    }
    sendStr += mapped || regularKeys[0]!;
  } else if (regularKeys.length > 1) {
    // Validate each key in multi-key combination
    const mappedKeys = regularKeys.map(rk => {
      const mapped = specialKeyMap[rk.toLowerCase()];
      if (!mapped && (rk.length !== 1 || /[{}+%^~()\[\]'"\n\r]/.test(rk))) {
        throw new Error(`Unsupported hotkey target: ${rk}`);
      }
      return mapped || rk;
    });
    sendStr += `(${mappedKeys.join('')})`;
  }

  const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${sendStr.replace(/'/g, "''")}')
`;
  await execPowerShell(script);
}

// =============================================================================
// Window Management (Multi-Monitor Support)
// =============================================================================

/**
 * Bring a window to the primary monitor by title (partial match, case-insensitive).
 * Moves the window to the center of the primary screen and activates it.
 * Returns the matched window title, or null if not found.
 */
export async function bringWindowToPrimary(titleQuery: string): Promise<string | null> {
  // Sanitize input — only allow safe characters for PowerShell Where-Object filter
  const safeTitleQuery = titleQuery.replace(/'/g, "''").replace(/[`$]/g, '');

  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -MemberDefinition '
[DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
[DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hWnd);
' -Name Win32 -Namespace User32

$primary = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$procs = Get-Process | Where-Object { $_.MainWindowTitle -like '*${safeTitleQuery}*' -and $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1

if ($procs) {
    $hwnd = $procs.MainWindowHandle
    # Restore if minimized or maximized (maximized windows ignore SetWindowPos coordinates)
    if ([User32.Win32]::IsIconic($hwnd) -or [User32.Win32]::IsZoomed($hwnd)) {
        [User32.Win32]::ShowWindow($hwnd, 9)  # SW_RESTORE
    }
    # Calculate centered position on primary monitor
    $w = [Math]::Min(1200, $primary.Width - 100)
    $h = [Math]::Min(800, $primary.Height - 100)
    $x = $primary.X + [Math]::Floor(($primary.Width - $w) / 2)
    $y = $primary.Y + [Math]::Floor(($primary.Height - $h) / 2)
    # Move, resize, and bring to top (SWP_SHOWWINDOW = 0x0040)
    [User32.Win32]::SetWindowPos($hwnd, [IntPtr]::Zero, $x, $y, $w, $h, 0x0040)
    [User32.Win32]::SetForegroundWindow($hwnd)
    Write-Output $procs.MainWindowTitle
} else {
    Write-Output 'NOT_FOUND'
}
`;
  const output = (await execPowerShell(script, 10000)).trim();
  if (output === 'NOT_FOUND' || !output) {
    logger.warn('Window not found for bring_window', { titleQuery });
    return null;
  }
  logger.info('Window brought to primary monitor', { titleQuery, matchedTitle: output });
  return output;
}

/**
 * List all visible windows with their titles (for VLM context).
 * Returns a formatted string of window titles.
 */
export async function listWindows(): Promise<string[]> {
  const script = `
Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and $_.MainWindowHandle -ne [IntPtr]::Zero } | ForEach-Object { $_.MainWindowTitle }
`;
  const output = await execPowerShell(script, 5000);
  return output.trim().split('\n').map(t => t.trim()).filter(t => t.length > 0);
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Clean up temporary screenshot files
 */
export function cleanupScreenshots(): void {
  try {
    if (fs.existsSync(TEMP_DIR)) {
      const files = fs.readdirSync(TEMP_DIR);
      for (const file of files) {
        if (file.startsWith('screenshot_')) {
          fs.unlinkSync(path.join(TEMP_DIR, file));
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}
