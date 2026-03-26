import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { prisma, redis } from '../index.js';

const JWT_SECRET = process.env['JWT_SECRET'] || 'hanseol-web-secret';
const EVENT_TTL = 3600; // 1 hour in Redis

const wss = new WebSocketServer({ noServer: true });

// Active relay connections: sessionId -> { browser, container }
const activeRelays = new Map<
  string,
  { browser: WebSocket; container: WebSocket | null; sessionId: string; userId: string }
>();

/**
 * Handle WebSocket upgrade from HTTP server
 */
export function handleWebSocketUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
}

wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const token = url.searchParams.get('token');

  if (!sessionId || !token) {
    ws.close(4001, 'Missing sessionId or token');
    return;
  }

  // Authenticate
  let userId: string;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = payload.userId;
  } catch {
    ws.close(4003, 'Invalid token');
    return;
  }

  // Verify session ownership
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId, status: 'RUNNING' },
  });

  if (!session || !session.containerPort) {
    ws.close(4004, 'Session not found or not running');
    return;
  }

  // Close any existing relay for this session
  const existing = activeRelays.get(sessionId);
  if (existing) {
    existing.browser.close(4005, 'Replaced by new connection');
    if (existing.container) existing.container.close();
    activeRelays.delete(sessionId);
  }

  // Connect to session container WebSocket
  const containerWsUrl = `ws://localhost:${session.containerPort}`;
  let containerWs: WebSocket | null = null;

  try {
    containerWs = new WebSocket(containerWsUrl);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        containerWs!.close();
        reject(new Error('Container WS connection timeout'));
      }, 10000);
      containerWs!.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      containerWs!.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  } catch (err) {
    console.error(`[WS Relay] Failed to connect to container WS:`, err);
    ws.close(4005, 'Failed to connect to session container');
    return;
  }

  const relay = { browser: ws, container: containerWs, sessionId, userId };
  activeRelays.set(sessionId, relay);

  // Replay missed events on reconnection
  const lastSeq = url.searchParams.get('lastSeq');
  if (lastSeq) {
    const missedEvents = await getMissedEvents(sessionId, parseInt(lastSeq, 10));
    for (const event of missedEvents) {
      ws.send(event);
    }
  }

  // Container -> Browser relay
  containerWs.on('open', () => {
    console.log(`[WS Relay] Container connected for session ${sessionId}`);
  });

  containerWs.on('message', async (data: Buffer | string) => {
    const message = data.toString();

    // Store event in Redis for reconnection support
    await storeEvent(sessionId, message);

    // Forward to browser
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });

  containerWs.on('close', () => {
    console.log(`[WS Relay] Container disconnected for session ${sessionId}`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'system', data: { message: 'Container disconnected' } }));
    }
  });

  containerWs.on('error', (err) => {
    console.error(`[WS Relay] Container WS error for session ${sessionId}:`, err.message);
  });

  // Browser -> Container relay
  ws.on('message', (data: Buffer | string) => {
    const message = data.toString();

    // Forward to container
    if (containerWs && containerWs.readyState === WebSocket.OPEN) {
      containerWs.send(message);
    }

    // Update session activity
    prisma.session
      .update({
        where: { id: sessionId },
        data: { lastActiveAt: new Date() },
      })
      .catch((err) => console.error('[WS] Session update failed:', err.message));
  });

  ws.on('close', () => {
    console.log(`[WS Relay] Browser disconnected for session ${sessionId}`);
    activeRelays.delete(sessionId);
    // Don't close container — it keeps running for reconnection
  });

  ws.on('error', (err) => {
    console.error(`[WS Relay] Browser WS error for session ${sessionId}:`, err.message);
  });

  // Heartbeat: ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  ws.on('close', () => clearInterval(pingInterval));
});

/**
 * Store an event in Redis for reconnection replay
 */
async function storeEvent(sessionId: string, message: string): Promise<void> {
  const key = `ws:events:${sessionId}`;
  try {
    await redis.rpush(key, message);
    await redis.ltrim(key, -500, -1); // Keep last 500 events
    await redis.expire(key, EVENT_TTL);
  } catch {
    // Non-critical: event replay is best-effort
  }
}

/**
 * Get missed events from Redis (events after the given sequence)
 */
async function getMissedEvents(sessionId: string, lastSeq: number): Promise<string[]> {
  const key = `ws:events:${sessionId}`;
  try {
    const events = await redis.lrange(key, 0, -1);
    // Filter events after lastSeq
    return events.filter((event) => {
      try {
        const parsed = JSON.parse(event);
        return (parsed.sequence || 0) > lastSeq;
      } catch {
        return true; // Include unparseable events
      }
    });
  } catch {
    return [];
  }
}

/**
 * Clean up Redis events for a session (called on session deletion)
 */
export async function cleanupSessionEvents(sessionId: string): Promise<void> {
  try {
    await redis.del(`ws:events:${sessionId}`);
  } catch {
    // Non-critical
  }
}
