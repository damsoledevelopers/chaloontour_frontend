'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { getRoleHomePath, normalizeRoleForApp } from '../lib/appPaths';

const getToken = () => (typeof window === 'undefined' ? null : localStorage.getItem('token'));
const setToken = (token) => { if (typeof window !== 'undefined') localStorage.setItem('token', token); };
const removeToken = () => { if (typeof window !== 'undefined') localStorage.removeItem('token'); };

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissionsLoaded, setPermissionsLoaded] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (token) fetchUser();
    else setLoading(false);
  }, []);

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      const raw = res.data.user;
      const u = {
        ...raw,
        id: raw?.id ?? (raw?._id != null ? String(raw._id) : undefined),
        role: normalizeRoleForApp(raw?.role)
      };
      const allowedRoles = ['superadmin', 'staff'];
      if (!allowedRoles.includes(u.role)) {
        removeToken();
        setUser(null);
        router.push('/auth/login');
        return;
      }
      setUser(u);
    } catch (err) {
      const status = err?.response?.status;
      // Only clear token on 401 (actually invalid). On 503 (DB down) keep the token.
      if (status !== 503) {
        removeToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email: email.trim(), password: password.trim() });
    const { token, user: raw } = res.data;
    const u = raw
      ? {
          ...raw,
          id: raw.id ?? (raw._id != null ? String(raw._id) : undefined),
          role: normalizeRoleForApp(raw.role)
        }
      : null;
    const allowedRoles = ['superadmin', 'staff'];
    if (!u || !allowedRoles.includes(u.role)) {
      removeToken();
      throw new Error('Access denied. Only active admin or portal users can access this app.');
    }
    setToken(token);
    setUser(u);
    try {
      const meRes = await api.get('/auth/me');
      if (meRes.data && meRes.data.user) {
        const mu = meRes.data.user;
        setUser({
          ...mu,
          id: mu.id ?? (mu._id != null ? String(mu._id) : undefined),
          role: normalizeRoleForApp(mu.role)
        });
      }
    } catch (_) {}
    router.push(getRoleHomePath(u.role));
  };

  const logout = () => {
    removeToken();
    setUser(null);
    router.push('/auth/login');
  };

  const checkPermission = () => true;

  return (
    <AuthContext.Provider value={{ user, loading, permissionsLoaded, login, logout, fetchUser, checkPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
