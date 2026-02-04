/**
 * ResizablePanel Component
 * 드래그로 크기 조절 가능한 패널
 * - 최소/최대 크기 제한
 * - 더블클릭으로 기본 크기 복원
 * - 패널 접기/펼치기
 * - 60fps 성능 최적화
 * - 터치 디바이스 지원
 */

import React, { useRef, useEffect } from 'react';
import { useResizable, type ResizableConfig } from '../hooks/useResizable';
import { useTranslation } from '../i18n/LanguageContext';
import './ResizablePanel.css';

export type ResizeDirection = 'left' | 'right' | 'top' | 'bottom';

export interface ResizablePanelProps {
  /** 패널 ID (저장용) */
  id: string;
  /** 자식 컴포넌트 */
  children: React.ReactNode;
  /** 리사이즈 방향 */
  direction: ResizeDirection;
  /** 기본 크기 (px) */
  defaultSize?: number;
  /** 최소 크기 (px) */
  minSize?: number;
  /** 최대 크기 (px) */
  maxSize?: number;
  /** 접힌 상태에서의 크기 */
  collapsedSize?: number;
  /** 초기 접힌 상태 */
  defaultCollapsed?: boolean;
  /** 접기 버튼 표시 여부 */
  showCollapseButton?: boolean;
  /** 크기 변경 콜백 */
  onSizeChange?: (size: number) => void;
  /** 접기/펼치기 변경 콜백 */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** 추가 클래스 */
  className?: string;
  /** 비율 기반 크기 조절 */
  useRatio?: boolean;
  /** 헤더 컨텐츠 */
  header?: React.ReactNode;
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  id,
  children,
  direction,
  defaultSize = 300,
  minSize = 100,
  maxSize = 800,
  collapsedSize = 0,
  showCollapseButton = true,
  onSizeChange,
  onCollapsedChange,
  className = '',
  useRatio = false,
  header,
}) => {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // 방향에 따른 orientation 결정
  const orientation: 'horizontal' | 'vertical' =
    direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical';

  // useResizable 훅 사용
  // 부모에서 onCollapsedChange를 전달하면 부모가 visibility를 제어하므로
  // 항상 expanded 상태로 시작 (localStorage 무시)
  const resizableConfig: ResizableConfig = {
    storageKey: `panel-${id}`,
    defaultSize,
    minSize,
    maxSize,
    direction: orientation,
    useRatio,
    initialCollapsed: onCollapsedChange ? false : undefined,
  };

  const {
    size,
    isResizing,
    isCollapsed,
    toggle,
    resetToDefault: _resetToDefault,
    resizeHandleProps,
  } = useResizable(resizableConfig);
  void _resetToDefault; // Suppress unused warning - available for future use

  // 크기 변경 콜백
  useEffect(() => {
    onSizeChange?.(size);
  }, [size, onSizeChange]);

  // 접기/펼치기 변경 콜백 (첫 렌더링 시에는 호출하지 않음 - 부모 상태와 충돌 방지)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onCollapsedChange?.(isCollapsed);
  }, [isCollapsed, onCollapsedChange]);

  // 실제 표시 크기 계산
  const displaySize = isCollapsed ? collapsedSize : size;

  // 스타일 계산
  const panelStyle: React.CSSProperties = {
    [orientation === 'horizontal' ? 'width' : 'height']: displaySize,
    [orientation === 'horizontal' ? 'minWidth' : 'minHeight']: isCollapsed ? collapsedSize : minSize,
    [orientation === 'horizontal' ? 'maxWidth' : 'maxHeight']: isCollapsed ? collapsedSize : maxSize,
  };

  // 리사이즈 핸들 위치 클래스
  const handlePositionClass = `resize-handle-${direction}`;

  // 접기 버튼 아이콘
  const getCollapseIcon = () => {
    if (isCollapsed) {
      // 펼치기 아이콘
      switch (direction) {
        case 'left':
          return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          );
        case 'right':
          return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 6l1.41 1.41L10.83 12l4.58 4.59L14 18l-6-6z" />
            </svg>
          );
        case 'top':
          return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
            </svg>
          );
        case 'bottom':
          return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
            </svg>
          );
      }
    } else {
      // 접기 아이콘
      switch (direction) {
        case 'left':
          return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 6l1.41 1.41L10.83 12l4.58 4.59L14 18l-6-6z" />
            </svg>
          );
        case 'right':
          return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          );
        case 'top':
          return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
            </svg>
          );
        case 'bottom':
          return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
            </svg>
          );
      }
    }
  };

  return (
    <div
      ref={panelRef}
      className={`resizable-panel ${className} ${isResizing ? 'is-resizing' : ''} ${isCollapsed ? 'is-collapsed' : ''} resizable-panel-${direction}`}
      style={panelStyle}
      data-direction={direction}
    >
      {/* 패널 헤더 (옵션) */}
      {(header || showCollapseButton) && (
        <div className="resizable-panel-header">
          <div className="resizable-panel-header-content">
            {header}
          </div>
          {showCollapseButton && (
            <button
              className="resizable-panel-collapse-btn"
              onClick={toggle}
              title={isCollapsed ? t('ui.expandPanel') : t('ui.collapsePanel')}
            >
              {getCollapseIcon()}
            </button>
          )}
        </div>
      )}

      {/* 패널 컨텐츠 */}
      <div className={`resizable-panel-content ${isCollapsed ? 'hidden' : ''}`}>
        {children}
      </div>

      {/* 리사이즈 핸들 */}
      {!isCollapsed && (
        <div
          className={`resize-handle ${handlePositionClass}`}
          {...resizeHandleProps}
          title={t('ui.resizeHint')}
        >
          <div className="resize-handle-indicator" />
        </div>
      )}
    </div>
  );
};

export default ResizablePanel;
