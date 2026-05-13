'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { getRoleHomePath } from '../lib/appPaths';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && ['superadmin', 'staff'].includes(user.role)) {
      router.replace(getRoleHomePath(user.role));
    } else {
      router.replace('/auth/login');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
    </div>
  );
}
