import axios from 'axios';
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
if (!API_URL.endsWith('/api')) API_URL = API_URL.replace(/\/$/, '') + '/api';
export const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' }, withCredentials: true });
const getToken = () => (typeof window === 'undefined' ? null : localStorage.getItem('token'));
const removeToken = () => { if (typeof window !== 'undefined') localStorage.removeItem('token'); };
api.interceptors.request.use((config) => { const t = getToken(); if (t) config.headers.Authorization = 'Bearer ' + t; return config; });
api.interceptors.response.use((r) => r, (err) => {
  if (err.response && err.response.status === 401 && typeof window !== 'undefined') {
    const path = window.location.pathname || '';
    const isAuthPage = path.includes('/auth/login') || path.includes('/auth/forgot-password') || path.includes('/auth/reset-password');
    if (!isAuthPage) { removeToken(); window.location.href = '/auth/login'; }
  }
  return Promise.reject(err);
});
