/**
 * useWindowState Hook
 * 창 상태 관리 훅
 * - 창 크기/위치 저장
 * - 최대화 상태 기억
 * - 멀티 모니터 지원
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  bounds: WindowBounds;
  isMaximized: boolean;
  isMinimized: boolean;
  isFullScreen: boolean;
  displayId?: number;
}

export interface UseWindowStateReturn {
  /** 현재 창 상태 */
  state: WindowState;
  /** 최대화 상태 */
  isMaximized: boolean;
  /** 최소화 상태 */
  isMinimized: boolean;
  /** 전체화면 상태 */
  isFullScreen: boolean;
  /** 창 크기 */
  windowSize: { width: number; height: number };
  /** 창 위치 */
  windowPosition: { x: number; y: number };
  /** 상태 저장 */
  saveState: () => void;
  /** 상태 복원 */
  restoreState: () => void;
  /** 기본 상태로 리셋 */
  resetState: () => void;
}

const STORAGE_KEY = 'window-state';

// 기본 창 상태
const getDefaultState = (): WindowState => ({
  bounds: {
    x: Math.round((screen.width - 1200) / 2),
    y: Math.round((screen.height - 800) / 2),
    width: 1200,
    height: 800,
  },
  isMaximized: false,
  isMinimized: false,
  isFullScreen: false,
});

// localStorage에서 상태 로드
const loadState = (): WindowState | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 유효성 검증
      if (
        parsed.bounds &&
        typeof parsed.bounds.x === 'number' &&
        typeof parsed.bounds.y === 'number' &&
        typeof parsed.bounds.width === 'number' &&
        typeof parsed.bounds.height === 'number'
      ) {
        return parsed;
      }
    }
  } catch {
    // 무시
  }
  return null;
};

// localStorage에 상태 저장
const saveStateToStorage = (state: WindowState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 무시
  }
};

// 창이 화면 내에 있는지 확인
const isWindowInBounds = (bounds: WindowBounds): boolean => {
  const { x, y, width, height } = bounds;

  // 최소한 창의 일부가 화면에 보이는지 확인
  const minVisible = 100;

  return (
    x + width > minVisible &&
    y + height > minVisible &&
    x < screen.width - minVisible &&
    y < screen.height - minVisible
  );
};

// 창 위치 보정 (화면 밖이면 중앙으로)
const normalizeWindowBounds = (bounds: WindowBounds): WindowBounds => {
  if (isWindowInBounds(bounds)) {
    return bounds;
  }

  // 화면 중앙으로 이동
  return {
    ...bounds,
    x: Math.round((screen.width - bounds.width) / 2),
    y: Math.round((screen.height - bounds.height) / 2),
  };
};

export function useWindowState(): UseWindowStateReturn {
  // 초기 상태 로드
  const [state, setState] = useState<WindowState>(() => {
    const saved = loadState();
    if (saved) {
      return {
        ...saved,
        bounds: normalizeWindowBounds(saved.bounds),
      };
    }
    return getDefaultState();
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 현재 창 크기/위치 추적
  useEffect(() => {
    const handleResize = () => {
      // 최대화/전체화면 상태가 아닐 때만 크기 저장
      if (!state.isMaximized && !state.isFullScreen) {
        setState(prev => ({
          ...prev,
          bounds: {
            ...prev.bounds,
            width: window.innerWidth,
            height: window.innerHeight,
          },
        }));
      }
    };

    // 디바운스된 저장
    const debouncedSave = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveStateToStorage(state);
      }, 500);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('resize', debouncedSave);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', debouncedSave);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state.isMaximized, state.isFullScreen]);

  // Electron API 연동
  useEffect(() => {
    const { electronAPI } = window;
    if (!electronAPI?.window) return;

    // 최대화 상태 변경 리스너
    const unsubMaximize = electronAPI.window.onMaximizeChange?.((isMaximized: boolean) => {
      setState(prev => ({ ...prev, isMaximized }));
    });

    // 초기 최대화 상태 확인
    electronAPI.window.isMaximized?.().then((isMaximized: boolean) => {
      setState(prev => ({ ...prev, isMaximized }));
    });

    return () => {
      unsubMaximize?.();
    };
  }, []);

  // 상태 저장
  const saveState = useCallback(() => {
    saveStateToStorage(state);
  }, [state]);

  // 상태 복원
  const restoreState = useCallback(() => {
    const saved = loadState();
    if (saved) {
      setState({
        ...saved,
        bounds: normalizeWindowBounds(saved.bounds),
      });
    }
  }, []);

  // 기본 상태로 리셋
  const resetState = useCallback(() => {
    const defaultState = getDefaultState();
    setState(defaultState);
    saveStateToStorage(defaultState);
  }, []);

  return {
    state,
    isMaximized: state.isMaximized,
    isMinimized: state.isMinimized,
    isFullScreen: state.isFullScreen,
    windowSize: {
      width: state.bounds.width,
      height: state.bounds.height,
    },
    windowPosition: {
      x: state.bounds.x,
      y: state.bounds.y,
    },
    saveState,
    restoreState,
    resetState,
  };
}

export default useWindowState;
