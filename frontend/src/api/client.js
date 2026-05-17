import axios from 'axios';
import { getPublicApiBaseUrl } from '../config/publicUrls';
import { attachApiContractGuard } from './contractGuard';

const api = axios.create({
  baseURL: getPublicApiBaseUrl(),
  withCredentials: true,
  timeout: 15000,
});

/** Prevents cascades of 401s firing multiple competing full-page redirects during session expiry bursts */
let redirectingAfterAuthFailure = false;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const requestUrl = String(err.config?.url || '');
    const isAuthMeProbe = requestUrl.includes('/api/auth/me');
    const isCallbackPage = window.location.pathname === '/auth/callback';
    const isPublicHome = window.location.pathname === '/';

    // 401 on /api/auth/me is normal when logged out — do not full-page redirect (causes reload loop).
    if (status === 401 && !isCallbackPage && !isAuthMeProbe && !isPublicHome) {
      if (!redirectingAfterAuthFailure) {
        redirectingAfterAuthFailure = true;
        window.location.replace(`${window.location.origin}/`);
      }
    }
    return Promise.reject(err);
  }
);

attachApiContractGuard(api);

export const authApi = {
  getMe: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
  githubCallback: (code, state) =>
    api.get('/api/auth/github/callback', {
      params: {
        code,
        ...(state ? { state } : {}),
        redirect_uri: `${window.location.origin}/auth/callback`,
      },
    }),
};

export const reposApi = {
  list: () => api.get('/api/repos'),
  listGithub: () => api.get('/api/repos/github'),
  listBranches: (id) => api.get(`/api/repos/${id}/branches`),
  connect: (data) => api.post('/api/repos', data),
  disconnect: (id) => api.delete(`/api/repos/${id}`),
  syncWebhook: (id) => api.post(`/api/repos/${id}/sync-webhook`),
};

export const reviewsApi = {
  list: (params) => api.get('/api/reviews', { params }),
  getOne: (id) => api.get(`/api/reviews/${id}`),
  getStats: () => api.get('/api/reviews/stats'),
  trigger: (data) => api.post('/api/reviews/trigger', data),
  triggerLatest: (repositoryId, branch) =>
    api.post('/api/reviews/trigger/latest', {
      repositoryId,
      ...(branch ? { branch } : {}),
    }),
  retryPending: (reviewId) => api.post(`/api/reviews/retry/${reviewId}`),
};

export const reportsApi = {
  list: (params) => api.get('/api/reports', { params }),
  getOne: (id, config) => api.get(`/api/reports/${id}`, config),
  getMarkdown: (id) => api.get(`/api/reports/${id}/markdown`),
  confirmRemediation: (id) => api.post(`/api/reports/${id}/confirm-remediation`),
};

export default api;
