/**
 * LLM Proxy Routes
 *
 * Proxies /v1/* requests to actual LLM endpoints
 * 폐쇄망 환경: 인증 없이 사용 가능
 * Usage tracking: LLM 응답에서 토큰 사용량 추출하여 DB에 저장
 */

import { Router, Request, Response } from 'express';
import { prisma, redis } from '../index.js';
import { incrementUsage, trackActiveUser } from '../services/redis.service.js';

export const proxyRoutes = Router();

// 기본 사용자 정보 (폐쇄망에서 인증 없이 사용 시)
const DEFAULT_USER = {
  loginid: 'anonymous',
  username: 'Anonymous User',
  deptname: 'Unknown',
};

// 기본 서비스 설정 (환경변수에서 가져오기)
const DEFAULT_SERVICE_NAME = process.env['DEFAULT_SERVICE_NAME'] || process.env['DEFAULT_SERVICE_ID'] || 'nexus-coder';

// 서비스 ID 캐시 (매 요청마다 DB 조회 방지)
let cachedDefaultServiceId: string | null = null;

/**
 * 기본 서비스 ID 조회 (캐시 사용)
 */
async function getDefaultServiceId(): Promise<string | null> {
  if (cachedDefaultServiceId) {
    return cachedDefaultServiceId;
  }

  const service = await prisma.service.findFirst({
    where: { name: DEFAULT_SERVICE_NAME },
    select: { id: true },
  });

  if (service) {
    cachedDefaultServiceId = service.id;
    console.log(`[Service] Default service resolved: ${DEFAULT_SERVICE_NAME} -> ${service.id}`);
  } else {
    console.warn(`[Service] Default service '${DEFAULT_SERVICE_NAME}' not found in database`);
  }

  return cachedDefaultServiceId;
}

/**
 * 요청에서 서비스 ID 추출
 * X-Service-Id 헤더가 있으면 해당 서비스, 없으면 기본 서비스
 * @returns { serviceId: string | null, error: string | null }
 */
async function getServiceIdFromRequest(req: Request): Promise<{ serviceId: string | null; error: string | null }> {
  const serviceHeader = req.headers['x-service-id'] as string | undefined;

  if (serviceHeader) {
    // 헤더에 서비스가 지정된 경우 해당 서비스 조회
    const service = await prisma.service.findFirst({
      where: {
        OR: [
          { id: serviceHeader },
          { name: serviceHeader },
        ],
      },
      select: { id: true },
    });

    if (service) {
      return { serviceId: service.id, error: null };
    }
    // 명시적으로 서비스를 지정했지만 등록되지 않은 경우 → 거부
    console.warn(`[Service] Unregistered service '${serviceHeader}' rejected`);
    return { serviceId: null, error: `Service '${serviceHeader}' is not registered. Please contact admin to register your service.` };
  }

  // 헤더가 없는 경우 기본 서비스 사용 (null → nexus-coder)
  const defaultServiceId = await getDefaultServiceId();
  return { serviceId: defaultServiceId, error: null };
}

/**
 * deptname에서 businessUnit 추출
 * "S/W혁신팀(S.LSI)" → "S.LSI", "DS/AI팀" → "DS"
 */
function extractBusinessUnit(deptname: string): string {
  if (!deptname) return '';
  // "팀이름(사업부)" 형식에서 사업부 추출
  const match = deptname.match(/\(([^)]+)\)/);
  if (match) return match[1];
  // "사업부/팀이름" 형식
  const parts = deptname.split('/');
  return parts[0]?.trim() || '';
}

/**
 * URL 인코딩된 텍스트 디코딩 (한글 등)
 * 디코딩 실패 시 원본 반환
 */
function safeDecodeURIComponent(text: string): string {
  if (!text) return text;
  try {
    // 이미 디코딩된 텍스트인지 확인 (% 문자가 없으면 디코딩 불필요)
    if (!text.includes('%')) return text;
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * 사용자 조회 또는 생성 (upsert)
 * X-User-Id 헤더가 있으면 해당 사용자, 없으면 기본 사용자
 */
async function getOrCreateUser(req: Request) {
  const loginid = (req.headers['x-user-id'] as string) || DEFAULT_USER.loginid;
  // URL 인코딩된 한글 디코딩
  const username = safeDecodeURIComponent((req.headers['x-user-name'] as string) || DEFAULT_USER.username);
  const deptname = safeDecodeURIComponent((req.headers['x-user-dept'] as string) || DEFAULT_USER.deptname);
  const businessUnit = extractBusinessUnit(deptname);

  const user = await prisma.user.upsert({
    where: { loginid },
    update: {
      lastActive: new Date(),
      deptname,  // 조직개편 시 자동 갱신
      businessUnit,
    },
    create: {
      loginid,
      username,
      deptname,
      businessUnit,
    },
  });

  return user;
}

/**
 * Usage 저장 (DB + Redis + UserService)
 */
async function recordUsage(
  userId: string,
  loginid: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  serviceId: string | null,
  latencyMs?: number
) {
  const totalTokens = inputTokens + outputTokens;

  // DB에 usage_logs 저장
  await prisma.usageLog.create({
    data: {
      userId,
      modelId,
      inputTokens,
      outputTokens,
      totalTokens,
      serviceId,
      latencyMs,
    },
  });

  // UserService 업데이트 (서비스별 사용자 활동 추적)
  if (serviceId) {
    await prisma.userService.upsert({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
      update: {
        lastActive: new Date(),
        requestCount: { increment: 1 },
      },
      create: {
        userId,
        serviceId,
        firstSeen: new Date(),
        lastActive: new Date(),
        requestCount: 1,
      },
    });
  }

  // Redis 카운터 업데이트
  await incrementUsage(redis, userId, modelId, inputTokens, outputTokens);

  // 활성 사용자 추적
  await trackActiveUser(redis, loginid);

  console.log(`[Usage] Recorded: user=${loginid}, model=${modelId}, service=${serviceId}, tokens=${totalTokens} (in=${inputTokens}, out=${outputTokens}), latency=${latencyMs || 'N/A'}ms`);
}

/**
 * endpointUrl에 /chat/completions가 없으면 자동 추가
 */
function buildChatCompletionsUrl(endpointUrl: string): string {
  let url = endpointUrl.trim();

  // 이미 /chat/completions로 끝나면 그대로 반환
  if (url.endsWith('/chat/completions')) {
    return url;
  }

  // 끝에 슬래시 제거
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  // /v1으로 끝나면 /chat/completions 추가
  if (url.endsWith('/v1')) {
    return `${url}/chat/completions`;
  }

  // 그 외의 경우도 /chat/completions 추가
  return `${url}/chat/completions`;
}

/**
 * GET /v1/models
 * Returns list of available models from Admin Server
 */
proxyRoutes.get('/models', async (_req: Request, res: Response) => {
  try {
    const models = await prisma.model.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        displayName: true,
        maxTokens: true,
        sortOrder: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { displayName: 'asc' },  // sortOrder가 같으면 displayName 순
      ],
    });

    // OpenAI-compatible format
    res.json({
      object: 'list',
      data: models.map(model => ({
        id: model.name,
        object: 'model',
        created: Date.now(),
        owned_by: 'nexus-coder',
        permission: [],
        root: model.name,
        parent: null,
        // Custom fields
        _nexus: {
          id: model.id,
          displayName: model.displayName,
          maxTokens: model.maxTokens,
        },
      })),
    });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ error: 'Failed to get models' });
  }
});

/**
 * POST /v1/chat/completions
 * Proxy chat completion request to actual LLM
 */
proxyRoutes.post('/chat/completions', async (req: Request, res: Response) => {
  try {
    const { model: modelName, messages, stream, ...otherParams } = req.body;

    if (!modelName || !messages) {
      res.status(400).json({ error: 'model and messages are required' });
      return;
    }

    // Find model in database
    const model = await prisma.model.findFirst({
      where: {
        OR: [
          { name: modelName },
          { id: modelName },
        ],
        enabled: true,
      },
    });

    if (!model) {
      res.status(404).json({ error: `Model '${modelName}' not found or disabled` });
      return;
    }

    // Get or create user for usage tracking
    const user = await getOrCreateUser(req);

    // Get service ID from header or use default
    const { serviceId, error: serviceError } = await getServiceIdFromRequest(req);

    // Reject requests from unregistered services
    if (serviceError) {
      res.status(403).json({ error: serviceError });
      return;
    }

    // Prepare request to actual LLM
    const llmRequestBody = {
      model: model.name,
      messages,
      stream: stream || false,
      ...otherParams,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (model.apiKey) {
      headers['Authorization'] = `Bearer ${model.apiKey}`;
    }

    // Handle streaming
    if (stream) {
      await handleStreamingRequest(res, model, llmRequestBody, headers, user, serviceId);
    } else {
      await handleNonStreamingRequest(res, model, llmRequestBody, headers, user, serviceId);
    }

  } catch (error) {
    console.error('Chat completion proxy error:', error);
    res.status(500).json({ error: 'Failed to process chat completion' });
  }
});

/**
 * Handle non-streaming chat completion
 */
async function handleNonStreamingRequest(
  res: Response,
  model: { id: string; name: string; endpointUrl: string; apiKey: string | null },
  requestBody: any,
  headers: Record<string, string>,
  user: { id: string; loginid: string },
  serviceId: string | null
) {
  try {
    const url = buildChatCompletionsUrl(model.endpointUrl);
    console.log(`[Proxy] Non-streaming request to: ${url}`);

    // Latency 측정 시작
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    // Latency 측정 종료
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM error:', errorText);
      res.status(response.status).json({ error: 'LLM request failed', details: errorText });
      return;
    }

    const data = await response.json() as {
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      [key: string]: unknown;
    };

    // Extract and record usage with latency
    if (data.usage) {
      const inputTokens = data.usage.prompt_tokens || 0;
      const outputTokens = data.usage.completion_tokens || 0;

      // 비동기로 usage 저장 (응답 지연 방지)
      recordUsage(user.id, user.loginid, model.id, inputTokens, outputTokens, serviceId, latencyMs).catch((err) => {
        console.error('[Usage] Failed to record usage:', err);
      });
    }

    // Return response to client
    res.json(data);

  } catch (error) {
    console.error('Non-streaming request error:', error);
    throw error;
  }
}

/**
 * Handle streaming chat completion
 * Streaming에서는 마지막 chunk에 usage 정보가 포함될 수 있음
 */
async function handleStreamingRequest(
  res: Response,
  model: { id: string; name: string; endpointUrl: string; apiKey: string | null },
  requestBody: any,
  headers: Record<string, string>,
  user: { id: string; loginid: string },
  serviceId: string | null
) {
  // Latency 측정 시작 (전체 스트리밍 완료까지)
  const startTime = Date.now();

  try {
    const url = buildChatCompletionsUrl(model.endpointUrl);
    console.log(`[Proxy] Streaming request to: ${url}`);

    // stream_options를 추가하여 usage 정보 요청 (OpenAI compatible)
    // 일부 LLM은 이 옵션을 지원하지 않을 수 있으므로 원본도 유지
    const requestWithUsage = {
      ...requestBody,
      stream_options: { include_usage: true },
    };

    let response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestWithUsage),
    });

    // stream_options 지원 안 하는 LLM의 경우 원본 요청으로 재시도
    if (!response.ok && response.status === 400) {
      console.log('[Proxy] Retrying without stream_options');
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM streaming error:', errorText);
      res.status(response.status).json({ error: 'LLM request failed', details: errorText });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body?.getReader();
    if (!reader) {
      res.status(500).json({ error: 'Failed to get response stream' });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let usageData: { prompt_tokens?: number; completion_tokens?: number } | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);

            if (dataStr === '[DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }

            // Parse to check for usage data
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.usage) {
                usageData = parsed.usage;
              }
            } catch {
              // Not valid JSON, ignore
            }

            res.write(`data: ${dataStr}\n\n`);
          } else if (line.trim()) {
            res.write(`${line}\n`);
          }
        }
      }

      // Flush any remaining buffer
      if (buffer.trim()) {
        res.write(`${buffer}\n`);
      }

    } finally {
      reader.releaseLock();
    }

    // Latency 측정 종료
    const latencyMs = Date.now() - startTime;

    // Record usage if available
    if (usageData) {
      const inputTokens = usageData.prompt_tokens || 0;
      const outputTokens = usageData.completion_tokens || 0;

      recordUsage(user.id, user.loginid, model.id, inputTokens, outputTokens, serviceId, latencyMs).catch((err) => {
        console.error('[Usage] Failed to record streaming usage:', err);
      });
    } else {
      console.log('[Usage] No usage data in streaming response');
    }

    res.end();

  } catch (error) {
    console.error('Streaming request error:', error);
    throw error;
  }
}

/**
 * POST /v1/completions
 * Proxy legacy completion request (non-chat)
 */
proxyRoutes.post('/completions', async (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Legacy completions endpoint not implemented. Use /v1/chat/completions instead.' });
});

/**
 * GET /v1/health
 * Health check endpoint for CLI
 */
proxyRoutes.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /v1/models/:model
 * Get specific model info
 */
proxyRoutes.get('/models/:modelName', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.params;

    const model = await prisma.model.findFirst({
      where: {
        OR: [
          { name: modelName },
          { id: modelName },
        ],
        enabled: true,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        maxTokens: true,
      },
    });

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    res.json({
      id: model.name,
      object: 'model',
      created: Date.now(),
      owned_by: 'nexus-coder',
      permission: [],
      root: model.name,
      parent: null,
      _nexus: {
        id: model.id,
        displayName: model.displayName,
        maxTokens: model.maxTokens,
      },
    });
  } catch (error) {
    console.error('Get model error:', error);
    res.status(500).json({ error: 'Failed to get model' });
  }
});
