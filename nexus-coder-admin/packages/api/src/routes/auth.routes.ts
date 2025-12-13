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

/**
 * POST /auth/admin-login
 * Admin dashboard login with username/password
 */
authRoutes.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    // Check against environment variables
    const adminUsername = process.env['ADMIN_USERNAME'] || 'admin';
    const adminPassword = process.env['ADMIN_PASSWORD'] || 'aidivn';

    if (username !== adminUsername || password !== adminPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Issue admin session token
    const sessionToken = signToken({
      loginid: adminUsername,
      deptname: 'System',
      username: 'Administrator',
    });

    res.json({
      success: true,
      user: {
        id: 'system-admin',
        loginid: adminUsername,
        deptname: 'System',
        username: 'Administrator',
      },
      sessionToken,
      isAdmin: true,
      adminRole: 'SUPER_ADMIN',
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /auth/admin-check
 * Check if request has valid admin session
 */
authRoutes.get('/admin-check', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check if system admin
    const adminUsername = process.env['ADMIN_USERNAME'] || 'admin';
    if (req.user.loginid === adminUsername) {
      res.json({
        user: {
          id: 'system-admin',
          loginid: adminUsername,
          deptname: 'System',
          username: 'Administrator',
        },
        isAdmin: true,
        adminRole: 'SUPER_ADMIN',
      });
      return;
    }

    // Check database admin
    const admin = await prisma.admin.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    res.json({
      user: {
        id: admin.id,
        loginid: admin.loginid,
        deptname: req.user.deptname,
        username: req.user.username,
      },
      isAdmin: true,
      adminRole: admin.role,
    });
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});
