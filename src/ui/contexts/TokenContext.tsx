/**
 * Token Usage Context
 *
 * Tracks token usage across the application
 * Provides real-time token counting and statistics
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { logger } from '../../utils/logger.js';

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface TokenStats {
  // Current session totals
  sessionTotal: number;
  sessionPrompt: number;
  sessionCompletion: number;

  // Current request
  lastRequestTokens: number;
  lastResponseTokens: number;

  // Rate tracking
  tokensPerSecond: number;
  lastUpdateTime: number;

  // History for averaging
  recentRates: number[];
}

interface TokenContextValue {
  stats: TokenStats;
  addUsage: (usage: TokenUsage, durationMs?: number) => void;
  resetSession: () => void;
}

const initialStats: TokenStats = {
  sessionTotal: 0,
  sessionPrompt: 0,
  sessionCompletion: 0,
  lastRequestTokens: 0,
  lastResponseTokens: 0,
  tokensPerSecond: 0,
  lastUpdateTime: Date.now(),
  recentRates: [],
};

const TokenContext = createContext<TokenContextValue | null>(null);

export const TokenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState<TokenStats>(initialStats);

  useEffect(() => {
    logger.debug('TokenProvider mounted');
    return () => {
      logger.debug('TokenProvider unmounted', { finalStats: stats });
    };
  }, []);

  const addUsage = useCallback((usage: TokenUsage, durationMs?: number) => {
    setStats(prev => {
      const newSessionTotal = prev.sessionTotal + usage.total_tokens;
      const newSessionPrompt = prev.sessionPrompt + usage.prompt_tokens;
      const newSessionCompletion = prev.sessionCompletion + usage.completion_tokens;

      // Calculate tokens per second
      let tokensPerSecond = prev.tokensPerSecond;
      const recentRates = [...prev.recentRates];

      if (durationMs && durationMs > 0) {
        const rate = (usage.completion_tokens / durationMs) * 1000;
        recentRates.push(rate);
        // Keep last 5 rates for averaging
        if (recentRates.length > 5) {
          recentRates.shift();
        }
        // Calculate average rate
        tokensPerSecond = recentRates.reduce((a, b) => a + b, 0) / recentRates.length;
      }

      logger.debug('Token usage updated', {
        added: usage.total_tokens,
        sessionTotal: newSessionTotal,
        tokensPerSecond: tokensPerSecond.toFixed(1),
      });

      return {
        sessionTotal: newSessionTotal,
        sessionPrompt: newSessionPrompt,
        sessionCompletion: newSessionCompletion,
        lastRequestTokens: usage.prompt_tokens,
        lastResponseTokens: usage.completion_tokens,
        tokensPerSecond,
        lastUpdateTime: Date.now(),
        recentRates,
      };
    });
  }, []);

  const resetSession = useCallback(() => {
    logger.info('Token stats reset');
    setStats(initialStats);
  }, []);

  return (
    <TokenContext.Provider value={{ stats, addUsage, resetSession }}>
      {children}
    </TokenContext.Provider>
  );
};

export const useTokenStats = (): TokenContextValue => {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error('useTokenStats must be used within a TokenProvider');
  }
  return context;
};

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

/**
 * Format tokens per second
 */
export function formatTokenRate(rate: number): string {
  if (rate < 1) return `${(rate * 1000).toFixed(0)}ms/tok`;
  return `${rate.toFixed(1)} tok/s`;
}
