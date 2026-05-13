'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, Activity, ChevronDown, User, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api, getProfileImageUrl } from '../../lib/api';
import { getLeadsPath } from '../../lib/appPaths';

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

export default function DashboardHeader({ onMenuClick }) {
  const { user } = useAuth();
  const [activityOpen, setActivityOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const dropdownRef = useRef(null);
  const leadsPath = getLeadsPath(user);
  const appTitle = user?.role === 'staff' ? 'ChaloOnTour Portal' : 'ChaloOnTour Admin';
  const activityTitle = user?.role === 'staff' ? 'My activity' : 'Staff activity';
  const activitySubtitle = user?.role === 'staff' ? 'Recently updated assigned leads' : 'Recently updated leads';

  useEffect(() => {
    if (activityOpen && activities.length === 0) {
      setLoadingActivity(true);
      api.get('/leads/recent-activity?limit=15')
        .then((r) => setActivities(r.data?.activities || []))
        .catch(() => setActivities([]))
        .finally(() => setLoadingActivity(false));
    }
  }, [activityOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setActivityOpen(false);
    }
    if (activityOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activityOpen]);

  return (
    <header className="no-print bg-white shadow-card border-b border-gray-200">
      <div className="flex items-center justify-between h-14 px-4 gap-2">
        <button type="button" className="lg:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors" onClick={onMenuClick}>
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 truncate">{appTitle}</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setActivityOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-colors shrink-0 border ${activityOpen ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Recent Active</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${activityOpen ? 'rotate-180' : ''}`} />
            </button>
            {activityOpen && (
              <div className="absolute right-0 top-full mt-1 w-80 max-h-[min(400px,70vh)] overflow-hidden bg-white rounded-xl shadow-lg border border-gray-200 z-50 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">{activityTitle}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{activitySubtitle}</p>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0">
                  {loadingActivity ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500">No recent activity</div>
                  ) : (
                    <ul className="py-2">
                      {activities.map((a) => {
                        const staffName = a.assigned_to ? `${a.assigned_to.firstName || ''} ${a.assigned_to.lastName || ''}`.trim() : null;
                        return (
                          <li key={a._id}>
                            <Link
                              href={`${leadsPath}/${a._id}`}
                              onClick={() => setActivityOpen(false)}
                              className="flex gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{a.name || a.leadId || 'Lead'}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{a.status}</span>
                                  <span className="text-xs text-gray-400">{formatTimeAgo(a.updatedAt)}</span>
                                </div>
                                {staffName && (
                                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {staffName}
                                  </p>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                  <Link
                    href={leadsPath}
                    onClick={() => setActivityOpen(false)}
                    className="text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    View all leads →
                  </Link>
                </div>
              </div>
            )}
          </div>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-semibold shadow-sm shrink-0 overflow-hidden bg-primary-600">
            {getProfileImageUrl(user?.profileImage) ? (
              <img src={getProfileImageUrl(user.profileImage)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
            )}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:inline truncate max-w-[120px]">{user?.firstName} {user?.lastName}</span>
        </div>
      </div>
    </header>
  );
}
