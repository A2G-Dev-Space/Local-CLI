/**
 * Context Tracker for Electron Agent
 * Tracks token usage and triggers auto-compact when threshold is reached
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import { logger } from '../logger';

// =============================================================================
// Types
// =============================================================================

export interface ContextUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  usagePercent: number;
  maxContextTokens: number;
}

export interface RecentFile {
  path: string;
  accessedAt: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_CONTEXT_TOKENS = 128000; // GPT-4 Turbo context
const DEFAULT_AUTO_COMPACT_THRESHOLD = 70; // 70% (as integer for consistency with CLI)
const RECENT_FILES_LIMIT = 20;
const CHARS_PER_TOKEN = 4; // Rough estimate

// =============================================================================
// Context Tracker Class
// =============================================================================

export class ContextTracker {
  private maxContextTokens: number;
  private currentPromptTokens: number = 0;
  private currentCompletionTokens: number = 0;
  private autoCompactTriggered: boolean = false;
  private recentFiles: RecentFile[] = [];
  private autoCompactThreshold: number = DEFAULT_AUTO_COMPACT_THRESHOLD; // CLI parity

  constructor(maxContextTokens: number = DEFAULT_MAX_CONTEXT_TOKENS) {
    this.maxContextTokens = maxContextTokens;
    logger.info('ContextTracker initialized', { maxContextTokens, threshold: this.autoCompactThreshold });
  }

  /**
   * Update token usage from LLM response
   */
  updateUsage(promptTokens: number, completionTokens?: number): void {
    this.currentPromptTokens = promptTokens;
    if (completionTokens !== undefined) {
      this.currentCompletionTokens = completionTokens;
    }

    const usage = this.getContextUsage();
    logger.debug('Context usage updated', {
      promptTokens,
      completionTokens,
      usagePercent: usage.usagePercent.toFixed(1),
    });
  }

  /**
   * Get current context usage
   */
  getContextUsage(): ContextUsage {
    const totalTokens = this.currentPromptTokens + this.currentCompletionTokens;
    const usagePercent = (totalTokens / this.maxContextTokens) * 100;

    return {
      promptTokens: this.currentPromptTokens,
      completionTokens: this.currentCompletionTokens,
      totalTokens,
      usagePercent,
      maxContextTokens: this.maxContextTokens,
    };
  }

  /**
   * Check if auto-compact should be triggered
   * Returns true only once when threshold is first crossed
   */
  shouldTriggerAutoCompact(): boolean {
    const usage = this.getContextUsage();

    // Check if we crossed the threshold (threshold is stored as integer 0-100)
    if (usage.usagePercent >= this.autoCompactThreshold) {
      // Only trigger once
      if (!this.autoCompactTriggered) {
        this.autoCompactTriggered = true;
        logger.info('Auto-compact threshold reached', {
          usagePercent: usage.usagePercent.toFixed(1),
          threshold: this.autoCompactThreshold,
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Get current auto-compact threshold (CLI parity)
   */
  getThreshold(): number {
    return this.autoCompactThreshold;
  }

  /**
   * Set auto-compact threshold (CLI parity)
   * @param threshold - Threshold as integer 0-100
   */
  setThreshold(threshold: number): void {
    if (threshold > 0 && threshold <= 100) {
      this.autoCompactThreshold = threshold;
      logger.info('Auto-compact threshold updated', { threshold });
    }
  }

  /**
   * Get last prompt tokens count (CLI parity)
   */
  getLastPromptTokens(): number {
    return this.currentPromptTokens;
  }

  /**
   * Reset auto-compact trigger (call after compact is performed)
   */
  resetAutoCompactTrigger(): void {
    this.autoCompactTriggered = false;
    logger.debug('Auto-compact trigger reset');
  }

  /**
   * Track file access for context building
   */
  trackFileAccess(filePath: string): void {
    // Remove if already exists
    this.recentFiles = this.recentFiles.filter((f) => f.path !== filePath);

    // Add to front
    this.recentFiles.unshift({
      path: filePath,
      accessedAt: Date.now(),
    });

    // Trim to limit
    if (this.recentFiles.length > RECENT_FILES_LIMIT) {
      this.recentFiles = this.recentFiles.slice(0, RECENT_FILES_LIMIT);
    }
  }

  /**
   * Get recently accessed files
   */
  getRecentFiles(): RecentFile[] {
    return [...this.recentFiles];
  }

  /**
   * Estimate tokens for a given text
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.currentPromptTokens = 0;
    this.currentCompletionTokens = 0;
    this.autoCompactTriggered = false;
    this.recentFiles = [];
    logger.debug('ContextTracker reset');
  }

  /**
   * Format status for display
   */
  formatStatus(): string {
    const usage = this.getContextUsage();
    const bar = this.createProgressBar(usage.usagePercent, 20);

    return `Context: ${bar} ${usage.usagePercent.toFixed(1)}% (${usage.totalTokens}/${usage.maxContextTokens} tokens)`;
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBar(percent: number, length: number): string {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let contextTrackerInstance: ContextTracker | null = null;

/**
 * Get context tracker instance
 */
export function getContextTracker(maxContextTokens?: number): ContextTracker {
  if (!contextTrackerInstance) {
    contextTrackerInstance = new ContextTracker(maxContextTokens);
  }
  return contextTrackerInstance;
}

/**
 * Reset context tracker instance
 */
export function resetContextTracker(): void {
  if (contextTrackerInstance) {
    contextTrackerInstance.reset();
  }
  contextTrackerInstance = null;
}

export default ContextTracker;
