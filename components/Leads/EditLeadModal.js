'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { X, User, Tag, Loader2, MessageSquare, Building2, Plus, Trash2, Route, CheckCircle, XCircle, CreditCard, AlertCircle, Plane, ImagePlus, Users, Car, Globe } from 'lucide-react';

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
  assigned_to: '',
  total_amount: '',
  packageCostPerPerson: '',
  kidsPackageCostPerPerson: '',
  advance_amount: '',
  advanceDueDate: '',
  paymentDueDate: '',
  payment_status: 'unpaid',
  notes: '',
  followups: [],
  paxCount: '',
  paxType: '',
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
  packageName: '',
};

const emptyAccommodationRow = () => ({ hotelName: '', nights: '', roomType: 'Double', sharing: 'Double', destination: '', hotelTotalAmount: '', hotelPaidAmount: '', hotelBalanceDueDate: '' });
const emptyVehicleRow = () => ({ vehicleName: '', vehicleType: '', vehicleTotalAmount: '', vehicleAdvanceAmount: '', vehicleBalanceDueDate: '' });
const emptyFlightRow = () => ({ from: '', to: '', airline: '', pnr: '', fare: '' });
const emptyItineraryRow = () => ({ day: '', route: '', description: '', placesText: '' });
const emptyPaxRow = () => ({ type: 'Adults', count: '' });
const getTodayDateString = () => new Date().toISOString().slice(0, 10);

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

export default function EditLeadModal({ open, leadId, onClose, onSuccess }) {
  const { user } = useAuth();
  const showPayment = user?.role === 'superadmin' || user?.role === 'staff';
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [staffUsers, setStaffUsers] = useState([]);
  const todayDate = getTodayDateString();

  useEffect(() => {
    if (!open || !leadId) return;
    setFetching(true);
    api.get(`/leads/${leadId}`)
      .then((r) => {
        const lead = r.data.lead;
        const a = lead.assigned_to;
        const destinationsText = Array.isArray(lead.destinations) && lead.destinations.length ? lead.destinations.join(', ') : '';
        const accommodation = Array.isArray(lead.accommodation) && lead.accommodation.length
          ? lead.accommodation.map((acc) => ({
            hotelName: acc.hotelName || '',
            nights: acc.nights != null ? String(acc.nights) : '',
            roomType: acc.roomType || '',
            sharing: acc.sharing || '',
            destination: acc.destination || '',
            hotelTotalAmount: acc.hotelTotalAmount != null ? String(acc.hotelTotalAmount) : '',
            hotelPaidAmount: acc.hotelPaidAmount != null ? String(acc.hotelPaidAmount) : '',
            hotelBalanceDueDate: acc.hotelBalanceDueDate ? acc.hotelBalanceDueDate.slice(0, 10) : '',
          }))
          : [];
        const vehicles = Array.isArray(lead.vehicles) && lead.vehicles.length
          ? lead.vehicles.map((v) => ({
            vehicleName: v.vehicleName || '',
            vehicleType: v.vehicleType || '',
            vehicleTotalAmount: v.vehicleTotalAmount != null ? String(v.vehicleTotalAmount) : '',
            vehicleAdvanceAmount: v.vehicleAdvanceAmount != null ? String(v.vehicleAdvanceAmount) : '',
            vehicleBalanceDueDate: v.vehicleBalanceDueDate ? v.vehicleBalanceDueDate.slice(0, 10) : '',
          }))
          : [];
        const flights = Array.isArray(lead.flights) && lead.flights.length
          ? lead.flights.map((f) => ({
            from: f.from || '',
            to: f.to || '',
            airline: f.airline || '',
            pnr: f.pnr || '',
            fare: f.fare != null ? String(f.fare) : '',
          }))
          : [];
        const itinerary = Array.isArray(lead.itinerary) && lead.itinerary.length
          ? lead.itinerary.map((item) => ({
            day: item.day != null ? String(item.day) : '',
            route: item.route || '',
            description: item.description || '',
            placesText: Array.isArray(item.places) ? item.places.join('\n') : '',
          }))
          : [];
        setForm({
          name: lead.name || '',
          phone: lead.phone || '',
          email: lead.email || '',
          destination: lead.destination || '',
          travel_date: lead.travel_date ? lead.travel_date.slice(0, 10) : '',
          budget: lead.budget != null ? String(lead.budget) : '',
          status: lead.status || 'new',
          assigned_to: a?._id ? a._id : (a || ''),
          total_amount: lead.total_amount != null ? String(lead.total_amount) : '',
          packageCostPerPerson: lead.packageCostPerPerson != null ? String(lead.packageCostPerPerson) : '',
          kidsPackageCostPerPerson: lead.kidsPackageCostPerPerson != null ? String(lead.kidsPackageCostPerPerson) : '',
          advance_amount: lead.advance_amount != null ? String(lead.advance_amount) : '',
          advanceDueDate: lead.advanceDueDate ? lead.advanceDueDate.slice(0, 10) : '',
          paymentDueDate: lead.paymentDueDate ? lead.paymentDueDate.slice(0, 10) : '',
          payment_status: lead.payment_status || 'unpaid',
          notes: lead.notes || '',
          followups: Array.isArray(lead.followups) ? lead.followups : [],
          paxCount: lead.paxCount != null ? String(lead.paxCount) : '',
          paxType: lead.paxType || '',
          paxBreakup: mapPaxBreakupToForm(lead),
          vehicleType: lead.vehicleType || '',
          hotelCategory: lead.hotelCategory || '',
          mealPlan: lead.mealPlan || '',
          tourNights: lead.tourNights != null ? String(lead.tourNights) : '',
          tourDays: lead.tourDays != null ? String(lead.tourDays) : '',
          tourStartDate: lead.tourStartDate ? lead.tourStartDate.slice(0, 10) : '',
          tourEndDate: lead.tourEndDate ? lead.tourEndDate.slice(0, 10) : '',
          pickupPoint: lead.pickupPoint || '',
          dropPoint: lead.dropPoint || '',
          destinationsText,
          accommodation,
          vehicles,
          flights,
          itinerary,
          inclusions: lead.inclusions || '',
          exclusions: lead.exclusions || '',
          payment_policy: lead.payment_policy || '',
          cancellation_policy: lead.cancellation_policy || '',
          termsAndConditions: lead.termsAndConditions || '',
          packageName: lead.packageName || '',
          tripImages: Array.isArray(lead.tripImages) ? lead.tripImages.filter(Boolean) : [],
        });
      })
      .catch(() => toast.error('Failed to load lead'))
      .finally(() => setFetching(false));
  }, [open, leadId]);

  useEffect(() => {
    if (open && showPayment) {
      api.get('/users').then((r) => setStaffUsers(r.data.users || [])).catch(() => setStaffUsers([]));
    }
  }, [open, showPayment]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const addFollowup = () => {
    setForm((p) => ({ ...p, followups: [...(p.followups || []), { date: todayDate, note: '' }] }));
  };

  const updateFollowup = (index, field, value) => {
    setForm((p) => {
      const next = [...(p.followups || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...p, followups: next };
    });
  };

  const removeFollowup = (index) => {
    setForm((p) => ({ ...p, followups: (p.followups || []).filter((_, i) => i !== index) }));
  };

  const getFollowupMinDate = (value) => {
    const normalizedValue = value ? String(value).slice(0, 10) : '';
    return normalizedValue && normalizedValue < todayDate ? normalizedValue : todayDate;
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
      const destinations = form.destinationsText.trim() ? form.destinationsText.split(/[,;]/).map((d) => d.trim()).filter(Boolean) : [];
      const paxSummary = getPaxSummary(form.paxBreakup);
      const accommodation = (form.accommodation || []).map((acc) => ({
        hotelName: (acc.hotelName || '').trim(),
        nights: acc.nights !== '' && acc.nights != null ? Number(acc.nights) : null,
        roomType: (acc.roomType || '').trim(),
        sharing: (acc.sharing || '').trim(),
        destination: (acc.destination || '').trim(),
        hotelTotalAmount: acc.hotelTotalAmount !== '' && acc.hotelTotalAmount != null ? Number(acc.hotelTotalAmount) : null,
        hotelPaidAmount: acc.hotelPaidAmount !== '' && acc.hotelPaidAmount != null ? Number(acc.hotelPaidAmount) : null,
        hotelBalanceDueDate: acc.hotelBalanceDueDate || null,
      }));
      const vehicles = (form.vehicles || []).map((v) => ({
        vehicleName: (v.vehicleName || '').trim(),
        vehicleType: (v.vehicleType || '').trim(),
        vehicleTotalAmount: v.vehicleTotalAmount !== '' && v.vehicleTotalAmount != null ? Number(v.vehicleTotalAmount) : null,
        vehicleAdvanceAmount: v.vehicleAdvanceAmount !== '' && v.vehicleAdvanceAmount != null ? Number(v.vehicleAdvanceAmount) : null,
        vehicleBalanceDueDate: v.vehicleBalanceDueDate || null,
      }));
      const flights = (form.flights || []).map((f) => ({
        from: (f.from || '').trim(),
        to: (f.to || '').trim(),
        airline: (f.airline || '').trim(),
        pnr: (f.pnr || '').trim(),
        fare: f.fare !== '' && f.fare != null ? Number(f.fare) : null,
      }));
      const itinerary = (form.itinerary || []).map((item) => ({
        day: item.day !== '' && item.day != null ? Number(item.day) : null,
        route: (item.route || '').trim(),
        description: (item.description || '').trim(),
        places: (item.placesText || '').split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean),
      }));
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        destination: form.destination.trim() || undefined,
        travel_date: form.travel_date || undefined,
        budget: form.budget || undefined,
        status: form.status,
        assigned_to: form.assigned_to || null,
        total_amount: form.total_amount ? Number(form.total_amount) : 0,
        packageCostPerPerson: form.packageCostPerPerson ? Number(form.packageCostPerPerson) : undefined,
        kidsPackageCostPerPerson: form.kidsPackageCostPerPerson ? Number(form.kidsPackageCostPerPerson) : undefined,
        advance_amount: form.advance_amount ? Number(form.advance_amount) : 0,
        advanceDueDate: form.advanceDueDate || null,
        paymentDueDate: form.paymentDueDate || null,
        payment_status: form.payment_status,
        notes: form.notes.trim() || '',
        followups: form.followups,
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
        accommodation,
        vehicles,
        flights,
        itinerary,
        inclusions: form.inclusions?.trim() ?? '',
        exclusions: form.exclusions?.trim() ?? '',
        payment_policy: form.payment_policy?.trim() ?? '',
        cancellation_policy: form.cancellation_policy?.trim() ?? '',
        termsAndConditions: form.termsAndConditions?.trim() ?? '',
        memorableTrip: form.memorableTrip?.trim() ?? '',
        tripImages: form.tripImages ?? [],
        packageName: form.packageName.trim(),
      };
      await api.put(`/leads/${leadId}`, payload);
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
              {/* Contact Info */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                  <User className="h-5 w-5 text-primary-600" />
                  <h3 className="font-semibold text-gray-900">Contact</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input name="name" required value={form.name} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input name="email" type="email" value={form.email} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label><input name="phone" required value={form.phone} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Destination</label><input name="destination" value={form.destination} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Travel Date</label><input name="travel_date" type="date" value={form.travel_date} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Budget</label><input name="budget" value={form.budget} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                  </div>
                  {showPayment && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                      <select name="assigned_to" value={form.assigned_to} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-white">
                        <option value="">Unassigned</option>
                        {staffUsers.map((u) => (<option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Details */}
              {showPayment && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                    <Tag className="h-5 w-5 text-primary-600" />
                    <h3 className="font-semibold text-gray-900">Payment Details</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label><input name="total_amount" type="number" min={0} value={form.total_amount} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Advance Amount</label><input name="advance_amount" type="number" min={0} value={form.advance_amount} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Advance Due Date</label><input name="advanceDueDate" type="date" value={form.advanceDueDate} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Payment Due Date</label><input name="paymentDueDate" type="date" value={form.paymentDueDate} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label><select name="payment_status" value={form.payment_status} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-white">{PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                  </div>
                </div>
              )}

              {/* Tour Summary */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                  <Globe className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-gray-900">Tour Summary</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Package Name (Separate Name For PDF)</label>
                    <input name="packageName" value={form.packageName} onChange={handleChange} placeholder="e.g. Summer Special Himachal Tour" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Package Cost (₹)</label><input name="total_amount" type="number" min={0} value={form.total_amount} onChange={handleChange} placeholder="e.g. 62500" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Adult Cost Per Person (₹)</label><input name="packageCostPerPerson" type="number" min={0} value={form.packageCostPerPerson} onChange={handleChange} placeholder="e.g. 12500" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kids Cost Per Person (₹)</label>
                    <input name="kidsPackageCostPerPerson" type="number" min={0} value={form.kidsPackageCostPerPerson} onChange={handleChange} placeholder="e.g. 8500" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
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
                    {form.paxBreakup.map((row, i) => (
                      <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-3 items-end">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Pax Type</label>
                          <input value={row.type || ''} onChange={(e) => updatePaxRow(i, 'type', e.target.value)} placeholder="e.g. Adults / Children" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">No. of Pax</label>
                          <input type="number" min={0} value={row.count ?? ''} onChange={(e) => updatePaxRow(i, 'count', e.target.value)} placeholder="e.g. 2" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
                        </div>
                        <button type="button" onClick={() => removePaxRow(i)} className="text-red-600 hover:text-red-800 p-2"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label><input name="vehicleType" value={form.vehicleType} onChange={handleChange} placeholder="e.g. Sedan" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Hotel Category</label><input name="hotelCategory" value={form.hotelCategory} onChange={handleChange} placeholder="e.g. 3 Star" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Meal Plan</label><input name="mealPlan" value={form.mealPlan} onChange={handleChange} placeholder="e.g. Breakfast & Dinner" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Tour Nights</label><input name="tourNights" type="number" min={0} value={form.tourNights} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Tour Days</label><input name="tourDays" type="number" min={0} value={form.tourDays} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Tour Start Date</label><input name="tourStartDate" type="date" value={form.tourStartDate} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Tour End Date</label><input name="tourEndDate" type="date" value={form.tourEndDate} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Pickup Point</label><input name="pickupPoint" value={form.pickupPoint} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Drop Point</label><input name="dropPoint" value={form.dropPoint} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Destinations</label><input name="destinationsText" value={form.destinationsText} onChange={handleChange} placeholder="e.g. Dwarka, Somnath" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
                </div>
              </div>

              {/* Accommodation */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-semibold text-gray-900">Accommodation</h3>
                  </div>
                  <button type="button" onClick={addAccommodationRow} className="text-emerald-700 hover:text-emerald-800 text-sm font-medium flex items-center gap-1"><Plus className="h-4 w-4" /> Add hotel</button>
                </div>
                <div className="p-4 space-y-4">
                  {form.accommodation.map((row, i) => (
                    <div key={i} className="p-3 border border-gray-100 rounded-lg bg-gray-50/50 space-y-3">
                      <div className="flex justify-between items-center"><span className="text-sm font-medium text-gray-700">Hotel #{i + 1}</span><button type="button" onClick={() => removeAccommodationRow(i)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></button></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><label className="block text-xs font-medium text-gray-600">Hotel Name</label><input value={row.hotelName} onChange={(e) => updateAccommodationRow(i, 'hotelName', e.target.value)} className="w-full px-2 py-1 rounded border text-sm" /></div>
                        <div><label className="block text-xs font-medium text-gray-600">Nights</label><input type="number" value={row.nights} onChange={(e) => updateAccommodationRow(i, 'nights', e.target.value)} className="w-full px-2 py-1 rounded border text-sm" /></div>
                        <div><label className="block text-xs font-medium text-gray-600">Destination</label><input value={row.destination} onChange={(e) => updateAccommodationRow(i, 'destination', e.target.value)} className="w-full px-2 py-1 rounded border text-sm" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vehicles */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-cyan-50 border-b border-cyan-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><Car className="h-5 w-5 text-cyan-600" /><h3 className="font-semibold text-gray-900">Vehicle Payments</h3></div>
                  <button type="button" onClick={addVehicleRow} className="text-cyan-700 hover:text-cyan-800 text-sm font-medium flex items-center gap-1"><Plus className="h-4 w-4" /> Add vehicle</button>
                </div>
                <div className="p-4 space-y-4">
                  {form.vehicles.map((row, i) => (
                    <div key={i} className="p-3 border border-gray-100 rounded-lg bg-gray-50/50 space-y-3">
                      <div className="flex justify-between items-center"><span className="text-sm font-medium text-gray-700">Vehicle #{i + 1}</span><button type="button" onClick={() => removeVehicleRow(i)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></button></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium text-gray-600">Name</label><input value={row.vehicleName} onChange={(e) => updateVehicleRow(i, 'vehicleName', e.target.value)} className="w-full px-2 py-1 rounded border text-sm" /></div>
                        <div><label className="block text-xs font-medium text-gray-600">Type</label><input value={row.vehicleType} onChange={(e) => updateVehicleRow(i, 'vehicleType', e.target.value)} className="w-full px-2 py-1 rounded border text-sm" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* flights */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><Plane className="h-5 w-5 text-indigo-600" /><h3 className="font-semibold text-gray-900">Flights</h3></div>
                  <button type="button" onClick={addFlightRow} className="text-indigo-700 hover:text-indigo-800 text-sm font-medium flex items-center gap-1"><Plus className="h-4 w-4" /> Add flight</button>
                </div>
                <div className="p-4 space-y-4">
                  {form.flights.map((row, i) => (
                    <div key={i} className="p-3 border border-gray-100 rounded-lg bg-gray-50/50 space-y-3">
                      <div className="flex justify-between items-center"><span className="text-sm font-medium text-gray-700">Flight #{i + 1}</span><button type="button" onClick={() => removeFlightRow(i)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></button></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium text-gray-600">From</label><input value={row.from} onChange={(e) => updateFlightRow(i, 'from', e.target.value)} className="w-full px-2 py-1 rounded border text-sm" /></div>
                        <div><label className="block text-xs font-medium text-gray-600">To</label><input value={row.to} onChange={(e) => updateFlightRow(i, 'to', e.target.value)} className="w-full px-2 py-1 rounded border text-sm" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* itinerary */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-violet-50 border-b border-violet-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><Route className="h-5 w-5 text-violet-600" /><h3 className="font-semibold text-gray-900">Itinerary</h3></div>
                  <button type="button" onClick={addItineraryDay} className="text-violet-700 hover:text-violet-800 text-sm font-medium flex items-center gap-1"><Plus className="h-4 w-4" /> Add day</button>
                </div>
                <div className="p-4 space-y-4">
                   {form.itinerary.map((row, i) => (
                    <div key={i} className="p-3 border border-gray-100 rounded-lg bg-gray-50/50 space-y-2">
                       <div className="flex justify-between items-center"><span className="text-sm font-medium text-gray-700">Day #{i + 1}</span><button type="button" onClick={() => removeItineraryRow(i)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></button></div>
                       <input value={row.route} onChange={(e) => updateItineraryRow(i, 'route', e.target.value)} placeholder="Route" className="w-full px-2 py-1 rounded border text-sm mb-2" />
                       <textarea value={row.description} onChange={(e) => updateItineraryRow(i, 'description', e.target.value)} placeholder="Description" rows={2} className="w-full px-2 py-1 rounded border text-sm" />
                    </div>
                   ))}
                </div>
              </div>

              {/* trip images */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                  <ImagePlus className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Trip Images</h3>
                </div>
                <div className="p-4 space-y-3">
                  <input type="file" accept="image/*" multiple onChange={handleTripImagesChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
                  <div className="grid grid-cols-3 gap-2">
                    {form.tripImages.map((img, i) => (
                      <div key={i} className="relative group aspect-video bg-gray-100 rounded overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="Trip" className="object-cover w-full h-full" />
                        <button type="button" onClick={() => removeTripImage(i)} className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Inclusions / Exclusions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" /><h3 className="font-semibold text-gray-900 text-sm">Inclusions</h3></div>
                  <textarea name="inclusions" value={form.inclusions} onChange={handleChange} rows={4} className="w-full p-3 text-sm focus:ring-0 border-0" />
                </div>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500" /><h3 className="font-semibold text-gray-900 text-sm">Exclusions</h3></div>
                  <textarea name="exclusions" value={form.exclusions} onChange={handleChange} rows={4} className="w-full p-3 text-sm focus:ring-0 border-0" />
                </div>
              </div>

              {/* Polices */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                 <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2"><CreditCard className="h-5 w-5 text-blue-600" /><h3 className="font-semibold text-gray-900">Policies</h3></div>
                 <div className="p-4 space-y-4">
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Payment Policy</label><textarea name="payment_policy" value={form.payment_policy} onChange={handleChange} rows={2} className="w-full p-2 border rounded text-sm" /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Cancellation Policy</label><textarea name="cancellation_policy" value={form.cancellation_policy} onChange={handleChange} rows={2} className="w-full p-2 border rounded text-sm" /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Terms & Conditions</label><textarea name="termsAndConditions" value={form.termsAndConditions} onChange={handleChange} rows={2} className="w-full p-2 border rounded text-sm" /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Memorable Trip Note</label><textarea name="memorableTrip" value={form.memorableTrip} onChange={handleChange} rows={2} className="w-full p-2 border rounded text-sm" /></div>
                 </div>
              </div>

              {/* Status & Notes (Always visible) */}
              <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-rose-600" />
                  <h3 className="font-semibold text-gray-900">Status & Admin Notes</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select name="status" value={form.status} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-white">{STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select></div>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label><textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Add follow-up notes, reminders, or conversation summary..." className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" /></div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><label className="block text-sm font-medium text-gray-700">Follow-ups</label><button type="button" onClick={addFollowup} className="text-primary-600 hover:text-primary-700 text-sm font-medium">+ Add Follow-up</button></div>
                    {form.followups.map((fu, i) => (
                      <div key={i} className="flex gap-3 items-start border-l-2 border-primary-200 pl-3 py-1">
                        <div className="flex-1 space-y-2">
                          <input type="date" min={getFollowupMinDate(fu.date)} value={fu.date ? fu.date.slice(0, 10) : ''} onChange={(e) => updateFollowup(i, 'date', e.target.value)} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
                          <input type="text" value={fu.note} onChange={(e) => updateFollowup(i, 'note', e.target.value)} placeholder="What was discussed?" className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
                        </div>
                        <button type="button" onClick={() => removeFollowup(i)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold shadow-md shadow-primary-200 disabled:opacity-60 transition-all">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Update Lead Details</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
