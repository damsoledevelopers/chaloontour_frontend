'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../../components/Layout/DashboardLayout';
import DashboardCharts from '../../../components/Dashboard/DashboardCharts';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/api';
import { getLeadsPath, getScopedPath } from '../../../lib/appPaths';
import { Users, TrendingUp, Target, UserPlus, ArrowRight, Activity, BarChart3, Calendar, Bell, Clock } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const SOURCE_LABELS = {
  manual: 'Manual',
  excel: 'Excel',
};

const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  booked: 'Booked',
  lost: 'Lost',
};

function MetricCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5 flex-1">
          <div className="h-3 bg-gray-200 rounded w-20" />
          <div className="h-6 bg-gray-200 rounded w-14" />
        </div>
        <div className="h-10 w-10 rounded-xl bg-gray-200" />
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, subLabel, href, colorClass }) {
  const content = (
    <div className={`rounded-xl border shadow-card p-4 h-full transition-all hover:shadow-card-hover ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-600 truncate">{label}</p>
          <p className="text-xl font-bold text-primary-800 mt-0.5">{value}</p>
          {subLabel && <p className="text-xs text-gray-500 mt-0.5 truncate">{subLabel}</p>}
        </div>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/80 shadow-inner flex-shrink-0">
          <Icon className="h-5 w-5 text-primary-600" />
        </div>
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block h-full">{content}</Link>;
  return content;
}

export default function SuperAdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const leadsPath = getLeadsPath(user);
  const remindersPath = getScopedPath(user, '/calendar');
  const addLeadPath = getScopedPath(user, '/leads/new');

  useEffect(() => {
    if (!user || authLoading) return;
    setError(null);
    api
      .get('/stats/dashboard')
      .then((r) => setData(r.data || {}))
      .catch(() => {
        setError('Failed to load dashboard');
        toast.error('Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const inquiryEntries = useMemo(() => {
    if (!data?.inquiryStats) return [];
    return Object.entries(data.inquiryStats)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name: SOURCE_LABELS[name] || name, value }));
  }, [data?.inquiryStats]);

  const statusEntries = useMemo(() => {
    if (!data?.statusBreakdown) return [];
    return Object.entries(data.statusBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ status: STATUS_LABELS[status] || status, count }));
  }, [data?.statusBreakdown]);

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-4">
            <div className="h-8 bg-primary-100 rounded-lg w-40 animate-pulse" />
            <div className="flex gap-2">
              <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 flex-shrink-0 mb-4">
            {[1, 2, 3, 4].map((i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            <div className="bg-white rounded-xl border border-gray-100 animate-pulse shadow-card min-h-0" />
            <div className="bg-white rounded-xl border border-gray-100 animate-pulse shadow-card min-h-0" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  const totalLeads = data?.totalLeads ?? 0;
  const activeLeads = data?.activeLeads ?? 0;
  const newToday = data?.newLeadsToday ?? 0;
  const newMonth = data?.newLeadsThisMonth ?? 0;
  const conversionRate = data?.conversionRate ?? 0;
  const newLeads = data?.newLeads ?? 0;
  const bookedLeads = data?.bookedLeads ?? 0;
  const paymentPendingLeads = data?.paymentPendingLeads ?? 0;
  const todaysFollowUps = data?.todaysFollowUps?.total ?? 0;
  const missedFollowUps = data?.missedFollowUps ?? 0;

  // Staff dashboard: simpler UI, only "My Leads" metrics and one chart
  if (user.role === 'staff') {
    return (
      <DashboardLayout>
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-3">
            <h1 className="text-xl font-bold text-primary-900">My Dashboard</h1>
            <div className="flex items-center gap-2">
              <Link
                href={remindersPath}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
              >
                <Calendar className="h-4 w-4" />
                Reminders
              </Link>
              <Link
                href={leadsPath}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm shadow-sm transition-colors"
              >
                <Users className="h-4 w-4" />
                View My Leads
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {error && (
            <div className="flex-shrink-0 rounded-lg bg-accent-50 border border-accent-200 px-3 py-2 text-sm text-accent-800 mb-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0 mb-4">
            <MetricCard
              icon={Users}
              label="My Leads"
              value={totalLeads}
              href={leadsPath}
              colorClass="bg-white border-gray-200"
            />
            <MetricCard
              icon={Activity}
              label="New"
              value={newLeads}
              href={leadsPath}
              colorClass="bg-white border-gray-200"
            />
            <MetricCard
              icon={Target}
              label="Booked"
              value={bookedLeads}
              href={leadsPath}
              colorClass="bg-white border-gray-200"
            />
            <MetricCard
              icon={TrendingUp}
              label="Payment Pending"
              value={paymentPendingLeads}
              href={leadsPath}
              colorClass="bg-white border-gray-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 flex-shrink-0 mb-4">
            <MetricCard
              icon={Clock}
              label="Today's Follow-Ups"
              value={todaysFollowUps}
              href={remindersPath}
              colorClass="bg-white border-gray-200"
            />
            <MetricCard
              icon={Bell}
              label="Missed Follow-Ups"
              value={missedFollowUps}
              href={`${leadsPath}?missed=1`}
              colorClass="bg-white border-gray-200"
            />
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <Link href={leadsPath} className="flex flex-col min-h-0 bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden hover:shadow-card-hover transition-shadow cursor-pointer">
              <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-primary-50/50 to-accent-50/30 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-accent-100 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-accent-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-primary-900">My Leads by Status</h2>
                  <p className="text-xs text-gray-500">Pipeline breakdown — click to view leads</p>
                </div>
              </div>
              <div className="flex-1 min-h-0 p-4">
                <div className="h-full w-full">
                  <DashboardCharts chart="status" data={statusEntries} emptyMessage="No status data yet." height="100%" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Superadmin dashboard: full view
  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-3">
          <h1 className="text-xl font-bold text-primary-900">Dashboard</h1>
          <div className="flex items-center gap-2">
            <Link
              href={remindersPath}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Reminders
            </Link>
            <Link
              href={leadsPath}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm shadow-sm transition-colors"
            >
              <Users className="h-4 w-4" />
              Manage Leads
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={addLeadPath}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Add Lead
            </Link>
          </div>
        </div>

        {error && (
          <div className="flex-shrink-0 rounded-lg bg-accent-50 border border-accent-200 px-3 py-2 text-sm text-accent-800 mb-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 flex-shrink-0 mb-4">
          <MetricCard
            icon={Users}
            label="Total Leads"
            value={totalLeads}
            href={leadsPath}
            colorClass="bg-white border-gray-200"
          />
          <MetricCard
            icon={Activity}
            label="Active Leads"
            value={activeLeads}
            subLabel="In pipeline"
            href={leadsPath}
            colorClass="bg-white border-gray-200"
          />
          <MetricCard
            icon={TrendingUp}
            label="New This Month"
            value={newMonth}
            subLabel={newToday > 0 ? `Today: ${newToday}` : null}
            colorClass="bg-white border-gray-200"
          />
          <MetricCard
            icon={Target}
            label="Conversion Rate"
            value={`${conversionRate}%`}
            subLabel="Booked"
            colorClass="bg-white border-gray-200"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          <div className="flex flex-col min-h-0 bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
            <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-primary-50/80 to-transparent flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary-100 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-primary-900">Leads by Source</h2>
                <p className="text-xs text-gray-500">Distribution by channel</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <div className="h-full w-full">
                <DashboardCharts chart="source" data={inquiryEntries} emptyMessage="No source data yet." height="100%" />
              </div>
            </div>
          </div>

          <div className="flex flex-col min-h-0 bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
            <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-primary-50/50 to-accent-50/30 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-accent-100 flex items-center justify-center">
                <Activity className="h-4 w-4 text-accent-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-primary-900">Leads by Status</h2>
                <p className="text-xs text-gray-500">Pipeline breakdown</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <div className="h-full w-full">
                <DashboardCharts chart="status" data={statusEntries} emptyMessage="No status data yet." height="100%" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
