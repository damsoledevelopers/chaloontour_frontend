'use client';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import DashboardHeader from './DashboardHeader';

const SIDEBAR_COLLAPSED_KEY = 'chalo-sidebar-collapsed';

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === 'true') setSidebarCollapsed(true);
  }, []);

  const handleToggleCollapse = () => {
    setSidebarCollapsed((c) => {
      const next = !c;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };
  return (
    <div className="h-screen flex overflow-hidden bg-gradient-to-br from-primary-50/80 via-slate-50 to-accent-50/30">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isCollapsed={sidebarCollapsed} onToggleCollapse={handleToggleCollapse} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-5">{children}</main>
      </div>
    </div>
  );
}
