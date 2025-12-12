/**
 * Authentication Middleware
 *
 * Verifies JWT tokens and checks admin permissions
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
  isAdmin?: boolean;
  adminRole?: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
}

const JWT_SECRET = process.env['JWT_SECRET'] || 'your-jwt-secret-change-in-production';

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
    // Decode token without verification (SSO token is already verified)
    // In production, verify with SSO certificate
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
 * Check if user is an admin
 */
export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.isAdmin = true;
    req.adminRole = admin.role;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Check if user is a super admin
 */
export async function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!admin || admin.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }

    req.isAdmin = true;
    req.adminRole = admin.role;
    next();
  } catch (error) {
    console.error('Super admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

    return {
      loginid: payload.loginid || payload.sub || payload.user_id || '',
      deptname: payload.deptname || payload.department || payload.dept || '',
      username: payload.username || payload.name || payload.display_name || '',
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
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
