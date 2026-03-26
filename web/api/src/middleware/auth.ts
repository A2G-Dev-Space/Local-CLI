import { Request, Response, NextFunction } from 'express';
import { prisma } from '../index.js';

export interface AuthUser {
  id: string;
  externalId: string;
  displayName: string;
  email: string | null;
  role: 'USER' | 'ADMIN';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Required authentication middleware.
 * local-web: no auth required. Create/use default local user.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const localUser = await prisma.user.upsert({
    where: { externalId: 'local-user' },
    update: { lastActiveAt: new Date() },
    create: {
      externalId: 'local-user',
      displayName: 'Local User',
      provider: 'local',
      role: 'ADMIN',
    },
  });

  req.user = {
    id: localUser.id,
    externalId: 'local-user',
    displayName: 'Local User',
    email: null,
    role: 'ADMIN',
  };
  next();
}

/**
 * Admin role check. Local user is always admin.
 */
export async function requireAdmin(_req: Request, _res: Response, next: NextFunction) {
  next();
}

/**
 * Optional authentication. Local user is always attached.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, next);
}
