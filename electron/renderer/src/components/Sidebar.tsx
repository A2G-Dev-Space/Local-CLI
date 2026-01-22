/**
 * Sidebar Component
 * Resizable sidebar container with header
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import './Sidebar.css';

interface SidebarProps {
  width: number;
  onResize: (width: number) => void;
  title: string;
  children: React.ReactNode;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;

const Sidebar: React.FC<SidebarProps> = ({
  width,
  onResize,
  title,
  children,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const rect = sidebar.getBoundingClientRect();
    const newWidth = e.clientX - rect.left + 48; // 48px for activity bar

    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      onResize(newWidth);
    }
  }, [isResizing, onResize]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={sidebarRef}
      className={`sidebar ${isResizing ? 'resizing' : ''}`}
      style={{ width }}
    >
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <span className="sidebar-title">{title}</span>
        <div className="sidebar-actions">
          <button className="sidebar-action-btn" title="Collapse All">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
              <path d="M7 11h10v2H7z"/>
            </svg>
          </button>
          <button className="sidebar-action-btn" title="More Actions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar Content */}
      <div className="sidebar-content">
        {children}
      </div>

      {/* Resize Handle */}
      <div
        className="sidebar-resize-handle"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

export default Sidebar;
