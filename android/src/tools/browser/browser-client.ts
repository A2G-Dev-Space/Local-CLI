/**
 * Android WebView Browser Client
 *
 * WebView 기반 브라우저 자동화 클라이언트.
 * CDP/Playwright를 대체하여 안드로이드 WebView에서 브라우저 자동화 수행.
 *
 * WebView에 JavaScript를 주입하여 DOM 조작, 스크린샷, 네트워크 모니터링 등 수행.
 */

import type { BrowserState, BrowserCommand, AndroidToolResult, ConsoleLog, NetworkRequest } from '../types';
import { logger } from '../../utils/logger';

// Injected JS scripts for WebView automation
export const BROWSER_INJECTION_SCRIPTS = {
  /**
   * Console log interceptor - WebView에 주입하여 console.log를 캡처
   */
  consoleInterceptor: `
    (function() {
      if (window.__localCliConsoleIntercepted) return;
      window.__localCliConsoleIntercepted = true;
      window.__localCliConsoleLogs = [];
      const origLog = console.log;
      const origWarn = console.warn;
      const origError = console.error;
      const origInfo = console.info;
      function capture(level, args) {
        const msg = Array.from(args).map(a => {
          try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
          catch(e) { return String(a); }
        }).join(' ');
        window.__localCliConsoleLogs.push({ level, message: msg, timestamp: Date.now() });
        if (window.__localCliConsoleLogs.length > 200) window.__localCliConsoleLogs.shift();
      }
      console.log = function() { capture('log', arguments); origLog.apply(console, arguments); };
      console.warn = function() { capture('warn', arguments); origWarn.apply(console, arguments); };
      console.error = function() { capture('error', arguments); origError.apply(console, arguments); };
      console.info = function() { capture('info', arguments); origInfo.apply(console, arguments); };
    })();
    true;
  `,

  /**
   * Network request interceptor
   */
  networkInterceptor: `
    (function() {
      if (window.__localCliNetworkIntercepted) return;
      window.__localCliNetworkIntercepted = true;
      window.__localCliNetworkRequests = [];
      const origFetch = window.fetch;
      window.fetch = function() {
        const url = typeof arguments[0] === 'string' ? arguments[0] : arguments[0]?.url || '';
        const method = arguments[1]?.method || 'GET';
        const startTime = Date.now();
        const entry = { url, method, timestamp: startTime, type: 'fetch' };
        window.__localCliNetworkRequests.push(entry);
        if (window.__localCliNetworkRequests.length > 100) window.__localCliNetworkRequests.shift();
        return origFetch.apply(this, arguments).then(resp => {
          entry.status = resp.status;
          entry.duration = Date.now() - startTime;
          return resp;
        }).catch(err => {
          entry.status = 0;
          entry.duration = Date.now() - startTime;
          throw err;
        });
      };
      const origXHR = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        this.__localCliEntry = { url: String(url), method, timestamp: Date.now(), type: 'xhr' };
        window.__localCliNetworkRequests.push(this.__localCliEntry);
        if (window.__localCliNetworkRequests.length > 100) window.__localCliNetworkRequests.shift();
        return origXHR.apply(this, arguments);
      };
      const origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function() {
        const entry = this.__localCliEntry;
        if (entry) {
          this.addEventListener('load', () => {
            entry.status = this.status;
            entry.duration = Date.now() - entry.timestamp;
          });
        }
        return origSend.apply(this, arguments);
      };
    })();
    true;
  `,

  /**
   * Click element by CSS selector
   */
  clickElement: (selector: string) => `
    (function() {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return JSON.stringify({ success: false, error: 'Element not found: ${selector}' });
      el.click();
      return JSON.stringify({ success: true, output: 'Clicked: ${selector}' });
    })();
  `,

  /**
   * Click element by text content
   */
  clickByText: (text: string) => `
    (function() {
      const xpath = "//button[contains(text(),'" + ${JSON.stringify(text)} + "')] | //a[contains(text(),'" + ${JSON.stringify(text)} + "')] | //*[contains(text(),'" + ${JSON.stringify(text)} + "')]";
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const el = result.singleNodeValue;
      if (!el) return JSON.stringify({ success: false, error: 'Element with text not found: ' + ${JSON.stringify(text)} });
      el.click();
      return JSON.stringify({ success: true, output: 'Clicked element with text: ' + ${JSON.stringify(text)} });
    })();
  `,

  /**
   * Fill input by CSS selector
   */
  fillInput: (selector: string, value: string) => `
    (function() {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return JSON.stringify({ success: false, error: 'Input not found: ${selector}' });
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, ${JSON.stringify(value)});
      } else {
        el.value = ${JSON.stringify(value)};
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return JSON.stringify({ success: true, output: 'Filled: ${selector}' });
    })();
  `,

  /**
   * Get text content
   */
  getText: (selector?: string) => `
    (function() {
      const el = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document.body'};
      if (!el) return JSON.stringify({ success: false, error: 'Element not found' });
      const text = el.innerText || el.textContent || '';
      return JSON.stringify({ success: true, output: text.substring(0, 10000) });
    })();
  `,

  /**
   * Get HTML content
   */
  getHtml: (selector?: string) => `
    (function() {
      const el = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document.documentElement'};
      if (!el) return JSON.stringify({ success: false, error: 'Element not found' });
      const html = el.outerHTML || '';
      return JSON.stringify({ success: true, output: html.substring(0, 50000) });
    })();
  `,

  /**
   * Get console logs
   */
  getConsoleLogs: `
    (function() {
      const logs = window.__localCliConsoleLogs || [];
      return JSON.stringify({ success: true, output: JSON.stringify(logs), data: { logs } });
    })();
  `,

  /**
   * Get network requests
   */
  getNetworkRequests: `
    (function() {
      const requests = window.__localCliNetworkRequests || [];
      return JSON.stringify({ success: true, output: JSON.stringify(requests), data: { requests } });
    })();
  `,

  /**
   * Execute arbitrary script
   */
  executeScript: (script: string) => `
    (function() {
      try {
        const result = eval(${JSON.stringify(script)});
        return JSON.stringify({ success: true, output: String(result) });
      } catch(e) {
        return JSON.stringify({ success: false, error: e.message });
      }
    })();
  `,

  /**
   * Get page info (title, url, meta, etc.)
   */
  getPageInfo: `
    (function() {
      const info = {
        title: document.title,
        url: window.location.href,
        readyState: document.readyState,
        charset: document.characterSet,
        contentType: document.contentType,
        forms: document.forms.length,
        links: document.links.length,
        images: document.images.length,
        scripts: document.scripts.length,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
      };
      return JSON.stringify({ success: true, output: JSON.stringify(info), data: info });
    })();
  `,

  /**
   * Scroll page
   */
  scroll: (x: number, y: number) => `
    (function() {
      window.scrollTo(${x}, ${y});
      return JSON.stringify({ success: true, output: 'Scrolled to (${x}, ${y})' });
    })();
  `,

  /**
   * Scroll by delta
   */
  scrollBy: (dx: number, dy: number) => `
    (function() {
      window.scrollBy(${dx}, ${dy});
      return JSON.stringify({ success: true, output: 'Scrolled by (${dx}, ${dy})' });
    })();
  `,

  /**
   * Press key on focused element
   */
  pressKey: (key: string) => `
    (function() {
      const el = document.activeElement || document.body;
      const event = new KeyboardEvent('keydown', {
        key: ${JSON.stringify(key)},
        code: ${JSON.stringify(key)},
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(event);
      el.dispatchEvent(new KeyboardEvent('keyup', {
        key: ${JSON.stringify(key)},
        code: ${JSON.stringify(key)},
        bubbles: true,
      }));
      if (${JSON.stringify(key)} === 'Enter') {
        const form = el.closest('form');
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
      }
      return JSON.stringify({ success: true, output: 'Pressed key: ${key}' });
    })();
  `,

  /**
   * Wait for element to appear
   */
  waitForElement: (selector: string, timeoutMs: number = 5000) => `
    (function() {
      return new Promise((resolve) => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el) { resolve(JSON.stringify({ success: true, output: 'Element found: ${selector}' })); return; }
        const observer = new MutationObserver(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) {
            observer.disconnect();
            resolve(JSON.stringify({ success: true, output: 'Element appeared: ${selector}' }));
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(JSON.stringify({ success: false, error: 'Timeout waiting for: ${selector}' }));
        }, ${timeoutMs});
      });
    })();
  `,

  /**
   * Get interactive elements (for LLM to understand page structure)
   */
  getInteractiveElements: `
    (function() {
      const elements = [];
      const selectors = 'a, button, input, textarea, select, [role="button"], [onclick], [tabindex]';
      document.querySelectorAll(selectors).forEach((el, i) => {
        if (i >= 50) return; // Limit to 50 elements
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        elements.push({
          index: i,
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || '',
          text: (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').substring(0, 100),
          id: el.id || '',
          name: el.getAttribute('name') || '',
          className: el.className?.toString().substring(0, 80) || '',
          href: el.getAttribute('href') || '',
          role: el.getAttribute('role') || '',
          visible: rect.top < window.innerHeight && rect.bottom > 0,
        });
      });
      return JSON.stringify({ success: true, output: JSON.stringify(elements), data: { elements } });
    })();
  `,
};

/**
 * Browser command queue - WebView 컴포넌트와 통신
 */
class BrowserCommandQueue {
  private commands: BrowserCommand[] = [];
  private listeners: Set<(command: BrowserCommand) => void> = new Set();

  /**
   * Send a command to the WebView
   */
  send(type: BrowserCommand['type'], payload: Record<string, unknown> = {}): Promise<AndroidToolResult> {
    return new Promise((resolve, reject) => {
      const command: BrowserCommand = { type, payload, resolve, reject };
      this.commands.push(command);
      this.listeners.forEach(listener => listener(command));
    });
  }

  /**
   * Subscribe to incoming commands (called by WebView component)
   */
  onCommand(listener: (command: BrowserCommand) => void): () => void {
    this.listeners.add(listener);
    // Process any pending commands
    while (this.commands.length > 0) {
      const cmd = this.commands.shift();
      if (cmd) listener(cmd);
    }
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear pending commands
   */
  clear(): void {
    this.commands.forEach(cmd => cmd.reject(new Error('Browser closed')));
    this.commands = [];
  }
}

// Singleton command queue shared between tools and WebView component
export const browserCommandQueue = new BrowserCommandQueue();

/**
 * Browser state manager
 */
class BrowserStateManager {
  private state: BrowserState = {
    url: '',
    title: '',
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    consoleLogs: [],
    networkRequests: [],
  };
  private listeners: Set<(state: BrowserState) => void> = new Set();

  getState(): BrowserState {
    return { ...this.state };
  }

  update(partial: Partial<BrowserState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(listener => listener(this.state));
  }

  addConsoleLog(log: ConsoleLog): void {
    this.state.consoleLogs.push(log);
    if (this.state.consoleLogs.length > 200) {
      this.state.consoleLogs = this.state.consoleLogs.slice(-100);
    }
  }

  addNetworkRequest(request: NetworkRequest): void {
    this.state.networkRequests.push(request);
    if (this.state.networkRequests.length > 100) {
      this.state.networkRequests = this.state.networkRequests.slice(-50);
    }
  }

  onStateChange(listener: (state: BrowserState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset(): void {
    this.state = {
      url: '',
      title: '',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      consoleLogs: [],
      networkRequests: [],
    };
  }
}

export const browserStateManager = new BrowserStateManager();
