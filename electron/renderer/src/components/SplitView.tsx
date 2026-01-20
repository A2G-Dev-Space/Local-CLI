/**
 * SplitView Component
 * 가로/세로 분할 뷰
 * - 다중 분할 지원
 * - 분할 비율 localStorage 저장
 * - 60fps 성능 최적화
 * - 터치 디바이스 지원
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import './SplitView.css';

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitPane {
  /** 고유 ID */
  id: string;
  /** 패널 컨텐츠 */
  content: React.ReactNode;
  /** 초기 크기 비율 (0-1) */
  initialSize?: number;
  /** 최소 크기 (px) */
  minSize?: number;
  /** 최대 크기 (px) */
  maxSize?: number;
}

export interface SplitViewProps {
  /** 분할 방향 */
  direction?: SplitDirection;
  /** 분할 패널들 */
  panes: SplitPane[];
  /** 저장 키 */
  storageKey?: string;
  /** 크기 변경 콜백 */
  onSizesChange?: (sizes: number[]) => void;
  /** 추가 클래스 */
  className?: string;
  /** 스플리터 크기 */
  splitterSize?: number;
}

// localStorage 유틸리티
const getSavedSizes = (key: string): number[] | null => {
  try {
    const stored = localStorage.getItem(`splitview-${key}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // 무시
  }
  return null;
};

const saveSizes = (key: string, sizes: number[]): void => {
  try {
    localStorage.setItem(`splitview-${key}`, JSON.stringify(sizes));
  } catch {
    // 무시
  }
};

const SplitView: React.FC<SplitViewProps> = ({
  direction = 'horizontal',
  panes,
  storageKey,
  onSizesChange,
  className = '',
  splitterSize = 4,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // 초기 크기 계산
  const getInitialSizes = (): number[] => {
    // localStorage에서 복원
    if (storageKey) {
      const saved = getSavedSizes(storageKey);
      if (saved && saved.length === panes.length) {
        return saved;
      }
    }

    // 초기 크기 비율 사용
    const total = panes.reduce((sum, pane) => sum + (pane.initialSize ?? 1 / panes.length), 0);
    return panes.map(pane => (pane.initialSize ?? 1 / panes.length) / total);
  };

  const [sizes, setSizes] = useState<number[]>(getInitialSizes);
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // 드래그 시작 위치 및 크기 저장
  const dragStartRef = useRef<{
    pos: number;
    sizes: number[];
    containerSize: number;
  } | null>(null);

  // 크기 업데이트 (RAF 최적화)
  const updateSizes = useCallback((newSizes: number[]) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      setSizes(newSizes);
      onSizesChange?.(newSizes);
    });
  }, [onSizesChange]);

  // 드래그 중 처리
  const handleDrag = useCallback((clientPos: number) => {
    if (!dragStartRef.current || dragIndex === null || !containerRef.current) return;

    const { pos, sizes: startSizes, containerSize } = dragStartRef.current;
    const delta = clientPos - pos;
    const deltaRatio = delta / containerSize;

    // 최소/최대 크기를 비율로 변환
    const getMinRatio = (index: number): number => {
      const pane = panes[index];
      if (pane.minSize) {
        return pane.minSize / containerSize;
      }
      return 0.05; // 기본 최소 5%
    };

    const getMaxRatio = (index: number): number => {
      const pane = panes[index];
      if (pane.maxSize) {
        return pane.maxSize / containerSize;
      }
      return 0.95; // 기본 최대 95%
    };

    const newSizes = [...startSizes];
    let newSize1 = startSizes[dragIndex] + deltaRatio;
    let newSize2 = startSizes[dragIndex + 1] - deltaRatio;

    // 최소/최대 제한 적용
    const min1 = getMinRatio(dragIndex);
    const max1 = getMaxRatio(dragIndex);
    const min2 = getMinRatio(dragIndex + 1);
    const max2 = getMaxRatio(dragIndex + 1);

    if (newSize1 < min1) {
      const diff = min1 - newSize1;
      newSize1 = min1;
      newSize2 -= diff;
    } else if (newSize1 > max1) {
      const diff = newSize1 - max1;
      newSize1 = max1;
      newSize2 += diff;
    }

    if (newSize2 < min2) {
      const diff = min2 - newSize2;
      newSize2 = min2;
      newSize1 -= diff;
    } else if (newSize2 > max2) {
      const diff = newSize2 - max2;
      newSize2 = max2;
      newSize1 += diff;
    }

    newSizes[dragIndex] = newSize1;
    newSizes[dragIndex + 1] = newSize2;

    updateSizes(newSizes);
  }, [dragIndex, panes, updateSizes]);

  // 마우스 이동 핸들러
  const handleMouseMove = useCallback((e: MouseEvent) => {
    e.preventDefault();
    const clientPos = direction === 'horizontal' ? e.clientX : e.clientY;
    handleDrag(clientPos);
  }, [direction, handleDrag]);

  // 터치 이동 핸들러
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const clientPos = direction === 'horizontal' ? e.touches[0].clientX : e.touches[0].clientY;
    handleDrag(clientPos);
  }, [direction, handleDrag]);

  // 드래그 종료
  const handleDragEnd = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setIsDragging(false);
    setDragIndex(null);
    dragStartRef.current = null;

    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.documentElement.classList.remove('is-resizing');

    // localStorage에 저장
    if (storageKey) {
      saveSizes(storageKey, sizes);
    }
  }, [storageKey, sizes]);

  // 드래그 시작 (마우스)
  const handleMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const containerSize = direction === 'horizontal' ? rect.width : rect.height;
    const clientPos = direction === 'horizontal' ? e.clientX : e.clientY;

    dragStartRef.current = {
      pos: clientPos,
      sizes: [...sizes],
      containerSize,
    };

    setIsDragging(true);
    setDragIndex(index);

    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    document.documentElement.classList.add('is-resizing');

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, [direction, sizes, handleMouseMove, handleDragEnd]);

  // 드래그 시작 (터치)
  const handleTouchStart = useCallback((index: number, e: React.TouchEvent) => {
    if (e.touches.length !== 1 || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const containerSize = direction === 'horizontal' ? rect.width : rect.height;
    const clientPos = direction === 'horizontal' ? e.touches[0].clientX : e.touches[0].clientY;

    dragStartRef.current = {
      pos: clientPos,
      sizes: [...sizes],
      containerSize,
    };

    setIsDragging(true);
    setDragIndex(index);

    document.documentElement.classList.add('is-resizing');

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
    document.addEventListener('touchcancel', handleDragEnd);
  }, [direction, sizes, handleTouchMove, handleDragEnd]);

  // 더블클릭으로 균등 분할
  const handleDoubleClick = useCallback(() => {
    const equalSize = 1 / panes.length;
    const newSizes = panes.map(() => equalSize);
    setSizes(newSizes);
    onSizesChange?.(newSizes);

    if (storageKey) {
      saveSizes(storageKey, newSizes);
    }
  }, [panes.length, onSizesChange, storageKey]);

  // 이벤트 리스너 정리
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleDragEnd);
      document.removeEventListener('touchcancel', handleDragEnd);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleMouseMove, handleTouchMove, handleDragEnd]);

  // panes 개수 변경 시 크기 재계산
  useEffect(() => {
    if (sizes.length !== panes.length) {
      setSizes(getInitialSizes());
    }
  }, [panes.length]);

  // 패널 스타일 계산
  const getPaneStyle = (index: number): React.CSSProperties => {
    const sizePercent = sizes[index] * 100;
    const flexBasis = `calc(${sizePercent}% - ${(splitterSize * (panes.length - 1)) / panes.length}px)`;

    return {
      flexBasis,
      flexGrow: 0,
      flexShrink: 0,
      overflow: 'hidden',
    };
  };

  return (
    <div
      ref={containerRef}
      className={`split-view split-view-${direction} ${className} ${isDragging ? 'is-dragging' : ''}`}
    >
      {panes.map((pane, index) => (
        <React.Fragment key={pane.id}>
          {/* 패널 */}
          <div
            className="split-pane"
            style={getPaneStyle(index)}
            data-pane-id={pane.id}
          >
            {pane.content}
          </div>

          {/* 스플리터 (마지막 패널 제외) */}
          {index < panes.length - 1 && (
            <div
              className={`split-splitter split-splitter-${direction} ${dragIndex === index ? 'is-active' : ''}`}
              style={{
                [direction === 'horizontal' ? 'width' : 'height']: splitterSize,
              }}
              onMouseDown={(e) => handleMouseDown(index, e)}
              onTouchStart={(e) => handleTouchStart(index, e)}
              onDoubleClick={handleDoubleClick}
              title="드래그하여 크기 조절 | 더블클릭으로 균등 분할"
            >
              <div className="split-splitter-line" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default SplitView;
