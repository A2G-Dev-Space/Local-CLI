/**
 * Localhost Testing Tools
 *
 * 로컬호스트 서버 연결, 테스트, 모니터링 도구.
 * 안드로이드에서 로컬 개발 서버(React, Next.js, Express 등)에
 * 연결하여 테스트할 수 있는 기능 제공.
 *
 * 안드로이드 에뮬레이터에서는 10.0.2.2가 호스트 머신의 localhost.
 * 실제 디바이스에서는 같은 네트워크의 호스트 IP를 사용.
 */

import type { AndroidTool, LocalhostServer } from '../types';

// Track monitored servers
const monitoredServers: Map<number, LocalhostServer> = new Map();

function getBaseUrl(host: string, port: number): string {
  // Android emulator uses 10.0.2.2 for host localhost
  const resolvedHost = host === 'localhost' || host === '127.0.0.1' ? '10.0.2.2' : host;
  return `http://${resolvedHost}:${port}`;
}

const localhost_check: AndroidTool = {
  name: 'localhost_check',
  description: 'Check if a localhost server is running and responding. On Android emulator, localhost/127.0.0.1 is automatically mapped to 10.0.2.2 (host machine).',
  category: 'localhost',
  parameters: {
    type: 'object',
    properties: {
      port: { type: 'number', description: 'Port number to check' },
      host: { type: 'string', description: 'Host address (default: localhost, mapped to 10.0.2.2 on emulator)', default: 'localhost' },
      path: { type: 'string', description: 'Path to check (default: /)', default: '/' },
      timeout: { type: 'number', description: 'Timeout in ms (default: 5000)', default: 5000 },
    },
    required: ['port'],
  },
  execute: async (args) => {
    const port = Number(args.port);
    const host = String(args.host || 'localhost');
    const path = String(args.path || '/');
    const timeout = Number(args.timeout || 5000);
    const baseUrl = getBaseUrl(host, port);
    const url = `${baseUrl}${path}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      let body = '';
      if (contentType.includes('json')) {
        body = JSON.stringify(await response.json(), null, 2);
      } else {
        body = await response.text();
        if (body.length > 5000) {
          body = body.substring(0, 5000) + '... (truncated)';
        }
      }

      // Track the server
      monitoredServers.set(port, {
        port,
        name: `Server on :${port}`,
        status: 'running',
        url: baseUrl,
        startedAt: Date.now(),
      });

      return {
        success: true,
        output: [
          `Server is RUNNING at ${url}`,
          `Status: ${response.status} ${response.statusText}`,
          `Content-Type: ${contentType}`,
          '',
          'Response:',
          body,
        ].join('\n'),
        data: { status: response.status, contentType, url },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      monitoredServers.set(port, {
        port,
        name: `Server on :${port}`,
        status: msg.includes('abort') ? 'error' : 'stopped',
        url: baseUrl,
      });

      return {
        success: false,
        output: '',
        error: msg.includes('abort')
          ? `Server at ${url} - connection timed out (${timeout}ms)`
          : `Server at ${url} is not responding: ${msg}`,
      };
    }
  },
};

const localhost_scan: AndroidTool = {
  name: 'localhost_scan',
  description: 'Scan common development ports to find running servers. Checks ports like 3000, 3001, 4200, 5000, 5173, 8000, 8080, 8888, 9000.',
  category: 'localhost',
  parameters: {
    type: 'object',
    properties: {
      host: { type: 'string', description: 'Host to scan (default: localhost)', default: 'localhost' },
      ports: { type: 'string', description: 'Comma-separated list of ports to scan (overrides defaults)' },
      timeout: { type: 'number', description: 'Timeout per port in ms (default: 2000)', default: 2000 },
    },
  },
  execute: async (args) => {
    const host = String(args.host || 'localhost');
    const timeout = Number(args.timeout || 2000);

    let ports: number[];
    if (args.ports) {
      ports = String(args.ports).split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    } else {
      ports = [3000, 3001, 4200, 5000, 5173, 5174, 8000, 8080, 8443, 8888, 9000, 9090, 19006];
    }

    const results: string[] = [];
    const found: Array<{ port: number; status: number }> = [];

    // Scan all ports in parallel
    const checks = ports.map(async (port) => {
      const baseUrl = getBaseUrl(host, port);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(baseUrl, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);
        found.push({ port, status: response.status });
        monitoredServers.set(port, { port, name: `Server on :${port}`, status: 'running', url: baseUrl, startedAt: Date.now() });
        return `  [RUNNING] :${port} → HTTP ${response.status} (${baseUrl})`;
      } catch {
        return `  [  ---  ] :${port}`;
      }
    });

    const scanResults = await Promise.all(checks);
    results.push('Port Scan Results:', ...scanResults);

    if (found.length > 0) {
      results.push('', `Found ${found.length} running server(s)`);
    } else {
      results.push('', 'No servers found on scanned ports');
    }

    return {
      success: true,
      output: results.join('\n'),
      data: { found },
    };
  },
};

const localhost_api_test: AndroidTool = {
  name: 'localhost_api_test',
  description: 'Test a localhost API endpoint with various HTTP methods. Supports JSON request/response.',
  category: 'localhost',
  parameters: {
    type: 'object',
    properties: {
      port: { type: 'number', description: 'Port number' },
      path: { type: 'string', description: 'API path (e.g., /api/users)' },
      method: { type: 'string', description: 'HTTP method', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
      body: { type: 'string', description: 'Request body (JSON string)' },
      headers: { type: 'string', description: 'Additional headers (JSON string)' },
      host: { type: 'string', description: 'Host address', default: 'localhost' },
    },
    required: ['port', 'path'],
  },
  execute: async (args) => {
    const port = Number(args.port);
    const path = String(args.path);
    const method = String(args.method || 'GET');
    const host = String(args.host || 'localhost');
    const baseUrl = getBaseUrl(host, port);
    const url = `${baseUrl}${path}`;

    try {
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (args.headers) {
        try {
          headers = { ...headers, ...JSON.parse(String(args.headers)) };
        } catch {
          return { success: false, output: '', error: 'Invalid headers JSON' };
        }
      }

      const fetchOptions: RequestInit = { method, headers };
      if (args.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOptions.body = String(args.body);
      }

      const startTime = Date.now();
      const response = await fetch(url, fetchOptions);
      const duration = Date.now() - startTime;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => { responseHeaders[key] = value; });

      let responseBody: string;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        responseBody = JSON.stringify(await response.json(), null, 2);
      } else {
        responseBody = await response.text();
      }

      if (responseBody.length > 15000) {
        responseBody = responseBody.substring(0, 15000) + '\n... (truncated)';
      }

      const output = [
        `${method} ${url}`,
        `Status: ${response.status} ${response.statusText}`,
        `Duration: ${duration}ms`,
        `Content-Type: ${contentType}`,
        '',
        'Response Headers:',
        JSON.stringify(responseHeaders, null, 2),
        '',
        'Response Body:',
        responseBody,
      ].join('\n');

      return {
        success: response.ok,
        output,
        data: { status: response.status, duration, contentType },
      };
    } catch (error) {
      return { success: false, output: '', error: `API test failed: ${error instanceof Error ? error.message : error}` };
    }
  },
};

const localhost_health: AndroidTool = {
  name: 'localhost_health',
  description: 'Monitor health of all tracked localhost servers.',
  category: 'localhost',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    if (monitoredServers.size === 0) {
      return { success: true, output: 'No servers being monitored. Use localhost_check or localhost_scan first.' };
    }

    const results: string[] = ['Monitored Servers:'];
    const checks = Array.from(monitoredServers.values()).map(async (server) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(server.url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);
        server.status = 'running';
        return `  [OK]    :${server.port} → HTTP ${response.status}`;
      } catch {
        server.status = 'stopped';
        return `  [DOWN]  :${server.port}`;
      }
    });

    const checkResults = await Promise.all(checks);
    results.push(...checkResults);

    return { success: true, output: results.join('\n') };
  },
};

const localhost_browse: AndroidTool = {
  name: 'localhost_browse',
  description: 'Open a localhost URL in the built-in WebView browser for visual testing.',
  category: 'localhost',
  parameters: {
    type: 'object',
    properties: {
      port: { type: 'number', description: 'Port number' },
      path: { type: 'string', description: 'Path to open (default: /)', default: '/' },
      host: { type: 'string', description: 'Host address (default: localhost)', default: 'localhost' },
    },
    required: ['port'],
  },
  execute: async (args) => {
    const port = Number(args.port);
    const path = String(args.path || '/');
    const host = String(args.host || 'localhost');
    const url = `${getBaseUrl(host, port)}${path}`;

    // Import browser command queue to navigate
    const { browserCommandQueue } = await import('../browser/browser-client');
    return browserCommandQueue.send('navigate', { url });
  },
};

export const localhostTools: AndroidTool[] = [
  localhost_check,
  localhost_scan,
  localhost_api_test,
  localhost_health,
  localhost_browse,
];
