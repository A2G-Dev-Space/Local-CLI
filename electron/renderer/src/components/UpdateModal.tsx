/**
 * Update Modal Component
 * 앱 업데이트 알림 및 진행률 표시
 */

import React, { useEffect, useRef, memo, useState } from 'react';
import './UpdateModal.css';

interface UpdateInfo {
  version: string;
  releaseNotes?: string | { note?: string | null }[];
  releaseDate?: string;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

interface UpdateModalProps {
  isOpen: boolean;
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available';
  updateInfo?: UpdateInfo;
  progress?: DownloadProgress;
  error?: string;
  onInstall: () => void;
  onLater: () => void;
  onClose: () => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatSpeed = (bytesPerSecond: number): string => {
  return formatBytes(bytesPerSecond) + '/s';
};

const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  status,
  updateInfo,
  progress,
  error,
  onInstall,
  onLater,
  onClose,
}) => {
  const installRef = useRef<HTMLButtonElement>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  // Get current app version
  useEffect(() => {
    window.electronAPI?.update?.getVersion?.().then(setCurrentVersion);
  }, []);

  // Focus install button when downloaded
  useEffect(() => {
    if (isOpen && status === 'downloaded' && installRef.current) {
      installRef.current.focus();
    }
  }, [isOpen, status]);

  // ESC key to close (except during download)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && status !== 'downloading') {
        onClose();
      } else if (e.key === 'Enter' && status === 'downloaded') {
        onInstall();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, status, onInstall, onClose]);

  if (!isOpen) return null;

  const parseReleaseNotes = (notes?: string | { note?: string | null }[]): string => {
    if (!notes) return '';
    if (typeof notes === 'string') return notes;
    if (Array.isArray(notes)) {
      return notes.map(n => n.note || '').filter(Boolean).join('\n');
    }
    return '';
  };

  const renderContent = () => {
    switch (status) {
      case 'checking':
        return (
          <>
            <div className="update-modal-icon update-modal-icon-checking">
              <svg className="update-modal-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            </div>
            <h2 className="update-modal-title">업데이트 확인 중</h2>
            <p className="update-modal-message">새로운 버전이 있는지 확인하고 있습니다...</p>
          </>
        );

      case 'not-available':
        return (
          <>
            <div className="update-modal-icon update-modal-icon-success">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h2 className="update-modal-title">최신 버전입니다</h2>
            <p className="update-modal-message">현재 v{currentVersion}을 사용 중입니다.</p>
          </>
        );

      case 'available':
      case 'downloading':
        return (
          <>
            <div className="update-modal-icon update-modal-icon-update">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            </div>
            <h2 className="update-modal-title">
              {status === 'downloading' ? '업데이트 다운로드 중' : '새 업데이트 발견'}
            </h2>
            <div className="update-modal-version-info">
              <span className="update-modal-version-current">v{currentVersion}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
              </svg>
              <span className="update-modal-version-new">v{updateInfo?.version}</span>
            </div>
            {status === 'available' && (
              <p className="update-modal-message">
                최신 버전으로 업데이트하여 새로운 기능과 개선된 성능을 경험하세요.
              </p>
            )}
            {status === 'downloading' && progress && (
              <div className="update-modal-progress">
                <div className="update-modal-progress-bar">
                  <div
                    className="update-modal-progress-fill"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="update-modal-progress-info">
                  <span>{formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
                  <span>{formatSpeed(progress.bytesPerSecond)}</span>
                </div>
              </div>
            )}
            {parseReleaseNotes(updateInfo?.releaseNotes) && (
              <div className="update-modal-notes">
                <strong>변경사항:</strong>
                <p>{parseReleaseNotes(updateInfo?.releaseNotes)}</p>
              </div>
            )}
          </>
        );

      case 'downloaded':
        return (
          <>
            <div className="update-modal-icon update-modal-icon-ready">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h2 className="update-modal-title">업데이트 준비 완료</h2>
            <div className="update-modal-version-info">
              <span className="update-modal-version-current">v{currentVersion}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
              </svg>
              <span className="update-modal-version-new">v{updateInfo?.version}</span>
            </div>
            <p className="update-modal-message">
              업데이트를 설치하여 최신 기능과 최적의 성능을 사용하세요.
            </p>
            <p className="update-modal-message update-modal-restart-notice">
              지금 설치하면 앱이 자동으로 재시작됩니다.
            </p>
          </>
        );

      case 'error':
        return (
          <>
            <div className="update-modal-icon update-modal-icon-error">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </div>
            <h2 className="update-modal-title">업데이트 오류</h2>
            <p className="update-modal-message update-modal-error">{error || '업데이트 중 오류가 발생했습니다.'}</p>
          </>
        );

      default:
        return null;
    }
  };

  const renderActions = () => {
    switch (status) {
      case 'checking':
      case 'downloading':
        return null; // No actions during these states

      case 'not-available':
      case 'error':
        return (
          <button className="update-modal-btn update-modal-btn-primary" onClick={onClose}>
            확인
          </button>
        );

      case 'available':
        return (
          <>
            <button className="update-modal-btn update-modal-btn-secondary" onClick={onLater}>
              나중에
            </button>
            <button className="update-modal-btn update-modal-btn-primary" onClick={onClose}>
              백그라운드에서 다운로드
            </button>
          </>
        );

      case 'downloaded':
        return (
          <>
            <button className="update-modal-btn update-modal-btn-secondary" onClick={onLater}>
              나중에
            </button>
            <button
              ref={installRef}
              className="update-modal-btn update-modal-btn-primary update-modal-btn-install"
              onClick={onInstall}
            >
              지금 설치
            </button>
          </>
        );

      default:
        return null;
    }
  };

  const canClose = status !== 'downloading' && status !== 'checking';

  return (
    <div className="update-modal-backdrop" onClick={canClose ? onClose : undefined}>
      <div
        className="update-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
      >
        <div className="update-modal-content">
          {renderContent()}
        </div>

        {(() => {
          const actions = renderActions();
          return actions && (
            <div className="update-modal-actions">
              {actions}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default memo(UpdateModal);
