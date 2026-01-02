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
  // SSO 기반 로그인 (토큰으로 인증)
  login: (token: string) => api.post('/auth/login', {}, {
    headers: { Authorization: `Bearer ${token}` }
  }),
  // 현재 세션 체크 (admin 아니어도 OK)
  check: () => api.get('/auth/check'),
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
  getAdminStatus: (id: string) => api.get(`/admin/users/${id}/admin-status`),
  promote: (id: string, role: 'ADMIN' | 'VIEWER') => api.post(`/admin/users/${id}/promote`, { role }),
  demote: (id: string) => api.delete(`/admin/users/${id}/demote`),
};

export const feedbackApi = {
  list: (params?: { status?: string; category?: string; page?: number; limit?: number }) =>
    api.get('/feedback', { params }),
  get: (id: string) => api.get(`/feedback/${id}`),
  create: (data: { category: string; title: string; content: string }) =>
    api.post('/feedback', data),
  update: (id: string, data: { category?: string; title?: string; content?: string }) =>
    api.put(`/feedback/${id}`, data),
  delete: (id: string) => api.delete(`/feedback/${id}`),
  respond: (id: string, data: { response: string; status?: string }) =>
    api.post(`/feedback/${id}/respond`, data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/feedback/${id}/status`, { status }),
  stats: () => api.get('/feedback/stats/overview'),
};

export const statsApi = {
  overview: () => api.get('/admin/stats/overview'),
  daily: (days = 30) => api.get(`/admin/stats/daily?days=${days}`),
  byUser: (days = 30) => api.get(`/admin/stats/by-user?days=${days}`),
  byModel: (days = 30) => api.get(`/admin/stats/by-model?days=${days}`),
  byDept: (days = 30) => api.get(`/admin/stats/by-dept?days=${days}`),
  dailyActiveUsers: (days = 30) => api.get(`/admin/stats/daily-active-users?days=${days}`),
  cumulativeUsers: (days = 30) => api.get(`/admin/stats/cumulative-users?days=${days}`),
  modelDailyTrend: (days = 30) => api.get(`/admin/stats/model-daily-trend?days=${days}`),
  modelUserTrend: (modelId: string, days = 30, topN = 10) =>
    api.get(`/admin/stats/model-user-trend?modelId=${modelId}&days=${days}&topN=${topN}`),
};

// 개인 사용량 API
export const myUsageApi = {
  summary: () => api.get('/my-usage/summary'),
  daily: (days = 30) => api.get(`/my-usage/daily?days=${days}`),
  byModel: (days = 30) => api.get(`/my-usage/by-model?days=${days}`),
  recent: (limit = 50, offset = 0) => api.get(`/my-usage/recent?limit=${limit}&offset=${offset}`),
};

// 모델 평점 API
export const ratingApi = {
  stats: (days = 30) => api.get(`/rating/stats?days=${days}`),
};

interface CreateModelData {
  name: string;
  displayName: string;
  endpointUrl: string;
  apiKey?: string;
  maxTokens?: number;
  enabled?: boolean;
}
