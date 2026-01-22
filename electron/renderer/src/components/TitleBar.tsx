/**
 * Custom Title Bar Component
 * Windows-style frameless window controls with drag region
 */

import React from 'react';
import './TitleBar.css';

// Import logo
import logoImage from '/no_bg_logo.png';

interface TitleBarProps {
  title: string;
  isMaximized: boolean;
  isFocused: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({
  title,
  isMaximized,
  isFocused,
  onMinimize,
  onMaximize,
  onClose,
}) => {
  return (
    <div className={`titlebar ${!isFocused ? 'unfocused' : ''}`}>
      {/* App Icon */}
      <div className="titlebar-icon no-drag">
        <img src={logoImage} alt="Logo" width="14" height="14" />
      </div>

      {/* Title */}
      <div className="titlebar-title drag-region">
        <span className="title-text">{title}</span>
      </div>

      {/* Window Controls */}
      <div className="titlebar-controls no-drag">
        <button
          className="titlebar-btn minimize"
          onClick={onMinimize}
          title="Minimize"
          aria-label="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        <button
          className="titlebar-btn maximize"
          onClick={onMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                d="M2 0v2H0v8h8V8h2V0H2zm6 8H1V3h7v5zm1-6H3V1h6v5h-1V2z"
                fill="currentColor"
              />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect
                x="0.5"
                y="0.5"
                width="9"
                height="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          )}
        </button>

        <button
          className="titlebar-btn close"
          onClick={onClose}
          title="Close"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4-4-4z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
