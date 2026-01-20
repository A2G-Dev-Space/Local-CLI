/**
 * LogViewer Component
 * - Linux CLI 스타일 로그 뷰어
 * - 실시간 로그 스트리밍
 * - 로그 레벨별 필터링/검색
 * - 로그 파일 관리 (열기/다운로드/삭제)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { LogFile, LogEntry } from '../../../preload/index';
import './LogViewer.css';

// 로그 레벨 정의
const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const;
type LogLevelName = typeof LOG_LEVELS[number];

// 로그 레벨 색상 (Linux CLI 스타일)
const LOG_LEVEL_COLORS: Record<LogLevelName, string> = {
  DEBUG: '#6b7280',   // gray
  INFO: '#38BDF8',    // sky blue
  WARN: '#f59e0b',    // amber
  ERROR: '#ef4444',   // red
  FATAL: '#dc2626',   // dark red
};

// 로그 레벨 아이콘
const LOG_LEVEL_ICONS: Record<LogLevelName, string> = {
  DEBUG: '[D]',
  INFO: '[I]',
  WARN: '[W]',
  ERROR: '[E]',
  FATAL: '[F]',
};

interface LogViewerProps {
  isVisible?: boolean;
  onClose?: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ isVisible = true, onClose }) => {
  // 상태
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<LogFile | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [streamingEntries, setStreamingEntries] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<Set<LogLevelName>>(new Set(LOG_LEVELS));
  const [showTimestamp, setShowTimestamp] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [wrapLines, setWrapLines] = useState(false);

  // 뷰 모드: 'file' | 'live'
  const [viewMode, setViewMode] = useState<'file' | 'live'>('live');

  // 현재 로그 레벨
  const [currentLogLevel, setCurrentLogLevel] = useState(1); // INFO

  // Refs
  const logContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 로그 파일 목록 로드
  const loadLogFiles = useCallback(async () => {
    if (!window.electronAPI?.log) {
      setError('Log API not available');
      return;
    }

    try {
      const files = await window.electronAPI.log.getFiles();
      setLogFiles(files);
      if (files.length > 0 && !selectedFile) {
        setSelectedFile(files[0]); // 최신 파일 선택
      }
    } catch (err) {
      setError('Failed to load log files');
      console.error(err);
    }
  }, [selectedFile]);

  // 로그 파일 내용 로드
  const loadLogEntries = useCallback(async (file: LogFile) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.log.readEntries(file.path);
      if (result.success && result.entries) {
        setLogEntries(result.entries);
      } else {
        setError(result.error || 'Failed to read log file');
      }
    } catch (err) {
      setError('Failed to load log entries');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 실시간 스트리밍 시작
  const startStreaming = useCallback(async () => {
    try {
      await window.electronAPI.log.startStreaming();
      setIsStreaming(true);
      setStreamingEntries([]);
    } catch (err) {
      setError('Failed to start streaming');
      console.error(err);
    }
  }, []);

  // 실시간 스트리밍 중지
  const stopStreaming = useCallback(async () => {
    try {
      await window.electronAPI.log.stopStreaming();
      setIsStreaming(false);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 로그 파일 삭제
  const deleteLogFile = useCallback(async (file: LogFile) => {
    const confirmed = window.confirm(`Delete log file: ${file.name}?`);
    if (!confirmed) return;

    try {
      const result = await window.electronAPI.log.deleteFile(file.path);
      if (result.success) {
        await loadLogFiles();
        if (selectedFile?.path === file.path) {
          setSelectedFile(null);
          setLogEntries([]);
        }
      } else {
        setError(result.error || 'Failed to delete log file');
      }
    } catch (err) {
      setError('Failed to delete log file');
      console.error(err);
    }
  }, [loadLogFiles, selectedFile]);

  // 모든 로그 삭제
  const clearAllLogs = useCallback(async () => {
    const confirmed = window.confirm('Delete all old log files? (Current log will be kept)');
    if (!confirmed) return;

    try {
      const result = await window.electronAPI.log.clearAll();
      if (result.success) {
        await loadLogFiles();
      } else {
        setError(result.error || 'Failed to clear logs');
      }
    } catch (err) {
      setError('Failed to clear logs');
      console.error(err);
    }
  }, [loadLogFiles]);

  // 로그 폴더 열기
  const openLogDirectory = useCallback(async () => {
    await window.electronAPI.log.openDirectory();
  }, []);

  // 로그 파일 탐색기에서 열기
  const openInExplorer = useCallback(async (file: LogFile) => {
    await window.electronAPI.log.openInExplorer(file.path);
  }, []);

  // 로그 레벨 설정
  const setLogLevel = useCallback(async (level: number) => {
    await window.electronAPI.log.setLevel(level);
    setCurrentLogLevel(level);
  }, []);

  // 초기화
  useEffect(() => {
    if (isVisible) {
      loadLogFiles();
      window.electronAPI.log.getLevel().then(setCurrentLogLevel);
    }
  }, [isVisible, loadLogFiles]);

  // 파일 선택 시 로드
  useEffect(() => {
    if (selectedFile && viewMode === 'file') {
      loadLogEntries(selectedFile);
    }
  }, [selectedFile, viewMode, loadLogEntries]);

  // 실시간 스트리밍 이벤트 구독
  useEffect(() => {
    if (viewMode === 'live' && isVisible) {
      startStreaming();
    } else {
      stopStreaming();
    }

    const unsubscribe = window.electronAPI.log.onEntry((entry: LogEntry) => {
      if (viewMode === 'live') {
        setStreamingEntries(prev => {
          const newEntries = [...prev, entry];
          // 최대 1000개 유지
          if (newEntries.length > 1000) {
            return newEntries.slice(-1000);
          }
          return newEntries;
        });
      }
    });

    return () => {
      unsubscribe();
      stopStreaming();
    };
  }, [viewMode, isVisible, startStreaming, stopStreaming]);

  // 자동 스크롤
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [streamingEntries, logEntries, autoScroll]);

  // 현재 표시할 로그 엔트리
  const displayEntries = useMemo(() => {
    const entries = viewMode === 'live' ? streamingEntries : logEntries;

    return entries.filter(entry => {
      // 레벨 필터
      const level = entry.level as LogLevelName;
      if (!levelFilter.has(level)) return false;

      // 검색 필터
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchMessage = entry.message.toLowerCase().includes(query);
        const matchData = entry.data ? JSON.stringify(entry.data).toLowerCase().includes(query) : false;
        if (!matchMessage && !matchData) return false;
      }

      return true;
    });
  }, [viewMode, streamingEntries, logEntries, levelFilter, searchQuery]);

  // 레벨 필터 토글
  const toggleLevelFilter = useCallback((level: LogLevelName) => {
    setLevelFilter(prev => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  }, []);

  // 모든 레벨 선택/해제
  const _toggleAllLevels = useCallback(() => {
    if (levelFilter.size === LOG_LEVELS.length) {
      setLevelFilter(new Set(['ERROR', 'FATAL']));
    } else {
      setLevelFilter(new Set(LOG_LEVELS));
    }
  }, [levelFilter.size]);
  void _toggleAllLevels; // Suppress unused warning

  // 검색 포커스
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f' && isVisible) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  // 타임스탬프 포맷
  const formatTimestamp = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  }, []);

  // 파일 사이즈 포맷
  const formatSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  if (!isVisible) return null;

  return (
    <div className="log-viewer">
      {/* 헤더 */}
      <div className="log-viewer-header">
        <div className="log-viewer-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
            <path d="M8 12h8v2H8zm0 4h8v2H8z"/>
          </svg>
          <span>Log Viewer</span>
          {isStreaming && <span className="streaming-badge">LIVE</span>}
        </div>
        <div className="log-viewer-actions">
          <button
            className="log-action-btn"
            onClick={openLogDirectory}
            title="Open Log Folder"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
            </svg>
          </button>
          <button
            className="log-action-btn"
            onClick={clearAllLogs}
            title="Clear Old Logs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
          {onClose && (
            <button className="log-close-btn" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 툴바 */}
      <div className="log-viewer-toolbar">
        {/* 뷰 모드 토글 */}
        <div className="log-view-mode">
          <button
            className={`mode-btn ${viewMode === 'live' ? 'active' : ''}`}
            onClick={() => setViewMode('live')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10"/>
            </svg>
            Live
          </button>
          <button
            className={`mode-btn ${viewMode === 'file' ? 'active' : ''}`}
            onClick={() => setViewMode('file')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
            </svg>
            File
          </button>
        </div>

        {/* 파일 선택 (File 모드) */}
        {viewMode === 'file' && (
          <select
            className="log-file-select"
            value={selectedFile?.path || ''}
            onChange={(e) => {
              const file = logFiles.find(f => f.path === e.target.value);
              setSelectedFile(file || null);
            }}
          >
            {logFiles.map(file => (
              <option key={file.path} value={file.path}>
                {file.name} ({formatSize(file.size)})
              </option>
            ))}
          </select>
        )}

        {/* 검색 */}
        <div className="log-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search logs... (Ctrl+F)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
        </div>

        {/* 레벨 필터 */}
        <div className="log-level-filters">
          {LOG_LEVELS.map(level => (
            <button
              key={level}
              className={`level-filter-btn ${levelFilter.has(level) ? 'active' : ''}`}
              style={{ '--level-color': LOG_LEVEL_COLORS[level] } as React.CSSProperties}
              onClick={() => toggleLevelFilter(level)}
              title={level}
            >
              {level.charAt(0)}
            </button>
          ))}
        </div>

        {/* 옵션 */}
        <div className="log-options">
          <button
            className={`option-btn ${showTimestamp ? 'active' : ''}`}
            onClick={() => setShowTimestamp(!showTimestamp)}
            title="Show Timestamp"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
            </svg>
          </button>
          <button
            className={`option-btn ${autoScroll ? 'active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title="Auto Scroll"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 13h-3V3h-2v10H8l4 4 4-4zM4 19v2h16v-2H4z"/>
            </svg>
          </button>
          <button
            className={`option-btn ${wrapLines ? 'active' : ''}`}
            onClick={() => setWrapLines(!wrapLines)}
            title="Wrap Lines"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 19h6v-2H4v2zM20 5H4v2h16V5zm-3 6H4v2h13.25c1.1 0 2 .9 2 2s-.9 2-2 2H15v-2l-3 3 3 3v-2h2c2.21 0 4-1.79 4-4s-1.79-4-4-4z"/>
            </svg>
          </button>
        </div>

        {/* 로그 레벨 설정 */}
        <div className="log-level-setting">
          <span>Level:</span>
          <select
            value={currentLogLevel}
            onChange={(e) => setLogLevel(Number(e.target.value))}
          >
            <option value={0}>DEBUG</option>
            <option value={1}>INFO</option>
            <option value={2}>WARN</option>
            <option value={3}>ERROR</option>
            <option value={4}>FATAL</option>
          </select>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="log-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* 로그 컨텐츠 */}
      <div
        ref={logContainerRef}
        className={`log-content ${wrapLines ? 'wrap' : ''}`}
      >
        {isLoading && (
          <div className="log-loading">
            <div className="spinner" />
            Loading logs...
          </div>
        )}

        {!isLoading && displayEntries.length === 0 && (
          <div className="log-empty">
            {viewMode === 'live' ? (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
                <span>Waiting for logs...</span>
                <span className="hint">Logs will appear here in real-time</span>
              </>
            ) : (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                </svg>
                <span>No log entries found</span>
                <span className="hint">Select a different file or adjust filters</span>
              </>
            )}
          </div>
        )}

        {displayEntries.map((entry, index) => {
          const level = entry.level as LogLevelName;
          return (
            <div
              key={`${entry.timestamp}-${index}`}
              className={`log-entry log-level-${level.toLowerCase()}`}
              style={{ '--level-color': LOG_LEVEL_COLORS[level] } as React.CSSProperties}
            >
              {showTimestamp && (
                <span className="log-timestamp">
                  {formatTimestamp(entry.timestamp)}
                </span>
              )}
              <span className="log-level">{LOG_LEVEL_ICONS[level]}</span>
              <span className="log-message">{entry.message}</span>
              {entry.data !== undefined && entry.data !== null && (
                <span className="log-data">
                  {typeof entry.data === 'object'
                    ? JSON.stringify(entry.data, null, 2)
                    : String(entry.data as string | number | boolean)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 푸터 - 통계 */}
      <div className="log-viewer-footer">
        <span className="log-count">
          {displayEntries.length} entries
          {viewMode === 'live' && ` (${streamingEntries.length} total)`}
        </span>
        {viewMode === 'file' && selectedFile && (
          <div className="log-file-actions">
            <button onClick={() => openInExplorer(selectedFile)} title="Show in Explorer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
              </svg>
            </button>
            <button onClick={() => loadLogEntries(selectedFile)} title="Refresh">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
            </button>
            <button onClick={() => deleteLogFile(selectedFile)} title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
