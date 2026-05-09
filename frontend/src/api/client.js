import axios from 'axios';
import { getPublicApiBaseUrl } from '../config/publicUrls';

const api = axios.create({
  baseURL: getPublicApiBaseUrl(),
  withCredentials: true,
  timeout: 15000,
});

/** Prevents cascades of 401s firing multiple competing full-page redirects during token expiry bursts */
let redirectingAfterAuthFailure = false;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isCallbackPage = window.location.pathname === '/auth/callback';
    if (err.response?.status === 401 && !isCallbackPage) {
      if (!redirectingAfterAuthFailure) {
        redirectingAfterAuthFailure = true;
        try {
          localStorage.removeItem('token');
        } catch {
          /* storage may be unavailable in hardened browsers — still navigate */
        }
        window.location.replace(`${window.location.origin}/`);
      }
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  getMe: () => api.get('/api/auth/me'),
  githubCallback: (code) =>
    api.get('/api/auth/github/callback', {
      params: {
        code,
        redirect_uri: `${window.location.origin}/auth/callback`,
      },
    }),
};

export const reposApi = {
  list: () => api.get('/api/repos'),
  listGithub: () => api.get('/api/repos/github'),
  connect: (data) => api.post('/api/repos', data),
  disconnect: (id) => api.delete(`/api/repos/${id}`),
};

export const reviewsApi = {
  list: (params) => api.get('/api/reviews', { params }),
  getOne: (id) => api.get(`/api/reviews/${id}`),
  getStats: () => api.get('/api/reviews/stats'),
  trigger: (data) => api.post('/api/reviews/trigger', data),
  triggerLatest: (repositoryId) => api.post('/api/reviews/trigger/latest', { repositoryId }),
  retryPending: (reviewId) => api.post(`/api/reviews/retry/${reviewId}`),
};

export default api;
