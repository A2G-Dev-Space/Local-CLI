/**
 * Usage Tracker
 *
 * Phase 3: 사용량 추적 기능
 * - 토큰 사용량 추적 (세션/작업 단위 취합)
 * - 세션별/일별/월별 통계
 * - 로컬 파일 저장
 * - 실시간 세션 토큰 추적
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { contextTracker } from './compact/context-tracker.js';

/**
 * 단일 사용 기록
 */
export interface UsageRecord {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessionId?: string;
}

/**
 * 일별 사용량 집계
 */
export interface DailyUsage {
  date: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  requestCount: number;
  models: Record<string, number>;
}

/**
 * 전체 사용량 데이터
 */
export interface UsageData {
  records: UsageRecord[];
  dailyStats: Record<string, DailyUsage>;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalRequests: number;
  lastUpdated: string;
}

/**
 * 사용량 요약
 */
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
}

/**
 * 현재 세션/작업 사용량 (실시간 취합용)
 */
export interface SessionUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
  startTime: number;
  models: Record<string, number>;
  /** Last prompt_tokens for context usage tracking */
  lastPromptTokens: number;
}

const DATA_DIR = path.join(process.env['HOME'] || '.', '.local-cli');
const USAGE_FILE = path.join(DATA_DIR, 'usage.json');

/**
 * Usage Tracker Class
 */
class UsageTrackerClass {
  private data: UsageData;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // 현재 세션 사용량 (여러 LLM 호출 취합)
  private currentSession: SessionUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requestCount: 0,
    startTime: Date.now(),
    models: {},
    lastPromptTokens: 0,
  };

  constructor() {
    logger.enter('UsageTracker.constructor');
    this.data = this.loadData();
    logger.exit('UsageTracker.constructor');
  }

  /**
   * Load usage data from file
   */
  private loadData(): UsageData {
    logger.enter('UsageTracker.loadData');

    try {
      if (fs.existsSync(USAGE_FILE)) {
        const content = fs.readFileSync(USAGE_FILE, 'utf-8');
        const data = JSON.parse(content) as UsageData;
        logger.vars({ name: 'recordCount', value: data.records.length });
        logger.exit('UsageTracker.loadData', { loaded: true });
        return data;
      }
    } catch (error) {
      logger.warn('Failed to load usage data, starting fresh', error);
    }

    const emptyData: UsageData = {
      records: [],
      dailyStats: {},
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      lastUpdated: new Date().toISOString(),
    };

    logger.exit('UsageTracker.loadData', { loaded: false });
    return emptyData;
  }

  /**
   * Save usage data to file (debounced)
   */
  private saveData(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      logger.flow('Saving usage data');
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        this.data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(USAGE_FILE, JSON.stringify(this.data, null, 2));
      } catch (error) {
        logger.error('Failed to save usage data', error as Error);
      }
    }, 1000);
  }

  /**
   * Record token usage (개별 LLM 호출마다)
   * - 현재 세션 사용량 업데이트
   * - 전체 통계 업데이트
   * @param promptTokens - Optional: last prompt_tokens for context tracking
   */
  recordUsage(
    model: string,
    inputTokens: number,
    outputTokens: number,
    sessionId?: string,
    promptTokens?: number
  ): void {
    logger.enter('UsageTracker.recordUsage', { model, inputTokens, outputTokens });

    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0] || timestamp;
    const totalTokens = inputTokens + outputTokens;

    // 현재 세션 사용량 업데이트 (실시간 취합)
    this.currentSession.inputTokens += inputTokens;
    this.currentSession.outputTokens += outputTokens;
    this.currentSession.totalTokens += totalTokens;
    this.currentSession.requestCount += 1;
    this.currentSession.models[model] = (this.currentSession.models[model] || 0) + totalTokens;

    // Update lastPromptTokens for context tracking
    if (promptTokens !== undefined) {
      this.currentSession.lastPromptTokens = promptTokens;
      // Also update contextTracker for auto-compact detection
      contextTracker.updateUsage(promptTokens);
    }

    // Add record
    const record: UsageRecord = {
      timestamp,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      sessionId,
    };
    this.data.records.push(record);

    // Update totals
    this.data.totalInputTokens += inputTokens;
    this.data.totalOutputTokens += outputTokens;
    this.data.totalTokens += totalTokens;
    this.data.totalRequests += 1;

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

    const daily = this.data.dailyStats[date]!;
    daily.totalInputTokens += inputTokens;
    daily.totalOutputTokens += outputTokens;
    daily.totalTokens += totalTokens;
    daily.requestCount += 1;
    daily.models[model] = (daily.models[model] || 0) + totalTokens;

    // Keep only last 30 days of detailed records
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    this.data.records = this.data.records.filter(
      r => new Date(r.timestamp) > thirtyDaysAgo
    );

    this.saveData();
    logger.exit('UsageTracker.recordUsage');
  }

  /**
   * Get usage summary
   */
  getSummary(): UsageSummary {
    logger.enter('UsageTracker.getSummary');

    const today = new Date().toISOString().split('T')[0] || '';
    const todayStats = this.data.dailyStats[today] || null;

    // This month stats
    const currentMonth = today.substring(0, 7); // YYYY-MM
    let monthTokens = 0;
    let monthRequests = 0;
    let monthDays = 0;

    for (const [date, stats] of Object.entries(this.data.dailyStats)) {
      if (date.startsWith(currentMonth)) {
        monthTokens += stats.totalTokens;
        monthRequests += stats.requestCount;
        monthDays += 1;
      }
    }

    // First usage date
    const firstRecord = this.data.records[0];
    const firstUsed = firstRecord ? firstRecord.timestamp.split('T')[0] || null : null;

    const summary: UsageSummary = {
      today: todayStats,
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
    };

    logger.exit('UsageTracker.getSummary');
    return summary;
  }

  /**
   * Get today's usage
   */
  getTodayUsage(): DailyUsage | null {
    const today = new Date().toISOString().split('T')[0] || '';
    return this.data.dailyStats[today] || null;
  }

  /**
   * Get total tokens used
   */
  getTotalTokens(): number {
    return this.data.totalTokens;
  }

  /**
   * Get current session usage (실시간 취합된 값)
   */
  getSessionUsage(): SessionUsage {
    return { ...this.currentSession };
  }

  /**
   * Get session elapsed time in seconds
   */
  getSessionElapsedSeconds(): number {
    return Math.floor((Date.now() - this.currentSession.startTime) / 1000);
  }

  /**
   * Reset session usage (새 작업 시작 시 호출)
   */
  resetSession(): void {
    logger.flow('Resetting session usage');
    this.currentSession = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requestCount: 0,
      startTime: Date.now(),
      models: {},
      lastPromptTokens: 0,
    };
  }

  /**
   * Format session usage for status bar display
   * Claude Code 스타일: "✶ ~ 하는 중… (esc to interrupt · 2m 7s · ↑ 3.6k tokens)"
   */
  formatSessionStatus(currentActivity?: string): string {
    const elapsed = this.getSessionElapsedSeconds();
    const tokens = this.currentSession.totalTokens;

    // Format time
    let timeStr: string;
    if (elapsed < 60) {
      timeStr = `${elapsed}s`;
    } else {
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      timeStr = `${mins}m ${secs}s`;
    }

    // Format tokens
    let tokenStr: string;
    if (tokens < 1000) {
      tokenStr = tokens.toString();
    } else if (tokens < 1000000) {
      tokenStr = `${(tokens / 1000).toFixed(1)}k`;
    } else {
      tokenStr = `${(tokens / 1000000).toFixed(2)}M`;
    }

    // Build status string
    const activity = currentActivity || '처리 중';
    return `✶ ${activity}… (esc to interrupt · ${timeStr} · ↑ ${tokenStr} tokens)`;
  }

  /**
   * Format usage for display
   */
  formatUsageDisplay(): string {
    logger.enter('UsageTracker.formatUsageDisplay');

    const summary = this.getSummary();
    const lines: string[] = [];

    lines.push('📊 사용량 통계');
    lines.push('');

    // Today
    lines.push('📅 오늘');
    if (summary.today) {
      lines.push(`   요청: ${summary.today.requestCount}회`);
      lines.push(`   입력 토큰: ${summary.today.totalInputTokens.toLocaleString()}`);
      lines.push(`   출력 토큰: ${summary.today.totalOutputTokens.toLocaleString()}`);
      lines.push(`   총 토큰: ${summary.today.totalTokens.toLocaleString()}`);
    } else {
      lines.push('   사용 기록 없음');
    }
    lines.push('');

    // This month
    lines.push('📆 이번 달');
    lines.push(`   요청: ${summary.thisMonth.totalRequests.toLocaleString()}회`);
    lines.push(`   총 토큰: ${summary.thisMonth.totalTokens.toLocaleString()}`);
    lines.push(`   활성 일수: ${summary.thisMonth.days}일`);
    lines.push('');

    // All time
    lines.push('📈 전체');
    lines.push(`   총 요청: ${summary.allTime.totalRequests.toLocaleString()}회`);
    lines.push(`   입력 토큰: ${summary.allTime.totalInputTokens.toLocaleString()}`);
    lines.push(`   출력 토큰: ${summary.allTime.totalOutputTokens.toLocaleString()}`);
    lines.push(`   총 토큰: ${summary.allTime.totalTokens.toLocaleString()}`);
    if (summary.allTime.firstUsed) {
      lines.push(`   최초 사용: ${summary.allTime.firstUsed}`);
    }

    logger.exit('UsageTracker.formatUsageDisplay');
    return lines.join('\n');
  }

  /**
   * Clear all usage data
   */
  clearData(): void {
    logger.flow('Clearing all usage data');
    this.data = {
      records: [],
      dailyStats: {},
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      lastUpdated: new Date().toISOString(),
    };
    this.saveData();
  }
}

// Singleton instance
export const usageTracker = new UsageTrackerClass();

export default usageTracker;
