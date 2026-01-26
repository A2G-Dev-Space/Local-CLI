/**
 * DocsBrowser Component
 * Browse and download local documentation
 * Based on CLI's docs-manager feature
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import './DocsBrowser.css';

interface DocsSource {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  fileCount?: number;
  size?: string;
}

interface DocsInfo {
  path: string;
  exists: boolean;
  totalFiles: number;
  totalSize: string;
  sources: DocsSource[];
}

interface DocsBrowserProps {
  isOpen: boolean;
  onClose: () => void;
}

// Available documentation sources (matching CLI)
const AVAILABLE_SOURCES: Omit<DocsSource, 'installed' | 'fileCount' | 'size'>[] = [
  {
    id: 'agno',
    name: 'Agno Framework',
    description: 'AI Agent Framework documentation - agents, memory, RAG, tools, workflows',
  },
  {
    id: 'adk',
    name: 'Google ADK',
    description: 'Google Agent Development Kit - agents, tools, sessions, deploy',
  },
];

const DocsBrowser: React.FC<DocsBrowserProps> = ({ isOpen, onClose }) => {
  const [docsInfo, setDocsInfo] = useState<DocsInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingSource, setDownloadingSource] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    downloaded: number;
    total: number;
    current?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load docs info
  const loadDocsInfo = useCallback(async () => {
    if (!window.electronAPI?.docs) {
      // Fallback: docs API not available yet
      setDocsInfo({
        path: '~/.local-cli/docs',
        exists: false,
        totalFiles: 0,
        totalSize: '0 B',
        sources: AVAILABLE_SOURCES.map(s => ({ ...s, installed: false })),
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.electronAPI.docs.getInfo();
      if (result.success && result.info) {
        setDocsInfo(result.info);
      } else {
        setError(result.error || 'Failed to load docs info');
      }
    } catch (err) {
      window.electronAPI?.log?.error('[DocsBrowser] Failed to load docs info', { error: err instanceof Error ? err.message : String(err) });
      setError('Failed to load documentation info');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Download documentation
  const handleDownload = useCallback(async (sourceId: string) => {
    if (!window.electronAPI?.docs) {
      setError('Docs API not available');
      return;
    }

    setDownloadingSource(sourceId);
    setDownloadProgress({ downloaded: 0, total: 0 });
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await window.electronAPI.docs.download(sourceId, (progress) => {
        setDownloadProgress(progress);
      });

      if (result.success) {
        setSuccessMessage(`Downloaded ${result.downloadedFiles} files to ${result.targetPath}`);
        await loadDocsInfo(); // Refresh
      } else {
        setError(result.message || 'Download failed');
      }
    } catch (err) {
      window.electronAPI?.log?.error('[DocsBrowser] Download failed', { error: err instanceof Error ? err.message : String(err) });
      setError('Download failed. Check your internet connection.');
    } finally {
      setDownloadingSource(null);
      setDownloadProgress(null);
    }
  }, [loadDocsInfo]);

  // Open docs folder
  const handleOpenFolder = useCallback(async () => {
    if (window.electronAPI?.docs) {
      await window.electronAPI.docs.openFolder();
    }
  }, []);

  // Delete docs source
  const handleDelete = useCallback(async (sourceId: string) => {
    if (!window.electronAPI?.docs) return;

    const confirmed = window.confirm(`Delete all ${sourceId} documentation?`);
    if (!confirmed) return;

    try {
      const result = await window.electronAPI.docs.delete(sourceId);
      if (result.success) {
        setSuccessMessage(`Deleted ${sourceId} documentation`);
        await loadDocsInfo();
      } else {
        setError(result.error || 'Delete failed');
      }
    } catch (err) {
      setError('Delete failed');
    }
  }, [loadDocsInfo]);

  // Load on open
  useEffect(() => {
    if (isOpen) {
      loadDocsInfo();
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, loadDocsInfo]);

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="docs-browser-backdrop" onClick={onClose}>
      <div className="docs-browser" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="docs-browser-header">
          <div className="docs-browser-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
            </svg>
            <span>Documentation</span>
          </div>
          <button className="docs-browser-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="docs-message error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            {error}
          </div>
        )}
        {successMessage && (
          <div className="docs-message success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            {successMessage}
          </div>
        )}

        {/* Content */}
        <div className="docs-browser-content">
          {isLoading ? (
            <div className="docs-loading">
              <div className="docs-spinner" />
              <span>Loading...</span>
            </div>
          ) : (
            <>
              {/* Stats */}
              {docsInfo && (
                <div className="docs-stats">
                  <div className="docs-stat">
                    <span className="docs-stat-value">{docsInfo.totalFiles}</span>
                    <span className="docs-stat-label">Files</span>
                  </div>
                  <div className="docs-stat">
                    <span className="docs-stat-value">{docsInfo.totalSize}</span>
                    <span className="docs-stat-label">Total Size</span>
                  </div>
                  <button className="docs-open-folder" onClick={handleOpenFolder} title="Open in Explorer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                    Open Folder
                  </button>
                </div>
              )}

              {/* Sources List */}
              <div className="docs-sources">
                <h3>Available Documentation</h3>
                {docsInfo?.sources.map((source) => (
                  <div key={source.id} className={`docs-source ${source.installed ? 'installed' : ''}`}>
                    <div className="docs-source-info">
                      <div className="docs-source-header">
                        <span className="docs-source-name">{source.name}</span>
                        {source.installed && (
                          <span className="docs-source-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                            Installed
                          </span>
                        )}
                      </div>
                      <p className="docs-source-description">{source.description}</p>
                      {source.installed && source.fileCount && (
                        <span className="docs-source-meta">
                          {source.fileCount} files • {source.size}
                        </span>
                      )}
                    </div>
                    <div className="docs-source-actions">
                      {downloadingSource === source.id ? (
                        <div className="docs-download-progress">
                          <div className="docs-progress-bar">
                            <div
                              className="docs-progress-fill"
                              style={{
                                width: downloadProgress?.total
                                  ? `${(downloadProgress.downloaded / downloadProgress.total) * 100}%`
                                  : '0%'
                              }}
                            />
                          </div>
                          <span className="docs-progress-text">
                            {downloadProgress?.downloaded || 0} / {downloadProgress?.total || '?'}
                          </span>
                        </div>
                      ) : source.installed ? (
                        <>
                          <button
                            className="docs-btn docs-btn-secondary"
                            onClick={() => handleDownload(source.id)}
                            title="Re-download"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                            </svg>
                            Update
                          </button>
                          <button
                            className="docs-btn docs-btn-danger"
                            onClick={() => handleDelete(source.id)}
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </>
                      ) : (
                        <button
                          className="docs-btn docs-btn-primary"
                          onClick={() => handleDownload(source.id)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                          </svg>
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Info */}
              <div className="docs-info-footer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/>
                </svg>
                <span>
                  Documentation is stored in <code>~/.local-cli/docs</code> and used by the AI assistant for context-aware answers.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(DocsBrowser);
