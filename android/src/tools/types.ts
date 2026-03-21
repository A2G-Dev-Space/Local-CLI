/**
 * Android Tool System - Type Definitions
 *
 * 안드로이드 환경에서 사용 가능한 도구 시스템 타입 정의
 */

export interface AndroidToolResult {
  success: boolean;
  output: string;
  error?: string;
  data?: Record<string, unknown>;
  screenshot?: string; // base64 image data
}

export interface AndroidTool {
  name: string;
  description: string;
  category: 'browser' | 'file' | 'shell' | 'localhost' | 'app';
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<AndroidToolResult>;
}

export interface BrowserState {
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  html?: string;
  text?: string;
  consoleLogs: ConsoleLog[];
  networkRequests: NetworkRequest[];
}

export interface ConsoleLog {
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;
}

export interface NetworkRequest {
  url: string;
  method: string;
  status?: number;
  type?: string;
  timestamp: number;
  duration?: number;
}

export interface BrowserCommand {
  type: 'navigate' | 'click' | 'fill' | 'get_text' | 'get_html' |
        'execute_script' | 'screenshot' | 'wait' | 'press_key' |
        'go_back' | 'go_forward' | 'refresh' | 'get_console' |
        'get_network' | 'scroll' | 'get_page_info';
  payload: Record<string, unknown>;
  resolve: (result: AndroidToolResult) => void;
  reject: (error: Error) => void;
}

export interface LocalhostServer {
  port: number;
  name: string;
  status: 'running' | 'stopped' | 'error';
  url: string;
  startedAt?: number;
}

export type ToolCategory = 'browser' | 'file' | 'shell' | 'localhost' | 'app';
