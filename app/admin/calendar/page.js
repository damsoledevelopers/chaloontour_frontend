'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '../../../components/Layout/DashboardLayout';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/api';
import { getLeadsPath } from '../../../lib/appPaths';
import Link from 'next/link';
import { Calendar, Bell, DollarSign, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const DEFAULT_LOOKAHEAD_DAYS = 5;

function ReminderCard({ icon: Icon, title, subtitle, items, emptyText, colorClass, formatDate, formatCurrency, leadsPath }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
      <div className={`px-4 py-3 border-b border-gray-100 ${colorClass}`}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-white/80 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-primary-900">{title}</h2>
            <p className="text-xs text-gray-600">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="p-4">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">{emptyText}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item, index) => (
              <li
                key={`${item.leadId}-${item.date}-${index}`}
                className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50/60"
              >
                <Icon className="h-4 w-4 mt-0.5 text-primary-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary-900">{formatDate(item.date)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.leadName}
                    {item.leadCode && ` (${item.leadCode})`}
                    {item.destination && ` · ${item.destination}`}
                    {item.status && ` · ${item.status}`}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Advance: {formatCurrency(item.advance_amount)} · Remaining: {formatCurrency(item.remaining_amount)}
                  </p>
                </div>
                <Link
                  href={`${leadsPath}/${item.leadId}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 flex-shrink-0"
                >
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const [overdueAdvanceReminders, setOverdueAdvanceReminders] = useState([]);
  const [overduePaymentReminders, setOverduePaymentReminders] = useState([]);
  const [advanceReminders, setAdvanceReminders] = useState([]);
  const [paymentReminders, setPaymentReminders] = useState([]);
  const [tripReminders, setTripReminders] = useState([]);
  const [lookaheadDays, setLookaheadDays] = useState(DEFAULT_LOOKAHEAD_DAYS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const leadsPath = getLeadsPath(user);

  const loadReminders = () => {
    if (!user || authLoading) return;
    setLoading(true);
    api
      .get('/leads/reminders')
      .then((r) => {
        setOverdueAdvanceReminders(r.data.overdueAdvanceReminders || []);
        setOverduePaymentReminders(r.data.overduePaymentReminders || []);
        setAdvanceReminders(r.data.advanceReminders || []);
        setPaymentReminders(r.data.paymentReminders || []);
        setTripReminders(r.data.tripReminders || []);
        setLookaheadDays(r.data.daysAhead || DEFAULT_LOOKAHEAD_DAYS);
      })
      .catch(() => {
        toast.error('Failed to load reminders');
        setOverdueAdvanceReminders([]);
        setOverduePaymentReminders([]);
        setAdvanceReminders([]);
        setPaymentReminders([]);
        setTripReminders([]);
        setLookaheadDays(DEFAULT_LOOKAHEAD_DAYS);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReminders();
  }, [user, authLoading]);

  if (authLoading || !user) return null;

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatCurrency = (n) => (n != null && !Number.isNaN(Number(n)) ? `₹${Number(n).toLocaleString('en-IN')}` : '–');

  const matchesSearch = (item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const fields = [
      item.leadName,
      item.leadCode,
      item.destination,
      item.payment_status,
      item.status
    ];
    return fields.some((f) => f && String(f).toLowerCase().includes(q));
  };

  const filteredOverdueAdvanceReminders = overdueAdvanceReminders.filter(matchesSearch);
  const filteredOverduePaymentReminders = overduePaymentReminders.filter(matchesSearch);
  const filteredAdvanceReminders = advanceReminders.filter(matchesSearch);
  const filteredPaymentReminders = paymentReminders.filter(matchesSearch);
  const filteredTripReminders = tripReminders.filter(matchesSearch);

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold text-primary-900">Reminders</h1>
          <div className="text-sm text-gray-600">
            Payment reminders show `qualified` and `booked` leads. Trip reminders show active leads for the next {lookaheadDays} days.
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-primary-50/80 to-transparent">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by lead name, lead ID, destination, status..."
                  className="w-full rounded-lg border border-primary-100 px-3 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
              <div className="space-y-6 p-4">
                <div className="space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold text-primary-900">Overdue</h2>
                    <p className="text-xs text-gray-500">Past due payment follow-ups that still need action.</p>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <ReminderCard
                      icon={Bell}
                      title="Overdue Advance"
                      subtitle="Advance payments that are already past due"
                      items={filteredOverdueAdvanceReminders}
                      emptyText="No overdue advance reminders."
                      colorClass="bg-gradient-to-r from-rose-50/90 to-transparent"
                      formatDate={formatDate}
                      formatCurrency={formatCurrency}
                      leadsPath={leadsPath}
                    />
                    <ReminderCard
                      icon={DollarSign}
                      title="Overdue Payment"
                      subtitle="Final payments that are already past due"
                      items={filteredOverduePaymentReminders}
                      emptyText="No overdue payment reminders."
                      colorClass="bg-gradient-to-r from-orange-50/90 to-transparent"
                      formatDate={formatDate}
                      formatCurrency={formatCurrency}
                      leadsPath={leadsPath}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold text-primary-900">Upcoming</h2>
                    <p className="text-xs text-gray-500">Due dates and trip starts coming up in the next {lookaheadDays} days.</p>
                  </div>
                  <div className="grid gap-6 xl:grid-cols-3">
                    <ReminderCard
                      icon={Bell}
                      title="Advance Reminders"
                      subtitle={`Advance due dates in the next ${lookaheadDays} days`}
                      items={filteredAdvanceReminders}
                      emptyText={`No advance reminders in the next ${lookaheadDays} days.`}
                      colorClass="bg-gradient-to-r from-indigo-50/80 to-transparent"
                      formatDate={formatDate}
                      formatCurrency={formatCurrency}
                      leadsPath={leadsPath}
                    />
                    <ReminderCard
                      icon={DollarSign}
                      title="Payment Reminders"
                      subtitle={`Payment due dates in the next ${lookaheadDays} days`}
                      items={filteredPaymentReminders}
                      emptyText={`No payment reminders in the next ${lookaheadDays} days.`}
                      colorClass="bg-gradient-to-r from-amber-50/80 to-transparent"
                      formatDate={formatDate}
                      formatCurrency={formatCurrency}
                      leadsPath={leadsPath}
                    />
                    <ReminderCard
                      icon={Calendar}
                      title="Trip Reminders"
                      subtitle={`Trips starting in the next ${lookaheadDays} days`}
                      items={filteredTripReminders}
                      emptyText={`No trip reminders in the next ${lookaheadDays} days.`}
                      colorClass="bg-gradient-to-r from-primary-50/80 to-transparent"
                      formatDate={formatDate}
                      formatCurrency={formatCurrency}
                      leadsPath={leadsPath}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
