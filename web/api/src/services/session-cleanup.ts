import cron from 'node-cron';
import { prisma } from '../index.js';
import { stopContainer, removeContainer } from './docker.service.js';
import { cleanupSessionEvents } from './ws-relay.js';

/**
 * Start cron job to clean up expired sessions every 5 minutes
 */
export function startSessionCleanup(): void {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await cleanupExpiredSessions();
    } catch (err) {
      console.error('[Cleanup] Error during session cleanup:', err);
    }
  });

  console.log('[Cleanup] Session cleanup cron scheduled (every 5 minutes)');
}

/**
 * Find and remove expired sessions
 */
async function cleanupExpiredSessions(): Promise<void> {
  const now = new Date();

  // Find sessions past their TTL
  const expired = await prisma.session.findMany({
    where: {
      status: { in: ['RUNNING', 'STOPPED', 'CREATING'] },
      expiresAt: { lte: now },
    },
  });

  if (expired.length === 0) return;

  console.log(`[Cleanup] Found ${expired.length} expired sessions to clean up`);

  for (const session of expired) {
    try {
      // Stop and remove Docker container
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

      // Mark as deleted
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'DELETED', containerId: null, containerPort: null },
      });

      // Clean up Redis event log
      await cleanupSessionEvents(session.id);

      console.log(`[Cleanup] Cleaned up session ${session.id}`);
    } catch (err) {
      console.error(`[Cleanup] Failed to clean up session ${session.id}:`, err);
    }
  }
}
