'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { X, User, Mail, Phone, Globe, Tag, BarChart3, Flame, Loader2, MessageSquare } from 'lucide-react';

const SOURCE_OPTIONS = [
  { value: 'website', label: 'Website' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'walk_in', label: 'Walk In' },
  { value: 'referral', label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'new', label: 'New Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'site_visit_scheduled', label: 'Site Visit Scheduled' },
  { value: 'site_visit_completed', label: 'Site Visit Completed' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'booked', label: 'Booked' },
  { value: 'lost', label: 'Lost' },
  { value: 'closed', label: 'Closed' },
  { value: 'junk', label: 'Junk / Invalid' },
];

const PRIORITY_OPTIONS = [
  { value: 'Hot', label: 'Hot' },
  { value: 'Warm', label: 'Warm' },
  { value: 'Cold', label: 'Cold' },
  { value: 'Not_interested', label: 'Not Interested' },
];

const initialForm = {
  contact: { firstName: '', lastName: '', email: '', phone: '', alternatePhone: '' },
  source: 'website',
  status: 'new',
  priority: 'Warm',
  inquiry: { message: '' },
};

export default function EditLeadModal({ open, leadId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!open || !leadId) return;
    setFetching(true);
    api.get(`/leads/${leadId}`)
      .then((r) => {
        const lead = r.data.lead;
        const c = lead.contact || {};
        setForm({
          contact: {
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            email: c.email || '',
            phone: c.phone || '',
            alternatePhone: c.alternatePhone || '',
          },
          source: lead.source || 'website',
          status: lead.status || 'new',
          priority: lead.priority || 'Warm',
          inquiry: { message: lead.inquiry?.message || '' },
        });
      })
      .catch(() => toast.error('Failed to load lead'))
      .finally(() => setFetching(false));
  }, [open, leadId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('contact.')) {
      const key = name.split('.')[1];
      setForm((prev) => ({ ...prev, contact: { ...prev.contact, [key]: value } }));
    } else setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/leads/${leadId}`, form);
      toast.success('Lead updated.');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-primary-600 to-primary-700">
          <h2 className="text-xl font-bold text-white">Edit Lead</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                  <User className="h-5 w-5 text-primary-600" />
                  <h3 className="font-semibold text-gray-900">Contact Information</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                      <input name="contact.firstName" required value={form.contact.firstName} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
                      <input name="contact.lastName" required value={form.contact.lastName} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input name="contact.email" type="email" required value={form.contact.email} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                      <input name="contact.phone" required value={form.contact.phone} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Alternate phone</label>
                      <input name="contact.alternatePhone" value={form.contact.alternatePhone} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary-600" />
                  <h3 className="font-semibold text-gray-900">Lead Details</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                    <select name="source" value={form.source} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-white">
                      {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select name="status" value={form.status} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-white">
                      {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select name="priority" value={form.priority} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-white">
                      {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Message</label>
                    <textarea value={form.inquiry.message} onChange={(e) => setForm((p) => ({ ...p, inquiry: { message: e.target.value } }))} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none" placeholder="Inquiry or notes..." />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-60">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                Update Lead
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
