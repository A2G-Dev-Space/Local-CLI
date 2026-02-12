/**
 * Markdown Parser Utility
 * Extracted from ChatPanel.tsx for reuse and Web Worker support
 */

import React from 'react';

// Code Block Component (must be defined before use)
interface CodeBlockProps {
  code: string;
  language: string;
}

// Sanitize URL to prevent javascript: and data: attacks
export const sanitizeUrl = (url: string): string => {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
    return '#';
  }
  // Only allow http, https, mailto, and relative URLs
  if (!/^(https?:\/\/|mailto:|\/|#)/.test(trimmed) && trimmed.includes(':')) {
    return '#';
  }
  return url;
};

// Parse inline markdown (bold, italic, links) - XSS-safe implementation
export const parseInlineMarkdown = (text: string, key: number): React.ReactNode => {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let partIndex = 0;

  // Pattern for bold, italic, and links
  const patterns = [
    { regex: /\*\*(.+?)\*\*/, render: (_match: string, content: string) => React.createElement('strong', { key: `b-${partIndex++}` }, content) },
    { regex: /\*(.+?)\*/, render: (_match: string, content: string) => React.createElement('em', { key: `i-${partIndex++}` }, content) },
    { regex: /\[(.+?)\]\((.+?)\)/, render: (_match: string, linkText: string, url: string) =>
      React.createElement('a', { key: `a-${partIndex++}`, href: sanitizeUrl(url), target: '_blank', rel: 'noopener noreferrer' }, linkText)
    },
  ];

  while (remaining.length > 0) {
    let earliestMatch: { index: number; match: RegExpMatchArray; pattern: typeof patterns[0] } | null = null;

    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex);
      if (match && match.index !== undefined) {
        if (!earliestMatch || match.index < earliestMatch.index) {
          earliestMatch = { index: match.index, match, pattern };
        }
      }
    }

    if (earliestMatch) {
      // Add text before the match
      if (earliestMatch.index > 0) {
        elements.push(remaining.slice(0, earliestMatch.index));
      }

      // Add the formatted element
      const { match, pattern } = earliestMatch;
      if (match.length === 3) {
        // Link pattern
        elements.push(pattern.render(match[0], match[1], match[2]));
      } else {
        // Bold or italic
        elements.push(pattern.render(match[0], match[1], ''));
      }

      remaining = remaining.slice(earliestMatch.index + match[0].length);
    } else {
      // No more matches, add remaining text
      elements.push(remaining);
      break;
    }
  }

  if (elements.length === 0) {
    return text;
  }

  if (elements.length === 1 && typeof elements[0] === 'string') {
    return text;
  }

  return React.createElement('span', { key }, elements);
};

/**
 * Convert HTML table string to markdown table format.
 * Used for paste handling: user copies table from Excel/web → markdown in textarea.
 */
export const htmlTableToMarkdown = (html: string): string | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;

  const rows: string[][] = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells: string[] = [];
    tr.querySelectorAll('td, th').forEach(cell => {
      cells.push((cell.textContent || '').trim().replace(/\|/g, '\\|'));
    });
    if (cells.length > 0) rows.push(cells);
  });

  if (rows.length === 0) return null;

  const colCount = Math.max(...rows.map(r => r.length));
  const padded = rows.map(r => {
    while (r.length < colCount) r.push('');
    return r;
  });

  const header = `| ${padded[0].join(' | ')} |`;
  const separator = `| ${padded[0].map(() => '---').join(' | ')} |`;
  const body = padded.slice(1).map(row => `| ${row.join(' | ')} |`);

  return [header, separator, ...body].join('\n');
};

// Parsed markdown node for Web Worker communication
export interface ParsedMarkdownNode {
  type: 'text' | 'heading' | 'paragraph' | 'code' | 'list' | 'listItem' | 'blockquote' | 'hr' | 'inline' | 'table' | 'tableRow' | 'tableCell';
  content?: string;
  level?: number;
  language?: string;
  isHeader?: boolean;
  ordered?: boolean;
  children?: ParsedMarkdownNode[];
}

/**
 * Parse markdown to AST (can be used in Web Worker)
 * Returns a tree structure that can be serialized
 */
export const parseMarkdownToAST = (text: string): ParsedMarkdownNode[] => {
  const nodes: ParsedMarkdownNode[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Safety check - line should always be defined within the loop
    if (line === undefined) {
      break;
    }

    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;

      // Collect code lines until closing ``` or end of input
      while (i < lines.length && lines[i] !== undefined && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }

      nodes.push({
        type: 'code',
        content: codeLines.join('\n'),
        language,
      });

      // Skip the closing ``` if it exists
      if (i < lines.length && lines[i]?.startsWith('```')) {
        i++;
      }
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      nodes.push({ type: 'heading', level: 1, content: line.slice(2) });
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      nodes.push({ type: 'heading', level: 2, content: line.slice(3) });
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      nodes.push({ type: 'heading', level: 3, content: line.slice(4) });
      i++;
      continue;
    }

    // Unordered list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const listItems: ParsedMarkdownNode[] = [];
      while (i < lines.length && lines[i] !== undefined && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        listItems.push({ type: 'listItem', content: lines[i].slice(2) });
        i++;
      }
      nodes.push({ type: 'list', ordered: false, children: listItems });
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const listItems: ParsedMarkdownNode[] = [];
      while (i < lines.length && lines[i] !== undefined && /^\d+\. /.test(lines[i])) {
        listItems.push({ type: 'listItem', content: lines[i].replace(/^\d+\. /, '') });
        i++;
      }
      nodes.push({ type: 'list', ordered: true, children: listItems });
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: ParsedMarkdownNode[] = [];
      while (i < lines.length && lines[i] !== undefined && lines[i].startsWith('> ')) {
        quoteLines.push({ type: 'paragraph', content: lines[i].slice(2) });
        i++;
      }
      nodes.push({ type: 'blockquote', children: quoteLines });
      continue;
    }

    // Table (pipe-separated lines)
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableRows: ParsedMarkdownNode[] = [];
      let isFirstDataRow = true;

      while (i < lines.length && lines[i] !== undefined && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        const rowLine = lines[i].trim();
        // Remove leading/trailing pipes and split
        const inner = rowLine.startsWith('|') ? rowLine.slice(1) : rowLine;
        const trimmedInner = inner.endsWith('|') ? inner.slice(0, -1) : inner;

        // Skip separator row (| --- | --- |)
        if (/^[\s\-|:]+$/.test(trimmedInner)) {
          i++;
          continue;
        }

        const cells = trimmedInner.split('|').map(cell => cell.trim());
        tableRows.push({
          type: 'tableRow',
          isHeader: isFirstDataRow,
          children: cells.map(cell => ({
            type: 'tableCell' as const,
            content: cell,
            isHeader: isFirstDataRow,
          })),
        });

        isFirstDataRow = false;
        i++;
      }

      if (tableRows.length > 0) {
        nodes.push({ type: 'table', children: tableRows });
      }
      continue;
    }

    // Horizontal rule
    if (line === '---' || line === '***') {
      nodes.push({ type: 'hr' });
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph (with inline code detection)
    if (line.includes('`')) {
      nodes.push({ type: 'inline', content: line });
    } else {
      nodes.push({ type: 'paragraph', content: line });
    }
    i++;
  }

  return nodes;
};

export type { CodeBlockProps };
