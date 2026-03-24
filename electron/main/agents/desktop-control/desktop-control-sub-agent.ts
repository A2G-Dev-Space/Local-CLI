/**
 * Desktop Control Sub-Agent
 *
 * Vision-based autonomous desktop control agent.
 * Custom loop (NOT extending SubAgent) because the core loop is:
 *   screenshot → VLM analysis → action execution → repeat
 * instead of SubAgent's LLM → tool_call → execute pattern.
 *
 * Architecture inspired by Anthropic Computer Use, GPT-5.4 CUA, Microsoft UFO.
 *
 * CLI parity: src/agents/desktop-control/desktop-control-sub-agent.ts (stub only — Electron exclusive)
 */

import type { ModelInfo, EndpointConfig } from '../../core/config/config-manager';
import type { ToolResult } from '../../tools/types';
import { findVisionModel } from '../../tools/llm/simple/read-image-tool';
import {
  captureScreen,
  mouseClick,
  mouseDoubleClick,
  mouseScroll,
  mouseDrag,
  typeText,
  pressKey,
  pressHotkey,
  bringWindowToPrimary,
  listWindows,
  cleanupScreenshots,
} from './desktop-automation';
import { DESKTOP_CONTROL_VLM_PROMPT, DESKTOP_CONTROL_TURN_PROMPT } from './prompts';
import { logger } from '../../utils/logger';

// =============================================================================
// Types
// =============================================================================

interface DesktopAction {
  action: 'click' | 'double_click' | 'right_click' | 'type' | 'press' | 'hotkey' | 'scroll' | 'drag' | 'wait' | 'bring_window' | 'list_windows' | 'done';
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  text?: string;
  key?: string;
  keys?: string[];
  title?: string;
  direction?: 'up' | 'down';
  clicks?: number;
  ms?: number;
  summary?: string;
}

interface ActionHistoryEntry {
  step: number;
  action: DesktopAction;
  success: boolean;
  error?: string;
}

export interface DesktopControlConfig {
  maxSteps?: number;
  actionDelayMs?: number;
  abortSignal?: AbortSignal;
}

// =============================================================================
// Desktop Control Sub-Agent
// =============================================================================

export class DesktopControlSubAgent {
  private task: string;
  private maxSteps: number;
  private actionDelayMs: number;
  private vlEndpoint: EndpointConfig;
  private vlModel: ModelInfo;
  private abortSignal?: AbortSignal;

  constructor(
    task: string,
    vlEndpoint: EndpointConfig,
    vlModel: ModelInfo,
    config?: DesktopControlConfig,
  ) {
    this.task = task;
    this.maxSteps = config?.maxSteps ?? 30;
    this.actionDelayMs = config?.actionDelayMs ?? 1000;
    this.abortSignal = config?.abortSignal;
    this.vlEndpoint = vlEndpoint;
    this.vlModel = vlModel;
  }

  /**
   * Main execution loop: screenshot → VLM → action → repeat
   */
  async run(): Promise<ToolResult> {
    const startTime = Date.now();
    const history: ActionHistoryEntry[] = [];

    logger.enter('DesktopControlSubAgent.run');
    logger.info('Desktop control agent starting', { task: this.task.slice(0, 100), maxSteps: this.maxSteps });

    try {

      for (let step = 1; step <= this.maxSteps; step++) {
        // Check abort signal at the top of each step
        if (this.abortSignal?.aborted) {
          cleanupScreenshots();
          const duration = Date.now() - startTime;
          logger.info('Desktop control aborted by user', { step, duration });
          logger.exit('DesktopControlSubAgent.run', { success: false, aborted: true });
          return {
            success: false,
            error: 'Desktop control aborted by user.',
            metadata: { steps: step - 1, duration, aborted: true },
          };
        }

        logger.flow(`Desktop control step ${step}/${this.maxSteps}`);

        // 1. Capture screenshot
        const screenshot = await captureScreen();
        logger.info('Screenshot captured', { width: screenshot.width, height: screenshot.height, size: screenshot.base64.length });

        // 2. Build history text for context
        const historyText = this.buildHistoryText(history);

        // 3. Call VLM with screenshot + task + history
        const action = await this.callVLM(screenshot.base64, step, historyText);
        if (!action) {
          logger.warn('VLM returned no valid action, retrying');
          history.push({ step, action: { action: 'wait', ms: 500 }, success: false, error: 'VLM returned invalid response' });
          await this.delay(500);
          continue;
        }

        logger.info('VLM action', { step, action: action.action, x: action.x, y: action.y });

        // 4. Check if done
        if (action.action === 'done') {
          const summary = action.summary || 'Task completed.';
          cleanupScreenshots();
          const duration = Date.now() - startTime;
          logger.info('Desktop control completed', { steps: step, duration });
          logger.exit('DesktopControlSubAgent.run', { success: true, steps: step });
          return {
            success: true,
            result: summary,
            metadata: { steps: step, duration, history: history.map(h => `[${h.step}] ${h.action.action}${h.success ? '' : ' FAILED'}`) },
          };
        }

        // 5. Execute action (with DPI-corrected coordinates)
        try {
          await this.executeAction(action, screenshot.width, screenshot.height);
          history.push({ step, action, success: true });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.warn('Action execution failed', { step, action: action.action, error: errorMsg });
          history.push({ step, action, success: false, error: errorMsg });
        }

        // 6. Wait for UI to settle
        const waitMs = action.action === 'click' || action.action === 'double_click'
          ? this.actionDelayMs
          : action.action === 'type' || action.action === 'press' || action.action === 'hotkey'
            ? Math.max(300, this.actionDelayMs / 2)
            : this.actionDelayMs;
        await this.delay(waitMs);
      }

      // Max steps reached
      cleanupScreenshots();
      const duration = Date.now() - startTime;
      logger.exit('DesktopControlSubAgent.run', { success: true, steps: this.maxSteps, maxStepsReached: true });
      return {
        success: true,
        result: `Desktop control agent completed after ${this.maxSteps} steps. Task may not be fully finished.`,
        metadata: { steps: this.maxSteps, duration },
      };
    } catch (error) {
      cleanupScreenshots();
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.errorSilent('Desktop control agent failed', error);
      logger.exit('DesktopControlSubAgent.run', { success: false, error: errorMsg });
      return {
        success: false,
        error: `Desktop control failed: ${errorMsg}`,
        metadata: { steps: history.length, duration: Date.now() - startTime },
      };
    }
  }

  /**
   * Call VLM with screenshot and get next action
   */
  private async callVLM(screenshotBase64: string, step: number, historyText: string): Promise<DesktopAction | null> {
    let baseUrl = this.vlEndpoint.baseUrl.trim();
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const chatUrl = baseUrl.endsWith('/chat/completions')
      ? baseUrl
      : `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.vlEndpoint.apiKey) {
      headers['Authorization'] = `Bearer ${this.vlEndpoint.apiKey}`;
    }

    // Use function replacements to avoid $& / $' / $` special patterns in user task text
    const userPrompt = DESKTOP_CONTROL_TURN_PROMPT
      .replace('{task}', () => this.task)
      .replace('{step}', () => String(step))
      .replace('{maxSteps}', () => String(this.maxSteps))
      .replace('{history}', () => historyText ? `PREVIOUS ACTIONS:\n${historyText}` : '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.vlModel.apiModelId || this.vlModel.name || this.vlModel.id,
          messages: [
            { role: 'system', content: DESKTOP_CONTROL_VLM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 800, // Enough for <think> block + action JSON in thinking-mode VLMs
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('VLM request failed', { status: response.status, error: errorText.slice(0, 300) });
        return null;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        logger.warn('VLM returned empty content');
        return null;
      }

      return this.parseAction(content);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('VLM request timed out');
      } else {
        logger.warn('VLM request error', { error: error instanceof Error ? error.message : String(error) });
      }
      return null;
    }
  }

  private static readonly VALID_ACTIONS = ['click', 'double_click', 'right_click', 'type', 'press', 'hotkey', 'scroll', 'drag', 'wait', 'bring_window', 'list_windows', 'done'];

  /**
   * Parse action JSON from VLM response.
   * Handles markdown code blocks, extra text around JSON, <think> tags, etc.
   */
  private parseAction(content: string): DesktopAction | null {
    // Strip <think>...</think> tags (Qwen3-VL thinking mode)
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // Try to extract JSON from markdown code block
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1]!;
    }

    // Strategy 1: Try direct JSON.parse (most common — VLM returns clean JSON)
    const directResult = this.tryParseAction(cleaned);
    if (directResult) return directResult;

    // Strategy 2: Find JSON by locating first { and last } (handles text around JSON, braces in strings)
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.slice(firstBrace, lastBrace + 1);
      const extractedResult = this.tryParseAction(extracted);
      if (extractedResult) return extractedResult;
    }

    logger.warn('Failed to parse VLM action JSON', { content: cleaned.slice(0, 200) });
    return null;
  }

  /**
   * Try to parse a string as a DesktopAction. Coerces coordinate fields to numbers.
   */
  private tryParseAction(text: string): DesktopAction | null {
    try {
      const parsed = JSON.parse(text) as DesktopAction;
      if (!parsed.action || !DesktopControlSubAgent.VALID_ACTIONS.includes(parsed.action)) return null;

      // Coerce coordinate fields to numbers (VLM may return "450" instead of 450)
      if (parsed.x != null) parsed.x = Number(parsed.x);
      if (parsed.y != null) parsed.y = Number(parsed.y);
      if (parsed.x1 != null) parsed.x1 = Number(parsed.x1);
      if (parsed.y1 != null) parsed.y1 = Number(parsed.y1);
      if (parsed.x2 != null) parsed.x2 = Number(parsed.x2);
      if (parsed.y2 != null) parsed.y2 = Number(parsed.y2);
      if (parsed.ms != null) parsed.ms = Number(parsed.ms);
      if (parsed.clicks != null) parsed.clicks = Number(parsed.clicks);

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Execute a desktop action with coordinate transformation.
   *
   * The VLM sees the screenshot at its native resolution (e.g., 1920x1080).
   * DPI scaling: if Windows is at 150% scaling, the screenshot captures at logical resolution
   * but mouse APIs work at physical resolution. We may need to adjust.
   *
   * Note: System.Drawing.CopyFromScreen captures at physical pixels, so screenshot coords
   * and mouse coords should be in the same space. DPI correction may only be needed
   * if the VLM uses normalized coordinates (0-1000).
   */
  private async executeAction(
    action: DesktopAction,
    screenshotWidth: number,
    screenshotHeight: number,
  ): Promise<void> {
    switch (action.action) {
      case 'click':
        if (action.x != null && action.y != null) {
          const { x, y } = this.transformCoords(action.x, action.y, screenshotWidth, screenshotHeight);
          await mouseClick(x, y, 'left');
        } else {
          throw new Error('click action requires x and y coordinates');
        }
        break;

      case 'double_click':
        if (action.x != null && action.y != null) {
          const { x, y } = this.transformCoords(action.x, action.y, screenshotWidth, screenshotHeight);
          await mouseDoubleClick(x, y);
        } else {
          throw new Error('double_click action requires x and y coordinates');
        }
        break;

      case 'right_click':
        if (action.x != null && action.y != null) {
          const { x, y } = this.transformCoords(action.x, action.y, screenshotWidth, screenshotHeight);
          await mouseClick(x, y, 'right');
        } else {
          throw new Error('right_click action requires x and y coordinates');
        }
        break;

      case 'type':
        if (action.text) {
          await typeText(action.text);
        } else {
          throw new Error('type action requires text');
        }
        break;

      case 'press':
        if (action.key) {
          await pressKey(action.key);
        } else {
          throw new Error('press action requires key');
        }
        break;

      case 'hotkey':
        if (action.keys && action.keys.length > 0) {
          await pressHotkey(action.keys);
        } else {
          throw new Error('hotkey action requires keys array');
        }
        break;

      case 'scroll':
        if (action.x != null && action.y != null && action.direction) {
          const { x, y } = this.transformCoords(action.x, action.y, screenshotWidth, screenshotHeight);
          await mouseScroll(x, y, action.direction, action.clicks ?? 3);
        } else {
          throw new Error('scroll action requires x, y, and direction');
        }
        break;

      case 'drag':
        if (action.x1 != null && action.y1 != null && action.x2 != null && action.y2 != null) {
          const from = this.transformCoords(action.x1, action.y1, screenshotWidth, screenshotHeight);
          const to = this.transformCoords(action.x2, action.y2, screenshotWidth, screenshotHeight);
          await mouseDrag(from.x, from.y, to.x, to.y);
        } else {
          throw new Error('drag action requires x1, y1, x2, y2 coordinates');
        }
        break;

      case 'wait':
        await this.delay(action.ms ?? 1000);
        break;

      case 'bring_window':
        if (action.title) {
          const matched = await bringWindowToPrimary(action.title);
          if (!matched) {
            throw new Error(`Window not found: "${action.title}". Use list_windows to see available titles.`);
          }
        } else {
          throw new Error('bring_window action requires title');
        }
        break;

      case 'list_windows': {
        const windows = await listWindows();
        // Store window list in history so VLM can see it in the next turn
        logger.info('Listed windows', { count: windows.length, titles: windows.slice(0, 10) });
        // Override the action's summary-like field for history display
        action.text = windows.length > 0
          ? `Found ${windows.length} windows: ${windows.slice(0, 15).join(', ')}`
          : 'No visible windows found';
        break;
      }

      default:
        logger.warn('Unknown action type', { action: action.action });
    }
  }

  /**
   * Transform coordinates from VLM output to screen pixels.
   *
   * Handles two coordinate systems:
   * 1. Qwen3-VL: normalized 0-1000 range → multiply by screenWidth/1000
   * 2. Standard: pixel coordinates matching screenshot resolution → use as-is
   *
   * Detection: if BOTH coordinates are in 0-1000 range AND at least one screen
   * dimension exceeds 1000px, treat as normalized. This handles 1920x1080 (most common)
   * and other resolutions where the VLM uses 0-1000 range.
   * False positive risk on exactly 1024x768 is accepted — at worst, coords are off by ~2.4%.
   */
  private transformCoords(x: number, y: number, screenshotWidth: number, screenshotHeight: number): { x: number; y: number } {
    // Guard against NaN/Infinity
    if (!isFinite(x) || !isFinite(y)) {
      logger.warn('Invalid coordinates from VLM', { x, y });
      return { x: 0, y: 0 };
    }

    // Detect normalized coordinates (Qwen3-VL uses 0-1000 range)
    // If both coords fit in 0-1000 and screen is larger than 1000 in at least one dimension,
    // assume normalized. The key insight: if a VLM sends pixel coords on a 1920x1080 screen,
    // it would commonly send x > 1000 for elements on the right side, breaking this condition.
    const isNormalized = x >= 0 && x <= 1000 && y >= 0 && y <= 1000
      && (screenshotWidth > 1000 || screenshotHeight > 1000);

    let resultX: number;
    let resultY: number;

    if (isNormalized) {
      resultX = Math.round((x / 1000) * screenshotWidth);
      resultY = Math.round((y / 1000) * screenshotHeight);
    } else {
      resultX = Math.round(x);
      resultY = Math.round(y);
    }

    // Clamp to screen bounds
    resultX = Math.max(0, Math.min(resultX, screenshotWidth - 1));
    resultY = Math.max(0, Math.min(resultY, screenshotHeight - 1));

    return { x: resultX, y: resultY };
  }

  /**
   * Build history text from action history (last N entries)
   */
  private buildHistoryText(history: ActionHistoryEntry[]): string {
    if (history.length === 0) return '';

    // Keep last 10 entries to avoid context bloat
    const recent = history.slice(-10);
    return recent.map(h => {
      const parts = [`Step ${h.step}: ${h.action.action}`];
      if (h.action.x != null) parts.push(`at (${h.action.x},${h.action.y})`);
      if (h.action.text) parts.push(`"${h.action.text.slice(0, 80)}"`);
      if (h.action.key) parts.push(`key=${h.action.key}`);
      if (h.action.keys) parts.push(`keys=${h.action.keys.join('+')}`);
      if (h.action.title) parts.push(`title="${h.action.title}"`);
      if (!h.success) parts.push(`FAILED: ${h.error}`);
      return parts.join(' ');
    }).join('\n');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Singleton guard + module-level abort controller
// =============================================================================

let isDesktopControlRunning = false;
let currentAbortController: AbortController | null = null;

/**
 * Abort the currently running desktop control agent (if any).
 * Called from outside (e.g., IPC handler when user clicks Stop).
 */
export function abortDesktopControl(): boolean {
  if (currentAbortController && isDesktopControlRunning) {
    currentAbortController.abort();
    return true;
  }
  return false;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create and run a desktop control agent.
 * Validates VL model availability and prevents concurrent execution.
 */
export async function runDesktopControl(
  task: string,
  config?: DesktopControlConfig,
): Promise<ToolResult> {
  // Prevent concurrent execution — two agents fighting over mouse/keyboard is catastrophic
  if (isDesktopControlRunning) {
    return {
      success: false,
      error: 'A desktop control agent is already running. Wait for it to complete before starting another.',
    };
  }

  // Validate VL model
  const vlModelInfo = findVisionModel();
  if (!vlModelInfo) {
    return {
      success: false,
      error: 'No Vision Language Model (VL) configured. Please select a VL model in Settings to use desktop control.',
    };
  }

  isDesktopControlRunning = true;
  currentAbortController = new AbortController();
  try {
    const agent = new DesktopControlSubAgent(
      task,
      vlModelInfo.endpoint,
      vlModelInfo.model,
      { ...config, abortSignal: currentAbortController.signal },
    );

    return await agent.run();
  } finally {
    isDesktopControlRunning = false;
    currentAbortController = null;
  }
}
