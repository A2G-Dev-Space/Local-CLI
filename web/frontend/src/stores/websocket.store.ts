import { create } from 'zustand';
import { HanseolWebSocket, type WSEvent } from '@/lib/websocket';

interface WebSocketState {
  ws: HanseolWebSocket | null;
  events: WSEvent[];
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectFailed: boolean;
  _reconnectCount: number;
  _lastSessionId: string | null;
  _lastToken: string | null;

  connect: (sessionId: string, token: string) => void;
  disconnect: () => void;
  sendMessage: (content: string) => void;
  sendInterrupt: () => void;
  clearEvents: () => void;
  manualReconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  ws: null,
  events: [],
  isConnected: false,
  isReconnecting: false,
  reconnectFailed: false,
  _reconnectCount: 0,
  _lastSessionId: null,
  _lastToken: null,

  connect: (sessionId: string, token: string) => {
    const existing = get().ws;
    if (existing) {
      existing.close();
    }

    set({ _lastSessionId: sessionId, _lastToken: token, reconnectFailed: false, _reconnectCount: 0 });

    const ws = new HanseolWebSocket(sessionId, token);

    ws.on('open', () => {
      set({ isConnected: true, isReconnecting: false, reconnectFailed: false, _reconnectCount: 0 });
    });

    ws.on('close', () => {
      set({ isConnected: false });
    });

    ws.on('reconnecting', () => {
      const count = get()._reconnectCount + 1;
      if (count >= MAX_RECONNECT_ATTEMPTS) {
        // Stop reconnecting — user must manually reconnect
        ws.close();
        set({ isReconnecting: false, reconnectFailed: true, _reconnectCount: count });
      } else {
        set({ isReconnecting: true, _reconnectCount: count });
      }
    });

    ws.on('event', (event: WSEvent) => {
      const events = get().events;
      const updated = [...events, event];
      // Keep max 2000 events to prevent memory leak
      set({ events: updated.length > 2000 ? updated.slice(-1500) : updated });
    });

    ws.connect();
    set({ ws, events: [] });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
    }
    set({ ws: null, isConnected: false, events: [], reconnectFailed: false, _reconnectCount: 0 });
  },

  sendMessage: (content: string) => {
    const { ws } = get();
    if (ws) {
      // Match session-server.ts InboundMessage format
      const id = crypto.randomUUID();
      const token = localStorage.getItem('token') || '';
      ws.send({ id, type: 'execute', payload: { message: content, authToken: token } });
    }
  },

  sendInterrupt: () => {
    const { ws } = get();
    if (ws) {
      ws.send({ id: crypto.randomUUID(), type: 'interrupt' });
    }
  },

  clearEvents: () => {
    set({ events: [] });
  },

  manualReconnect: () => {
    const { _lastSessionId, _lastToken } = get();
    if (_lastSessionId && _lastToken) {
      get().connect(_lastSessionId, _lastToken);
    }
  },
}));
