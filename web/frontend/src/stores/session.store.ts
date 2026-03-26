import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Session {
  id: string;
  name: string;
  status: 'RUNNING' | 'STOPPED' | 'CREATING' | 'DELETED';
  agentId?: string;
  agentName?: string;
  agent?: { id: string; name: string; iconUrl?: string };
  containerId?: string;
  containerPort?: number;
  wsUrl?: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt?: string;
}

interface SessionState {
  sessions: Session[];
  currentSession: Session | null;
  isLoading: boolean;

  listSessions: () => Promise<void>;
  getSession: (id: string) => Promise<void>;
  createSession: (data: { name: string; agentId?: string }) => Promise<Session>;
  startSession: (id: string) => Promise<void>;
  stopSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  updateSessionLocally: (id: string, updates: Partial<Session>) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  isLoading: false,

  listSessions: async () => {
    set({ isLoading: true });
    try {
      const sessions = await api.get<Session[]>('/api/sessions');
      set({ sessions, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  getSession: async (id: string) => {
    try {
      const session = await api.get<Session>(`/api/sessions/${id}`);
      set({ currentSession: session });
    } catch {
      /* session not found */
    }
  },

  createSession: async (data) => {
    const session = await api.post<Session>('/api/sessions', data);
    set({ sessions: [session, ...get().sessions] });
    return session;
  },

  startSession: async (id: string) => {
    await api.post(`/api/sessions/${id}/start`);
    get().updateSessionLocally(id, { status: 'RUNNING' });
  },

  stopSession: async (id: string) => {
    await api.post(`/api/sessions/${id}/stop`);
    get().updateSessionLocally(id, { status: 'STOPPED' });
  },

  deleteSession: async (id: string) => {
    await api.delete(`/api/sessions/${id}`);
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },

  updateSessionLocally: (id: string, updates: Partial<Session>) => {
    set({
      sessions: get().sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      currentSession:
        get().currentSession?.id === id
          ? { ...get().currentSession!, ...updates }
          : get().currentSession,
    });
  },
}));
