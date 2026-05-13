'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/Layout/DashboardLayout';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/api';
import { getLeadsPath } from '../../../lib/appPaths';
import Link from 'next/link';
import { MapPin, Calendar, ArrowRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TripsPage() {
  const { user, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [destination, setDestination] = useState('');
  const leadsPath = getLeadsPath(user);

  useEffect(() => {
    if (!user || authLoading) return;
    api.get('/leads/trips/destinations').then((r) => setDestinations(r.data.destinations || [])).catch(() => setDestinations([]));
  }, [user, authLoading]);

  useEffect(() => {
    if (!user || authLoading) return;
    setLoading(true);
    const params = { page: pagination.page, limit: pagination.limit };
    if (from) params.from = from;
    if (to) params.to = to;
    if (destination) params.destination = destination;
    api
      .get('/leads/trips', { params })
      .then((r) => {
        setTrips(r.data.trips || []);
        setPagination((prev) => ({ ...prev, ...(r.data.pagination || {}) }));
      })
      .catch(() => {
        toast.error('Failed to load trip plans');
        setTrips([]);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading, pagination.page, pagination.limit, from, to, destination]);

  if (authLoading || !user) return null;

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
  const assignedName = (lead) => {
    const a = lead.assigned_to;
    if (!a) return 'Unassigned';
    return typeof a === 'object' ? `${a.firstName || ''} ${a.lastName || ''}`.trim() || '–' : '–';
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-4">
          <h1 className="text-xl font-bold text-primary-900">Trip plans</h1>
          <Link
            href={leadsPath}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm shadow-sm transition-colors"
          >
            <Users className="h-4 w-4" />
            All leads
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex-shrink-0 flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm text-gray-600">Destination</label>
          <select
            value={destination}
            onChange={(e) => { setDestination(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 min-w-[160px]"
          >
            <option value="">All destinations</option>
            {destinations.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <label className="text-sm text-gray-600">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
          <label className="text-sm text-gray-600">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
          {(from || to || destination) && (
            <button
              type="button"
              onClick={() => { setFrom(''); setTo(''); setDestination(''); setPagination((p) => ({ ...p, page: 1 })); }}
              className="text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white rounded-xl border border-gray-100 shadow-card">
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-primary-50/80 to-transparent flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-primary-900">Every trip plan in one place</h2>
              <p className="text-xs text-gray-500">Leads with travel date, sorted by date</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : trips.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No trip plans found. Add travel dates to leads.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-900">Travel date</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">Destination</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">Lead</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">Assigned to</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trips.map((t) => (
                    <tr key={t._id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          {formatDate(t.travel_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{t.destination || '–'}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-primary-900">{t.name}</span>
                        {t.leadId && <span className="text-gray-500 ml-1">({t.leadId})</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 capitalize">{t.status || '–'}</td>
                      <td className="px-4 py-3 text-gray-600">{assignedName(t)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`${leadsPath}/${t._id}`}
                          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Open <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {pagination.pages > 1 && (
            <div className="flex-shrink-0 px-4 py-2 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
              <span>Page {pagination.page} of {pagination.pages} ({pagination.total} trips)</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
