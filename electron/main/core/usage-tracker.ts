/**
 * Usage Tracker for Electron
 * Tracks token usage per session and provides statistics
 *
 * CLI parity: src/core/usage-tracker.ts
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';
import { contextTracker } from './compact/context-tracker';

// Usage data directory (Windows: %APPDATA%\LOCAL-CLI-UI)
function getDataDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'LOCAL-CLI-UI');
  }
  return path.join(os.homedir(), '.local-cli-ui');
}

const DATA_DIR = getDataDir();
const USAGE_FILE = path.join(DATA_DIR, 'usage.json');

export interface UsageRecord {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessionId?: string;
}

export interface DailyUsage {
  date: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  requestCount: number;
  models: Record<string, number>;
}

export interface UsageData {
  records: UsageRecord[];
  dailyStats: Record<string, DailyUsage>;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalRequests: number;
  lastUpdated: string;
}

export interface UsageSummary {
  today: DailyUsage | null;
  thisMonth: {
    totalTokens: number;
    totalRequests: number;
    days: number;
  };
  allTime: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalRequests: number;
    firstUsed: string | null;
  };
  currentSession: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requestCount: number;
  };
}

class UsageTracker {
  private data: UsageData;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // Current session usage (CLI parity: includes lastPromptTokens)
  private currentSession = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requestCount: 0,
    lastPromptTokens: 0,
  };

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): UsageData {
    try {
      if (fs.existsSync(USAGE_FILE)) {
        const content = fs.readFileSync(USAGE_FILE, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      logger.warn('Failed to load usage data', error);
    }

    return {
      records: [],
      dailyStats: {},
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  private saveData(): void {
    // Debounce saves
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        this.data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(USAGE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
      } catch (error) {
        logger.error('Failed to save usage data', error);
      }
    }, 1000);
  }

  /**
   * Record token usage
   * CLI parity: src/core/usage-tracker.ts recordUsage()
   * @param promptTokens - Optional: last prompt_tokens for context tracking (auto-compact)
   */
  recordUsage(
    model: string,
    inputTokens: number,
    outputTokens: number,
    sessionId?: string,
    promptTokens?: number
  ): void {
    const totalTokens = inputTokens + outputTokens;
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];

    // Add to records
    const record: UsageRecord = {
      timestamp,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      sessionId,
    };
    this.data.records.push(record);

    // Keep only last 1000 records
    if (this.data.records.length > 1000) {
      this.data.records = this.data.records.slice(-1000);
    }

    // Update daily stats
    if (!this.data.dailyStats[date]) {
      this.data.dailyStats[date] = {
        date,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        requestCount: 0,
        models: {},
      };
    }
    const daily = this.data.dailyStats[date];
    daily.totalInputTokens += inputTokens;
    daily.totalOutputTokens += outputTokens;
    daily.totalTokens += totalTokens;
    daily.requestCount++;
    daily.models[model] = (daily.models[model] || 0) + totalTokens;

    // Update totals
    this.data.totalInputTokens += inputTokens;
    this.data.totalOutputTokens += outputTokens;
    this.data.totalTokens += totalTokens;
    this.data.totalRequests++;

    // Update current session
    this.currentSession.inputTokens += inputTokens;
    this.currentSession.outputTokens += outputTokens;
    this.currentSession.totalTokens += totalTokens;
    this.currentSession.requestCount++;

    // Update lastPromptTokens for context tracking (CLI parity)
    if (promptTokens !== undefined) {
      this.currentSession.lastPromptTokens = promptTokens;
      // Also update contextTracker for auto-compact detection
      contextTracker.updateUsage(promptTokens);
    }

    this.saveData();
  }

  /**
   * Get usage summary
   */
  getSummary(): UsageSummary {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.slice(0, 7); // YYYY-MM

    // Calculate this month stats
    let monthTokens = 0;
    let monthRequests = 0;
    let monthDays = 0;
    for (const [date, stats] of Object.entries(this.data.dailyStats)) {
      if (date.startsWith(thisMonth)) {
        monthTokens += stats.totalTokens;
        monthRequests += stats.requestCount;
        monthDays++;
      }
    }

    // Find first used date
    const firstUsed = this.data.records.length > 0
      ? this.data.records[0].timestamp.split('T')[0]
      : null;

    return {
      today: this.data.dailyStats[today] || null,
      thisMonth: {
        totalTokens: monthTokens,
        totalRequests: monthRequests,
        days: monthDays,
      },
      allTime: {
        totalInputTokens: this.data.totalInputTokens,
        totalOutputTokens: this.data.totalOutputTokens,
        totalTokens: this.data.totalTokens,
        totalRequests: this.data.totalRequests,
        firstUsed,
      },
      currentSession: { ...this.currentSession },
    };
  }

  /**
   * Reset current session stats
   */
  resetSession(): void {
    this.currentSession = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requestCount: 0,
      lastPromptTokens: 0,
    };
  }

  /**
   * Get daily stats for last N days
   */
  getDailyStats(days: number = 30): DailyUsage[] {
    const result: DailyUsage[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      if (this.data.dailyStats[dateStr]) {
        result.push(this.data.dailyStats[dateStr]);
      }
    }

    return result.reverse();
  }

  /**
   * Clear all usage data
   */
  clearData(): void {
    this.data = {
      records: [],
      dailyStats: {},
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      lastUpdated: new Date().toISOString(),
    };
    this.resetSession();
    this.saveData();
  }
}

// Export singleton
export const usageTracker = new UsageTracker();
