/**
 * LLM Proxy Routes
 *
 * Proxies /v1/* requests to actual LLM endpoints
 * 폐쇄망 환경: 인증 없이 사용 가능
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';

export const proxyRoutes = Router();

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
      await handleStreamingRequest(res, model, llmRequestBody, headers);
    } else {
      await handleNonStreamingRequest(res, model, llmRequestBody, headers);
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

    const data = await response.json();

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
  res: Response,
  model: { id: string; name: string; endpointUrl: string; apiKey: string | null },
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
