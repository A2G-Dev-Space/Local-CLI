/**
 * Browser Sub-Agent (Electron)
 *
 * Browser lifecycle + auth + SubAgent delegation.
 * Confluence/Jira/Search 에이전트가 이 클래스를 사용하여 실행.
 *
 * CLI parity: src/agents/browser/browser-sub-agent.ts
 */

import type { LLMClient } from '../../core/llm';
import type { LLMSimpleTool, ToolResult } from '../../tools/types';
import type { BrowserClient } from '../../tools/browser/browser-client';
import { SubAgent } from '../common/sub-agent';
import { configManager } from '../../core/config';
import {
  ensureAuthenticated,
  launchSubAgentBrowser,
  getSubAgentBrowserClient,
  ATLASSIAN_LOGIN_INDICATORS,
  LoginIndicators,
} from './browser-profile-manager';
import { logger } from '../../utils/logger';

export interface BrowserServiceConfig {
  type: 'confluence' | 'jira';
  name: string;
  url: string;
}

export interface BrowserSubAgentConfig {
  requiresAuth: boolean;
  serviceType: 'confluence' | 'jira' | 'search';
  loginIndicators?: LoginIndicators;
}

export class BrowserSubAgent {
  constructor(
    private llmClient: LLMClient,
    private serviceName: string,
    private tools: LLMSimpleTool[],
    private systemPrompt: string,
    private config: BrowserSubAgentConfig
  ) {}

  async run(instruction: string, sourceUrl?: string): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // 1. URL 결정
      const url = sourceUrl || this.resolveServiceUrl();
      if (!url && this.config.serviceType !== 'search') {
        return {
          success: false,
          error: this.getUrlNotConfiguredMessage(),
        };
      }

      // 2. 브라우저 시작
      const launched = await launchSubAgentBrowser(true);
      if (!launched) {
        return {
          success: false,
          error: 'Failed to launch browser. Chrome or Edge must be installed.',
        };
      }

      // 3. 인증 (search는 스킵)
      if (this.config.requiresAuth && url) {
        const indicators = this.config.loginIndicators || ATLASSIAN_LOGIN_INDICATORS;
        const authResult = await ensureAuthenticated(url, indicators);
        if (!authResult.success) {
          return {
            success: false,
            error: `Authentication failed: ${authResult.error}`,
          };
        }
      }

      // 4. URL 컨텍스트를 instruction에 추가
      const enrichedInstruction = url
        ? `[Target URL: ${url}]\n\n${instruction}`
        : instruction;

      // 5. 서브에이전트용 도구에 BrowserClient 바인딩
      const client = getSubAgentBrowserClient();
      const boundTools = this.bindToolsToClient(client);

      // 6. SubAgent delegation
      const agent = new SubAgent(
        this.llmClient,
        this.serviceName,
        boundTools,
        this.systemPrompt,
        { maxIterations: 25 }
      );

      const result = await agent.run(enrichedInstruction);

      const duration = Date.now() - startTime;
      logger.info(`BrowserSubAgent[${this.serviceName}] completed`, {
        success: result.success,
        duration,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`BrowserSubAgent[${this.serviceName}] error`, { error: errorMsg });
      return {
        success: false,
        error: `Browser sub-agent error: ${errorMsg}`,
      };
    }
  }

  /**
   * config에서 서비스 URL 찾기
   */
  private resolveServiceUrl(): string | undefined {
    try {
      const config = configManager.getAll();
      const services: BrowserServiceConfig[] = (config as unknown as { browserServices?: BrowserServiceConfig[] }).browserServices || [];
      const first = services.find(s => s.type === this.config.serviceType);
      return first?.url;
    } catch {
      return undefined;
    }
  }

  /**
   * URL 미설정 시 안내 메시지
   */
  private getUrlNotConfiguredMessage(): string {
    const typeLabel = this.config.serviceType === 'confluence' ? 'Confluence' : 'Jira';
    return `${typeLabel} URL is not configured.\n\n` +
      `How to configure: Add browserServices to config.json.\n` +
      `Example:\n` +
      `{\n` +
      `  "browserServices": [\n` +
      `    { "type": "${this.config.serviceType}", "name": "My ${typeLabel}", "url": "https://${this.config.serviceType}.example.com" }\n` +
      `  ]\n` +
      `}`;
  }

  /**
   * 서브에이전트용 도구에 BrowserClient를 바인딩
   */
  private bindToolsToClient(client: BrowserClient): LLMSimpleTool[] {
    return this.tools.map(tool => ({
      ...tool,
      execute: async (args: Record<string, unknown>) => {
        const toolName = tool.definition.function.name;
        return this.executeToolWithClient(toolName, args, client);
      },
    }));
  }

  /**
   * BrowserClient 메소드를 직접 호출하여 도구 실행
   */
  private async executeToolWithClient(
    toolName: string,
    args: Record<string, unknown>,
    client: BrowserClient
  ): Promise<ToolResult> {
    try {
      let result: { success: boolean; error?: string; [key: string]: unknown };

      switch (toolName) {
        case 'browser_navigate':
          result = await client.navigate(args['url'] as string);
          break;
        case 'browser_screenshot':
          result = await client.screenshot(args['full_page'] as boolean);
          if (result.success && (result as { image?: string }).image) {
            return { success: true, result: `Screenshot captured (base64 image, ${((result as { image?: string }).image || '').length} chars)` };
          }
          break;
        case 'browser_click':
          result = await client.click(args['selector'] as string);
          break;
        case 'browser_fill':
          result = await client.fill(args['selector'] as string, args['value'] as string);
          break;
        case 'browser_get_text':
          result = await client.getText(args['selector'] as string | undefined);
          break;
        case 'browser_get_html':
          result = await client.getHtml();
          break;
        case 'browser_get_page_info':
          result = await client.getPageInfo();
          break;
        case 'browser_focus':
          result = await client.focus(args['selector'] as string);
          break;
        case 'browser_press_key':
          result = await client.pressKey(args['key'] as string, args['selector'] as string | undefined);
          break;
        case 'browser_type':
          result = await client.type(args['text'] as string, args['selector'] as string | undefined);
          break;
        case 'browser_execute_script':
          result = await client.executeScript(args['script'] as string);
          break;
        case 'browser_wait':
          result = await client.waitFor(args['selector'] as string, args['timeout'] as number | undefined);
          break;
        case 'browser_send':
          result = await client.send(args['method'] as string, args['params'] as Record<string, unknown> | undefined);
          break;
        default:
          return { success: false, error: `Unknown browser tool: ${toolName}` };
      }

      if (!result.success) {
        return { success: false, error: result.error || 'Unknown error' };
      }

      // 결과를 문자열로 변환
      const { success: _, error: _err, ...rest } = result;
      const resultText = Object.keys(rest).length > 0
        ? JSON.stringify(rest, null, 2)
        : result['message'] || '(success)';

      return { success: true, result: typeof resultText === 'string' ? resultText : JSON.stringify(resultText) };
    } catch (error) {
      return {
        success: false,
        error: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
