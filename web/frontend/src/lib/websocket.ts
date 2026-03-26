/**
 * WebSocket event from session container (via API relay).
 * Types match session-server.ts outbound events exactly.
 */
export interface WSEvent {
  type: string; // Flexible — session server emits many types
  requestId?: string;
  payload: Record<string, unknown>;
  // Locally assigned sequence for reconnection
  _seq?: number;
}

/**
 * Known event types from session-server.ts:
 * planning:start, planning:todo, planning:complete
 * execution:start, execution:complete
 * tool:call, tool:result
 * llm:token, llm:reasoning
 * todo:update
 * ask_user, tell_user
 * error
 * session:state, session:complete
 * compact:start, compact:complete
 * system (from ws-relay)
 */

type EventHandler = (event: WSEvent) => void;
type ConnectionHandler = () => void;

interface Listeners {
  open: ConnectionHandler[];
  close: ConnectionHandler[];
  reconnecting: ConnectionHandler[];
  event: EventHandler[];
}

export class HanseolWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private token: string;
  private listeners: Listeners = { open: [], close: [], reconnecting: [], event: [] };
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private lastSeq = 0;
  private closed = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(sessionId: string, token: string) {
    this.sessionId = sessionId;
    this.token = token;
  }

  connect() {
    this.closed = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws?sessionId=${this.sessionId}&token=${this.token}&lastSeq=${this.lastSeq}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.listeners.open.forEach((fn) => fn());
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.listeners.close.forEach((fn) => fn());
      if (!this.closed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      /* onclose will fire */
    };

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'pong') return;
        const event = data as WSEvent;
        this.lastSeq++;
        event._seq = this.lastSeq;
        this.listeners.event.forEach((fn) => fn(event));
      } catch {
        /* ignore malformed messages */
      }
    };
  }

  send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close() {
    this.closed = true;
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  on(event: 'open', handler: ConnectionHandler): void;
  on(event: 'close', handler: ConnectionHandler): void;
  on(event: 'reconnecting', handler: ConnectionHandler): void;
  on(event: 'event', handler: EventHandler): void;
  on(event: keyof Listeners, handler: ConnectionHandler | EventHandler) {
    (this.listeners[event] as Array<typeof handler>).push(handler);
  }

  off(event: keyof Listeners, handler: ConnectionHandler | EventHandler) {
    const arr = this.listeners[event] as Array<typeof handler>;
    const idx = arr.indexOf(handler);
    if (idx >= 0) arr.splice(idx, 1);
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.listeners.reconnecting.forEach((fn) => fn());
    setTimeout(() => {
      if (!this.closed) {
        this.connect();
      }
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
