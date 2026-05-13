'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../../components/Layout/DashboardLayout';
import { useAuth } from '../../../../contexts/AuthContext';
import { getLeadsPath } from '../../../../lib/appPaths';

export default function NewLeadRedirect() {
  const router = useRouter();
  const { user } = useAuth();
  const leadsPath = getLeadsPath(user);
  useEffect(() => {
    router.replace(`${leadsPath}?add=1`);
  }, [router, leadsPath]);
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    </DashboardLayout>
  );
}
