import axios from 'axios';
import { showGlobalToast } from '../components/common/Toast';
import { extractErrorMessage } from '../utils/errorMessages';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('No token found in localStorage for request:', config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401, 403 ve genel hata mesajları
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const currentPath = window.location.pathname;
    const errorUrl = error.config?.url || '';
    const token = localStorage.getItem('token');
    const silent = error.config?.headers?.['X-Silent-Error'] === 'true';

    if (status === 401) {
      // Don't log errors for log endpoint to avoid infinite loop
      if (!errorUrl.includes('/admin/logs/system/frontend')) {
        console.error('401 Unauthorized error:', {
          url: errorUrl,
          path: currentPath,
          hasToken: !!token,
          tokenPreview: token ? token.substring(0, 20) + '...' : 'null'
        });
      }

      // Sadece /auth/me hatasında otomatik login'e gönder
      if (errorUrl.includes('/auth/me')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (currentPath !== '/login') {
          window.location.href = '/login';
        }
      } else if (!silent && !errorUrl.includes('/auth/login') && currentPath !== '/login') {
        showGlobalToast('Oturum süresi doldu, lütfen tekrar giriş yapın.', 'warning');
      }
    } else if (status === 403) {
      console.error('403 Forbidden error:', {
        url: errorUrl,
        path: currentPath,
        hasToken: !!token
      });
      if (!silent) {
        showGlobalToast(extractErrorMessage(error, 'Bu işlem için yetkiniz yok.'), 'error');
      }
    } else if (status && status >= 500 && !silent) {
      showGlobalToast(extractErrorMessage(error), 'error');
    } else if (!error.response && !silent) {
      // Network/CORS hatası gibi response'suz durumlar
      showGlobalToast('Sunucuya bağlanılamadı. Bağlantınızı kontrol edin.', 'error');
    }

    return Promise.reject(error);
  }
);

export default api;
