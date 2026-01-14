/**
 * useInputHistory Hook
 *
 * Manages input history navigation with Up/Down arrow keys (bash-style)
 * History is session-only (resets on restart)
 */

import { useState, useCallback, useRef } from 'react';

export interface InputHistoryState {
  input: string;
  setInput: (value: string) => void;
  handleHistoryPrev: () => void;
  handleHistoryNext: () => void;
  addToHistory: (value: string) => void;
}

export function useInputHistory(): InputHistoryState {
  const [input, setInputInternal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const savedInputRef = useRef('');

  const setInput = useCallback((value: string) => {
    setInputInternal(value);
  }, []);

  const handleHistoryPrev = useCallback(() => {
    if (history.length === 0) return;

    if (historyIndex === -1) {
      // Save current input before browsing history
      savedInputRef.current = input;
      const newIndex = history.length - 1;
      const historyItem = history[newIndex];
      if (historyItem !== undefined) {
        setHistoryIndex(newIndex);
        setInputInternal(historyItem);
      }
    } else if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const historyItem = history[newIndex];
      if (historyItem !== undefined) {
        setHistoryIndex(newIndex);
        setInputInternal(historyItem);
      }
    }
  }, [input, history, historyIndex]);

  const handleHistoryNext = useCallback(() => {
    if (historyIndex === -1) return;

    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const historyItem = history[newIndex];
      if (historyItem !== undefined) {
        setHistoryIndex(newIndex);
        setInputInternal(historyItem);
      }
    } else {
      // Reached the end, restore saved input
      setHistoryIndex(-1);
      setInputInternal(savedInputRef.current);
    }
  }, [history, historyIndex]);

  const addToHistory = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Skip duplicates
    setHistory(prev => {
      if (prev.length > 0 && prev[prev.length - 1] === trimmed) {
        return prev;
      }
      return [...prev, trimmed];
    });
    setHistoryIndex(-1);
    savedInputRef.current = '';
  }, []);

  return {
    input,
    setInput,
    handleHistoryPrev,
    handleHistoryNext,
    addToHistory,
  };
}
