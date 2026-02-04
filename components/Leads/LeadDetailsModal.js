'use client';

import { X, Edit } from 'lucide-react';

const STATUS_LABELS = {
  new: 'New Lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  site_visit_scheduled: 'Site Visit Scheduled',
  site_visit_completed: 'Site Visit Completed',
  negotiation: 'Negotiation',
  booked: 'Booked',
  lost: 'Lost',
  closed: 'Closed',
  junk: 'Junk / Invalid',
};

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right break-all">{value || '–'}</span>
    </div>
  );
}

export default function LeadDetailsModal({ open, lead, onClose, onEdit, canEdit }) {
  if (!open) return null;

  const c = lead?.contact || {};
  const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown';
  const statusLabel = STATUS_LABELS[lead?.status] || lead?.status || '–';
  const createdDate = lead?.createdAt || lead?.createdDate;
  const created = createdDate ? new Date(createdDate).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-primary-600 to-primary-700">
          <h2 className="text-xl font-bold text-white">Lead Details – {name}</h2>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button type="button" onClick={() => onEdit?.(lead)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors">
                <Edit className="h-4 w-4" />
                Edit
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900">{name}</h3>
              <span className="text-sm font-medium text-primary-700 shrink-0">{statusLabel}</span>
            </div>
            <div className="p-4 space-y-0">
              <InfoRow label="Mobile Number" value={c.phone} />
              <InfoRow label="Email ID" value={c.email} />
              <InfoRow label="Lead Source" value={lead?.source} />
              <InfoRow label="Priority" value={lead?.priority} />
              <InfoRow label="Lead ID" value={lead?.leadId || lead?._id} />
              <InfoRow label="Created At" value={created} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
