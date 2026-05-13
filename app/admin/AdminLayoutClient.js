'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleHomePath } from '../../lib/appPaths';

export default function AdminLayoutClient({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Allow any authenticated user when export=1 (Puppeteer PDF generation)
  const isExportMode = searchParams.get('export') === '1';

  useEffect(() => {
    if (loading) return;
    // In export mode (headless Chrome PDF), skip all auth redirects
    if (isExportMode) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    // Skip role redirect in export mode — Puppeteer needs staff to access /admin/tour-pdf
    if (user.role !== 'superadmin') {
      router.replace(getRoleHomePath(user.role));
    }
  }, [user, loading, router, isExportMode]);

  // In export mode, render children immediately — Chrome has no auth token
  // and we don't want it stuck on a loading spinner
  if (isExportMode) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  // Allow render if superadmin
  if (!user || user.role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
