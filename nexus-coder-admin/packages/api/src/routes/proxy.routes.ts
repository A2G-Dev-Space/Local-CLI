/**
 * LLM Proxy Routes
 *
 * Proxies /v1/* requests to actual LLM endpoints
 * Records usage in database before returning response
 */

import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { redis } from '../index.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { incrementUsage, trackActiveUser } from '../services/redis.service.js';

export const proxyRoutes = Router();

// All proxy routes require authentication
proxyRoutes.use(authenticateToken);

/**
 * GET /v1/models
 * Returns list of available models from Admin Server
 */
proxyRoutes.get('/models', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const models = await prisma.model.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        displayName: true,
        maxTokens: true,
      },
      orderBy: { displayName: 'asc' },
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
proxyRoutes.post('/chat/completions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

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

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Track active user
    await trackActiveUser(redis, req.user.loginid);

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
      await handleStreamingRequest(req, res, model, user, llmRequestBody, headers);
    } else {
      await handleNonStreamingRequest(req, res, model, user, llmRequestBody, headers);
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
  req: AuthenticatedRequest,
  res: Response,
  model: { id: string; name: string; endpointUrl: string; apiKey: string | null },
  user: { id: string; loginid: string },
  requestBody: any,
  headers: Record<string, string>
) {
  try {
    const response = await fetch(model.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM error:', errorText);
      res.status(response.status).json({ error: 'LLM request failed', details: errorText });
      return;
    }

    const data = await response.json() as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };

    // Extract usage from response
    const usage = data.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || inputTokens + outputTokens;

    // Record usage in database
    await recordUsage(user.id, model.id, inputTokens, outputTokens, totalTokens, req.user!.loginid);

    // Return response to client
    res.json(data);

  } catch (error) {
    console.error('Non-streaming request error:', error);
    throw error;
  }
}

/**
 * Handle streaming chat completion
 */
async function handleStreamingRequest(
  req: AuthenticatedRequest,
  res: Response,
  model: { id: string; name: string; endpointUrl: string; apiKey: string | null },
  user: { id: string; loginid: string },
  requestBody: any,
  headers: Record<string, string>
) {
  try {
    const response = await fetch(model.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

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
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Estimate input tokens from messages (rough estimate)
    const messagesText = JSON.stringify(requestBody.messages);
    totalInputTokens = Math.ceil(messagesText.length / 4); // Rough estimate: 4 chars per token

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

            try {
              const data = JSON.parse(dataStr);

              // Extract usage if present (some providers include it)
              if (data.usage) {
                totalInputTokens = data.usage.prompt_tokens || totalInputTokens;
                totalOutputTokens = data.usage.completion_tokens || totalOutputTokens;
              }

              // Estimate output tokens from content
              const content = data.choices?.[0]?.delta?.content || '';
              if (content) {
                totalOutputTokens += Math.ceil(content.length / 4); // Rough estimate
              }

              res.write(`data: ${dataStr}\n\n`);
            } catch {
              // Forward unparseable data as-is
              res.write(`data: ${dataStr}\n\n`);
            }
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

    // Record usage after stream completes
    const totalTokens = totalInputTokens + totalOutputTokens;
    await recordUsage(user.id, model.id, totalInputTokens, totalOutputTokens, totalTokens, req.user!.loginid);

    res.end();

  } catch (error) {
    console.error('Streaming request error:', error);
    throw error;
  }
}

/**
 * Record usage in database and Redis
 */
async function recordUsage(
  userId: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
  loginid: string
) {
  try {
    // Create usage log in database
    await prisma.usageLog.create({
      data: {
        userId,
        modelId,
        inputTokens,
        outputTokens,
        totalTokens,
      },
    });

    // Update Redis counters
    await incrementUsage(redis, userId, modelId, inputTokens, outputTokens);

    // Update user's last active
    await prisma.user.update({
      where: { id: userId },
      data: { lastActive: new Date() },
    });

    console.log(`Usage recorded: user=${loginid}, model=${modelId}, tokens=${totalTokens}`);
  } catch (error) {
    console.error('Failed to record usage:', error);
    // Don't throw - usage recording failure shouldn't break the response
  }
}

/**
 * POST /v1/completions
 * Proxy legacy completion request (non-chat)
 */
proxyRoutes.post('/completions', async (_req: AuthenticatedRequest, res: Response) => {
  // Similar to chat/completions but for legacy format
  res.status(501).json({ error: 'Legacy completions endpoint not implemented. Use /v1/chat/completions instead.' });
});

/**
 * GET /v1/health
 * Health check endpoint for CLI
 */
proxyRoutes.get('/health', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis connection
    await redis.ping();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'ok',
        redis: 'ok',
      },
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
proxyRoutes.get('/models/:modelName', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

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
