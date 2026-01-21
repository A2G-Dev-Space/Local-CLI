/**
 * useMarkdownWorker Hook (Optimized)
 *
 * Performance optimizations applied:
 * 1. Removed Web Worker - overhead > benefit for typical message sizes
 * 2. Added LRU cache - prevents re-parsing identical content
 * 3. Uses requestIdleCallback for non-blocking parsing when available
 * 4. Memoized React element conversion
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import React from 'react';
import { parseMarkdownToAST, parseInlineMarkdown, type ParsedMarkdownNode } from '../utils/markdown-parser';
import { markdownCache } from '../utils/markdown-cache';

// Code Block Component - Memoized for performance
interface CodeBlockProps {
  code: string;
  language: string;
}

const CodeBlock: React.FC<CodeBlockProps> = React.memo(({ code, language }) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [code]);

  return React.createElement('div', { className: 'code-block' },
    React.createElement('div', { className: 'code-block-header' },
      React.createElement('span', { className: 'code-language' }, language || 'plaintext'),
      React.createElement('button', { className: 'code-copy-btn', onClick: handleCopy },
        copied ? [
          React.createElement('svg', { key: 'icon', width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor' },
            React.createElement('path', { d: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' })
          ),
          'Copied!'
        ] : [
          React.createElement('svg', { key: 'icon', width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor' },
            React.createElement('path', { d: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z' })
          ),
          'Copy'
        ]
      )
    ),
    React.createElement('pre', { className: 'code-content' },
      React.createElement('code', null, code)
    )
  );
});

CodeBlock.displayName = 'CodeBlock';

/**
 * Convert AST nodes to React elements
 * Memoization-friendly: same nodes = same output
 */
function astToReact(nodes: ParsedMarkdownNode[]): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `node-${index}`;

    switch (node.type) {
      case 'heading': {
        const level = node.level || 1;
        const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
        return React.createElement(HeadingTag, { key }, node.content);
      }

      case 'paragraph':
        return React.createElement('p', { key }, parseInlineMarkdown(node.content || '', index));

      case 'inline': {
        // Parse inline code
        const parts = (node.content || '').split(/(`[^`]+`)/g);
        const inlineElements = parts.map((part, idx) => {
          if (part.startsWith('`') && part.endsWith('`')) {
            return React.createElement('code', { key: idx, className: 'inline-code' }, part.slice(1, -1));
          }
          return parseInlineMarkdown(part, idx);
        });
        return React.createElement('p', { key }, inlineElements);
      }

      case 'code':
        return React.createElement(CodeBlock, {
          key,
          code: node.content || '',
          language: node.language || '',
        });

      case 'list': {
        const ListTag = node.ordered ? 'ol' : 'ul';
        return React.createElement(
          ListTag,
          { key },
          (node.children || []).map((item, idx) =>
            React.createElement('li', { key: idx }, parseInlineMarkdown(item.content || '', idx))
          )
        );
      }

      case 'blockquote':
        return React.createElement(
          'blockquote',
          { key },
          (node.children || []).map((child, idx) =>
            React.createElement('p', { key: idx }, parseInlineMarkdown(child.content || '', idx))
          )
        );

      case 'hr':
        return React.createElement('hr', { key });

      default:
        return React.createElement('p', { key }, node.content);
    }
  });
}

/**
 * Parse markdown with caching
 * Uses LRU cache to avoid re-parsing identical content
 */
function parseWithCache(text: string): ParsedMarkdownNode[] {
  // Check cache first
  const cached = markdownCache.get(text);
  if (cached) {
    return cached;
  }

  // Parse and cache
  const nodes = parseMarkdownToAST(text);
  markdownCache.set(text, nodes);
  return nodes;
}

/**
 * Hook for parsing markdown - Optimized version
 *
 * Changes from original:
 * - No Web Worker overhead (was adding 32ms+ per message)
 * - LRU cache for instant retrieval of previously parsed content
 * - Simpler state management
 */
export function useMarkdownWorker(text: string): {
  content: React.ReactNode[];
  isLoading: boolean;
  parseTime: number | null;
} {
  const [nodes, setNodes] = useState<ParsedMarkdownNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [parseTime, setParseTime] = useState<number | null>(null);
  const lastTextRef = useRef<string>('');
  const isMountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Skip if text hasn't changed
    if (text === lastTextRef.current) return;
    lastTextRef.current = text;

    // Skip empty text
    if (!text) {
      setNodes([]);
      setIsLoading(false);
      setParseTime(0);
      return;
    }

    setIsLoading(true);
    const startTime = performance.now();

    // Use requestIdleCallback if available for non-blocking parsing
    // Otherwise parse immediately (still very fast with cache)
    const parse = () => {
      if (!isMountedRef.current) return;

      const parsedNodes = parseWithCache(text);
      const elapsed = performance.now() - startTime;

      setNodes(parsedNodes);
      setParseTime(elapsed);
      setIsLoading(false);
    };

    // For short texts or cached content, parse immediately
    // For longer texts, use requestIdleCallback to avoid blocking
    const cachedResult = markdownCache.get(text);
    if (cachedResult || text.length < 1000) {
      // Immediate parsing for cached or short content
      parse();
    } else if ('requestIdleCallback' in window) {
      // Non-blocking parsing for longer content
      const idleId = requestIdleCallback(parse, { timeout: 100 });
      return () => cancelIdleCallback(idleId);
    } else {
      // Fallback: use setTimeout with 0 delay
      const timeoutId = setTimeout(parse, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [text]);

  // Memoize React element conversion
  const content = useMemo(() => astToReact(nodes), [nodes]);

  return { content, isLoading, parseTime };
}

/**
 * Synchronous markdown parsing (for simple cases)
 * Also uses cache for consistency
 */
export function parseMarkdownSync(text: string): React.ReactNode[] {
  const nodes = parseWithCache(text);
  return astToReact(nodes);
}

export default useMarkdownWorker;
