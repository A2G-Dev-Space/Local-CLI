/**
 * Session Browser Component
 * - 세션 목록 표시
 * - 세션 로드/삭제/내보내기
 * - 세션 검색
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { SessionSummary } from '../../../preload/index';
import ConfirmModal from './ConfirmModal';
import './SessionBrowser.css';
import './ConfirmModal.css';

interface SessionBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSession: (sessionId: string) => void;
  onDeleteCurrentSession?: () => void;
  currentSessionId?: string;
}

const SessionBrowser: React.FC<SessionBrowserProps> = ({
  isOpen,
  onClose,
  onLoadSession,
  onDeleteCurrentSession,
  currentSessionId,
}) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; sessionId: string | null }>({
    isOpen: false,
    sessionId: null,
  });

  // 세션 목록 로드
  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.session.list();
      if (result.success && result.sessions) {
        setSessions(result.sessions);
      } else {
        setError(result.error || '세션 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('세션 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 세션 검색
  const searchSessions = useCallback(async (query: string) => {
    if (!query.trim()) {
      loadSessions();
      return;
    }

    setLoading(true);
    try {
      const result = await window.electronAPI.session.search(query);
      if (result.success && result.sessions) {
        setSessions(result.sessions);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [loadSessions]);

  // 세션 삭제 확인 모달 열기
  const handleDeleteSession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, sessionId });
  }, []);

  // 실제 세션 삭제 수행
  const confirmDeleteSession = useCallback(async () => {
    const sessionId = deleteConfirm.sessionId;
    if (!sessionId) return;

    const result = await window.electronAPI.session.delete(sessionId);
    if (result.success) {
      loadSessions();
      if (selectedSession === sessionId) {
        setSelectedSession(null);
      }
      // 현재 세션을 삭제한 경우 부모에게 알림
      if (currentSessionId === sessionId) {
        onDeleteCurrentSession?.();
      }
    }
    setDeleteConfirm({ isOpen: false, sessionId: null });
  }, [deleteConfirm.sessionId, loadSessions, selectedSession, currentSessionId, onDeleteCurrentSession]);

  // 삭제 취소
  const cancelDeleteSession = useCallback(() => {
    setDeleteConfirm({ isOpen: false, sessionId: null });
  }, []);

  // 세션 내보내기
  const handleExportSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const result = await window.electronAPI.session.export(sessionId);
    if (result.success && result.data) {
      // 파일 저장 다이얼로그
      const saveResult = await window.electronAPI.dialog.saveFile({
        title: '세션 내보내기',
        defaultPath: `session-${sessionId}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (saveResult.success && saveResult.filePath) {
        await window.electronAPI.fs.writeFile(saveResult.filePath, result.data);
        await window.electronAPI.dialog.showMessage({
          type: 'info',
          title: '내보내기 완료',
          message: '세션이 성공적으로 내보내졌습니다.',
        });
      }
    }
  }, []);

  // 세션 로드
  const handleLoadSession = useCallback((sessionId: string) => {
    onLoadSession(sessionId);
    onClose();
  }, [onLoadSession, onClose]);

  // 세션 가져오기
  const handleImportSession = useCallback(async () => {
    const result = await window.electronAPI.dialog.openFile({
      title: '세션 가져오기',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (result.success && result.filePath) {
      const fileResult = await window.electronAPI.fs.readFile(result.filePath);
      if (fileResult.success && fileResult.content) {
        const importResult = await window.electronAPI.session.import(fileResult.content);
        if (importResult.success) {
          loadSessions();
          await window.electronAPI.dialog.showMessage({
            type: 'info',
            title: '가져오기 완료',
            message: '세션이 성공적으로 가져와졌습니다.',
          });
        } else {
          await window.electronAPI.dialog.showMessage({
            type: 'error',
            title: '가져오기 실패',
            message: importResult.error || '세션 데이터가 올바르지 않습니다.',
          });
        }
      }
    }
  }, [loadSessions]);

  // 컴포넌트 마운트 시 세션 로드
  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen, loadSessions]);

  // 검색 디바운스
  useEffect(() => {
    const timer = setTimeout(() => {
      searchSessions(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchSessions]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 날짜 포맷팅
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="session-browser-backdrop" onClick={onClose}>
      <div className="session-browser" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="session-browser-header">
          <h2>세션 목록</h2>
          <button className="session-browser-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="session-browser-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.25 0a8.25 8.25 0 0 0-6.18 13.72L1 22.88l1.12 1.12 8.16-8.07A8.25 8.25 0 1 0 15.25.01V0zm0 15a6.75 6.75 0 1 1 0-13.5 6.75 6.75 0 0 1 0 13.5z"/>
          </svg>
          <input
            type="text"
            placeholder="세션 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Session List */}
        <div className="session-browser-list">
          {loading ? (
            <div className="session-browser-loading">
              <div className="loading-spinner" />
              <span>세션 로딩 중...</span>
            </div>
          ) : error ? (
            <div className="session-browser-error">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span>{error}</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="session-browser-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
              </svg>
              <span>저장된 세션이 없습니다</span>
              <p>새 세션을 시작하면 자동으로 저장됩니다.</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`session-item ${selectedSession === session.id ? 'selected' : ''} ${currentSessionId === session.id ? 'current' : ''}`}
                onClick={() => setSelectedSession(session.id)}
                onDoubleClick={() => handleLoadSession(session.id)}
              >
                <div className="session-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                  </svg>
                </div>
                <div className="session-item-content">
                  <div className="session-item-header">
                    <span className="session-item-name">{session.name}</span>
                    {currentSessionId === session.id && (
                      <span className="session-item-badge">현재</span>
                    )}
                  </div>
                  <div className="session-item-meta">
                    <span className="session-item-date">{formatDate(session.updatedAt)}</span>
                    <span className="session-item-messages">{session.messageCount}개 메시지</span>
                  </div>
                  {session.preview && (
                    <div className="session-item-preview">{session.preview}</div>
                  )}
                  {session.workingDirectory && (
                    <div className="session-item-directory">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                      </svg>
                      <span>{session.workingDirectory}</span>
                    </div>
                  )}
                </div>
                <div className="session-item-actions">
                  <button
                    className="session-action-btn"
                    onClick={(e) => handleExportSession(session.id, e)}
                    title="내보내기"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                  </button>
                  <button
                    className="session-action-btn delete"
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    title="삭제"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="session-browser-footer">
          <button className="session-browser-btn secondary" onClick={handleImportSession}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
            </svg>
            가져오기
          </button>
          <div className="session-browser-footer-spacer" />
          <button
            className="session-browser-btn primary"
            onClick={() => selectedSession && handleLoadSession(selectedSession)}
            disabled={!selectedSession}
          >
            세션 열기
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="세션 삭제"
        message="이 세션을 삭제하시겠습니까?"
        detail="삭제된 세션은 복구할 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
        type="danger"
        onConfirm={confirmDeleteSession}
        onCancel={cancelDeleteSession}
      />
    </div>
  );
};

export default SessionBrowser;
