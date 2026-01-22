/**
 * Markdown Parser Web Worker
 * Offloads markdown parsing to a separate thread
 * Prevents UI blocking when parsing large messages
 */

// Parsed markdown node type (duplicated to avoid import issues in worker)
interface ParsedMarkdownNode {
  type: 'text' | 'heading' | 'paragraph' | 'code' | 'list' | 'listItem' | 'blockquote' | 'hr' | 'inline';
  content?: string;
  level?: number;
  language?: string;
  ordered?: boolean;
  children?: ParsedMarkdownNode[];
}

interface WorkerMessage {
  id: string;
  text: string;
}

interface WorkerResponse {
  id: string;
  nodes: ParsedMarkdownNode[];
  parseTime: number;
}

/**
 * Parse markdown to AST
 */
function parseMarkdownToAST(text: string): ParsedMarkdownNode[] {
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
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { id, text } = event.data;
  const startTime = performance.now();

  try {
    const nodes = parseMarkdownToAST(text);
    const parseTime = performance.now() - startTime;

    const response: WorkerResponse = { id, nodes, parseTime };
    self.postMessage(response);
  } catch (error) {
    // Return original text as paragraph on error
    console.error('Markdown worker parse error:', error);
    const response: WorkerResponse = {
      id,
      nodes: [{ type: 'paragraph', content: text }],
      parseTime: performance.now() - startTime,
    };
    self.postMessage(response);
  }
};

export {};
