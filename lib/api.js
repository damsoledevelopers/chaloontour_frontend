import axios from 'axios';
const PRODUCTION_API = 'https://crm.chaloontour.com/api';

const getBaseUrl = () => {
  // CI/CD / VPS build should set this; production default must never be localhost
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }
    // Private LAN only (mobile testing) — never guess port on public domains
    if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) {
      return `http://${hostname}:5000/api`;
    }
    return PRODUCTION_API;
  }
  if (process.env.NODE_ENV === 'development') return 'http://localhost:5000/api';
  return PRODUCTION_API;
};

let API_URL = getBaseUrl();
// Ensure absolute URL (Vercel env may be set without https://)
if (typeof API_URL === 'string' && !/^https?:\/\//i.test(API_URL.trim())) API_URL = 'https://' + API_URL.trim();
if (!API_URL.endsWith('/api')) API_URL = API_URL.replace(/\/$/, '') + '/api';
export const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' }, withCredentials: true });

export function getProfileImageUrl(profileImage) {
  if (!profileImage) return null;
  let base = process.env.NEXT_PUBLIC_API_URL || PRODUCTION_API;
  if (typeof base === 'string' && !/^https?:\/\//i.test(base.trim())) base = 'https://' + base.trim();
  const uploadsBase = base.replace(/\/api\/?$/, '');
  return profileImage.startsWith('http') ? profileImage : `${uploadsBase}${profileImage.startsWith('/') ? '' : '/'}${profileImage}`;
}
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
