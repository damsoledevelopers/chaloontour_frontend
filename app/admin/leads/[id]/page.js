'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '../../../../components/Layout/DashboardLayout';
import { useAuth } from '../../../../contexts/AuthContext';
import { getLeadsPath } from '../../../../lib/appPaths';

export default function LeadViewRedirect() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id;
  const leadsPath = getLeadsPath(user);
  useEffect(() => {
    if (id) router.replace(`${leadsPath}?view=${id}`);
  }, [id, router, leadsPath]);
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    </DashboardLayout>
  );
}
