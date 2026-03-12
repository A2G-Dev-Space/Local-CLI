/**
 * Custom Title Bar Component
 * Windows-style frameless window controls with drag region
 */

import React from 'react';
import { useTranslation } from '../i18n/LanguageContext';
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
  planDisplayName?: string | null;
  simplified?: boolean; // Task window: hides maximize button and DEV badge
  isPinned?: boolean; // Task window: always on top
  onPinToggle?: () => void; // Task window: toggle always on top
}

const TitleBar: React.FC<TitleBarProps> = ({
  title,
  isMaximized,
  isFocused,
  onMinimize,
  onMaximize,
  onClose,
  planDisplayName,
  simplified = false,
  isPinned = false,
  onPinToggle,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`titlebar ${!isFocused ? 'unfocused' : ''}`}>
      {/* App Icon */}
      <div className="titlebar-icon no-drag">
        <img src={logoImage} alt="Logo" width="14" height="14" />
      </div>

      {/* Title */}
      <div className="titlebar-title drag-region">
        <span className="title-text">{title}</span>
        {!simplified && <span className="title-dev-badge">DEV</span>}
        {planDisplayName && (
          <span className="title-plan-badge">{planDisplayName}</span>
        )}
      </div>

      {/* Window Controls */}
      <div className="titlebar-controls no-drag">
        {/* Pin button - only for simplified (Task) window */}
        {simplified && onPinToggle && (
          <button
            className={`titlebar-btn pin ${isPinned ? 'active' : ''}`}
            onClick={onPinToggle}
            title={isPinned ? t('titlebar.unpin') : t('titlebar.pin')}
            aria-label={isPinned ? t('titlebar.unpin') : t('titlebar.pin')}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              {isPinned ? (
                // Filled pin icon (active)
                <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
              ) : (
                // Outline pin icon (inactive)
                <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12M8.8,14L10,12.8V4H14V12.8L15.2,14H8.8Z" />
              )}
            </svg>
          </button>
        )}

        <button
          className="titlebar-btn minimize"
          onClick={onMinimize}
          title={t('titlebar.minimize')}
          aria-label={t('titlebar.minimize')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        {!simplified && (
          <button
            className="titlebar-btn maximize"
            onClick={onMaximize}
            title={isMaximized ? t('titlebar.restore') : t('titlebar.maximize')}
            aria-label={isMaximized ? t('titlebar.restore') : t('titlebar.maximize')}
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
        )}

        <button
          className="titlebar-btn close"
          onClick={onClose}
          title={t('titlebar.close')}
          aria-label={t('titlebar.close')}
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
