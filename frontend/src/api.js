import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Token automatisch hinzufügen
api.interceptors.request.use(config => {
  // Admin-Endpunkte bekommen den adminToken, alle anderen den User-Token
  const isAdminRequest = config.url?.startsWith('/admin');
  const token = isAdminRequest
    ? localStorage.getItem('adminToken')
    : (localStorage.getItem('token') || localStorage.getItem('adminToken'));
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Bei 401 Token entfernen
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        localStorage.removeItem('adminToken');
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
