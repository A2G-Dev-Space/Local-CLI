import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

export const agentRoutes = Router();

/**
 * GET /api/agents — List my agents + accessible agents
 */
agentRoutes.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agents = await prisma.agent.findMany({
      where: {
        OR: [{ userId }, { visibility: 'PUBLIC' }],
      },
      include: {
        user: { select: { displayName: true } },
        _count: { select: { customTools: true, sessions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(agents);
  } catch (err) {
    console.error('[Agent] List error:', err);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

/**
 * GET /api/marketplace — List public agents (with search + pagination)
 */
agentRoutes.get('/marketplace', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { visibility: 'PUBLIC' };
    if (search) {
      where['OR'] = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        select: {
          id: true, name: true, description: true, iconUrl: true,
          visibility: true, usageCount: true, rating: true, createdAt: true,
          // Hide: systemPrompt, enabledTools, customTools details (internal config)
          user: { select: { displayName: true } },
          _count: { select: { customTools: true, sessions: true } },
        },
        orderBy: { usageCount: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.agent.count({ where }),
    ]);

    res.json({
      agents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[Agent] Marketplace error:', err);
    res.status(500).json({ error: 'Failed to list marketplace agents' });
  }
});

/**
 * GET /api/agents/:id — Get agent detail
 */
agentRoutes.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params['id'] },
      include: {
        user: { select: { displayName: true } },
        customTools: true,
        _count: { select: { sessions: true } },
      },
    });

    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // Check access
    if (agent.userId !== req.user!.id && agent.visibility === 'PRIVATE') {
      res.status(403).json({ error: 'Agent not accessible' });
      return;
    }

    res.json(agent);
  } catch (err) {
    console.error('[Agent] Get error:', err);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

/**
 * POST /api/agents — Create agent
 */
agentRoutes.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, iconUrl, systemPrompt, enabledTools, visibility, visibilityScope } =
      req.body as {
        name: string;
        description: string;
        iconUrl?: string;
        systemPrompt?: string;
        enabledTools?: string[];
        visibility?: string;
        visibilityScope?: string;
      };

    if (!name || !description) {
      res.status(400).json({ error: 'name and description are required' });
      return;
    }

    const agent = await prisma.agent.create({
      data: {
        userId,
        name,
        description,
        iconUrl: iconUrl || null,
        systemPrompt: systemPrompt || null,
        enabledTools: enabledTools || [],
        visibility: (visibility as 'PRIVATE' | 'PUBLIC' | 'ORG_SCOPED') || 'PRIVATE',
        visibilityScope: visibilityScope || null,
      },
    });

    res.status(201).json(agent);
  } catch (err) {
    console.error('[Agent] Create error:', err);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

/**
 * PUT /api/agents/:id — Update agent
 */
agentRoutes.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: req.params['id'] } });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    if (agent.userId !== req.user!.id) {
      res.status(403).json({ error: 'Not your agent' });
      return;
    }

    const { name, description, iconUrl, systemPrompt, enabledTools, visibility, visibilityScope } =
      req.body as Record<string, unknown>;

    const updated = await prisma.agent.update({
      where: { id: agent.id },
      data: {
        ...(name !== undefined && { name: name as string }),
        ...(description !== undefined && { description: description as string }),
        ...(iconUrl !== undefined && { iconUrl: (iconUrl as string) || null }),
        ...(systemPrompt !== undefined && { systemPrompt: (systemPrompt as string) || null }),
        ...(enabledTools !== undefined && { enabledTools: enabledTools as string[] }),
        ...(visibility !== undefined && {
          visibility: visibility as 'PRIVATE' | 'PUBLIC' | 'ORG_SCOPED',
        }),
        ...(visibilityScope !== undefined && {
          visibilityScope: (visibilityScope as string) || null,
        }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('[Agent] Update error:', err);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

/**
 * DELETE /api/agents/:id — Delete agent
 */
agentRoutes.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: req.params['id'] } });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    if (agent.userId !== req.user!.id) {
      res.status(403).json({ error: 'Not your agent' });
      return;
    }

    await prisma.agent.delete({ where: { id: agent.id } });
    res.json({ message: 'Agent deleted' });
  } catch (err) {
    console.error('[Agent] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

/**
 * POST /api/agents/:id/publish — Set visibility to PUBLIC
 */
agentRoutes.post('/:id/publish', requireAuth, async (req: Request, res: Response) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: req.params['id'] } });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    if (agent.userId !== req.user!.id) {
      res.status(403).json({ error: 'Not your agent' });
      return;
    }

    const updated = await prisma.agent.update({
      where: { id: agent.id },
      data: { visibility: 'PUBLIC' },
    });

    res.json(updated);
  } catch (err) {
    console.error('[Agent] Publish error:', err);
    res.status(500).json({ error: 'Failed to publish agent' });
  }
});
