/**
 * Usage Statistics Component
 * Displays token usage statistics
 */

import React, { useState, useEffect, useCallback } from 'react';
import './UsageStats.css';

interface UsageSummary {
  today: { totalTokens: number; requestCount: number } | null;
  thisMonth: { totalTokens: number; totalRequests: number; days: number };
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

interface UsageStatsProps {
  isOpen: boolean;
  onClose: () => void;
}

const UsageStats: React.FC<UsageStatsProps> = ({ isOpen, onClose }) => {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load usage summary
  const loadSummary = useCallback(async () => {
    if (!window.electronAPI?.usage) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.usage.getSummary();
      if (result.success && result.summary) {
        setSummary(result.summary);
      } else {
        setError(result.error || 'Failed to load usage data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on open
  useEffect(() => {
    if (isOpen) {
      loadSummary();
    }
  }, [isOpen, loadSummary]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset session
  const handleResetSession = useCallback(async () => {
    if (!window.electronAPI?.usage) return;

    try {
      await window.electronAPI.usage.resetSession();
      loadSummary();
    } catch (err) {
      console.error('Failed to reset session:', err);
    }
  }, [loadSummary]);

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="usage-stats-backdrop" onClick={onClose}>
      <div className="usage-stats-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="usage-stats-header">
          <div className="usage-stats-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
            </svg>
            <span>Token Usage Statistics</span>
          </div>
          <button className="usage-stats-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="usage-stats-content">
          {isLoading && (
            <div className="usage-loading">Loading...</div>
          )}

          {error && (
            <div className="usage-error">{error}</div>
          )}

          {summary && !isLoading && (
            <>
              {/* Current Session */}
              <div className="usage-section">
                <div className="usage-section-header">
                  <h3>Current Session</h3>
                  <button className="reset-btn" onClick={handleResetSession}>
                    Reset
                  </button>
                </div>
                <div className="usage-grid">
                  <div className="usage-stat">
                    <span className="stat-label">Input Tokens</span>
                    <span className="stat-value">{formatNumber(summary.currentSession.inputTokens)}</span>
                  </div>
                  <div className="usage-stat">
                    <span className="stat-label">Output Tokens</span>
                    <span className="stat-value">{formatNumber(summary.currentSession.outputTokens)}</span>
                  </div>
                  <div className="usage-stat">
                    <span className="stat-label">Total Tokens</span>
                    <span className="stat-value highlight">{formatNumber(summary.currentSession.totalTokens)}</span>
                  </div>
                  <div className="usage-stat">
                    <span className="stat-label">Requests</span>
                    <span className="stat-value">{formatNumber(summary.currentSession.requestCount)}</span>
                  </div>
                </div>
              </div>

              {/* Today */}
              <div className="usage-section">
                <h3>Today</h3>
                {summary.today ? (
                  <div className="usage-grid">
                    <div className="usage-stat">
                      <span className="stat-label">Total Tokens</span>
                      <span className="stat-value">{formatNumber(summary.today.totalTokens)}</span>
                    </div>
                    <div className="usage-stat">
                      <span className="stat-label">Requests</span>
                      <span className="stat-value">{formatNumber(summary.today.requestCount)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="usage-empty">No usage today</div>
                )}
              </div>

              {/* This Month */}
              <div className="usage-section">
                <h3>This Month</h3>
                <div className="usage-grid">
                  <div className="usage-stat">
                    <span className="stat-label">Total Tokens</span>
                    <span className="stat-value">{formatNumber(summary.thisMonth.totalTokens)}</span>
                  </div>
                  <div className="usage-stat">
                    <span className="stat-label">Requests</span>
                    <span className="stat-value">{formatNumber(summary.thisMonth.totalRequests)}</span>
                  </div>
                  <div className="usage-stat">
                    <span className="stat-label">Active Days</span>
                    <span className="stat-value">{summary.thisMonth.days}</span>
                  </div>
                </div>
              </div>

              {/* All Time */}
              <div className="usage-section">
                <h3>All Time</h3>
                <div className="usage-grid">
                  <div className="usage-stat">
                    <span className="stat-label">Input Tokens</span>
                    <span className="stat-value">{formatNumber(summary.allTime.totalInputTokens)}</span>
                  </div>
                  <div className="usage-stat">
                    <span className="stat-label">Output Tokens</span>
                    <span className="stat-value">{formatNumber(summary.allTime.totalOutputTokens)}</span>
                  </div>
                  <div className="usage-stat">
                    <span className="stat-label">Total Tokens</span>
                    <span className="stat-value highlight">{formatNumber(summary.allTime.totalTokens)}</span>
                  </div>
                  <div className="usage-stat">
                    <span className="stat-label">Total Requests</span>
                    <span className="stat-value">{formatNumber(summary.allTime.totalRequests)}</span>
                  </div>
                </div>
                {summary.allTime.firstUsed && (
                  <div className="usage-meta">
                    First used: {summary.allTime.firstUsed}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="usage-stats-footer">
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};

export default UsageStats;
