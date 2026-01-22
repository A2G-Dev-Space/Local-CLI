/**
 * useResponsive Hook
 * 반응형 브레이크포인트 관리 훅
 * - 작은 창: 사이드바 자동 숨김
 * - 중간 창: 기본 레이아웃
 * - 큰 창: 확장 레이아웃
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

// 브레이크포인트 정의
export const BREAKPOINTS = {
  xs: 480,   // 매우 작은 화면
  sm: 640,   // 작은 화면
  md: 768,   // 중간 화면
  lg: 1024,  // 큰 화면
  xl: 1280,  // 매우 큰 화면
  '2xl': 1536, // 초대형 화면
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

export interface ResponsiveState {
  /** 현재 창 너비 */
  width: number;
  /** 현재 창 높이 */
  height: number;
  /** 현재 브레이크포인트 */
  breakpoint: BreakpointKey;
  /** 사이드바 자동 숨김 여부 */
  shouldHideSidebar: boolean;
  /** 확장 레이아웃 사용 여부 */
  useExpandedLayout: boolean;
  /** 컴팩트 레이아웃 사용 여부 */
  useCompactLayout: boolean;
  /** 모바일 뷰 여부 */
  isMobile: boolean;
  /** 태블릿 뷰 여부 */
  isTablet: boolean;
  /** 데스크톱 뷰 여부 */
  isDesktop: boolean;
}

export interface ResponsiveConfig {
  /** 사이드바 자동 숨김 브레이크포인트 */
  sidebarHideBreakpoint?: BreakpointKey;
  /** 확장 레이아웃 브레이크포인트 */
  expandedBreakpoint?: BreakpointKey;
  /** 컴팩트 레이아웃 브레이크포인트 */
  compactBreakpoint?: BreakpointKey;
  /** 디바운스 딜레이 (ms) */
  debounceDelay?: number;
}

export interface UseResponsiveReturn extends ResponsiveState {
  /** 브레이크포인트 비교 유틸리티 */
  isAbove: (breakpoint: BreakpointKey) => boolean;
  isBelow: (breakpoint: BreakpointKey) => boolean;
  isBetween: (min: BreakpointKey, max: BreakpointKey) => boolean;
  /** 미디어 쿼리 매칭 */
  matches: (query: string) => boolean;
}

// 현재 브레이크포인트 결정
const getCurrentBreakpoint = (width: number): BreakpointKey => {
  if (width < BREAKPOINTS.xs) return 'xs';
  if (width < BREAKPOINTS.sm) return 'sm';
  if (width < BREAKPOINTS.md) return 'md';
  if (width < BREAKPOINTS.lg) return 'lg';
  if (width < BREAKPOINTS.xl) return 'xl';
  return '2xl';
};

// 디바운스 유틸리티
const debounce = <T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

export function useResponsive(config: ResponsiveConfig = {}): UseResponsiveReturn {
  const {
    sidebarHideBreakpoint = 'md',
    expandedBreakpoint = 'xl',
    compactBreakpoint = 'sm',
    debounceDelay = 100,
  } = config;

  // 초기 상태
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  // 창 크기 변경 핸들러
  useEffect(() => {
    const handleResize = debounce(() => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }, debounceDelay);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [debounceDelay]);

  // 현재 브레이크포인트
  const breakpoint = useMemo(
    () => getCurrentBreakpoint(dimensions.width),
    [dimensions.width]
  );

  // 브레이크포인트 비교 유틸리티
  const isAbove = useCallback(
    (bp: BreakpointKey): boolean => dimensions.width >= BREAKPOINTS[bp],
    [dimensions.width]
  );

  const isBelow = useCallback(
    (bp: BreakpointKey): boolean => dimensions.width < BREAKPOINTS[bp],
    [dimensions.width]
  );

  const isBetween = useCallback(
    (min: BreakpointKey, max: BreakpointKey): boolean =>
      dimensions.width >= BREAKPOINTS[min] && dimensions.width < BREAKPOINTS[max],
    [dimensions.width]
  );

  // 미디어 쿼리 매칭
  const matches = useCallback(
    (query: string): boolean => {
      if (typeof window === 'undefined') return false;
      return window.matchMedia(query).matches;
    },
    []
  );

  // 계산된 상태
  const state = useMemo<ResponsiveState>(() => {
    const { width, height } = dimensions;

    return {
      width,
      height,
      breakpoint,
      shouldHideSidebar: width < BREAKPOINTS[sidebarHideBreakpoint],
      useExpandedLayout: width >= BREAKPOINTS[expandedBreakpoint],
      useCompactLayout: width < BREAKPOINTS[compactBreakpoint],
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
    };
  }, [dimensions, breakpoint, sidebarHideBreakpoint, expandedBreakpoint, compactBreakpoint]);

  return {
    ...state,
    isAbove,
    isBelow,
    isBetween,
    matches,
  };
}

// 레이아웃 관련 편의 훅
export function useLayoutState() {
  const responsive = useResponsive();

  return useMemo(() => ({
    // 사이드바 관련
    sidebarVisible: !responsive.shouldHideSidebar,
    sidebarDefaultWidth: responsive.useExpandedLayout ? 280 : 240,
    sidebarMinWidth: responsive.useCompactLayout ? 180 : 200,
    sidebarMaxWidth: responsive.useExpandedLayout ? 400 : 320,

    // 패널 관련
    bottomPanelDefaultHeight: responsive.useCompactLayout ? 300 : 400,
    bottomPanelMinHeight: 150,
    bottomPanelMaxHeight: responsive.height * 0.8,

    rightPanelDefaultWidth: responsive.useExpandedLayout ? 400 : 320,
    rightPanelMinWidth: 280,
    rightPanelMaxWidth: responsive.width * 0.4,

    // 레이아웃 모드
    isCompact: responsive.useCompactLayout,
    isExpanded: responsive.useExpandedLayout,
    showBottomPanel: !responsive.useCompactLayout,
    showRightPanel: responsive.useExpandedLayout,

    // 분할 뷰 관련
    minPaneSize: responsive.useCompactLayout ? 150 : 200,
    defaultSplitRatio: responsive.useExpandedLayout ? 0.6 : 0.5,
  }), [responsive]);
}

export default useResponsive;
