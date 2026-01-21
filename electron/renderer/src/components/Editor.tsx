/**
 * Editor Component
 * Monaco-style code editor with tabs, syntax highlighting, and line numbers
 */

import React, { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import type { EditorTab } from '../App';
import DiffView from './DiffView';
import './Editor.css';
import './DiffView.css';

// Debounce utility
function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

interface EditorProps {
  tabs: EditorTab[];
  activeTab: EditorTab | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onContentChange: (tabId: string, content: string) => void;
  onSave: (tabId: string) => void;
}

// Syntax highlighting keywords by language
const KEYWORDS: Record<string, string[]> = {
  typescript: ['import', 'export', 'from', 'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum', 'extends', 'implements', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'new', 'this', 'super', 'static', 'public', 'private', 'protected', 'readonly', 'abstract', 'as', 'typeof', 'instanceof', 'in', 'of', 'null', 'undefined', 'true', 'false', 'void', 'never', 'any', 'unknown', 'string', 'number', 'boolean', 'object', 'symbol', 'bigint'],
  javascript: ['import', 'export', 'from', 'const', 'let', 'var', 'function', 'class', 'extends', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'new', 'this', 'super', 'static', 'typeof', 'instanceof', 'in', 'of', 'null', 'undefined', 'true', 'false', 'void'],
  python: ['import', 'from', 'as', 'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'raise', 'with', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'lambda', 'yield', 'global', 'nonlocal', 'True', 'False', 'None', 'self', 'async', 'await'],
  powershell: ['function', 'param', 'if', 'else', 'elseif', 'switch', 'foreach', 'for', 'while', 'do', 'until', 'try', 'catch', 'finally', 'throw', 'return', 'break', 'continue', 'exit', 'begin', 'process', 'end', '$true', '$false', '$null', 'Write-Host', 'Write-Output', 'Get-', 'Set-', 'New-', 'Remove-', 'Invoke-'],
};

const Editor: React.FC<EditorProps> = ({
  tabs,
  activeTab,
  onTabSelect,
  onTabClose,
  onContentChange,
  onSave,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [localContent, setLocalContent] = useState(activeTab?.content || '');

  // Sync local content when active tab changes
  useEffect(() => {
    if (activeTab) {
      setLocalContent(activeTab.content);
    }
  }, [activeTab?.id, activeTab?.content]);

  // Debounced content change handler (300ms delay)
  const debouncedContentChange = useMemo(
    () => debounce((tabId: string, content: string) => {
      onContentChange(tabId, content);
    }, 300),
    [onContentChange]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's' && activeTab) {
          e.preventDefault();
          onSave(activeTab.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, onSave]);

  // Update cursor position
  const updateCursorPosition = useCallback((textarea: HTMLTextAreaElement) => {
    const text = textarea.value.substring(0, textarea.selectionStart);
    const lines = text.split('\n');
    setCursorPosition({
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    });
    setSelection({
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
  }, []);

  // Handle content change with debounced parent update
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalContent(newValue);
    if (activeTab) {
      debouncedContentChange(activeTab.id, newValue);
    }
    updateCursorPosition(e.target);
  }, [activeTab, debouncedContentChange, updateCursorPosition]);

  // Handle tab key
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);

      setLocalContent(newValue);
      if (activeTab) {
        debouncedContentChange(activeTab.id, newValue);
      }

      // Set cursor position after tab
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  }, [activeTab, debouncedContentChange]);

  // Handle click/selection
  const handleSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    updateCursorPosition(e.currentTarget);
  }, [updateCursorPosition]);

  // Simple syntax highlighting
  const highlightSyntax = useCallback((content: string, language: string): React.ReactNode[] => {
    if (!content) return [];

    const lines = content.split('\n');
    const keywords = KEYWORDS[language] || [];

    return lines.map((line, lineIndex) => {
      const parts: React.ReactNode[] = [];
      let currentIndex = 0;

      // Match strings
      const stringRegex = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
      // Match comments
      const commentRegex = language === 'python' ? /#.*$/ : /\/\/.*$|\/\*[\s\S]*?\*\//gm;
      // Match numbers
      const numberRegex = /\b\d+\.?\d*\b/g;

      // Simple tokenization
      const tokens: Array<{ type: string; value: string; index: number }> = [];

      // Find strings
      let match;
      const lineForMatching = line;

      // Comments
      const commentMatch = lineForMatching.match(commentRegex);
      if (commentMatch) {
        const idx = lineForMatching.indexOf(commentMatch[0]);
        tokens.push({ type: 'comment', value: commentMatch[0], index: idx });
      }

      // Strings
      stringRegex.lastIndex = 0;
      while ((match = stringRegex.exec(lineForMatching)) !== null) {
        tokens.push({ type: 'string', value: match[0], index: match.index });
      }

      // Numbers
      numberRegex.lastIndex = 0;
      while ((match = numberRegex.exec(lineForMatching)) !== null) {
        tokens.push({ type: 'number', value: match[0], index: match.index });
      }

      // Keywords
      keywords.forEach(keyword => {
        const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'g');
        while ((match = keywordRegex.exec(lineForMatching)) !== null) {
          tokens.push({ type: 'keyword', value: match[0], index: match.index });
        }
      });

      // Sort tokens by index
      tokens.sort((a, b) => a.index - b.index);

      // Build highlighted line
      tokens.forEach((token, i) => {
        // Add text before token
        if (token.index > currentIndex) {
          parts.push(
            <span key={`${lineIndex}-text-${i}`}>
              {line.substring(currentIndex, token.index)}
            </span>
          );
        }

        // Add token with highlighting
        if (token.index >= currentIndex) {
          parts.push(
            <span key={`${lineIndex}-${token.type}-${i}`} className={`syntax-${token.type}`}>
              {token.value}
            </span>
          );
          currentIndex = token.index + token.value.length;
        }
      });

      // Add remaining text
      if (currentIndex < line.length) {
        parts.push(
          <span key={`${lineIndex}-end`}>{line.substring(currentIndex)}</span>
        );
      }

      return (
        <div key={lineIndex} className="editor-line">
          {parts.length > 0 ? parts : <span>{line || '\n'}</span>}
        </div>
      );
    });
  }, []);

  // Get line numbers
  const getLineNumbers = useCallback((content: string) => {
    const lines = content.split('\n');
    return lines.map((_, index) => (
      <div
        key={index}
        className={`line-number ${cursorPosition.line === index + 1 ? 'active' : ''}`}
      >
        {index + 1}
      </div>
    ));
  }, [cursorPosition.line]);

  // Get file icon for tab
  const getTabIcon = (language: string): React.ReactNode => {
    const iconMap: Record<string, { color: string; path: string }> = {
      typescript: {
        color: '#3178c6',
        path: 'M3 3h18v18H3V3zm10.71 14.29c.18.19.43.29.71.29.14 0 .28-.03.41-.08.39-.15.65-.53.65-.95V10h-2v5.59l-2.29-2.3c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.02 0 1.41l3.29 3.29c.18.19.43.3.7.3h.07z',
      },
      javascript: {
        color: '#f7df1e',
        path: 'M3 3h18v18H3V3zm4.5 14c.83 0 1.5-.67 1.5-1.5v-4c0-.28.22-.5.5-.5s.5.22.5.5V15h2v-3.5c0-1.38-1.12-2.5-2.5-2.5S7 10.12 7 11.5V15h.5c0 .83.67 2 1.5 2zm9-2h-3v-2h3v-2h-3V9h3V7h-5v12h5v-4z',
      },
      python: {
        color: '#3776ab',
        path: 'M12 2C8.8 2 8 3.1 8 5v2h4v1H6c-1.7 0-3 1.8-3 4 0 2.2 1.3 4 3 4h2v-2c0-1.7 1.3-3 3-3h4c1.1 0 2-.9 2-2V5c0-1.9-1.3-3-4-3H12z',
      },
      powershell: {
        color: '#5391fe',
        path: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 11h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z',
      },
    };

    const icon = iconMap[language] || {
      color: '#8b949e',
      path: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    };

    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill={icon.color}>
        <path d={icon.path} />
      </svg>
    );
  };

  return (
    <div className="editor" role="region" aria-label="Code editor">
      {/* Tab Bar */}
      <div className="editor-tabs" role="tablist" aria-label="Open files">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`editor-tab ${tab.id === activeTab?.id ? 'active' : ''}`}
            onClick={() => onTabSelect(tab.id)}
            role="tab"
            aria-selected={tab.id === activeTab?.id}
            aria-controls={`editor-panel-${tab.id}`}
            tabIndex={tab.id === activeTab?.id ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTabSelect(tab.id);
              }
            }}
          >
            {getTabIcon(tab.language)}
            <span className="tab-name">{tab.name}</span>
            {tab.isDirty && <span className="tab-dirty" aria-label="Unsaved changes" />}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              title="Close"
              aria-label={`Close ${tab.name}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Editor Content */}
      {activeTab ? (
        activeTab.isDiff && activeTab.originalContent !== undefined ? (
          // Diff View Mode
          <DiffView
            originalContent={activeTab.originalContent}
            modifiedContent={activeTab.content}
            fileName={activeTab.name.replace(' (diff)', '')}
            language={activeTab.language}
            onClose={() => onTabClose(activeTab.id)}
          />
        ) : (
        <div
          className="editor-content"
          role="tabpanel"
          id={`editor-panel-${activeTab.id}`}
          aria-labelledby={`tab-${activeTab.id}`}
        >
          {/* Breadcrumb */}
          <div className="editor-breadcrumb">
            <span className="breadcrumb-item">{activeTab.path}</span>
          </div>

          {/* Code Area */}
          <div className="editor-code-area">
            {/* Line Numbers */}
            <div className="editor-line-numbers" aria-hidden="true">
              {getLineNumbers(localContent)}
            </div>

            {/* Code */}
            <div className="editor-code-container">
              {/* Highlighted code (background) */}
              <div className="editor-code-highlight" aria-hidden="true">
                {highlightSyntax(localContent, activeTab.language)}
              </div>

              {/* Actual textarea (foreground, transparent) */}
              <textarea
                ref={textareaRef}
                className="editor-textarea"
                value={localContent}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onSelect={handleSelect}
                onClick={handleSelect}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                aria-label={`Edit ${activeTab.name}`}
                aria-multiline="true"
              />
            </div>

            {/* Minimap */}
            <div className="editor-minimap" aria-hidden="true">
              <div className="minimap-content">
                {localContent.split('\n').map((line, i) => (
                  <div key={i} className="minimap-line" title={line}>
                    {line.substring(0, 80)}
                  </div>
                ))}
              </div>
              <div
                className="minimap-viewport"
                style={{
                  height: `${Math.min(100, (20 / Math.max(1, localContent.split('\n').length)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Editor Status */}
          <div className="editor-status">
            <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
            {selection.start !== selection.end && (
              <span className="selection-info">
                ({Math.abs(selection.end - selection.start)} selected)
              </span>
            )}
            <span className="status-separator">|</span>
            <span>{activeTab.language}</span>
          </div>
        </div>
        )
      ) : (
        <div className="editor-empty">
          <div className="editor-empty-content">
            <div className="editor-logo">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z"/>
              </svg>
            </div>
            <h2 className="editor-title gradient-text">Local CLI</h2>
            <p className="editor-subtitle">For Windows</p>
            <div className="editor-shortcuts">
              <div className="shortcut">
                <kbd>Ctrl</kbd> + <kbd>S</kbd>
                <span>Save File</span>
              </div>
              <div className="shortcut">
                <kbd>Ctrl</kbd> + <kbd>O</kbd>
                <span>Open File</span>
              </div>
              <div className="shortcut">
                <kbd>Ctrl</kbd> + <kbd>`</kbd>
                <span>Toggle Terminal</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(Editor);
