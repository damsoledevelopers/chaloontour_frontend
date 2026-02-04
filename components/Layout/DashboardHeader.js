'use client';
import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function DashboardHeader({ onMenuClick }) {
  const { user } = useAuth();
  return (
    <header className="no-print bg-white shadow-card border-b border-gray-100">
      <div className="flex items-center justify-between h-14 px-4">
        <button type="button" className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-primary-50 hover:text-primary-700 transition-colors" onClick={onMenuClick}>
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-primary-800">ChaloOnTour Admin</h1>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-primary-600 rounded-xl flex items-center justify-center text-white text-sm font-semibold shadow-sm">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user?.firstName} {user?.lastName}</span>
        </div>
      </div>
    </header>
  );
}
