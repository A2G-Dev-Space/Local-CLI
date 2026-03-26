import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createSessionContainer,
  startContainer,
  stopContainer,
  removeContainer,
  getContainerPort,
} from '../services/docker.service.js';

export const sessionRoutes = Router();

const SESSION_TTL_HOURS = parseInt(process.env['SESSION_TTL_HOURS'] || '24', 10);

sessionRoutes.use(requireAuth);

/**
 * POST /api/sessions — Create a new session
 */
sessionRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { agentId, name } = req.body as { agentId?: string; name?: string };

    // Check session limit
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const activeCount = await prisma.session.count({
      where: { userId, status: { in: ['CREATING', 'RUNNING'] } },
    });

    if (activeCount >= user.maxSessions) {
      res.status(429).json({
        error: `Session limit reached (${user.maxSessions}). Stop or delete an existing session first.`,
      });
      return;
    }

    // Validate agent if provided
    if (agentId) {
      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      // Must own or be public
      if (agent.userId !== userId && agent.visibility === 'PRIVATE') {
        res.status(403).json({ error: 'Agent not accessible' });
        return;
      }
    }

    // Create DB record
    const session = await prisma.session.create({
      data: {
        userId,
        agentId: agentId || null,
        name: name || 'New Session',
        status: 'CREATING',
        expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000),
      },
    });

    // Create Docker container
    try {
      const { containerId, containerPort } = await createSessionContainer(
        userId,
        session.id,
        agentId || null
      );

      const updated = await prisma.session.update({
        where: { id: session.id },
        data: { containerId, containerPort, status: 'RUNNING' },
      });

      res.status(201).json({
        ...updated,
        wsUrl: `/ws?sessionId=${session.id}`,
      });
    } catch (dockerErr) {
      // Mark session as failed
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'DELETED' },
      });
      throw dockerErr;
    }
  } catch (err) {
    console.error('[Session] Create error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * GET /api/sessions — List my sessions
 */
sessionRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sessions = await prisma.session.findMany({
      where: { userId, status: { not: 'DELETED' } },
      include: { agent: { select: { id: true, name: true, iconUrl: true } } },
      orderBy: { lastActiveAt: 'desc' },
    });
    res.json(sessions);
  } catch (err) {
    console.error('[Session] List error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/**
 * GET /api/sessions/:id — Get session detail
 */
sessionRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params['id'], userId: req.user!.id },
      include: { agent: true },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      ...session,
      wsUrl: session.status === 'RUNNING' ? `/ws?sessionId=${session.id}` : null,
    });
  } catch (err) {
    console.error('[Session] Get error:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * POST /api/sessions/:id/start — Start stopped container
 */
sessionRoutes.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params['id'], userId: req.user!.id },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if (session.status !== 'STOPPED') {
      res.status(400).json({ error: `Cannot start session in ${session.status} state` });
      return;
    }
    if (!session.containerId) {
      res.status(400).json({ error: 'No container associated with this session' });
      return;
    }

    await startContainer(session.containerId);
    const port = await getContainerPort(session.containerId);

    const updated = await prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'RUNNING',
        containerPort: port,
        lastActiveAt: new Date(),
        expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000),
      },
    });

    res.json({ ...updated, wsUrl: `/ws?sessionId=${session.id}` });
  } catch (err) {
    console.error('[Session] Start error:', err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

/**
 * POST /api/sessions/:id/stop — Stop running container
 */
sessionRoutes.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params['id'], userId: req.user!.id },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if (session.status !== 'RUNNING') {
      res.status(400).json({ error: `Cannot stop session in ${session.status} state` });
      return;
    }
    if (session.containerId) {
      await stopContainer(session.containerId);
    }

    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { status: 'STOPPED', lastActiveAt: new Date() },
    });

    res.json(updated);
  } catch (err) {
    console.error('[Session] Stop error:', err);
    res.status(500).json({ error: 'Failed to stop session' });
  }
});

/**
 * DELETE /api/sessions/:id — Delete session and remove container
 */
sessionRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params['id'], userId: req.user!.id },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Remove Docker container
    if (session.containerId) {
      try {
        await stopContainer(session.containerId);
      } catch {
        // Container may already be stopped
      }
      try {
        await removeContainer(session.containerId);
      } catch {
        // Container may already be removed
      }
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'DELETED', containerId: null, containerPort: null },
    });

    res.json({ message: 'Session deleted' });
  } catch (err) {
    console.error('[Session] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});
