'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

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
      const u = res.data.user;
      if (u.role !== 'super_admin') {
        removeToken();
        setUser(null);
        router.push('/auth/login');
        return;
      }
      setUser(u);
    } catch (err) {
      removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email: email.trim(), password: password.trim() });
    const { token, user: u } = res.data;
    if (!u || u.role !== 'super_admin') {
      removeToken();
      throw new Error('Only Super Admin can access this app.');
    }
    setToken(token);
    setUser(u);
    try {
      const meRes = await api.get('/auth/me');
      if (meRes.data && meRes.data.user) setUser(meRes.data.user);
    } catch (_) {}
    router.push('/admin/dashboard');
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
