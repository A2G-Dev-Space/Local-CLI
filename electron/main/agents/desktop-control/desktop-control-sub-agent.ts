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
import { getSubAgentPhaseLogger } from '../common/sub-agent';
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

/** Detailed log entry for each step — returned in result metadata */
interface StepLog {
  step: number;
  timestamp: string;
  screenshotSize?: number;
  screenshotDimensions?: string;
  vlmModel: string;
  vlmRawResponse?: string;
  vlmParsedAction?: string;
  vlmLatencyMs?: number;
  actionExecuted?: string;
  actionResult: 'success' | 'failed' | 'skipped' | 'done';
  actionError?: string;
  coordsRaw?: string;
  coordsTransformed?: string;
}

export interface DesktopControlConfig {
  maxSteps?: number;
  actionDelayMs?: number;
  abortSignal?: AbortSignal;
}

// =============================================================================
// Phase logger helper
// =============================================================================

function emitPhase(phase: string, detail: string): void {
  const phaseLogger = getSubAgentPhaseLogger();
  if (phaseLogger) phaseLogger('desktop-control', phase, detail);
  logger.info(`[desktop-control] ${phase}: ${detail}`);
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
  private vlModelName: string;

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
    this.vlModelName = vlModel.apiModelId || vlModel.name || vlModel.id;
  }

  /**
   * Main execution loop: screenshot → VLM → action → repeat
   */
  async run(): Promise<ToolResult> {
    const startTime = Date.now();
    const history: ActionHistoryEntry[] = [];
    const stepLogs: StepLog[] = [];

    logger.enter('DesktopControlSubAgent.run');
    emitPhase('start', `Task: "${this.task.slice(0, 80)}" | VLM: ${this.vlModelName} | Max steps: ${this.maxSteps}`);

    try {
      for (let step = 1; step <= this.maxSteps; step++) {
        const stepLog: StepLog = {
          step,
          timestamp: new Date().toISOString(),
          vlmModel: this.vlModelName,
          actionResult: 'skipped',
        };

        // Check abort signal
        if (this.abortSignal?.aborted) {
          cleanupScreenshots();
          emitPhase('abort', `Aborted at step ${step}`);
          logger.exit('DesktopControlSubAgent.run', { success: false, aborted: true });
          return this.buildFinalResult(false, 'Desktop control aborted by user.', undefined, step - 1, startTime, stepLogs, history);
        }

        emitPhase('step', `[${step}/${this.maxSteps}] Capturing screenshot...`);

        // 1. Capture screenshot
        let screenshot: { base64: string; width: number; height: number };
        try {
          screenshot = await captureScreen();
          stepLog.screenshotSize = screenshot.base64.length;
          stepLog.screenshotDimensions = `${screenshot.width}x${screenshot.height}`;
          emitPhase('screenshot', `[${step}/${this.maxSteps}] ${screenshot.width}x${screenshot.height} (${Math.round(screenshot.base64.length / 1024)}KB)`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          stepLog.actionResult = 'failed';
          stepLog.actionError = `Screenshot failed: ${errMsg}`;
          stepLogs.push(stepLog);
          emitPhase('error', `[${step}/${this.maxSteps}] Screenshot failed: ${errMsg}`);
          // Fatal — can't continue without screenshot
          throw err;
        }

        // 2. Build history text for context
        const historyText = this.buildHistoryText(history);

        // 3. Call VLM
        emitPhase('vlm', `[${step}/${this.maxSteps}] Calling ${this.vlModelName}...`);
        const vlmStart = Date.now();
        const { action, rawResponse } = await this.callVLM(screenshot.base64, step, historyText);
        const vlmLatency = Date.now() - vlmStart;
        stepLog.vlmLatencyMs = vlmLatency;
        stepLog.vlmRawResponse = rawResponse?.slice(0, 500);

        if (!action) {
          stepLog.actionResult = 'failed';
          stepLog.actionError = 'VLM returned no valid action';
          stepLogs.push(stepLog);
          emitPhase('vlm-fail', `[${step}/${this.maxSteps}] No valid action (${vlmLatency}ms). Raw: "${(rawResponse || 'empty').slice(0, 100)}"`);
          history.push({ step, action: { action: 'wait', ms: 500 }, success: false, error: 'VLM returned invalid response' });
          await this.delay(500);
          continue;
        }

        stepLog.vlmParsedAction = JSON.stringify(action);
        const actionDesc = this.describeAction(action);
        emitPhase('vlm-ok', `[${step}/${this.maxSteps}] → ${actionDesc} (${vlmLatency}ms)`);

        // 4. Check if done
        if (action.action === 'done') {
          const summary = action.summary || 'Task completed.';
          stepLog.actionResult = 'done';
          stepLogs.push(stepLog);
          cleanupScreenshots();
          emitPhase('done', `Completed at step ${step}: "${summary}"`);
          logger.exit('DesktopControlSubAgent.run', { success: true, steps: step });
          return this.buildFinalResult(true, undefined, summary, step, startTime, stepLogs, history);
        }

        // 5. Execute action
        emitPhase('exec', `[${step}/${this.maxSteps}] Executing ${actionDesc}...`);
        try {
          const coordInfo = this.executeActionWithLogging(action, screenshot.width, screenshot.height);
          stepLog.coordsRaw = coordInfo.raw;
          stepLog.coordsTransformed = coordInfo.transformed;
          await coordInfo.promise;
          stepLog.actionExecuted = actionDesc;
          stepLog.actionResult = 'success';
          history.push({ step, action, success: true });
          emitPhase('exec-ok', `[${step}/${this.maxSteps}] ✓ ${actionDesc}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          stepLog.actionResult = 'failed';
          stepLog.actionError = errorMsg;
          history.push({ step, action, success: false, error: errorMsg });
          emitPhase('exec-fail', `[${step}/${this.maxSteps}] ✗ ${actionDesc}: ${errorMsg}`);
        }

        stepLogs.push(stepLog);

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
      emitPhase('max-steps', `Reached ${this.maxSteps} steps limit`);
      logger.exit('DesktopControlSubAgent.run', { success: true, steps: this.maxSteps, maxStepsReached: true });
      return this.buildFinalResult(true, undefined, `Desktop control completed after ${this.maxSteps} steps. Task may not be fully finished.`, this.maxSteps, startTime, stepLogs, history);
    } catch (error) {
      cleanupScreenshots();
      const errorMsg = error instanceof Error ? error.message : String(error);
      emitPhase('error', `Fatal: ${errorMsg}`);
      logger.errorSilent('Desktop control agent failed', error);
      logger.exit('DesktopControlSubAgent.run', { success: false, error: errorMsg });
      return this.buildFinalResult(false, `Desktop control failed: ${errorMsg}`, undefined, stepLogs.length, startTime, stepLogs, history);
    }
  }

  /**
   * Build final result with detailed execution log
   */
  private buildFinalResult(
    success: boolean,
    error: string | undefined,
    result: string | undefined,
    steps: number,
    startTime: number,
    stepLogs: StepLog[],
    history: ActionHistoryEntry[],
  ): ToolResult {
    const duration = Date.now() - startTime;

    // Build human-readable execution log
    const executionLog = stepLogs.map(s => {
      const parts = [`[Step ${s.step}]`];
      if (s.screenshotDimensions) parts.push(`📸 ${s.screenshotDimensions} (${Math.round((s.screenshotSize || 0) / 1024)}KB)`);
      if (s.vlmLatencyMs != null) parts.push(`🤖 VLM ${s.vlmLatencyMs}ms`);
      if (s.vlmParsedAction) parts.push(`→ ${s.vlmParsedAction}`);
      if (s.coordsRaw && s.coordsTransformed && s.coordsRaw !== s.coordsTransformed) {
        parts.push(`📍 ${s.coordsRaw} → ${s.coordsTransformed}`);
      }
      if (s.actionResult === 'success') parts.push('✓');
      else if (s.actionResult === 'failed') parts.push(`✗ ${s.actionError}`);
      else if (s.actionResult === 'done') parts.push('🏁 DONE');
      if (s.vlmRawResponse && s.actionResult === 'failed') parts.push(`Raw VLM: "${s.vlmRawResponse.slice(0, 100)}"`);
      return parts.join(' ');
    }).join('\n');

    // Prepend execution log to result text so the main LLM sees it
    const fullResult = result
      ? `${result}\n\n--- Execution Log (${steps} steps, ${(duration / 1000).toFixed(1)}s) ---\n${executionLog}`
      : `--- Execution Log (${steps} steps, ${(duration / 1000).toFixed(1)}s) ---\n${executionLog}`;

    return {
      success,
      result: success ? fullResult : undefined,
      error: error ? `${error}\n\n--- Execution Log ---\n${executionLog}` : undefined,
      metadata: {
        steps,
        duration,
        vlmModel: this.vlModelName,
        stepLogs,
        history: history.map(h => `[${h.step}] ${h.action.action}${h.success ? '' : ' FAILED'}`),
      },
    };
  }

  /**
   * Describe an action in human-readable form
   */
  private describeAction(action: DesktopAction): string {
    switch (action.action) {
      case 'click': return `click(${action.x},${action.y})`;
      case 'double_click': return `double_click(${action.x},${action.y})`;
      case 'right_click': return `right_click(${action.x},${action.y})`;
      case 'type': return `type("${(action.text || '').slice(0, 30)}")`;
      case 'press': return `press(${action.key})`;
      case 'hotkey': return `hotkey(${(action.keys || []).join('+')})`;
      case 'scroll': return `scroll(${action.x},${action.y},${action.direction})`;
      case 'drag': return `drag(${action.x1},${action.y1}→${action.x2},${action.y2})`;
      case 'wait': return `wait(${action.ms}ms)`;
      case 'bring_window': return `bring_window("${action.title}")`;
      case 'list_windows': return 'list_windows()';
      case 'done': return `done("${(action.summary || '').slice(0, 40)}")`;
      default: return action.action;
    }
  }

  /**
   * Call VLM with screenshot and get next action.
   * Returns both parsed action and raw response for logging.
   */
  private async callVLM(screenshotBase64: string, step: number, historyText: string): Promise<{ action: DesktopAction | null; rawResponse: string | null }> {
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
          model: this.vlModelName,
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
          max_tokens: 800,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('VLM request failed', { status: response.status, error: errorText.slice(0, 300) });
        return { action: null, rawResponse: `HTTP ${response.status}: ${errorText.slice(0, 300)}` };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        logger.warn('VLM returned empty content');
        return { action: null, rawResponse: 'empty response (no content)' };
      }

      const parsed = this.parseAction(content);
      return { action: parsed, rawResponse: content };
    } catch (error) {
      clearTimeout(timeoutId);
      const errMsg = error instanceof Error
        ? (error.name === 'AbortError' ? 'VLM request timed out (60s)' : error.message)
        : String(error);
      logger.warn('VLM request error', { error: errMsg });
      return { action: null, rawResponse: `Error: ${errMsg}` };
    }
  }

  private static readonly VALID_ACTIONS = ['click', 'double_click', 'right_click', 'type', 'press', 'hotkey', 'scroll', 'drag', 'wait', 'bring_window', 'list_windows', 'done'];

  /**
   * Parse action JSON from VLM response.
   */
  private parseAction(content: string): DesktopAction | null {
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1]!;
    }

    const directResult = this.tryParseAction(cleaned);
    if (directResult) return directResult;

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

  private tryParseAction(text: string): DesktopAction | null {
    try {
      const parsed = JSON.parse(text) as DesktopAction;
      if (!parsed.action || !DesktopControlSubAgent.VALID_ACTIONS.includes(parsed.action)) return null;

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
   * Execute action with coordinate logging. Returns raw/transformed coords for the step log.
   */
  private executeActionWithLogging(
    action: DesktopAction,
    screenshotWidth: number,
    screenshotHeight: number,
  ): { promise: Promise<void>; raw: string; transformed: string } {
    const doTransform = (x: number, y: number) => {
      const result = this.transformCoords(x, y, screenshotWidth, screenshotHeight);
      return {
        result,
        raw: `(${x},${y})`,
        transformed: `(${result.x},${result.y})`,
      };
    };

    switch (action.action) {
      case 'click': {
        if (action.x == null || action.y == null) throw new Error('click action requires x and y coordinates');
        const c = doTransform(action.x, action.y);
        return { promise: mouseClick(c.result.x, c.result.y, 'left'), raw: c.raw, transformed: c.transformed };
      }
      case 'double_click': {
        if (action.x == null || action.y == null) throw new Error('double_click action requires x and y coordinates');
        const c = doTransform(action.x, action.y);
        return { promise: mouseDoubleClick(c.result.x, c.result.y), raw: c.raw, transformed: c.transformed };
      }
      case 'right_click': {
        if (action.x == null || action.y == null) throw new Error('right_click action requires x and y coordinates');
        const c = doTransform(action.x, action.y);
        return { promise: mouseClick(c.result.x, c.result.y, 'right'), raw: c.raw, transformed: c.transformed };
      }
      case 'type': {
        if (!action.text) throw new Error('type action requires text');
        return { promise: typeText(action.text), raw: '', transformed: '' };
      }
      case 'press': {
        if (!action.key) throw new Error('press action requires key');
        return { promise: pressKey(action.key), raw: '', transformed: '' };
      }
      case 'hotkey': {
        if (!action.keys || action.keys.length === 0) throw new Error('hotkey action requires keys array');
        return { promise: pressHotkey(action.keys), raw: '', transformed: '' };
      }
      case 'scroll': {
        if (action.x == null || action.y == null || !action.direction) throw new Error('scroll action requires x, y, and direction');
        const c = doTransform(action.x, action.y);
        return { promise: mouseScroll(c.result.x, c.result.y, action.direction, action.clicks ?? 3), raw: c.raw, transformed: c.transformed };
      }
      case 'drag': {
        if (action.x1 == null || action.y1 == null || action.x2 == null || action.y2 == null) throw new Error('drag action requires x1, y1, x2, y2');
        const from = doTransform(action.x1, action.y1);
        const to = doTransform(action.x2, action.y2);
        return { promise: mouseDrag(from.result.x, from.result.y, to.result.x, to.result.y), raw: `${from.raw}→${to.raw}`, transformed: `${from.transformed}→${to.transformed}` };
      }
      case 'wait': {
        return { promise: this.delay(action.ms ?? 1000), raw: '', transformed: '' };
      }
      case 'bring_window': {
        if (!action.title) throw new Error('bring_window action requires title');
        const title = action.title;
        const p = bringWindowToPrimary(title).then(matched => {
          if (!matched) throw new Error(`Window not found: "${title}". Use list_windows to see available titles.`);
        });
        return { promise: p, raw: '', transformed: '' };
      }
      case 'list_windows': {
        const p = listWindows().then(windows => {
          logger.info('Listed windows', { count: windows.length, titles: windows.slice(0, 10) });
          action.text = windows.length > 0
            ? `Found ${windows.length} windows: ${windows.slice(0, 15).join(', ')}`
            : 'No visible windows found';
        });
        return { promise: p, raw: '', transformed: '' };
      }
      default:
        logger.warn('Unknown action type', { action: action.action });
        return { promise: Promise.resolve(), raw: '', transformed: '' };
    }
  }

  /**
   * Transform coordinates from VLM output to screen pixels.
   */
  private transformCoords(x: number, y: number, screenshotWidth: number, screenshotHeight: number): { x: number; y: number } {
    if (!isFinite(x) || !isFinite(y)) {
      logger.warn('Invalid coordinates from VLM', { x, y });
      return { x: 0, y: 0 };
    }

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

    resultX = Math.max(0, Math.min(resultX, screenshotWidth - 1));
    resultY = Math.max(0, Math.min(resultY, screenshotHeight - 1));

    return { x: resultX, y: resultY };
  }

  /**
   * Build history text from action history (last N entries)
   */
  private buildHistoryText(history: ActionHistoryEntry[]): string {
    if (history.length === 0) return '';

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
 */
export async function runDesktopControl(
  task: string,
  config?: DesktopControlConfig,
): Promise<ToolResult> {
  if (isDesktopControlRunning) {
    return {
      success: false,
      error: 'A desktop control agent is already running. Wait for it to complete before starting another.',
    };
  }

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
