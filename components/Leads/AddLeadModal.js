'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { X, UserPlus, User, Mail, Phone, Globe, Tag, Loader2, MapPin, Building2, Plus, Trash2, Route, CheckCircle, XCircle, CreditCard, AlertCircle, Plane, ImagePlus, Users, Car } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'booked', label: 'Booked' },
  { value: 'lost', label: 'Lost' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
];

const initialForm = {
  name: '',
  phone: '',
  email: '',
  destination: '',
  travel_date: '',
  budget: '',
  status: 'new',
  notes: '',
  total_amount: '',
  advance_amount: '',
  advanceDueDate: '',
  paymentDueDate: '',
  payment_status: 'unpaid',
  packageCostPerPerson: '',
  kidsPackageCostPerPerson: '',
  paxCount: '',
  paxType: 'Adults',
  paxBreakup: [{ type: 'Adults', count: '' }],
  vehicleType: '',
  hotelCategory: '',
  mealPlan: '',
  tourNights: '',
  tourDays: '',
  tourStartDate: '',
  tourEndDate: '',
  pickupPoint: '',
  dropPoint: '',
  destinationsText: '',
  accommodation: [],
  vehicles: [],
  flights: [],
  itinerary: [],
  inclusions: '',
  exclusions: '',
  payment_policy: '',
  cancellation_policy: '',
  termsAndConditions: '',
  memorableTrip: '',
  tripImages: [],
};

const emptyAccommodationRow = () => ({ hotelName: '', nights: '', roomType: 'Double', sharing: 'Double', destination: '', hotelTotalAmount: '', hotelPaidAmount: '', hotelBalanceDueDate: '' });
const emptyVehicleRow = () => ({ vehicleName: '', vehicleType: '', vehicleTotalAmount: '', vehicleAdvanceAmount: '', vehicleBalanceDueDate: '' });
const emptyFlightRow = () => ({ from: '', to: '', airline: '', pnr: '', fare: '' });
const emptyItineraryRow = () => ({ day: '', route: '', description: '', placesText: '' });
const emptyPaxRow = () => ({ type: 'Adults', count: '' });

function mapPaxBreakupToForm(source) {
  if (Array.isArray(source?.paxBreakup) && source.paxBreakup.length) {
    return source.paxBreakup.map((item) => ({
      type: item.type || '',
      count: item.count != null ? String(item.count) : '',
    }));
  }
  if (source?.paxType || source?.paxCount != null) {
    return [{
      type: source.paxType || 'Adults',
      count: source.paxCount != null ? String(source.paxCount) : '',
    }];
  }
  return [emptyPaxRow()];
}

function getPaxSummary(paxBreakup) {
  const normalized = (paxBreakup || [])
    .map((item) => ({
      type: (item.type || '').trim(),
      count: item.count !== '' && item.count != null ? Number(item.count) : null,
    }))
    .filter((item) => item.type || item.count != null);
  const totalCount = normalized.reduce((sum, item) => sum + (Number.isFinite(item.count) ? item.count : 0), 0);
  const paxType = normalized
    .map((item) => [item.count != null ? item.count : null, item.type].filter(Boolean).join(' ').trim())
    .filter(Boolean)
    .join(', ');
  return {
    paxBreakup: normalized,
    paxCount: totalCount > 0 ? totalCount : undefined,
    paxType: paxType || undefined,
  };
}

function readFilesAsDataUrls(files) {
  return Promise.all(
    files.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }))
  );
}

export default function AddLeadModal({ open, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
  }, [open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const addAccommodationRow = () => {
    setForm((p) => ({ ...p, accommodation: [...(p.accommodation || []), emptyAccommodationRow()] }));
  };
  const updateAccommodationRow = (index, field, value) => {
    setForm((p) => {
      const next = [...(p.accommodation || [])];
      if (!next[index]) next[index] = emptyAccommodationRow();
      next[index] = { ...next[index], [field]: value };
      return { ...p, accommodation: next };
    });
  };
  const removeAccommodationRow = (index) => {
    setForm((p) => ({ ...p, accommodation: (p.accommodation || []).filter((_, i) => i !== index) }));
  };

  const addVehicleRow = () => {
    setForm((p) => ({ ...p, vehicles: [...(p.vehicles || []), emptyVehicleRow()] }));
  };
  const updateVehicleRow = (index, field, value) => {
    setForm((p) => {
      const next = [...(p.vehicles || [])];
      if (!next[index]) next[index] = emptyVehicleRow();
      next[index] = { ...next[index], [field]: value };
      return { ...p, vehicles: next };
    });
  };
  const removeVehicleRow = (index) => {
    setForm((p) => ({ ...p, vehicles: (p.vehicles || []).filter((_, i) => i !== index) }));
  };

  const addFlightRow = () => {
    setForm((p) => ({ ...p, flights: [...(p.flights || []), emptyFlightRow()] }));
  };
  const updateFlightRow = (index, field, value) => {
    setForm((p) => {
      const next = [...(p.flights || [])];
      if (!next[index]) next[index] = emptyFlightRow();
      next[index] = { ...next[index], [field]: value };
      return { ...p, flights: next };
    });
  };
  const removeFlightRow = (index) => {
    setForm((p) => ({ ...p, flights: (p.flights || []).filter((_, i) => i !== index) }));
  };

  const addPaxRow = () => {
    setForm((p) => ({ ...p, paxBreakup: [...(p.paxBreakup || []), emptyPaxRow()] }));
  };
  const updatePaxRow = (index, field, value) => {
    setForm((p) => {
      const next = [...(p.paxBreakup || [])];
      if (!next[index]) next[index] = emptyPaxRow();
      next[index] = { ...next[index], [field]: value };
      return { ...p, paxBreakup: next };
    });
  };
  const removePaxRow = (index) => {
    setForm((p) => ({ ...p, paxBreakup: (p.paxBreakup || []).filter((_, i) => i !== index) }));
  };

  const handleTripImagesChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const nextImages = await readFilesAsDataUrls(files.slice(0, 6));
      setForm((p) => ({ ...p, tripImages: [...(p.tripImages || []), ...nextImages].slice(0, 6) }));
    } catch {
      toast.error('Failed to load selected images.');
    } finally {
      e.target.value = '';
    }
  };

  const removeTripImage = (index) => {
    setForm((p) => ({ ...p, tripImages: (p.tripImages || []).filter((_, i) => i !== index) }));
  };

  const addItineraryDay = () => {
    setForm((p) => ({ ...p, itinerary: [...(p.itinerary || []), emptyItineraryRow()] }));
  };
  const updateItineraryRow = (index, field, value) => {
    setForm((p) => {
      const next = [...(p.itinerary || [])];
      if (!next[index]) next[index] = emptyItineraryRow();
      next[index] = { ...next[index], [field]: value };
      return { ...p, itinerary: next };
    });
  };
  const removeItineraryRow = (index) => {
    setForm((p) => ({ ...p, itinerary: (p.itinerary || []).filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const destinations = form.destinationsText.trim() ? form.destinationsText.split(/[,;]/).map((d) => d.trim()).filter(Boolean) : undefined;
      const paxSummary = getPaxSummary(form.paxBreakup);
      const accommodation = (form.accommodation || []).filter((a) => a.hotelName?.trim() || a.destination?.trim()).map((a) => ({
        hotelName: (a.hotelName || '').trim(),
        nights: a.nights !== '' && a.nights != null ? Number(a.nights) : null,
        roomType: (a.roomType || '').trim(),
        sharing: (a.sharing || '').trim(),
        destination: (a.destination || '').trim(),
        hotelTotalAmount: a.hotelTotalAmount !== '' && a.hotelTotalAmount != null ? Number(a.hotelTotalAmount) : null,
        hotelPaidAmount: a.hotelPaidAmount !== '' && a.hotelPaidAmount != null ? Number(a.hotelPaidAmount) : null,
        hotelBalanceDueDate: a.hotelBalanceDueDate || null,
      }));
      const vehicles = (form.vehicles || []).filter((v) => v.vehicleName?.trim() || v.vehicleType?.trim() || v.vehicleTotalAmount !== '' || v.vehicleAdvanceAmount !== '' || v.vehicleBalanceDueDate).map((v) => ({
        vehicleName: (v.vehicleName || '').trim(),
        vehicleType: (v.vehicleType || '').trim(),
        vehicleTotalAmount: v.vehicleTotalAmount !== '' && v.vehicleTotalAmount != null ? Number(v.vehicleTotalAmount) : null,
        vehicleAdvanceAmount: v.vehicleAdvanceAmount !== '' && v.vehicleAdvanceAmount != null ? Number(v.vehicleAdvanceAmount) : null,
        vehicleBalanceDueDate: v.vehicleBalanceDueDate || null,
      }));
      const flights = (form.flights || []).filter((f) => (f.from || f.to || f.airline || f.pnr)?.trim() || f.fare !== '' && f.fare != null).map((f) => ({
        from: (f.from || '').trim(),
        to: (f.to || '').trim(),
        airline: (f.airline || '').trim(),
        pnr: (f.pnr || '').trim(),
        fare: f.fare !== '' && f.fare != null ? Number(f.fare) : null,
      }));
      const itinerary = (form.itinerary || [])
        .filter((item) => item.day !== '' || item.route?.trim() || item.description?.trim() || item.placesText?.trim())
        .map((item) => ({
          day: item.day !== '' && item.day != null ? Number(item.day) : null,
          route: (item.route || '').trim(),
          description: (item.description || '').trim(),
          places: (item.placesText || '').split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean),
        }));
      await api.post('/leads', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() ? form.email.trim().toLowerCase() : undefined,
        destination: form.destination.trim() || undefined,
        travel_date: form.travel_date || undefined,
        budget: form.budget.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
        total_amount: form.total_amount ? Number(form.total_amount) : undefined,
        advance_amount: form.advance_amount ? Number(form.advance_amount) : undefined,
        advanceDueDate: form.advanceDueDate || undefined,
        paymentDueDate: form.paymentDueDate || undefined,
        payment_status: form.payment_status,
        packageCostPerPerson: form.packageCostPerPerson ? Number(form.packageCostPerPerson) : undefined,
        kidsPackageCostPerPerson: form.kidsPackageCostPerPerson ? Number(form.kidsPackageCostPerPerson) : undefined,
        paxCount: paxSummary.paxCount,
        paxType: paxSummary.paxType,
        paxBreakup: paxSummary.paxBreakup.length ? paxSummary.paxBreakup : undefined,
        vehicleType: form.vehicleType?.trim() || undefined,
        hotelCategory: form.hotelCategory?.trim() || undefined,
        mealPlan: form.mealPlan?.trim() || undefined,
        tourNights: form.tourNights ? Number(form.tourNights) : undefined,
        tourDays: form.tourDays ? Number(form.tourDays) : undefined,
        tourStartDate: form.tourStartDate || undefined,
        tourEndDate: form.tourEndDate || undefined,
        pickupPoint: form.pickupPoint?.trim() || undefined,
        dropPoint: form.dropPoint?.trim() || undefined,
        destinations,
        accommodation: accommodation.length ? accommodation : undefined,
        vehicles: vehicles.length ? vehicles : undefined,
        flights: flights.length ? flights : undefined,
        itinerary: itinerary.length ? itinerary : undefined,
        inclusions: form.inclusions?.trim() || undefined,
        exclusions: form.exclusions?.trim() || undefined,
        payment_policy: form.payment_policy?.trim() || undefined,
        cancellation_policy: form.cancellation_policy?.trim() || undefined,
        termsAndConditions: form.termsAndConditions?.trim() || undefined,
        memorableTrip: form.memorableTrip?.trim() || undefined,
        tripImages: (form.tripImages || []).length ? form.tripImages : undefined,
      });
      toast.success('Lead created successfully.');
      setForm(initialForm);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create lead.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setForm(initialForm);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-600 to-primary-700">
          <div className="flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Add New Lead</h2>
          </div>
          <button type="button" onClick={handleClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                <User className="h-5 w-5 text-primary-600" />
                <h3 className="font-semibold text-gray-900">Contact Information</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input name="name" required value={form.name} onChange={handleChange} placeholder="e.g. John Doe" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="e.g. john@example.com" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
                  <input name="phone" type="tel" required value={form.phone} onChange={handleChange} placeholder="e.g. 9876543210" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary-600" />
                <h3 className="font-semibold text-gray-900">Trip Details</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                  <input name="destination" value={form.destination} onChange={handleChange} placeholder="e.g. Goa" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Travel Date</label>
                  <input name="travel_date" type="date" value={form.travel_date} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                  <input name="budget" value={form.budget} onChange={handleChange} placeholder="e.g. 50000" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-white">
                    {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="Optional notes" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-gray-900">Tour Summary (Optional)</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Package Cost (₹)</label>
                    <input name="total_amount" type="number" min={0} value={form.total_amount} onChange={handleChange} placeholder="e.g. 62500" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Advance Amount (₹)</label>
                    <input name="advance_amount" type="number" min={0} value={form.advance_amount} onChange={handleChange} placeholder="e.g. 15000" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adult Cost Per Person (₹)</label>
                    <input name="packageCostPerPerson" type="number" min={0} value={form.packageCostPerPerson} onChange={handleChange} placeholder="e.g. 12500" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kids Cost Per Person (₹)</label>
                    <input name="kidsPackageCostPerPerson" type="number" min={0} value={form.kidsPackageCostPerPerson} onChange={handleChange} placeholder="e.g. 8500" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                  <select name="payment_status" value={form.payment_status} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-white">
                    {PAYMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Advance Due Date</label>
                    <input name="advanceDueDate" type="date" value={form.advanceDueDate} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Due Date</label>
                    <input name="paymentDueDate" type="date" value={form.paymentDueDate} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary-600" />
                      <label className="block text-sm font-medium text-gray-700">Pax Type And Count</label>
                    </div>
                    <button type="button" onClick={addPaxRow} className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800">
                      <Plus className="h-4 w-4" /> Add pax type
                    </button>
                  </div>
                  {(form.paxBreakup || []).map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Pax Type</label>
                        <input value={row.type || ''} onChange={(e) => updatePaxRow(i, 'type', e.target.value)} placeholder="e.g. Adults / Children / Infants" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">No. of Pax</label>
                        <input type="number" min={0} value={row.count ?? ''} onChange={(e) => updatePaxRow(i, 'count', e.target.value)} placeholder="e.g. 2" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                      </div>
                      <button type="button" onClick={() => removePaxRow(i)} className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                  <input name="vehicleType" value={form.vehicleType} onChange={handleChange} placeholder="e.g. Sedan or Similar" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Category</label>
                  <input name="hotelCategory" value={form.hotelCategory} onChange={handleChange} placeholder="e.g. 3 Star Category" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meal Plan</label>
                  <input name="mealPlan" value={form.mealPlan} onChange={handleChange} placeholder="e.g. Breakfast & Dinner" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tour Nights</label>
                    <input name="tourNights" type="number" min={0} value={form.tourNights} onChange={handleChange} placeholder="e.g. 7" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tour Days</label>
                    <input name="tourDays" type="number" min={0} value={form.tourDays} onChange={handleChange} placeholder="e.g. 8" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tour Start Date</label>
                    <input name="tourStartDate" type="date" value={form.tourStartDate} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tour End Date</label>
                    <input name="tourEndDate" type="date" value={form.tourEndDate} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pick up</label>
                  <input name="pickupPoint" value={form.pickupPoint} onChange={handleChange} placeholder="e.g. Rajkot Railway Station" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drop</label>
                  <input name="dropPoint" value={form.dropPoint} onChange={handleChange} placeholder="e.g. Surat Railway Station" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destinations (comma or semicolon separated)</label>
                  <input name="destinationsText" value={form.destinationsText} onChange={handleChange} placeholder="e.g. Dwarka, Somnath, Sasan Gir" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-gray-900">Accommodation (Optional)</h3>
                </div>
                <button type="button" onClick={addAccommodationRow} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">
                  <Plus className="h-4 w-4" /> Add hotel
                </button>
              </div>
              <div className="p-4 space-y-4">
                {(form.accommodation || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No hotels added. Click &quot;Add hotel&quot; to add accommodation.</p>
                ) : (
                  (form.accommodation || []).map((row, i) => (
                    <div key={i} className="p-3 border border-gray-200 rounded-lg bg-gray-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Hotel #{i + 1}</span>
                        <button type="button" onClick={() => removeAccommodationRow(i)} className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Hotel Name</label>
                          <input value={row.hotelName || ''} onChange={(e) => updateAccommodationRow(i, 'hotelName', e.target.value)} placeholder="e.g. Hotel The Dwarika" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Nights</label>
                          <input type="number" min={0} value={row.nights ?? ''} onChange={(e) => updateAccommodationRow(i, 'nights', e.target.value)} placeholder="2" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Room Type</label>
                          <input value={row.roomType || ''} onChange={(e) => updateAccommodationRow(i, 'roomType', e.target.value)} placeholder="e.g. Deluxe Room" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Sharing</label>
                          <input value={row.sharing || ''} onChange={(e) => updateAccommodationRow(i, 'sharing', e.target.value)} placeholder="e.g. Double" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Destination</label>
                          <input value={row.destination || ''} onChange={(e) => updateAccommodationRow(i, 'destination', e.target.value)} placeholder="e.g. Dwarka" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Hotel Total (Rs)</label>
                          <input type="number" min={0} step={1} value={row.hotelTotalAmount ?? ''} onChange={(e) => updateAccommodationRow(i, 'hotelTotalAmount', e.target.value)} placeholder="Total for this hotel" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Hotel Advance (Rs)</label>
                          <input type="number" min={0} step={1} value={row.hotelPaidAmount ?? ''} onChange={(e) => updateAccommodationRow(i, 'hotelPaidAmount', e.target.value)} placeholder="Paid for this hotel" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Hotel Balance Due Date</label>
                          <input type="date" value={row.hotelBalanceDueDate || ''} onChange={(e) => updateAccommodationRow(i, 'hotelBalanceDueDate', e.target.value)} className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-cyan-50 border-b border-cyan-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-cyan-700" />
                  <h3 className="font-semibold text-gray-900">Vehicle Payments (Optional)</h3>
                </div>
                <button type="button" onClick={addVehicleRow} className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:text-cyan-800">
                  <Plus className="h-4 w-4" /> Add vehicle
                </button>
              </div>
              <div className="p-4 space-y-4">
                {(form.vehicles || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No vehicles added. Click &quot;Add vehicle&quot; to add payment details.</p>
                ) : (
                  (form.vehicles || []).map((row, i) => (
                    <div key={i} className="p-3 border border-gray-200 rounded-lg bg-gray-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Vehicle #{i + 1}</span>
                        <button type="button" onClick={() => removeVehicleRow(i)} className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Vehicle Name</label>
                          <input value={row.vehicleName || ''} onChange={(e) => updateVehicleRow(i, 'vehicleName', e.target.value)} placeholder="e.g. Raj Travels" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Vehicle Type</label>
                          <input value={row.vehicleType || ''} onChange={(e) => updateVehicleRow(i, 'vehicleType', e.target.value)} placeholder="e.g. Innova Crysta" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Vehicle Total (Rs)</label>
                          <input type="number" min={0} step={1} value={row.vehicleTotalAmount ?? ''} onChange={(e) => updateVehicleRow(i, 'vehicleTotalAmount', e.target.value)} placeholder="Total for this vehicle" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Vehicle Advance Payment Done (Rs)</label>
                          <input type="number" min={0} step={1} value={row.vehicleAdvanceAmount ?? ''} onChange={(e) => updateVehicleRow(i, 'vehicleAdvanceAmount', e.target.value)} placeholder="Advance paid" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Vehicle Balance Due Date</label>
                          <input type="date" value={row.vehicleBalanceDueDate || ''} onChange={(e) => updateVehicleRow(i, 'vehicleBalanceDueDate', e.target.value)} className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Plane className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Flight Details: - (Optional)</h3>
                </div>
                <button type="button" onClick={addFlightRow} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-800">
                  <Plus className="h-4 w-4" /> Add flight
                </button>
              </div>
              <div className="p-4 space-y-4">
                {(form.flights || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No flights. Click &quot;Add flight&quot; to add flight details.</p>
                ) : (
                  (form.flights || []).map((row, i) => (
                    <div key={i} className="p-3 border border-gray-200 rounded-lg bg-gray-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Flight #{i + 1}</span>
                        <button type="button" onClick={() => removeFlightRow(i)} className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">From</label>
                          <input value={row.from || ''} onChange={(e) => updateFlightRow(i, 'from', e.target.value)} placeholder="e.g. Mumbai" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">To</label>
                          <input value={row.to || ''} onChange={(e) => updateFlightRow(i, 'to', e.target.value)} placeholder="e.g. Goa" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Airline Info</label>
                          <input value={row.airline || ''} onChange={(e) => updateFlightRow(i, 'airline', e.target.value)} placeholder="e.g. IndiGo 6E-234" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">PNR / Booking</label>
                          <input value={row.pnr || ''} onChange={(e) => updateFlightRow(i, 'pnr', e.target.value)} placeholder="e.g. ABC123" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Fare (Rs)</label>
                          <input type="number" min={0} step={1} value={row.fare ?? ''} onChange={(e) => updateFlightRow(i, 'fare', e.target.value)} placeholder="e.g. 4500" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Trip Images (Optional)</h3>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <input type="file" accept="image/*" multiple onChange={handleTripImagesChange} className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
                <p className="text-xs text-gray-500">Upload up to 6 trip images. These will also be used in the tour PDF where possible.</p>
                {(form.tripImages || []).length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {(form.tripImages || []).map((image, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt={`Trip ${i + 1}`} className="h-28 w-full object-cover" />
                        <button type="button" onClick={() => removeTripImage(i)} className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-violet-50 border-b border-violet-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Route className="h-5 w-5 text-violet-600" />
                  <h3 className="font-semibold text-gray-900">Day-wise Itinerary (Optional)</h3>
                </div>
                <button type="button" onClick={addItineraryDay} className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:text-violet-800">
                  <Plus className="h-4 w-4" /> Add day
                </button>
              </div>
              <div className="p-4 space-y-4">
                {(form.itinerary || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No days added. Click &quot;Add day&quot; to add itinerary.</p>
                ) : (
                  (form.itinerary || []).map((row, i) => (
                    <div key={i} className="p-3 border border-gray-200 rounded-lg bg-gray-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Day #{i + 1}</span>
                        <button type="button" onClick={() => removeItineraryRow(i)} className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-0.5">Day number</label>
                            <input type="number" min={1} value={row.day ?? ''} onChange={(e) => updateItineraryRow(i, 'day', e.target.value)} placeholder="1" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-0.5">Route (e.g. City A – City B (250KM))</label>
                            <input value={row.route || ''} onChange={(e) => updateItineraryRow(i, 'route', e.target.value)} placeholder="Rajkot – Dwarka (250KM)" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Description</label>
                          <textarea value={row.description || ''} onChange={(e) => updateItineraryRow(i, 'description', e.target.value)} rows={3} placeholder="Short description for the day" className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Places to visit (one per line or comma separated)</label>
                          <textarea value={row.placesText || ''} onChange={(e) => updateItineraryRow(i, 'placesText', e.target.value)} rows={3} placeholder={'Dwarkadhish Temple\nNageshwar Jyotirlinga\nGomati Ghat'} className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Package Inclusions (Optional)</h3>
              </div>
              <div className="p-4">
                <textarea name="inclusions" value={form.inclusions} onChange={handleChange} rows={4} placeholder={'One item per line, e.g.\n• Accommodation on double sharing\n• Breakfast and Dinner\n• All transfers by vehicle'} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm" />
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <h3 className="font-semibold text-gray-900">Package Exclusions (Optional)</h3>
              </div>
              <div className="p-4">
                <textarea name="exclusions" value={form.exclusions} onChange={handleChange} rows={4} placeholder={'One item per line, e.g.\n• GST\n• Train/Flight tickets\n• Entry fees, personal expenses'} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm" />
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Payment Policy (Optional)</h3>
              </div>
              <div className="p-4">
                <textarea name="payment_policy" value={form.payment_policy} onChange={handleChange} rows={3} placeholder={'e.g. Initial deposit 40% to confirm. 60% before 10 days of departure. 100% for flight/train tickets.'} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm" />
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-gray-900">Cancellation Policy (Optional)</h3>
              </div>
              <div className="p-4">
                <textarea name="cancellation_policy" value={form.cancellation_policy} onChange={handleChange} rows={4} placeholder={'e.g. 35+ days: 25%. 34-15 days: 25%. 14-10 days: 50%. 10-7 days: 100%. Train as per IRCTC.'} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm" />
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-slate-600" />
                <h3 className="font-semibold text-gray-900">Terms And Conditions (Optional)</h3>
              </div>
              <div className="p-4">
                <textarea name="termsAndConditions" value={form.termsAndConditions} onChange={handleChange} rows={4} placeholder={'Add tour terms and conditions here.'} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm" />
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-rose-600" />
                <h3 className="font-semibold text-gray-900">Memorable Trip (Optional)</h3>
              </div>
              <div className="p-4">
                <textarea name="memorableTrip" value={form.memorableTrip} onChange={handleChange} rows={4} placeholder={'Add a memorable closing note for the trip.'} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button type="button" onClick={handleClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-60">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              Save Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
