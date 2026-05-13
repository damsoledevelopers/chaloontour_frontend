import { Suspense } from 'react';
import AdminLayoutClient from './AdminLayoutClient';

export default function AdminLayout({ children }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
      </div>
    }>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </Suspense>
  );
}
