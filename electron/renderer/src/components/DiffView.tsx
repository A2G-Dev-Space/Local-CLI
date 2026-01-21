/**
 * DiffView Component
 * Side-by-side diff viewer with syntax highlighting
 */

import React, { useMemo, memo } from 'react';
import './DiffView.css';

interface DiffViewProps {
  originalContent: string;
  modifiedContent: string;
  fileName: string;
  language: string;
  onClose?: () => void;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'empty';
  content: string;
  lineNumber: number | null;
}

// Simple diff algorithm (LCS-based)
function computeDiff(original: string, modified: string): { left: DiffLine[]; right: DiffLine[] } {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  // Build LCS table
  const m = originalLines.length;
  const n = modifiedLines.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalLines[i - 1] === modifiedLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const left: DiffLine[] = [];
  const right: DiffLine[] = [];

  let i = m;
  let j = n;
  const result: Array<{ type: 'unchanged' | 'added' | 'removed'; origIdx: number; modIdx: number }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === modifiedLines[j - 1]) {
      result.unshift({ type: 'unchanged', origIdx: i - 1, modIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', origIdx: -1, modIdx: j - 1 });
      j--;
    } else {
      result.unshift({ type: 'removed', origIdx: i - 1, modIdx: -1 });
      i--;
    }
  }

  // Build side-by-side view
  let leftLineNum = 1;
  let rightLineNum = 1;

  for (const item of result) {
    if (item.type === 'unchanged') {
      left.push({
        type: 'unchanged',
        content: originalLines[item.origIdx],
        lineNumber: leftLineNum++,
      });
      right.push({
        type: 'unchanged',
        content: modifiedLines[item.modIdx],
        lineNumber: rightLineNum++,
      });
    } else if (item.type === 'removed') {
      left.push({
        type: 'removed',
        content: originalLines[item.origIdx],
        lineNumber: leftLineNum++,
      });
      right.push({
        type: 'empty',
        content: '',
        lineNumber: null,
      });
    } else {
      left.push({
        type: 'empty',
        content: '',
        lineNumber: null,
      });
      right.push({
        type: 'added',
        content: modifiedLines[item.modIdx],
        lineNumber: rightLineNum++,
      });
    }
  }

  return { left, right };
}

const DiffView: React.FC<DiffViewProps> = ({
  originalContent,
  modifiedContent,
  fileName,
  language,
  onClose,
}) => {
  const diff = useMemo(() => {
    return computeDiff(originalContent, modifiedContent);
  }, [originalContent, modifiedContent]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;

    for (const line of diff.left) {
      if (line.type === 'removed') removed++;
    }
    for (const line of diff.right) {
      if (line.type === 'added') added++;
    }

    return { added, removed };
  }, [diff]);

  const renderLine = (line: DiffLine, side: 'left' | 'right', index: number) => {
    return (
      <div className={`diff-line ${line.type}`} key={`${side}-${index}-${line.lineNumber || 'empty'}`}>
        <span className="diff-line-number">
          {line.lineNumber !== null ? line.lineNumber : ''}
        </span>
        <span className="diff-line-marker">
          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
        </span>
        <span className="diff-line-content">
          {line.content}
        </span>
      </div>
    );
  };

  return (
    <div className="diff-view">
      {/* Header */}
      <div className="diff-header">
        <div className="diff-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 12l-4.463 4.969-4.537-4.969h3c0-4.97 4.03-9 9-9 2.395 0 4.565.942 6.179 2.468l-2.004 2.231c-1.081-1.05-2.553-1.699-4.175-1.699-3.309 0-6 2.691-6 6h3zm10.463-4.969l-4.463 4.969h3c0 3.309-2.691 6-6 6-1.623 0-3.094-.648-4.175-1.699l-2.004 2.231c1.613 1.526 3.784 2.468 6.179 2.468 4.97 0 9-4.03 9-9h3l-4.537-4.969z"/>
          </svg>
          <span>{fileName}</span>
          <span className="diff-language">({language})</span>
        </div>
        <div className="diff-stats">
          <span className="diff-stat added">+{stats.added}</span>
          <span className="diff-stat removed">-{stats.removed}</span>
        </div>
        {onClose && (
          <button className="diff-close-btn" onClick={onClose} title="Close diff view">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Diff Content */}
      <div className="diff-content">
        {/* Left side (Original) */}
        <div className="diff-pane left">
          <div className="diff-pane-header">
            <span>Original</span>
          </div>
          <div className="diff-pane-content">
            {diff.left.map((line, idx) => renderLine(line, 'left', idx))}
          </div>
        </div>

        {/* Right side (Modified) */}
        <div className="diff-pane right">
          <div className="diff-pane-header">
            <span>Modified</span>
          </div>
          <div className="diff-pane-content">
            {diff.right.map((line, idx) => renderLine(line, 'right', idx))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(DiffView);
