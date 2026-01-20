/**
 * File Explorer Component
 * Tree view file browser with context menu and drag & drop
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { FileNode } from '../App';
import './FileExplorer.css';

interface FileExplorerProps {
  files: FileNode[];
  currentDirectory: string;
  onFileOpen: (path: string, name: string) => void;
  onDirectoryChange: (path: string) => void;
  onRefresh: () => void;
}

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  node: FileNode | null;
}

// File icons by extension
const getFileIcon = (name: string, isFolder: boolean): React.ReactNode => {
  if (isFolder) {
    return (
      <svg className="file-icon folder" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
      </svg>
    );
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';

  // TypeScript/JavaScript
  if (['ts', 'tsx'].includes(ext)) {
    return (
      <svg className="file-icon typescript" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 3h18v18H3V3zm10.71 14.29c.18.19.43.29.71.29.14 0 .28-.03.41-.08.39-.15.65-.53.65-.95V10h-2v5.59l-2.29-2.3c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.02 0 1.41l3.29 3.29c.18.19.43.3.7.3h.07z"/>
      </svg>
    );
  }

  if (['js', 'jsx', 'mjs'].includes(ext)) {
    return (
      <svg className="file-icon javascript" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 3h18v18H3V3zm4.5 14c.83 0 1.5-.67 1.5-1.5v-4c0-.28.22-.5.5-.5s.5.22.5.5V15h2v-3.5c0-1.38-1.12-2.5-2.5-2.5S7 10.12 7 11.5V15h.5c0 .83.67 2 1.5 2zm9-2h-3v-2h3v-2h-3V9h3V7h-5v12h5v-4z"/>
      </svg>
    );
  }

  // Python
  if (['py', 'pyw'].includes(ext)) {
    return (
      <svg className="file-icon python" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8.8 2 8 3.1 8 5v2h4v1H6c-1.7 0-3 1.8-3 4 0 2.2 1.3 4 3 4h2v-2c0-1.7 1.3-3 3-3h4c1.1 0 2-.9 2-2V5c0-1.9-1.3-3-4-3H12zm-1.5 2a1 1 0 110 2 1 1 0 010-2zM6 12c0-1.1.9-2 2-2h1v2c0 1.7-1.3 3-3 3v-3zm10 3c0 1.1-.9 2-2 2h-1v-2c0-1.7 1.3-3 3-3v3z"/>
      </svg>
    );
  }

  // PowerShell
  if (['ps1', 'psm1', 'psd1'].includes(ext)) {
    return (
      <svg className="file-icon powershell" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 11h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z"/>
      </svg>
    );
  }

  // JSON
  if (ext === 'json') {
    return (
      <svg className="file-icon json" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 3h2v2H5v5a2 2 0 01-2 2 2 2 0 012 2v5h2v2H5c-1.07-.27-2-.9-2-2v-4a2 2 0 00-2-2H0v-2h1a2 2 0 002-2V5a2 2 0 012-2zm14 0a2 2 0 012 2v4a2 2 0 002 2h1v2h-1a2 2 0 00-2 2v4a2 2 0 01-2 2h-2v-2h2v-5a2 2 0 012-2 2 2 0 01-2-2V5h-2V3h2z"/>
      </svg>
    );
  }

  // HTML
  if (['html', 'htm'].includes(ext)) {
    return (
      <svg className="file-icon html" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 3l1.6 16.4L12 22l6.4-2.6L20 3H4zm13.2 5H8.4l.2 2h8.4l-.6 7-4.4 1.2-4.4-1.2-.3-3h2l.2 1.5 2.5.6 2.5-.6.3-3H7.8L7 5h10l-.8 3z"/>
      </svg>
    );
  }

  // CSS/SCSS
  if (['css', 'scss', 'sass', 'less'].includes(ext)) {
    return (
      <svg className="file-icon css" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 3l1.6 16.4L12 22l6.4-2.6L20 3H4zm11.4 6H8.2l.2 2h6.8l-.6 7-2.6.8-2.6-.8-.2-2h-2l.4 4L12 20l4.6-1.4.8-9.6H8.6l-.2-2h9l.2-2H6.8L7 5h10l-.6 4z"/>
      </svg>
    );
  }

  // Markdown
  if (['md', 'markdown'].includes(ext)) {
    return (
      <svg className="file-icon markdown" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 4H2v16h20V4zM7 15v-4.3l2 2.3 2-2.3V15h2V9h-2l-2 2.3L7 9H5v6h2zm8-2h3l-4 4-4-4h3V9h2v4z"/>
      </svg>
    );
  }

  // Git
  if (name === '.gitignore' || name === '.gitattributes') {
    return (
      <svg className="file-icon git" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.62 11.11l-8.73-8.73a1.32 1.32 0 00-1.86 0L9.07 4.34l2.34 2.34a1.56 1.56 0 012 2l2.26 2.26a1.56 1.56 0 11-.93.93L12.5 9.63v5.49a1.56 1.56 0 11-1.29 0V9.42a1.56 1.56 0 01-.85-2.05L8.03 5.04l-5.65 5.65a1.32 1.32 0 000 1.86l8.73 8.73a1.32 1.32 0 001.86 0l8.65-8.65a1.32 1.32 0 000-1.86v.04z"/>
      </svg>
    );
  }

  // Config files
  if (['config', 'conf', 'cfg', 'ini', 'env', 'yaml', 'yml', 'toml'].includes(ext)) {
    return (
      <svg className="file-icon config" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
      </svg>
    );
  }

  // Default file icon
  return (
    <svg className="file-icon default" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  currentDirectory,
  onFileOpen,
  onDirectoryChange,
  onRefresh,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    node: null,
  });
  const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, show: false }));
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Handle folder toggle
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Handle file/folder click
  const handleNodeClick = useCallback((node: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(node.id);

    if (node.type === 'folder') {
      toggleFolder(node.path);
    } else {
      onFileOpen(node.path, node.name);
    }
  }, [onFileOpen, toggleFolder]);

  // Handle double click
  const handleDoubleClick = useCallback((node: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder') {
      onDirectoryChange(node.path);
    }
  }, [onDirectoryChange]);

  // Handle context menu
  const handleContextMenu = useCallback((node: FileNode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedNode(node.id);
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      node,
    });
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((node: FileNode, e: React.DragEvent) => {
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.path);
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const handleDrop = useCallback((targetNode: FileNode, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedNode && targetNode.type === 'folder') {
      console.log(`Move ${draggedNode.path} to ${targetNode.path}`);
      // Implement file move logic here
    }
    setDraggedNode(null);
  }, [draggedNode]);

  // Context menu actions
  const handleContextMenuAction = useCallback((action: string) => {
    if (!contextMenu.node) return;

    switch (action) {
      case 'open':
        if (contextMenu.node.type === 'file') {
          onFileOpen(contextMenu.node.path, contextMenu.node.name);
        }
        break;
      case 'reveal':
        if (window.electronAPI?.shell) {
          window.electronAPI.shell.showItemInFolder(contextMenu.node.path);
        }
        break;
      case 'copy-path':
        navigator.clipboard.writeText(contextMenu.node.path).catch(err => {
          console.error('Failed to copy path:', err);
        });
        break;
      case 'refresh':
        onRefresh();
        break;
      default:
        break;
    }

    setContextMenu(prev => ({ ...prev, show: false }));
  }, [contextMenu.node, onFileOpen, onRefresh]);

  // Render file tree node
  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedNode === node.id;
    const isFolder = node.type === 'folder';

    return (
      <div
        key={node.id}
        className="file-tree-item-wrapper"
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-level={depth + 1}
      >
        <div
          className={`file-tree-item ${isSelected ? 'selected' : ''} ${draggedNode?.id === node.id ? 'dragging' : ''}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={(e) => handleNodeClick(node, e)}
          onDoubleClick={(e) => handleDoubleClick(node, e)}
          onContextMenu={(e) => handleContextMenu(node, e)}
          draggable
          onDragStart={(e) => handleDragStart(node, e)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(node, e)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleNodeClick(node, e as unknown as React.MouseEvent);
            }
          }}
        >
          {/* Expand/Collapse Arrow */}
          <span
            className={`file-tree-arrow ${isFolder && isExpanded ? 'expanded' : ''} ${!isFolder ? 'hidden' : ''}`}
            aria-hidden="true"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
          </span>

          {/* File/Folder Icon */}
          {getFileIcon(node.name, isFolder)}

          {/* Name */}
          <span className="file-tree-name">{node.name}</span>
        </div>

        {/* Children (for expanded folders) */}
        {isFolder && isExpanded && node.children && (
          <div className="file-tree-children" role="group">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="file-explorer" ref={containerRef} role="region" aria-label="File explorer">
      {/* Current Directory Header */}
      <div className="file-explorer-header">
        <button
          className="file-explorer-folder-btn"
          onClick={() => {
            if (!window.electronAPI?.dialog) return;
            window.electronAPI.dialog.openFolder().then(result => {
              if (result.success && result.filePaths?.[0]) {
                onDirectoryChange(result.filePaths[0]);
              }
            }).catch(err => {
              console.error('Failed to open folder dialog:', err);
            });
          }}
          title="Open Folder"
          aria-label="Open folder"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
          </svg>
          <span className="folder-path">{currentDirectory || 'Open Folder'}</span>
        </button>
        <div className="file-explorer-actions">
          <button className="action-btn" onClick={onRefresh} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
          <button className="action-btn" title="New File">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z"/>
            </svg>
          </button>
          <button className="action-btn" title="New Folder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div
        className="file-tree"
        role="tree"
        aria-label="File explorer"
      >
        {files.length === 0 ? (
          <div className="file-tree-empty" role="status">
            <p>No files in this directory</p>
            <p className="empty-hint">Open a folder to get started</p>
          </div>
        ) : (
          files.map(node => renderNode(node))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.show && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.node?.type === 'file' && (
            <button className="context-menu-item" onClick={() => handleContextMenuAction('open')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              Open
            </button>
          )}
          <button className="context-menu-item" onClick={() => handleContextMenuAction('reveal')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
            </svg>
            Reveal in File Explorer
          </button>
          <button className="context-menu-item" onClick={() => handleContextMenuAction('copy-path')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            Copy Path
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => handleContextMenuAction('refresh')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
