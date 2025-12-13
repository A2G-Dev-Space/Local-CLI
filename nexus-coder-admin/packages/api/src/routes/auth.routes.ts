/**
 * Auth Routes
 *
 * Public endpoints for CLI authentication
 */

import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, AuthenticatedRequest, signToken } from '../middleware/auth.js';
import { trackActiveUser } from '../services/redis.service.js';
import { redis } from '../index.js';

export const authRoutes = Router();

/**
 * POST /auth/callback
 * SSO callback - sync user with database
 */
authRoutes.post('/callback', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { loginid, deptname, username } = req.user;

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { loginid },
      update: {
        deptname,
        username,
        lastActive: new Date(),
      },
      create: {
        loginid,
        deptname,
        username,
      },
    });

    // Track active user in Redis
    await trackActiveUser(redis, loginid);

    // Issue internal session token
    const sessionToken = signToken({ loginid, deptname, username });

    res.json({
      success: true,
      user: {
        id: user.id,
        loginid: user.loginid,
        deptname: user.deptname,
        username: user.username,
      },
      sessionToken,
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Failed to process authentication' });
  }
});

/**
 * GET /auth/me
 * Get current user info
 */
authRoutes.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    });

    // Track active user
    await trackActiveUser(redis, user.loginid);

    // Check if admin
    const admin = await prisma.admin.findUnique({
      where: { loginid: user.loginid },
    });

    res.json({
      user: {
        id: user.id,
        loginid: user.loginid,
        deptname: user.deptname,
        username: user.username,
        firstSeen: user.firstSeen,
        lastActive: user.lastActive,
      },
      isAdmin: !!admin,
      adminRole: admin?.role || null,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * POST /auth/refresh
 * Refresh session token
 */
authRoutes.post('/refresh', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { loginid, deptname, username } = req.user;

    // Issue new session token
    const sessionToken = signToken({ loginid, deptname, username });

    res.json({
      success: true,
      sessionToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});
