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

// Service API
export const serviceApi = {
  list: () => api.get('/services'),
  listAll: () => api.get('/services/all'),
  get: (id: string) => api.get(`/services/${id}`),
  create: (data: CreateServiceData) => api.post('/services', data),
  update: (id: string, data: Partial<CreateServiceData>) => api.put(`/services/${id}`, data),
  delete: (id: string) => api.delete(`/services/${id}`),
  stats: (id: string) => api.get(`/services/${id}/stats`),
};

export const modelsApi = {
  list: (serviceId?: string) => api.get('/admin/models', { params: { serviceId } }),
  create: (data: CreateModelData) => api.post('/admin/models', data),
  update: (id: string, data: Partial<CreateModelData>) => api.put(`/admin/models/${id}`, data),
  delete: (id: string, force = false) => api.delete(`/admin/models/${id}`, { params: { force } }),
  reorder: (modelIds: string[]) => api.put('/admin/models/reorder', { modelIds }),
};

export const usersApi = {
  list: (page = 1, limit = 50, serviceId?: string) =>
    api.get('/admin/users', { params: { page, limit, serviceId } }),
  get: (id: string) => api.get(`/admin/users/${id}`),
  getAdminStatus: (id: string) => api.get(`/admin/users/${id}/admin-status`),
  promote: (id: string, role: 'ADMIN' | 'VIEWER', serviceId?: string) =>
    api.post(`/admin/users/${id}/promote`, { role, serviceId }),
  demote: (id: string, serviceId?: string) =>
    api.delete(`/admin/users/${id}/demote`, { data: { serviceId } }),
};

export const feedbackApi = {
  list: (params?: { status?: string; category?: string; page?: number; limit?: number; serviceId?: string }) =>
    api.get('/feedback', { params }),
  byService: () => api.get('/feedback/by-service'),
  get: (id: string) => api.get(`/feedback/${id}`),
  create: (data: { category: string; title: string; content: string; serviceId?: string }) =>
    api.post('/feedback', data),
  update: (id: string, data: { category?: string; title?: string; content?: string; serviceId?: string }) =>
    api.put(`/feedback/${id}`, data),
  delete: (id: string) => api.delete(`/feedback/${id}`),
  respond: (id: string, data: { response: string; status?: string }) =>
    api.post(`/feedback/${id}/respond`, data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/feedback/${id}/status`, { status }),
  stats: (serviceId?: string) => api.get('/feedback/stats/overview', { params: { serviceId } }),
  // 댓글 API
  addComment: (feedbackId: string, content: string) =>
    api.post(`/feedback/${feedbackId}/comments`, { content }),
  updateComment: (feedbackId: string, commentId: string, content: string) =>
    api.put(`/feedback/${feedbackId}/comments/${commentId}`, { content }),
  deleteComment: (feedbackId: string, commentId: string) =>
    api.delete(`/feedback/${feedbackId}/comments/${commentId}`),
};

export const statsApi = {
  // Service-specific stats
  overview: (serviceId?: string) => api.get('/admin/stats/overview', { params: { serviceId } }),
  daily: (days = 30, serviceId?: string) => api.get('/admin/stats/daily', { params: { days, serviceId } }),
  byUser: (days = 30, serviceId?: string) => api.get('/admin/stats/by-user', { params: { days, serviceId } }),
  byModel: (days = 30, serviceId?: string) => api.get('/admin/stats/by-model', { params: { days, serviceId } }),
  byDept: (days = 30, serviceId?: string) => api.get('/admin/stats/by-dept', { params: { days, serviceId } }),
  dailyActiveUsers: (days = 30, serviceId?: string) =>
    api.get('/admin/stats/daily-active-users', { params: { days, serviceId } }),
  cumulativeUsers: (days = 30, serviceId?: string) =>
    api.get('/admin/stats/cumulative-users', { params: { days, serviceId } }),
  modelDailyTrend: (days = 30, serviceId?: string) =>
    api.get('/admin/stats/model-daily-trend', { params: { days, serviceId } }),
  modelUserTrend: (modelId: string, days = 30, topN = 10, serviceId?: string) =>
    api.get('/admin/stats/model-user-trend', { params: { modelId, days, topN, serviceId } }),

  // Global stats (across all services)
  globalOverview: () => api.get('/admin/stats/global/overview'),
  globalByService: (days = 30) => api.get('/admin/stats/global/by-service', { params: { days } }),
  globalByDept: (days = 30) => api.get('/admin/stats/global/by-dept', { params: { days } }),
  globalByDeptDaily: (days = 30, topN = 5) => api.get('/admin/stats/global/by-dept-daily', { params: { days, topN } }),
  globalByDeptUsersDaily: (days = 30, topN = 5) => api.get('/admin/stats/global/by-dept-users-daily', { params: { days, topN } }),
  globalByDeptServiceRequestsDaily: (days = 30, topN = 10) => api.get('/admin/stats/global/by-dept-service-requests-daily', { params: { days, topN } }),

  // Latency stats
  latency: () => api.get('/admin/stats/latency'),
  latencyHistory: (hours = 24, interval = 10) => api.get('/admin/stats/latency/history', { params: { hours, interval } }),
};

// 개인 사용량 API
export const myUsageApi = {
  summary: (serviceId?: string) => api.get('/my-usage/summary', { params: { serviceId } }),
  daily: (days = 30, serviceId?: string) => api.get('/my-usage/daily', { params: { days, serviceId } }),
  byModel: (days = 30, serviceId?: string) => api.get('/my-usage/by-model', { params: { days, serviceId } }),
  byService: (days = 30) => api.get('/my-usage/by-service', { params: { days } }),
  recent: (limit = 50, offset = 0, serviceId?: string) =>
    api.get('/my-usage/recent', { params: { limit, offset, serviceId } }),
};

// 모델 평점 API
export const ratingApi = {
  stats: (days = 30, serviceId?: string) => api.get('/rating/stats', { params: { days, serviceId } }),
};

// 통합 사용자 관리 API
export interface UnifiedUserFilters {
  page?: number;
  limit?: number;
  serviceId?: string;
  businessUnit?: string;
  deptname?: string;
  role?: string;
  search?: string;
}

export interface ServicePermission {
  serviceId: string;
  role: string;
}

export const unifiedUsersApi = {
  list: (filters?: UnifiedUserFilters) => api.get('/admin/unified-users', { params: filters }),
  updatePermissions: (id: string, data: { globalRole?: string; servicePermissions?: ServicePermission[] }) =>
    api.put(`/admin/unified-users/${id}/permissions`, data),
};

interface CreateModelData {
  name: string;
  displayName: string;
  endpointUrl: string;
  apiKey?: string;
  maxTokens?: number;
  enabled?: boolean;
  serviceId?: string;
}

interface CreateServiceData {
  name: string;
  displayName: string;
  description?: string;
  iconUrl?: string;
  enabled?: boolean;
}
