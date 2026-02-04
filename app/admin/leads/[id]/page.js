'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '../../../../components/Layout/DashboardLayout';

export default function LeadViewRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  useEffect(() => {
    if (id) router.replace(`/admin/leads?view=${id}`);
  }, [id, router]);
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    </DashboardLayout>
  );
}
