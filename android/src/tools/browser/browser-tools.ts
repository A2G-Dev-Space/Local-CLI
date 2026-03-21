/**
 * Android Browser Tools
 *
 * WebView 기반 브라우저 자동화 도구들.
 * CLI의 browser-tools.ts와 동일한 인터페이스를 제공하되,
 * CDP 대신 WebView JS injection으로 구현.
 */

import type { AndroidTool } from '../types';
import { browserCommandQueue, browserStateManager } from './browser-client';

const browser_navigate: AndroidTool = {
  name: 'browser_navigate',
  description: 'Navigate the browser to a URL. Opens the browser if not already open.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
    },
    required: ['url'],
  },
  execute: async (args) => {
    const url = String(args.url);
    return browserCommandQueue.send('navigate', { url });
  },
};

const browser_click: AndroidTool = {
  name: 'browser_click',
  description: 'Click an element on the page by CSS selector or text content.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector of the element to click' },
      text: { type: 'string', description: 'Text content to find and click (used if selector not provided)' },
    },
  },
  execute: async (args) => {
    if (args.selector) {
      return browserCommandQueue.send('click', { selector: String(args.selector) });
    } else if (args.text) {
      return browserCommandQueue.send('click', { text: String(args.text) });
    }
    return { success: false, output: '', error: 'Either selector or text is required' };
  },
};

const browser_fill: AndroidTool = {
  name: 'browser_fill',
  description: 'Fill an input field with the given value.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector of the input element' },
      value: { type: 'string', description: 'Value to fill into the input' },
    },
    required: ['selector', 'value'],
  },
  execute: async (args) => {
    return browserCommandQueue.send('fill', {
      selector: String(args.selector),
      value: String(args.value),
    });
  },
};

const browser_get_text: AndroidTool = {
  name: 'browser_get_text',
  description: 'Get text content of the page or a specific element.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector (optional, defaults to entire page)' },
    },
  },
  execute: async (args) => {
    return browserCommandQueue.send('get_text', {
      selector: args.selector ? String(args.selector) : undefined,
    });
  },
};

const browser_get_html: AndroidTool = {
  name: 'browser_get_html',
  description: 'Get HTML content of the page or a specific element.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector (optional, defaults to entire page)' },
    },
  },
  execute: async (args) => {
    return browserCommandQueue.send('get_html', {
      selector: args.selector ? String(args.selector) : undefined,
    });
  },
};

const browser_screenshot: AndroidTool = {
  name: 'browser_screenshot',
  description: 'Take a screenshot of the current page (captured via ViewShot).',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    return browserCommandQueue.send('screenshot', {});
  },
};

const browser_execute_script: AndroidTool = {
  name: 'browser_execute_script',
  description: 'Execute JavaScript code in the browser page context.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {
      script: { type: 'string', description: 'JavaScript code to execute' },
    },
    required: ['script'],
  },
  execute: async (args) => {
    return browserCommandQueue.send('execute_script', { script: String(args.script) });
  },
};

const browser_press_key: AndroidTool = {
  name: 'browser_press_key',
  description: 'Press a keyboard key on the focused element.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Key to press (Enter, Tab, Escape, etc.)' },
    },
    required: ['key'],
  },
  execute: async (args) => {
    return browserCommandQueue.send('press_key', { key: String(args.key) });
  },
};

const browser_wait: AndroidTool = {
  name: 'browser_wait',
  description: 'Wait for an element to appear on the page or wait for a specified duration.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector to wait for' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 5000)', default: 5000 },
    },
  },
  execute: async (args) => {
    if (args.selector) {
      return browserCommandQueue.send('wait', {
        selector: String(args.selector),
        timeout: Number(args.timeout || 5000),
      });
    }
    // Simple delay
    const ms = Number(args.timeout || 1000);
    await new Promise(resolve => setTimeout(resolve, ms));
    return { success: true, output: `Waited ${ms}ms` };
  },
};

const browser_get_console: AndroidTool = {
  name: 'browser_get_console',
  description: 'Get console log messages from the browser.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    return browserCommandQueue.send('get_console', {});
  },
};

const browser_get_network: AndroidTool = {
  name: 'browser_get_network',
  description: 'Get network requests made by the page.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    return browserCommandQueue.send('get_network', {});
  },
};

const browser_get_page_info: AndroidTool = {
  name: 'browser_get_page_info',
  description: 'Get information about the current page (title, URL, dimensions, forms, links, etc.).',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    return browserCommandQueue.send('get_page_info', {});
  },
};

const browser_scroll: AndroidTool = {
  name: 'browser_scroll',
  description: 'Scroll the page to a specific position or by a delta amount.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X position (or delta if relative)' },
      y: { type: 'number', description: 'Y position (or delta if relative)' },
      relative: { type: 'boolean', description: 'If true, scroll by delta instead of to position', default: false },
    },
  },
  execute: async (args) => {
    return browserCommandQueue.send('scroll', {
      x: Number(args.x || 0),
      y: Number(args.y || 0),
      relative: Boolean(args.relative),
    });
  },
};

const browser_go_back: AndroidTool = {
  name: 'browser_go_back',
  description: 'Navigate back in browser history.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    return browserCommandQueue.send('go_back', {});
  },
};

const browser_go_forward: AndroidTool = {
  name: 'browser_go_forward',
  description: 'Navigate forward in browser history.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    return browserCommandQueue.send('go_forward', {});
  },
};

const browser_refresh: AndroidTool = {
  name: 'browser_refresh',
  description: 'Refresh the current page.',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    return browserCommandQueue.send('refresh', {});
  },
};

export const browserTools: AndroidTool[] = [
  browser_navigate,
  browser_click,
  browser_fill,
  browser_get_text,
  browser_get_html,
  browser_screenshot,
  browser_execute_script,
  browser_press_key,
  browser_wait,
  browser_get_console,
  browser_get_network,
  browser_get_page_info,
  browser_scroll,
  browser_go_back,
  browser_go_forward,
  browser_refresh,
];
