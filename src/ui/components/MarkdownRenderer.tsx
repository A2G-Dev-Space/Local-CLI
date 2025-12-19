/**
 * Markdown Renderer Component
 *
 * Renders markdown content with syntax highlighting for code blocks
 * Supports: headers, bold, italic, code blocks, inline code, lists
 */

import React from 'react';
import { Box, Text } from 'ink';

// Simple syntax highlighting colors
const SYNTAX_COLORS: Record<string, string> = {
  keyword: 'magenta',
  string: 'green',
  number: 'yellow',
  comment: 'gray',
  function: 'cyan',
  operator: 'white',
  punctuation: 'gray',
  variable: 'blue',
  type: 'yellow',
};

// Language keywords for highlighting
const KEYWORDS: Record<string, string[]> = {
  typescript: ['const', 'let', 'var', 'function', 'class', 'interface', 'type', 'import', 'export', 'from', 'return', 'if', 'else', 'for', 'while', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'extends', 'implements', 'public', 'private', 'protected', 'static', 'readonly', 'enum', 'namespace', 'module', 'declare', 'as', 'in', 'of', 'typeof', 'instanceof', 'null', 'undefined', 'true', 'false'],
  javascript: ['const', 'let', 'var', 'function', 'class', 'import', 'export', 'from', 'return', 'if', 'else', 'for', 'while', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'extends', 'null', 'undefined', 'true', 'false'],
  python: ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'raise', 'with', 'as', 'lambda', 'yield', 'async', 'await', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is', 'pass', 'break', 'continue', 'global', 'nonlocal', 'assert', 'del'],
  bash: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'return', 'exit', 'export', 'source', 'alias', 'echo', 'cd', 'ls', 'rm', 'cp', 'mv', 'mkdir', 'chmod', 'chown', 'grep', 'sed', 'awk', 'cat', 'head', 'tail', 'find', 'xargs'],
};

interface MarkdownRendererProps {
  content: string;
  showTimestamp?: boolean;
  timestamp?: Date;
}

/**
 * Simple syntax highlighter for code
 */
function highlightCode(code: string, language: string): React.ReactNode[] {
  const keywords = KEYWORDS[language] || KEYWORDS['javascript'] || [];
  const lines = code.split('\n');

  return lines.map((line, lineIdx) => {
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let keyIndex = 0;

    // Process the line character by character for highlighting
    while (remaining.length > 0) {
      let matched = false;

      // Check for comments
      if (remaining.startsWith('//') || remaining.startsWith('#')) {
        tokens.push(
          <Text key={`${lineIdx}-${keyIndex++}`} color={SYNTAX_COLORS['comment']}>
            {remaining}
          </Text>
        );
        break;
      }

      // Check for strings
      const stringMatch = remaining.match(/^(['"`])(?:[^\\]|\\.)*?\1/);
      if (stringMatch) {
        tokens.push(
          <Text key={`${lineIdx}-${keyIndex++}`} color={SYNTAX_COLORS['string']}>
            {stringMatch[0]}
          </Text>
        );
        remaining = remaining.slice(stringMatch[0].length);
        matched = true;
        continue;
      }

      // Check for numbers
      const numberMatch = remaining.match(/^\d+\.?\d*/);
      if (numberMatch) {
        tokens.push(
          <Text key={`${lineIdx}-${keyIndex++}`} color={SYNTAX_COLORS['number']}>
            {numberMatch[0]}
          </Text>
        );
        remaining = remaining.slice(numberMatch[0].length);
        matched = true;
        continue;
      }

      // Check for keywords
      for (const kw of keywords) {
        if (remaining.startsWith(kw) && !/[a-zA-Z0-9_]/.test(remaining[kw.length] || '')) {
          tokens.push(
            <Text key={`${lineIdx}-${keyIndex++}`} color={SYNTAX_COLORS['keyword']} bold>
              {kw}
            </Text>
          );
          remaining = remaining.slice(kw.length);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Check for function calls
        const funcMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
        if (funcMatch && funcMatch[1]) {
          tokens.push(
            <Text key={`${lineIdx}-${keyIndex++}`} color={SYNTAX_COLORS['function']}>
              {funcMatch[1]}
            </Text>
          );
          remaining = remaining.slice(funcMatch[1].length);
          continue;
        }

        // Default: add single character
        tokens.push(
          <Text key={`${lineIdx}-${keyIndex++}`}>
            {remaining[0]}
          </Text>
        );
        remaining = remaining.slice(1);
      }
    }

    return (
      <Box key={lineIdx}>
        <Text color="gray" dimColor>
          {String(lineIdx + 1).padStart(3, ' ')} │
        </Text>
        {tokens}
      </Box>
    );
  });
}

/**
 * Parse and render markdown content
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  showTimestamp = false,
  timestamp,
}) => {
  const elements: React.ReactNode[] = [];
  const lines = content.split('\n');
  let i = 0;
  let elementKey = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Code block
    const codeBlockMatch = line.match(/^```(\w*)/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1] || 'text';
      const codeLines: string[] = [];
      i++;

      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      i++; // Skip closing ```

      const code = codeLines.join('\n');

      elements.push(
        <Box
          key={elementKey++}
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          marginY={0}
        >
          <Box marginBottom={0}>
            <Text color="gray" dimColor>
              {language || 'code'}
            </Text>
          </Box>
          <Box flexDirection="column">
            {highlightCode(code, language)}
          </Box>
        </Box>
      );
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <Text key={elementKey++} color="cyan">
          {line.slice(4)}
        </Text>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <Text key={elementKey++} color="cyan" bold>
          {line.slice(3)}
        </Text>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <Text key={elementKey++} color="cyan" bold underline>
          {line.slice(2)}
        </Text>
      );
      i++;
      continue;
    }

    // Bullet lists
    if (line.match(/^[\s]*[-*]\s/)) {
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch?.[1]?.length ?? 0;
      const text = line.replace(/^[\s]*[-*]\s/, '');
      elements.push(
        <Box key={elementKey++} paddingLeft={indent}>
          <Text color="cyan">• </Text>
          <Text>{renderInlineMarkdown(text)}</Text>
        </Box>
      );
      i++;
      continue;
    }

    // Numbered lists
    if (line.match(/^[\s]*\d+\.\s/)) {
      const match = line.match(/^(\s*)(\d+)\.\s(.*)$/);
      if (match) {
        const indent = match[1] ?? '';
        const num = match[2] ?? '';
        const text = match[3] ?? '';
        elements.push(
          <Box key={elementKey++} paddingLeft={indent.length}>
            <Text color="yellow">{num}. </Text>
            <Text>{renderInlineMarkdown(text)}</Text>
          </Box>
        );
      }
      i++;
      continue;
    }

    // Empty line - collapse consecutive empty lines into one
    if (line.trim() === '') {
      // Skip consecutive empty lines
      while (i + 1 < lines.length && (lines[i + 1] ?? '').trim() === '') {
        i++;
      }
      elements.push(<Box key={elementKey++} height={1} />);
      i++;
      continue;
    }

    // Regular text with inline markdown
    elements.push(
      <Text key={elementKey++}>{renderInlineMarkdown(line)}</Text>
    );
    i++;
  }

  return (
    <Box flexDirection="column">
      {showTimestamp && timestamp && (
        <Text color="gray" dimColor>
          {timestamp.toLocaleTimeString('ko-KR')}
        </Text>
      )}
      {elements}
    </Box>
  );
};

/**
 * Render inline markdown (bold, italic, code, links)
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      elements.push(
        <Text key={key++} color="yellow" backgroundColor="gray">
          {codeMatch[1]}
        </Text>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      elements.push(
        <Text key={key++} bold>
          {boldMatch[1]}
        </Text>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      elements.push(
        <Text key={key++} italic dimColor>
          {italicMatch[1]}
        </Text>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Link (just show text, not URL in terminal)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\([^)]+\)/);
    if (linkMatch) {
      elements.push(
        <Text key={key++} color="blue" underline>
          {linkMatch[1]}
        </Text>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Find next special character
    const nextSpecial = remaining.search(/[`*\[]/);
    if (nextSpecial === -1) {
      elements.push(<Text key={key++}>{remaining}</Text>);
      break;
    } else if (nextSpecial === 0) {
      // Special char at start but no match, treat as regular
      elements.push(<Text key={key++}>{remaining[0]}</Text>);
      remaining = remaining.slice(1);
    } else {
      elements.push(<Text key={key++}>{remaining.slice(0, nextSpecial)}</Text>);
      remaining = remaining.slice(nextSpecial);
    }
  }

  return elements;
}

export default MarkdownRenderer;
