// Axios client with JWT auth interceptor
// Equivalent to ApiService._getHeaders() in Flutter

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'https://spotlight-backend-x0q7.onrender.com/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 15000,
});

// Attach auth token on every request — equivalent to Flutter's _getHeaders()
apiClient.interceptors.request.use((config) => {
  config.headers['ngrok-skip-browser-warning'] = 'true';
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — clear auth and redirect
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('userId');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Equivalent to ApiService.formatExceptionMessage()
export function formatApiError(error: unknown, defaultMsg: string): string {
  if (!error) return defaultMsg;

  if (axios.isAxiosError(error)) {
    // Network-level errors (no response received)
    if (!error.response) {
      return 'Connection error. Please check your internet connection and try again.';
    }

    const status = error.response.status;

    // Extract backend message first so it takes priority
    const backendMsg = error.response.data?.error ?? error.response.data?.message;

    if (status === 401) {
      return backendMsg ?? 'Your session has expired. Please log in again.';
    }
    if (status === 403) {
      return backendMsg ?? 'You do not have permission to perform this action.';
    }
    if (status === 404) {
      return backendMsg ?? 'The requested resource was not found.';
    }
    if (status === 409 || (backendMsg && (String(backendMsg).toLowerCase().includes('already_exists') || String(backendMsg).toLowerCase().includes('already exists')))) {
      return 'An account with this email address already exists.';
    }
    if (status >= 500) {
      return 'An unexpected server error occurred. Please try again later.';
    }

    // Other 4xx — use backend message if present
    if (backendMsg) return backendMsg;

    // Fallback string checks for edge cases
    const errStr = String(error).toLowerCase();
    if (errStr.includes('user_not_found') || errStr.includes('invalid_credentials') ||
        errStr.includes('invalid password') || errStr.includes('invalid email or password')) {
      return 'Invalid email address or password. Please try again.';
    }

    return defaultMsg;
  }

  // Non-axios errors (plain JS errors, network failures)
  const errStr = String(error).toLowerCase();
  if (errStr.includes('network error') || errStr.includes('econnrefused') ||
      errStr.includes('failed to fetch') || errStr.includes('timeout')) {
    return 'Connection error. Please check your internet connection and try again.';
  }

  return defaultMsg;
}

export default apiClient;
