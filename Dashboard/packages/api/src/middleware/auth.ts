/**
 * Authentication Middleware
 *
 * Verifies JWT tokens and checks admin permissions
 * - DEVELOPERS 환경변수: 쉼표로 구분된 개발자 loginid 목록 (SUPER_ADMIN 권한)
 * - DB admins 테이블: 동적으로 관리되는 관리자 목록
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';

export interface JWTPayload {
  loginid: string;
  deptname: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  userId?: string;        // DB User ID
  isAdmin?: boolean;
  adminRole?: 'SUPER_ADMIN' | 'SERVICE_ADMIN' | 'VIEWER' | 'SERVICE_VIEWER';
  isDeveloper?: boolean;  // 환경변수 개발자 여부
  adminId?: string;       // DB Admin ID
}

const JWT_SECRET = process.env['JWT_SECRET'] || 'your-jwt-secret-change-in-production';

/**
 * 환경변수에서 개발자 목록 가져오기
 */
function getDevelopers(): string[] {
  const developers = process.env['DEVELOPERS'] || '';
  return developers.split(',').map(d => d.trim()).filter(Boolean);
}

/**
 * 개발자인지 확인 (환경변수 기반)
 */
export function isDeveloper(loginid: string): boolean {
  const developers = getDevelopers();
  return developers.includes(loginid);
}

/**
 * Verify JWT token and attach user to request
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    // First try to verify as internally signed token (from admin-login or session)
    const internalPayload = verifyInternalToken(token);
    if (internalPayload && internalPayload.loginid) {
      req.user = internalPayload;
      next();
      return;
    }

    // Check for SSO token format (sso.base64EncodedData)
    if (token.startsWith('sso.')) {
      const ssoData = decodeSSOToken(token.substring(4));
      if (ssoData && ssoData.loginid) {
        req.user = ssoData;
        next();
        return;
      }
    }

    // If not internal token, try decoding as SSO token (base64 decode)
    const decoded = decodeJWT(token);

    if (!decoded || !decoded.loginid) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(403).json({ error: 'Invalid token' });
  }
}

/**
 * Check if user is an admin (any role)
 * 1. 환경변수 DEVELOPERS에 있으면 → SUPER_ADMIN
 * 2. DB admins 테이블에 있으면 → 해당 역할 (SUPER_ADMIN, SERVICE_ADMIN, VIEWER, SERVICE_VIEWER)
 */
export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    // 1. 환경변수 개발자 체크 (SUPER_ADMIN)
    if (isDeveloper(req.user.loginid)) {
      req.isAdmin = true;
      req.isDeveloper = true;
      req.adminRole = 'SUPER_ADMIN';
      next();
      return;
    }

    // 2. DB admin 체크
    const admin = await prisma.admin.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.isAdmin = true;
    req.isDeveloper = false;
    req.adminRole = admin.role as AuthenticatedRequest['adminRole'];
    req.adminId = admin.id;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Check if user is a super admin
 * 환경변수 개발자 또는 DB SUPER_ADMIN만 허용
 */
export async function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    // 1. 환경변수 개발자 체크 (항상 SUPER_ADMIN)
    if (isDeveloper(req.user.loginid)) {
      req.isAdmin = true;
      req.isDeveloper = true;
      req.adminRole = 'SUPER_ADMIN';
      next();
      return;
    }

    // 2. DB admin 체크 (SUPER_ADMIN만)
    const admin = await prisma.admin.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!admin || admin.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    req.isAdmin = true;
    req.isDeveloper = false;
    req.adminRole = admin.role;
    next();
  } catch (error) {
    console.error('Super admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Safely decode URL-encoded string
 */
function safeDecodeURIComponent(str: string): string {
  if (!str) return '';
  try {
    // Check if string contains URL-encoded characters
    if (str.includes('%')) {
      return decodeURIComponent(str);
    }
    return str;
  } catch {
    return str;
  }
}

/**
 * Decode SSO token (Unicode-safe base64 decode)
 * Frontend encodes: btoa(unescape(encodeURIComponent(json)))
 * Backend decodes: decodeURIComponent(escape(base64Decode))
 */
function decodeSSOToken(base64Token: string): JWTPayload | null {
  try {
    // Decode base64 to binary string
    const binaryString = Buffer.from(base64Token, 'base64').toString('binary');
    // Convert binary string to UTF-8 (reverse of unescape(encodeURIComponent()))
    const jsonString = decodeURIComponent(
      binaryString.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    const payload = JSON.parse(jsonString);

    console.log('SSO token payload:', JSON.stringify(payload, null, 2));

    return {
      loginid: safeDecodeURIComponent(payload.loginid || ''),
      deptname: safeDecodeURIComponent(payload.deptname || ''),
      username: safeDecodeURIComponent(payload.username || ''),
    };
  } catch (error) {
    console.error('SSO token decode error:', error);
    return null;
  }
}

/**
 * Decode JWT token (base64url decode)
 */
function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadBase64 = parts[1]!
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));

    // Debug: log actual payload fields
    console.log('JWT payload fields:', Object.keys(payload));
    console.log('JWT payload:', JSON.stringify(payload, null, 2));

    const loginid = payload.loginid || payload.sub || payload.user_id || payload.userId || payload.id || '';
    const deptname = payload.deptname || payload.department || payload.dept || payload.deptName || '';
    const username = payload.username || payload.name || payload.display_name || payload.userName || payload.displayName || '';

    return {
      loginid: safeDecodeURIComponent(loginid),
      deptname: safeDecodeURIComponent(deptname),
      username: safeDecodeURIComponent(username),
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

/**
 * Sign a JWT token (for internal session management)
 */
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Verify internally signed token
 */
export function verifyInternalToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Check if user has write access (not VIEWER or SERVICE_VIEWER)
 * Must be used after requireAdmin middleware
 */
export function requireWriteAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (['VIEWER', 'SERVICE_VIEWER'].includes(req.adminRole || '')) {
    res.status(403).json({ error: 'Read-only access. Write operations are not permitted.' });
    return;
  }
  next();
}

/**
 * Check if user has access to a specific service
 * SUPER_ADMIN/VIEWER → all services
 * SERVICE_ADMIN/SERVICE_VIEWER → only assigned services
 * Must be used after requireAdmin middleware
 */
export function requireServiceAccess(serviceIdParam: string = 'serviceId') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // SUPER_ADMIN and VIEWER have global access
      if (req.adminRole === 'SUPER_ADMIN' || req.adminRole === 'VIEWER') {
        next();
        return;
      }

      // Get serviceId from query, params, or body
      const serviceId = (req.query[serviceIdParam] as string)
        || req.params[serviceIdParam]
        || req.body?.[serviceIdParam];

      if (!serviceId) {
        // If no specific service requested, allow (will show all accessible services)
        next();
        return;
      }

      // SERVICE_ADMIN and SERVICE_VIEWER need specific permission
      if (!req.adminId) {
        res.status(403).json({ error: 'Admin ID not found' });
        return;
      }

      const permission = await prisma.adminService.findUnique({
        where: {
          adminId_serviceId: {
            adminId: req.adminId,
            serviceId,
          },
        },
      });

      if (!permission) {
        res.status(403).json({ error: 'No access to this service' });
        return;
      }

      next();
    } catch (error) {
      console.error('Service access check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Get list of service IDs accessible by the current admin
 * SUPER_ADMIN/VIEWER → null (all services)
 * SERVICE_ADMIN/SERVICE_VIEWER → list of assigned service IDs
 */
export async function getAccessibleServiceIds(req: AuthenticatedRequest): Promise<string[] | null> {
  // Global roles can access all services
  if (req.adminRole === 'SUPER_ADMIN' || req.adminRole === 'VIEWER') {
    return null; // null means all services
  }

  // Service-specific roles need to check AdminService
  if (!req.adminId) {
    return [];
  }

  const adminServices = await prisma.adminService.findMany({
    where: { adminId: req.adminId },
    select: { serviceId: true },
  });

  return adminServices.map(as => as.serviceId);
}
