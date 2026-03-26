import { create } from 'zustand';
import { api } from '@/lib/api';

interface Agent {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  systemPrompt?: string;
  enabledTools: string[];
  visibility: 'PRIVATE' | 'PUBLIC' | 'ORG_SCOPED';
  visibilityScope?: string;
  usageCount: number;
  rating?: number;
  createdAt: string;
  updatedAt: string;
  customTools?: CustomTool[];
}

interface CustomTool {
  id: string;
  name: string;
  description: string;
  apiEndpoint: string;
  apiMethod: string;
  apiHeaders?: Record<string, string>;
  parameters: Record<string, unknown>;
  lastTestResult?: string;
}

interface AgentState {
  agents: Agent[];
  currentAgent: Agent | null;
  marketplaceAgents: Agent[];
  isLoading: boolean;
  error: string | null;

  listMyAgents: () => Promise<void>;
  getAgent: (id: string) => Promise<void>;
  createAgent: (data: Partial<Agent>) => Promise<Agent>;
  updateAgent: (id: string, data: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  publishAgent: (id: string) => Promise<void>;
  listMarketplace: (search?: string) => Promise<void>;
  clearError: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  currentAgent: null,
  marketplaceAgents: [],
  isLoading: false,
  error: null,

  listMyAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const agents = await api.get<Agent[]>('/api/agents');
      set({ agents, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load agents', isLoading: false });
    }
  },

  getAgent: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const agent = await api.get<Agent>(`/api/agents/${id}`);
      set({ currentAgent: agent, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load agent', isLoading: false });
    }
  },

  createAgent: async (data: Partial<Agent>) => {
    set({ isLoading: true, error: null });
    try {
      const agent = await api.post<Agent>('/api/agents', data);
      set({ agents: [...get().agents, agent], isLoading: false });
      return agent;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create agent', isLoading: false });
      throw err;
    }
  },

  updateAgent: async (id: string, data: Partial<Agent>) => {
    set({ isLoading: true, error: null });
    try {
      await api.put(`/api/agents/${id}`, data);
      set({ agents: get().agents.map(a => a.id === id ? { ...a, ...data } : a), isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update agent', isLoading: false });
    }
  },

  deleteAgent: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/api/agents/${id}`);
      set({ agents: get().agents.filter(a => a.id !== id), isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete agent', isLoading: false });
    }
  },

  publishAgent: async (id: string) => {
    try {
      await api.post(`/api/agents/${id}/publish`);
      set({ agents: get().agents.map(a => a.id === id ? { ...a, visibility: 'PUBLIC' as const } : a) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to publish agent' });
    }
  },

  listMarketplace: async (search?: string) => {
    set({ isLoading: true, error: null });
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const agents = await api.get<Agent[]>(`/api/agents/marketplace${query}`);
      set({ marketplaceAgents: agents, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load marketplace', isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
