import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

export const toolRoutes = Router();

/**
 * Validate URL — block private/internal addresses to prevent SSRF
 */
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (host.startsWith('10.') || host.startsWith('172.') || host.startsWith('192.168.')) return false;
    if (host === '169.254.169.254') return false; // AWS metadata
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return true;
  } catch {
    return false;
  }
}

toolRoutes.use(requireAuth);

/**
 * Verify agent ownership and return it, or send error response
 */
async function getOwnedAgent(req: Request, res: Response) {
  const agent = await prisma.agent.findUnique({ where: { id: req.params['agentId'] } });
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return null;
  }
  if (agent.userId !== req.user!.id) {
    res.status(403).json({ error: 'Not your agent' });
    return null;
  }
  return agent;
}

/**
 * POST /api/agents/:agentId/tools — Add custom tool to agent
 */
toolRoutes.post('/:agentId/tools', async (req: Request, res: Response) => {
  try {
    const agent = await getOwnedAgent(req, res);
    if (!agent) return;

    const {
      name,
      description,
      apiEndpoint,
      apiMethod,
      apiHeaders,
      apiBodyTemplate,
      parameters,
      responseMapping,
      testPayload,
    } = req.body as {
      name: string;
      description: string;
      apiEndpoint: string;
      apiMethod: string;
      apiHeaders?: Record<string, string>;
      apiBodyTemplate?: Record<string, unknown>;
      parameters: Record<string, unknown>;
      responseMapping?: Record<string, unknown>;
      testPayload?: Record<string, unknown>;
    };

    if (!name || !description || !apiEndpoint || !apiMethod || !parameters) {
      res.status(400).json({
        error: 'name, description, apiEndpoint, apiMethod, and parameters are required',
      });
      return;
    }

    const tool = await prisma.customTool.create({
      data: {
        agentId: agent.id,
        name,
        description,
        apiEndpoint,
        apiMethod,
        apiHeaders: apiHeaders || null,
        apiBodyTemplate: apiBodyTemplate || null,
        parameters,
        responseMapping: responseMapping || null,
        testPayload: testPayload || null,
      },
    });

    res.status(201).json(tool);
  } catch (err) {
    console.error('[Tool] Create error:', err);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

/**
 * PUT /api/agents/:agentId/tools/:toolId — Update tool
 */
toolRoutes.put('/:agentId/tools/:toolId', async (req: Request, res: Response) => {
  try {
    const agent = await getOwnedAgent(req, res);
    if (!agent) return;

    const tool = await prisma.customTool.findFirst({
      where: { id: req.params['toolId'], agentId: agent.id },
    });
    if (!tool) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }

    const {
      name,
      description,
      apiEndpoint,
      apiMethod,
      apiHeaders,
      apiBodyTemplate,
      parameters,
      responseMapping,
      testPayload,
    } = req.body as Record<string, unknown>;

    const updated = await prisma.customTool.update({
      where: { id: tool.id },
      data: {
        ...(name !== undefined && { name: name as string }),
        ...(description !== undefined && { description: description as string }),
        ...(apiEndpoint !== undefined && { apiEndpoint: apiEndpoint as string }),
        ...(apiMethod !== undefined && { apiMethod: apiMethod as string }),
        ...(apiHeaders !== undefined && { apiHeaders: apiHeaders as object }),
        ...(apiBodyTemplate !== undefined && { apiBodyTemplate: apiBodyTemplate as object }),
        ...(parameters !== undefined && { parameters: parameters as object }),
        ...(responseMapping !== undefined && { responseMapping: responseMapping as object }),
        ...(testPayload !== undefined && { testPayload: testPayload as object }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('[Tool] Update error:', err);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

/**
 * DELETE /api/agents/:agentId/tools/:toolId — Delete tool
 */
toolRoutes.delete('/:agentId/tools/:toolId', async (req: Request, res: Response) => {
  try {
    const agent = await getOwnedAgent(req, res);
    if (!agent) return;

    const tool = await prisma.customTool.findFirst({
      where: { id: req.params['toolId'], agentId: agent.id },
    });
    if (!tool) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }

    await prisma.customTool.delete({ where: { id: tool.id } });
    res.json({ message: 'Tool deleted' });
  } catch (err) {
    console.error('[Tool] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

/**
 * POST /api/agents/:agentId/tools/:toolId/test — Test tool API endpoint (proxy call)
 */
toolRoutes.post('/:agentId/tools/:toolId/test', async (req: Request, res: Response) => {
  try {
    const agent = await getOwnedAgent(req, res);
    if (!agent) return;

    const tool = await prisma.customTool.findFirst({
      where: { id: req.params['toolId'], agentId: agent.id },
    });
    if (!tool) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }

    if (!isAllowedUrl(tool.apiEndpoint)) {
      res.status(400).json({ error: 'API endpoint URL is not allowed (private/internal addresses blocked)' });
      return;
    }

    const payload = (req.body.payload as Record<string, unknown>) || tool.testPayload || {};
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((tool.apiHeaders as Record<string, string>) || {}),
      };

      const fetchOptions: RequestInit = {
        method: tool.apiMethod,
        headers,
      };

      if (tool.apiMethod !== 'GET' && tool.apiMethod !== 'HEAD') {
        // Merge body template with test payload
        const body = tool.apiBodyTemplate
          ? { ...(tool.apiBodyTemplate as Record<string, unknown>), ...payload }
          : payload;
        fetchOptions.body = JSON.stringify(body);
      }

      const apiRes = await fetch(tool.apiEndpoint, fetchOptions);
      const latency = Date.now() - startTime;
      const responseBody = await apiRes.text();

      let parsedResponse: unknown;
      try {
        parsedResponse = JSON.parse(responseBody);
      } catch {
        parsedResponse = responseBody;
      }

      const testResult = apiRes.ok ? 'SUCCESS' : `FAILED (${apiRes.status})`;

      // Update tool with test result
      await prisma.customTool.update({
        where: { id: tool.id },
        data: {
          lastTestedAt: new Date(),
          lastTestResult: testResult,
        },
      });

      res.json({
        success: apiRes.ok,
        status: apiRes.status,
        latencyMs: latency,
        response: parsedResponse,
        testResult,
      });
    } catch (fetchErr) {
      const latency = Date.now() - startTime;
      const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Unknown error';

      await prisma.customTool.update({
        where: { id: tool.id },
        data: {
          lastTestedAt: new Date(),
          lastTestResult: `ERROR: ${errMsg}`,
        },
      });

      res.json({
        success: false,
        status: 0,
        latencyMs: latency,
        error: errMsg,
        testResult: `ERROR: ${errMsg}`,
      });
    }
  } catch (err) {
    console.error('[Tool] Test error:', err);
    res.status(500).json({ error: 'Failed to test tool' });
  }
});
