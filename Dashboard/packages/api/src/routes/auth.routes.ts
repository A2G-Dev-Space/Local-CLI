/**
 * Auth Routes
 *
 * SSO 기반 인증 엔드포인트
 * - CLI와 동일한 방식으로 인증
 * - 환경변수 DEVELOPERS 또는 DB admins로 권한 체크
 */

import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, AuthenticatedRequest, signToken, isDeveloper } from '../middleware/auth.js';
import { trackActiveUser } from '../services/redis.service.js';
import { redis } from '../index.js';

export const authRoutes = Router();

/**
 * URL 인코딩된 텍스트 디코딩 (한글 등)
 */
function safeDecodeURIComponent(text: string): string {
  if (!text) return text;
  try {
    if (!text.includes('%')) return text;
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * deptname에서 businessUnit 추출
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
 * POST /auth/callback
 * SSO callback - sync user with database
 */
authRoutes.post('/callback', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const loginid = req.user.loginid;
    // URL 인코딩된 한글 디코딩
    const deptname = safeDecodeURIComponent(req.user.deptname || '');
    const username = safeDecodeURIComponent(req.user.username || '');
    const businessUnit = extractBusinessUnit(deptname);

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { loginid },
      update: {
        deptname,
        username,
        businessUnit,
        lastActive: new Date(),
      },
      create: {
        loginid,
        deptname,
        username,
        businessUnit,
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
 * POST /auth/login
 * Dashboard SSO 로그인 (CLI와 동일한 방식)
 * SSO 토큰으로 사용자 정보 가져와서 세션 토큰 발급
 */
authRoutes.post('/login', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const loginid = req.user.loginid;
    // URL 인코딩된 한글 디코딩
    const deptname = safeDecodeURIComponent(req.user.deptname || '');
    const username = safeDecodeURIComponent(req.user.username || '');
    const businessUnit = extractBusinessUnit(deptname);

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { loginid },
      update: {
        deptname,
        username,
        businessUnit,
        lastActive: new Date(),
      },
      create: {
        loginid,
        deptname,
        username,
        businessUnit,
      },
    });

    // Track active user in Redis
    await trackActiveUser(redis, loginid);

    // 권한 체크: 환경변수 개발자 → DB admin → 일반 사용자
    let isAdmin = false;
    let adminRole: 'SUPER_ADMIN' | 'SERVICE_ADMIN' | 'VIEWER' | 'SERVICE_VIEWER' | null = null;
    const isEnvDeveloper = isDeveloper(loginid);

    if (isEnvDeveloper) {
      isAdmin = true;
      adminRole = 'SUPER_ADMIN';
    } else {
      const admin = await prisma.admin.findUnique({
        where: { loginid },
      });
      if (admin) {
        isAdmin = true;
        adminRole = admin.role;
      }
    }

    // Issue session token
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
      isAdmin,
      adminRole,
      isDeveloper: isEnvDeveloper,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /auth/check
 * 현재 세션의 권한 정보 반환 (admin 아니어도 OK)
 */
authRoutes.get('/check', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { loginid, deptname, username } = req.user;

    // Get user from DB
    const user = await prisma.user.findUnique({
      where: { loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // 권한 체크
    let isAdmin = false;
    let adminRole: 'SUPER_ADMIN' | 'SERVICE_ADMIN' | 'VIEWER' | 'SERVICE_VIEWER' | null = null;
    const isEnvDeveloper = isDeveloper(loginid);

    if (isEnvDeveloper) {
      isAdmin = true;
      adminRole = 'SUPER_ADMIN';
    } else {
      const admin = await prisma.admin.findUnique({
        where: { loginid },
      });
      if (admin) {
        isAdmin = true;
        adminRole = admin.role;
      }
    }

    res.json({
      user: {
        id: user.id,
        loginid: user.loginid,
        deptname: user.deptname || deptname,
        username: user.username || username,
      },
      isAdmin,
      adminRole,
      isDeveloper: isEnvDeveloper,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: 'Failed to check auth status' });
  }
});
