import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

export const authRoutes = Router();

/**
 * GET /api/auth/login -- Auto-login redirect (no OAuth)
 */
authRoutes.get('/login', (_req: Request, res: Response) => {
  res.redirect('/sessions');
});

/**
 * GET /api/auth/me -- Current user info (local user)
 */
authRoutes.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        _count: { select: { sessions: true, agents: true } },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    res.json({
      id: user.id,
      externalId: user.externalId,
      displayName: user.displayName,
      email: user.email,
      provider: user.provider,
      dept: user.dept,
      role: user.role,
      maxSessions: user.maxSessions,
      locale: user.locale,
      theme: user.theme,
      createdAt: user.createdAt,
      sessionCount: user._count.sessions,
      agentCount: user._count.agents,
    });
  } catch (err) {
    console.error('[Auth] Me error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * PUT /api/auth/me -- Update user settings (locale, theme, displayName)
 */
authRoutes.put('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { locale, theme, displayName } = req.body;
    const data: Record<string, string> = {};
    if (locale && ['ko', 'en'].includes(locale)) data.locale = locale;
    if (theme && ['dark', 'light'].includes(theme)) data.theme = theme;
    if (displayName) data.displayName = displayName;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
    });
    res.json(user);
  } catch (err) {
    console.error('[Auth] Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * POST /api/auth/logout -- No-op for local user
 */
authRoutes.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out' });
});
