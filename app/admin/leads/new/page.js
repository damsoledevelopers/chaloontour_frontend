'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../../components/Layout/DashboardLayout';

export default function NewLeadRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/leads?add=1');
  }, [router]);
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    </DashboardLayout>
  );
}
