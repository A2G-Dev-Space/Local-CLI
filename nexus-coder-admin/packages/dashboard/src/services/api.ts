import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexus_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('nexus_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// API functions
export const authApi = {
  me: () => api.get('/auth/me'),
  callback: (token: string) => api.post('/auth/callback', {}, {
    headers: { Authorization: `Bearer ${token}` }
  }),
};

export const modelsApi = {
  list: () => api.get('/admin/models'),
  create: (data: CreateModelData) => api.post('/admin/models', data),
  update: (id: string, data: Partial<CreateModelData>) => api.put(`/admin/models/${id}`, data),
  delete: (id: string) => api.delete(`/admin/models/${id}`),
};

export const usersApi = {
  list: (page = 1, limit = 50) => api.get(`/admin/users?page=${page}&limit=${limit}`),
  get: (id: string) => api.get(`/admin/users/${id}`),
};

export const statsApi = {
  overview: () => api.get('/admin/stats/overview'),
  daily: (days = 30) => api.get(`/admin/stats/daily?days=${days}`),
  byUser: (days = 30) => api.get(`/admin/stats/by-user?days=${days}`),
  byModel: (days = 30) => api.get(`/admin/stats/by-model?days=${days}`),
  byDept: (days = 30) => api.get(`/admin/stats/by-dept?days=${days}`),
};

interface CreateModelData {
  name: string;
  displayName: string;
  endpointUrl: string;
  apiKey?: string;
  maxTokens?: number;
  enabled?: boolean;
}
