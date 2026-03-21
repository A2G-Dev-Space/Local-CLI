/**
 * Android Shell Tools
 *
 * 안드로이드 환경에서의 제한적 셸 실행 도구.
 * 네이티브 셸 접근이 제한되므로 fetch 기반 HTTP 요청과
 * 기본 유틸리티 기능을 제공.
 */

import type { AndroidTool } from '../types';

const http_request: AndroidTool = {
  name: 'http_request',
  description: 'Make an HTTP request (GET, POST, PUT, DELETE). Replaces curl/wget on Android.',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to request' },
      method: { type: 'string', description: 'HTTP method', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'], default: 'GET' },
      headers: { type: 'string', description: 'JSON string of headers (e.g., {"Content-Type": "application/json"})' },
      body: { type: 'string', description: 'Request body (for POST/PUT/PATCH)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds', default: 30000 },
    },
    required: ['url'],
  },
  execute: async (args) => {
    try {
      const url = String(args.url);
      const method = String(args.method || 'GET');
      const timeout = Number(args.timeout || 30000);

      let headers: Record<string, string> = {};
      if (args.headers) {
        try {
          headers = JSON.parse(String(args.headers));
        } catch {
          return { success: false, output: '', error: 'Invalid headers JSON' };
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (args.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOptions.body = String(args.body);
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
          fetchOptions.headers = headers;
        }
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let body: string;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        const json = await response.json();
        body = JSON.stringify(json, null, 2);
      } else {
        body = await response.text();
      }

      // Truncate very long responses
      if (body.length > 20000) {
        body = body.substring(0, 20000) + '\n... (truncated, total length: ' + body.length + ')';
      }

      const output = [
        `HTTP ${response.status} ${response.statusText}`,
        `Headers: ${JSON.stringify(responseHeaders, null, 2)}`,
        '',
        body,
      ].join('\n');

      return {
        success: response.ok,
        output,
        data: { status: response.status, headers: responseHeaders },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('abort')) {
        return { success: false, output: '', error: 'Request timed out' };
      }
      return { success: false, output: '', error: `HTTP request failed: ${msg}` };
    }
  },
};

const json_parse: AndroidTool = {
  name: 'json_parse',
  description: 'Parse and format JSON data. Supports JSONPath-like queries.',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      data: { type: 'string', description: 'JSON string to parse' },
      query: { type: 'string', description: 'Dot-notation path to extract (e.g., "data.items[0].name")' },
    },
    required: ['data'],
  },
  execute: async (args) => {
    try {
      const parsed = JSON.parse(String(args.data));

      if (args.query) {
        const path = String(args.query);
        const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
        let current: unknown = parsed;
        for (const part of parts) {
          if (current == null || typeof current !== 'object') {
            return { success: false, output: '', error: `Path not found: ${path}` };
          }
          current = (current as Record<string, unknown>)[part];
        }
        return { success: true, output: JSON.stringify(current, null, 2) };
      }

      return { success: true, output: JSON.stringify(parsed, null, 2) };
    } catch (error) {
      return { success: false, output: '', error: `JSON parse error: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const base64_encode: AndroidTool = {
  name: 'base64_encode',
  description: 'Encode text to base64.',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to encode' },
    },
    required: ['text'],
  },
  execute: async (args) => {
    try {
      // React Native supports btoa/atob
      const encoded = btoa(unescape(encodeURIComponent(String(args.text))));
      return { success: true, output: encoded };
    } catch (error) {
      return { success: false, output: '', error: `Encoding failed: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const base64_decode: AndroidTool = {
  name: 'base64_decode',
  description: 'Decode base64 to text.',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      data: { type: 'string', description: 'Base64 data to decode' },
    },
    required: ['data'],
  },
  execute: async (args) => {
    try {
      const decoded = decodeURIComponent(escape(atob(String(args.data))));
      return { success: true, output: decoded };
    } catch (error) {
      return { success: false, output: '', error: `Decoding failed: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const text_transform: AndroidTool = {
  name: 'text_transform',
  description: 'Transform text (regex replace, split, join, count, etc.).',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Input text' },
      operation: {
        type: 'string',
        description: 'Operation to perform',
        enum: ['replace', 'split', 'join', 'count_lines', 'count_words', 'count_chars', 'uppercase', 'lowercase', 'trim', 'reverse', 'sort_lines', 'unique_lines', 'grep'],
      },
      pattern: { type: 'string', description: 'Pattern (for replace/split/grep operations)' },
      replacement: { type: 'string', description: 'Replacement string (for replace operation)' },
      separator: { type: 'string', description: 'Separator (for join/split operations)' },
    },
    required: ['text', 'operation'],
  },
  execute: async (args) => {
    const text = String(args.text);
    const op = String(args.operation);

    try {
      switch (op) {
        case 'replace': {
          const pattern = new RegExp(String(args.pattern || ''), 'g');
          return { success: true, output: text.replace(pattern, String(args.replacement || '')) };
        }
        case 'split':
          return { success: true, output: JSON.stringify(text.split(String(args.separator || '\n'))) };
        case 'join': {
          const items = JSON.parse(text);
          return { success: true, output: Array.isArray(items) ? items.join(String(args.separator || '\n')) : text };
        }
        case 'count_lines':
          return { success: true, output: String(text.split('\n').length) };
        case 'count_words':
          return { success: true, output: String(text.split(/\s+/).filter(Boolean).length) };
        case 'count_chars':
          return { success: true, output: String(text.length) };
        case 'uppercase':
          return { success: true, output: text.toUpperCase() };
        case 'lowercase':
          return { success: true, output: text.toLowerCase() };
        case 'trim':
          return { success: true, output: text.trim() };
        case 'reverse':
          return { success: true, output: text.split('').reverse().join('') };
        case 'sort_lines':
          return { success: true, output: text.split('\n').sort().join('\n') };
        case 'unique_lines':
          return { success: true, output: [...new Set(text.split('\n'))].join('\n') };
        case 'grep': {
          const regex = new RegExp(String(args.pattern || ''), 'i');
          const matching = text.split('\n').filter(line => regex.test(line));
          return { success: true, output: matching.join('\n') };
        }
        default:
          return { success: false, output: '', error: `Unknown operation: ${op}` };
      }
    } catch (error) {
      return { success: false, output: '', error: `Transform failed: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const device_info: AndroidTool = {
  name: 'device_info',
  description: 'Get device information (platform, dimensions, etc.).',
  category: 'shell',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    // Using dynamic import to avoid bundling issues
    const { Platform, Dimensions } = await import('react-native');
    const { width, height } = Dimensions.get('window');
    const info = {
      platform: Platform.OS,
      version: Platform.Version,
      dimensions: { width, height },
      isTV: Platform.isTV,
    };
    return { success: true, output: JSON.stringify(info, null, 2), data: info };
  },
};

export const shellTools: AndroidTool[] = [
  http_request,
  json_parse,
  base64_encode,
  base64_decode,
  text_transform,
  device_info,
];
