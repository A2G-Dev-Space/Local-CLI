/**
 * Context Tracker
 *
 * Tracks context window usage and determines when auto-compact should trigger.
 * Uses prompt_tokens from LLM API responses to calculate usage.
 */

import { logger } from '../../utils/logger.js';

/**
 * Context usage information
 */
export interface ContextUsageInfo {
  /** Last prompt_tokens from API response */
  currentTokens: number;
  /** Model's context window size */
  maxTokens: number;
  /** Usage percentage (current/max * 100) */
  usagePercentage: number;
  /** Remaining percentage (100 - usagePercentage) */
  remainingPercentage: number;
  /** Whether auto-compact should trigger */
  shouldAutoCompact: boolean;
}

/**
 * Context Tracker Class
 *
 * Singleton that tracks:
 * - Last prompt_tokens from LLM responses
 * - Recent file accesses for compact context
 * - Auto-compact threshold detection
 */
class ContextTrackerClass {
  private lastPromptTokens: number = 0;
  private autoCompactThreshold: number = 80; // percentage
  private autoCompactTriggered: boolean = false;

  // Recent files tracking
  private recentFiles: Set<string> = new Set();
  private maxRecentFiles: number = 20;

  /**
   * Update usage with prompt_tokens from LLM response
   */
  updateUsage(promptTokens: number): void {
    this.lastPromptTokens = promptTokens;
    logger.debug('Context usage updated', { promptTokens });
  }

  /**
   * Get current context usage information
   */
  getContextUsage(modelMaxTokens: number): ContextUsageInfo {
    const maxTokens = modelMaxTokens || 128000;
    const usagePercentage = Math.round((this.lastPromptTokens / maxTokens) * 100);
    const remainingPercentage = Math.max(0, 100 - usagePercentage);

    return {
      currentTokens: this.lastPromptTokens,
      maxTokens,
      usagePercentage,
      remainingPercentage,
      shouldAutoCompact: usagePercentage >= this.autoCompactThreshold,
    };
  }

  /**
   * Check if auto-compact should trigger
   * Returns true only once per threshold crossing (prevents multiple triggers)
   */
  shouldTriggerAutoCompact(modelMaxTokens: number): boolean {
    const usage = this.getContextUsage(modelMaxTokens);

    if (usage.shouldAutoCompact && !this.autoCompactTriggered) {
      logger.flow('Auto-compact threshold reached');
      logger.vars(
        { name: 'usagePercentage', value: usage.usagePercentage },
        { name: 'threshold', value: this.autoCompactThreshold }
      );
      this.autoCompactTriggered = true;
      return true;
    }

    return false;
  }

  /**
   * Reset after compact (allow future auto-compact triggers)
   */
  reset(): void {
    logger.flow('ContextTracker reset');
    this.lastPromptTokens = 0;
    this.autoCompactTriggered = false;
    this.recentFiles.clear();
  }

  /**
   * Reset only the auto-compact trigger flag
   * Call this after processing a message to allow future triggers
   */
  resetAutoCompactTrigger(): void {
    this.autoCompactTriggered = false;
  }

  /**
   * Track file access for compact context
   */
  trackFileAccess(filePath: string): void {
    this.recentFiles.add(filePath);

    // Keep only last N files
    if (this.recentFiles.size > this.maxRecentFiles) {
      const arr = Array.from(this.recentFiles);
      this.recentFiles = new Set(arr.slice(-this.maxRecentFiles));
    }
  }

  /**
   * Get recently accessed files
   */
  getRecentFiles(): string[] {
    return Array.from(this.recentFiles);
  }

  /**
   * Get the auto-compact threshold percentage
   */
  getThreshold(): number {
    return this.autoCompactThreshold;
  }

  /**
   * Set the auto-compact threshold percentage
   */
  setThreshold(threshold: number): void {
    if (threshold > 0 && threshold <= 100) {
      logger.state('Auto-compact threshold', this.autoCompactThreshold, threshold);
      this.autoCompactThreshold = threshold;
    }
  }

  /**
   * Get last prompt tokens
   */
  getLastPromptTokens(): number {
    return this.lastPromptTokens;
  }
}

// Singleton instance
export const contextTracker = new ContextTrackerClass();

export default contextTracker;
