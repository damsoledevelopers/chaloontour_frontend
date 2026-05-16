'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Edit, MapPin, Building2, Route, CheckCircle, XCircle, FileText, FileDown, CreditCard, AlertCircle, Plane, Banknote, ImagePlus, Car } from 'lucide-react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  booked: 'Booked',
  lost: 'Lost',
};

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right break-all">{value ?? '–'}</span>
    </div>
  );
}

function formatCurrency(value) {
  return value != null ? `Rs.${Number(value).toLocaleString('en-IN')}/-` : '–';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-GB') : '–';
}

export default function LeadDetailsModal({ open, lead, onClose, onEdit, canEdit }) {
  const router = useRouter();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);

  const buildPaxLabel = (lead) => {
    if (Array.isArray(lead?.paxBreakup) && lead.paxBreakup.length > 0) {
      return lead.paxBreakup
        .map((item) => [item?.count != null ? item.count : null, item?.type].filter(Boolean).join(' ').trim())
        .filter(Boolean)
        .join(', ');
    }
    if (lead?.paxCount != null && lead?.paxType) {
      return `${lead.paxCount} ${lead.paxType}`.trim();
    }
    if (lead?.paxCount != null) {
      return String(lead.paxCount);
    }
    return '';
  };

  const buildTourDuration = (lead) => {
    return [
      lead?.tourNights != null && `${lead.tourNights} Nights`,
      lead?.tourDays != null && `${lead.tourDays} Days`,
    ].filter(Boolean).join(' / ');
  };

  const mapLeadToTourPdfData = (lead) => {
    const images = Array.isArray(lead?.tripImages) ? lead.tripImages.filter(Boolean) : [];
    const destinations = Array.isArray(lead?.destinations) && lead.destinations.length > 0
      ? lead.destinations.join(', ')
      : (lead?.destination || '');

    const getTripImg = (img) => {
      if (!img) return '';
      if (img.startsWith('data:') || img.startsWith('http')) return img;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://crm.chaloontour.com/api';
      const base = apiUrl.replace(/\/api\/?$/, '');
      return `${base}/uploads/${img.startsWith('/') ? img.slice(1) : img}`;
    };

    return {
      perPersonCost: lead?.packageCostPerPerson != null
        ? String(lead.packageCostPerPerson)
        : (lead?.total_amount != null ? String(lead.total_amount) : ''),
      totalPax: buildPaxLabel(lead),
      vehicleType: lead?.vehicleType || '',
      hotelCategory: lead?.hotelCategory || '',
      mealPlan: lead?.mealPlan || '',
      tourDuration: buildTourDuration(lead),
      tourDateFrom: lead?.tourStartDate ? new Date(lead.tourStartDate).toLocaleDateString('en-IN') : (lead?.travel_date ? new Date(lead.travel_date).toLocaleDateString('en-IN') : ''),
      tourDateTo: lead?.tourEndDate ? new Date(lead.tourEndDate).toLocaleDateString('en-IN') : (lead?.travel_date ? new Date(lead.travel_date).toLocaleDateString('en-IN') : ''),
      pickupPoint: lead?.pickupPoint || '',
      dropPoint: lead?.dropPoint || '',
      destinations,
      heroMain: getTripImg(images[0]),
      heroSub1: getTripImg(images[1]),
      heroSub2: getTripImg(images[2]),
      quoteNumber: lead?.leadId || '',
      quoteDate: lead?.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      hotels: Array.isArray(lead?.accommodation)
        ? lead.accommodation.map((hotel) => ({
          name: hotel?.hotelName || '',
          nights: hotel?.nights != null ? `${hotel.nights} Night${hotel.nights === 1 ? '' : 's'}` : '',
          roomCategory: hotel?.roomType || '',
          roomSharing: hotel?.sharing || '',
          destination: hotel?.destination || '',
        }))
        : [],
      accommodationNote: '',
      flights: Array.isArray(lead?.flights)
        ? lead.flights.map((flight) => ({
          from: flight?.from || '',
          depDate: '',
          depTime: '',
          to: flight?.to || '',
          arrDate: '',
          arrTime: '',
          airline: flight?.airline || '',
          flightNo: '',
          pnr: flight?.pnr || '',
        }))
        : [],
      flightNote: '',
      inclusions: lead?.inclusions || '',
      exclusions: lead?.exclusions || '',
      paymentPolicy: lead?.payment_policy || '',
      cancellationPolicy: lead?.cancellation_policy || '',
      termsAndConditions: lead?.termsAndConditions || '',
      memorableTrip: lead?.memorableTrip || '',
      itinerary: Array.isArray(lead?.itinerary)
        ? lead.itinerary.map((day, index) => ({
          dayLabel: `Day ${day?.day != null ? day.day : index + 1}`,
          date: day?.date ? new Date(day.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
          title: day?.route || '',
          description: day?.description || '',
          places: Array.isArray(day?.places) ? day.places.filter(Boolean) : [],
        }))
        : [],
      ceoName: 'Mr. Utkarsh Kale (C.E.O.)',
      cell1: '9960625167',
      cell2: '9136549898',
      companyEmail: 'bookings@chaloontour.com',
      companyWebsite: 'www.chaloontour.com',
    };
  };

  const handleDownloadPdf = async () => {
    if (!lead?._id || downloadingPdf) return;
    setDownloadingPdf(true);
    const tid = toast.loading('Generating PDF...');
    try {
      const data = mapLeadToTourPdfData(lead);
      const fileName = `Tour-Quotation-${data.quoteNumber || lead._id}`;
      await api.post(`/leads/${lead._id}/generate-pdf`, { data, fileName });
      const response = await api.post(`/leads/${lead._id}/download-pdf`, { data, fileName }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tour-Quotation-${data.quoteNumber || lead._id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF Downloaded!', { id: tid });
    } catch (error) {
      console.error('Download Error:', error);
      let msg = 'Failed to generate PDF.';
      const errData = error.response?.data;
      if (errData instanceof Blob) {
        try {
          const json = JSON.parse(await errData.text());
          msg = json.message || json.error || msg;
        } catch (_) {}
      } else if (errData?.message) {
        msg = errData.message;
      }
      toast.error(msg, { id: tid });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadWord = async () => {
    if (!lead?._id || downloadingWord) return;
    setDownloadingWord(true);
    const tid = toast.loading('Generating Word Doc...');
    try {
      const data = mapLeadToTourPdfData(lead);
      const response = await api.post('/leads/convert-to-docx', {
        leadId: lead._id,
        data,
        fileName: `Tour-Quotation-${data.quoteNumber || lead._id}`
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tour-Quotation-${data.quoteNumber || lead._id}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Word Document Downloaded!', { id: tid });
    } catch (error) {
      console.error('Word Download Error:', error);
      toast.error('Failed to generate Word document.', { id: tid });
    } finally {
      setDownloadingWord(false);
    }
  };

  const handleGoToPdfEditor = () => {
    if (!lead?._id) return;
    router.push(`/admin/tour-pdf?leadId=${encodeURIComponent(lead._id)}&preview=1`);
    onClose();
  };


  if (!open) return null;

  const name = lead?.name?.trim() || 'Unknown';
  const statusLabel = STATUS_LABELS[lead?.status] || lead?.status || '–';
  const createdDate = lead?.createdAt || lead?.createdDate;
  const created = createdDate ? new Date(createdDate).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
  const assigned = lead?.assigned_to;
  const assignedName = assigned && (typeof assigned === 'object') ? `${assigned.firstName || ''} ${assigned.lastName || ''}`.trim() : '–';
  const paxBreakupSummary = Array.isArray(lead?.paxBreakup) && lead.paxBreakup.length
    ? lead.paxBreakup
        .map((item) => [item?.count != null ? item.count : null, item?.type].filter(Boolean).join(' ').trim())
        .filter(Boolean)
        .join(', ')
    : ([lead?.paxCount, lead?.paxType].filter(Boolean).length ? `${lead.paxCount ?? ''} ${lead.paxType ?? ''}`.trim() : null);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-primary-600 to-primary-700">
          <h2 className="text-xl font-bold text-white">Lead Details – {name}</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleGoToPdfEditor} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors" title="Open Tour PDF/Word Generator">
              <FileText className="h-4 w-4" />
              Generator
            </button>
            <button type="button" onClick={handleDownloadPdf} disabled={downloadingPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50" title="Download PDF">
              <FileDown className="h-4 w-4" />
              PDF
            </button>
            <button type="button" onClick={handleDownloadWord} disabled={downloadingWord} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50" title="Download Word">
              <FileDown className="h-4 w-4" />
              Word
            </button>
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
          {/* Contact & Lead Info – all form data visible */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900">Contact & Lead Info</h3>
              <span className="text-sm font-medium text-primary-700 shrink-0">{statusLabel}</span>
            </div>
            <div className="p-4 space-y-0">
              <InfoRow label="Name" value={name} />
              <InfoRow label="Phone" value={lead?.phone} />
              <InfoRow label="Email" value={lead?.email} />
              <InfoRow label="Destination" value={lead?.destination} />
              <InfoRow label="Travel Date" value={lead?.travel_date ? new Date(lead.travel_date).toLocaleDateString('en-GB') : null} />
              <InfoRow label="Budget" value={lead?.budget} />
              <InfoRow label="Source" value={lead?.source} />
              <InfoRow label="Assigned To" value={assignedName} />
              <InfoRow label="Total Amount" value={lead?.total_amount != null ? `Rs.${Number(lead.total_amount).toLocaleString('en-IN')}/-` : null} />
              <InfoRow label="Advance Amount" value={lead?.advance_amount != null ? `Rs.${Number(lead.advance_amount).toLocaleString('en-IN')}/-` : null} />
              <InfoRow label="Remaining Amount" value={lead?.remaining_amount != null ? `Rs.${Number(lead.remaining_amount).toLocaleString('en-IN')}/-` : null} />
              <InfoRow label="Advance Due Date" value={lead?.advanceDueDate ? new Date(lead.advanceDueDate).toLocaleDateString('en-GB') : null} />
              <InfoRow label="Payment Due Date" value={lead?.paymentDueDate ? new Date(lead.paymentDueDate).toLocaleDateString('en-GB') : null} />
              <InfoRow label="Payment Status" value={lead?.payment_status} />
              <InfoRow label="Lead ID" value={lead?.leadId || lead?._id} />
              <InfoRow label="Created At" value={created} />
              <InfoRow label="Notes" value={lead?.notes} />
              {Array.isArray(lead?.followups) && lead.followups.length > 0 && (
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <span className="text-sm text-gray-500 block mb-2">Follow-ups</span>
                  {lead.followups.map((fu, i) => (
                    <div key={i} className="text-sm text-gray-700 py-1">
                      {fu.date ? new Date(fu.date).toLocaleDateString('en-GB') : '–'} – {fu.note || '–'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tour Summary: - (same as PDF) – always show */}
          <div className="rounded-xl border border-gray-200 overflow-hidden mt-4">
            <div className="px-4 py-3 bg-[#1565c0] flex items-center gap-2">
              <MapPin className="h-5 w-5 text-white" />
              <h3 className="font-semibold text-white">Tour Summary: -</h3>
            </div>
            <div className="p-4 space-y-0">
              <InfoRow label="01. Total Package Cost" value={lead?.total_amount != null ? `Rs.${Number(lead.total_amount).toLocaleString('en-IN')}/-` : null} />
              <InfoRow label="02. Adult Cost Per Person" value={lead?.packageCostPerPerson != null ? `Rs.${Number(lead.packageCostPerPerson).toLocaleString('en-IN')}/-` : null} />
              <InfoRow label="03. Kids Cost Per Person" value={lead?.kidsPackageCostPerPerson != null ? `Rs.${Number(lead.kidsPackageCostPerPerson).toLocaleString('en-IN')}/-` : null} />
              <InfoRow label="04. Kids Count" value={lead?.kidsCount != null ? String(lead.kidsCount) : null} />
              <InfoRow label="05. Total No. of Pax" value={lead?.paxCount != null ? String(lead.paxCount) : null} />
              <InfoRow label="06. Pax Type Breakdown" value={paxBreakupSummary} />
              <InfoRow label="07. Vehicle Type" value={lead?.vehicleType} />
              <InfoRow label="08. Hotel Category" value={lead?.hotelCategory} />
              <InfoRow label="09. Meal Plan" value={lead?.mealPlan} />
              <InfoRow label="10. Tour Duration" value={[lead?.tourNights != null && `${lead.tourNights} Nights`, lead?.tourDays != null && `${lead.tourDays} Days`].filter(Boolean).join(' / ') || null} />
              <InfoRow label="11. Tour Date" value={lead?.tourStartDate && lead?.tourEndDate ? `${new Date(lead.tourStartDate).toLocaleDateString('en-GB')} to ${new Date(lead.tourEndDate).toLocaleDateString('en-GB')}` : (lead?.travel_date ? new Date(lead.travel_date).toLocaleDateString('en-GB') : null)} />
              <InfoRow label="12. Pick up" value={lead?.pickupPoint} />
              <InfoRow label="13. Drop" value={lead?.dropPoint} />
              <InfoRow label="14. Destinations" value={Array.isArray(lead?.destinations) && lead.destinations.length > 0 ? lead.destinations.join(', ') : lead?.destination} />
            </div>
          </div>
          {Array.isArray(lead?.tripImages) && lead.tripImages.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden mt-4">
              <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                <ImagePlus className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900">Trip Images</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {lead.tripImages.map((image, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt={`Trip ${i + 1}`} className="h-32 w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Accommodation: - (same as PDF) – always show */}
          <div className="rounded-xl border border-gray-200 overflow-hidden mt-4">
            <div className="px-4 py-3 bg-[#1565c0] flex items-center gap-2">
              <Building2 className="h-5 w-5 text-white" />
              <h3 className="font-semibold text-white">Accommodation: -</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-gray-700">Sr</th>
                    <th className="px-4 py-2 font-semibold text-gray-700">Hotel Name</th>
                    <th className="px-4 py-2 font-semibold text-gray-700">Night(s)</th>
                    <th className="px-4 py-2 font-semibold text-gray-700">Room Category</th>
                    <th className="px-4 py-2 font-semibold text-gray-700">Sharing</th>
                    <th className="px-4 py-2 font-semibold text-gray-700">Destination</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Array.isArray(lead?.accommodation) && lead.accommodation.length > 0 ? (
                    lead.accommodation.map((a, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2 text-gray-700">{i + 1}</td>
                        <td className="px-4 py-2 text-gray-900">{a.hotelName || '–'}</td>
                        <td className="px-4 py-2 text-gray-700">{a.nights != null ? a.nights : '–'}</td>
                        <td className="px-4 py-2 text-gray-700">{a.roomType || '–'}</td>
                        <td className="px-4 py-2 text-gray-700">{a.sharing || '–'}</td>
                        <td className="px-4 py-2 text-gray-700">{a.destination || '–'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-center text-gray-500">No accommodation details added.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {Array.isArray(lead?.accommodation) && lead.accommodation.some((a) => a.hotelTotalAmount != null || a.hotelPaidAmount != null || a.hotelBalanceDueDate) && (
            <div className="rounded-xl border border-gray-200 overflow-hidden mt-4">
              <div className="px-4 py-3 bg-amber-600 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-white" />
                <h3 className="font-semibold text-white">Hotel Payment Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-gray-700">Hotel Name</th>
                      <th className="px-4 py-2 font-semibold text-gray-700">Advance Payment Done (Rs)</th>
                      <th className="px-4 py-2 font-semibold text-gray-700">Balance Amount (Rs)</th>
                      <th className="px-4 py-2 font-semibold text-gray-700">Balance Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lead.accommodation.map((a, i) => {
                      const total = a.hotelTotalAmount != null ? Number(a.hotelTotalAmount) : null;
                      const paid = a.hotelPaidAmount != null ? Number(a.hotelPaidAmount) : null;
                      const remaining = total != null && paid != null ? Math.max(0, total - paid) : (total != null ? total : null);
                      if (total == null && paid == null && !a.hotelBalanceDueDate) return null;
                      return (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2 text-gray-900">{a.hotelName || '–'}</td>
                          <td className="px-4 py-2 text-gray-700">{formatCurrency(paid)}</td>
                          <td className="px-4 py-2 font-medium text-gray-900">{formatCurrency(remaining)}</td>
                          <td className="px-4 py-2 text-gray-700">{formatDate(a.hotelBalanceDueDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {Array.isArray(lead?.vehicles) && lead.vehicles.some((v) => v.vehicleName || v.vehicleType || v.vehicleTotalAmount != null || v.vehicleAdvanceAmount != null || v.vehicleBalanceDueDate) && (
            <div className="rounded-xl border border-gray-200 overflow-hidden mt-4">
              <div className="px-4 py-3 bg-cyan-700 flex items-center gap-2">
                <Car className="h-5 w-5 text-white" />
                <h3 className="font-semibold text-white">Vehicle Payment Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-gray-700">Vehicle Name</th>
                      <th className="px-4 py-2 font-semibold text-gray-700">Vehicle Type</th>
                      <th className="px-4 py-2 font-semibold text-gray-700">Advance (Rs)</th>
                      <th className="px-4 py-2 font-semibold text-gray-700">Balance (Rs)</th>
                      <th className="px-4 py-2 font-semibold text-gray-700">Balance Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lead.vehicles.map((v, i) => {
                      const total = v.vehicleTotalAmount != null ? Number(v.vehicleTotalAmount) : null;
                      const advance = v.vehicleAdvanceAmount != null ? Number(v.vehicleAdvanceAmount) : null;
                      const remaining = total != null && advance != null ? Math.max(0, total - advance) : (total != null ? total : null);
                      if (!v.vehicleName && !v.vehicleType && total == null && advance == null && !v.vehicleBalanceDueDate) return null;
                      return (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2 text-gray-900">{v.vehicleName || '–'}</td>
                          <td className="px-4 py-2 text-gray-700">{v.vehicleType || '–'}</td>
                          <td className="px-4 py-2 text-gray-700">{formatCurrency(advance)}</td>
                          <td className="px-4 py-2 font-medium text-gray-900">{formatCurrency(remaining)}</td>
                          <td className="px-4 py-2 text-gray-700">{formatDate(v.vehicleBalanceDueDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Flight Details: - (same as PDF) – always show */}
          <div className="rounded-xl border border-gray-200 overflow-hidden mt-4">
            <div className="px-4 py-3 bg-[#1565c0] flex items-center gap-2">
              <Plane className="h-5 w-5 text-white" />
              <h3 className="font-semibold text-white">Flight Details: -</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-gray-700">Sr</th>
                    <th className="px-4 py-2 font-semibold text-gray-700">From</th>
                    <th className="px-4 py-2 font-semibold text-gray-700">To</th>
                    <th className="px-4 py-2 font-semibold text-gray-700">Airline Info</th>
                    <th className="px-4 py-2 font-semibold text-gray-700">PNR / Booking</th>
                    <th className="px-4 py-2 font-semibold text-gray-700">Fare (Rs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Array.isArray(lead?.flights) && lead.flights.length > 0 ? (
                    lead.flights.map((f, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2 text-gray-700">{i + 1}</td>
                        <td className="px-4 py-2 text-gray-900">{f.from || '–'}</td>
                        <td className="px-4 py-2 text-gray-700">{f.to || '–'}</td>
                        <td className="px-4 py-2 text-gray-700">{f.airline || '–'}</td>
                        <td className="px-4 py-2 text-gray-700">{f.pnr || '–'}</td>
                        <td className="px-4 py-2 text-gray-700">{f.fare != null ? `Rs.${Number(f.fare).toLocaleString('en-IN')}/-` : '–'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-center text-gray-500">No flight details added.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tour Itinerary: - (same as PDF) – always show */}
          <div className="rounded-xl border border-gray-200 overflow-hidden mt-4">
            <div className="px-4 py-3 bg-[#c62828] flex items-center gap-2">
              <Route className="h-5 w-5 text-white" />
              <h3 className="font-semibold text-white">Tour Itinerary: -</h3>
            </div>
            <div className="p-4 space-y-4">
              {Array.isArray(lead?.itinerary) && lead.itinerary.length > 0 ? (
                lead.itinerary.map((item, i) => (
                  <div key={i} className="border border-amber-200 rounded-lg p-3 bg-amber-50/50">
                    <div className="font-semibold text-gray-900 text-sm mb-1">
                      Day {item.day != null ? item.day : i + 1}{item.route ? ` :– ${item.route}` : ' :– Tour'}
                      {item.date ? ` (${new Date(item.date).toLocaleDateString('en-GB')})` : ''}
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-700 mb-2">{item.description}</p>
                    )}
                    {Array.isArray(item.places) && item.places.length > 0 && (
                      <>
                        <p className="text-sm font-semibold text-red-800 underline mb-1">Places can be visit: -</p>
                        <ul className="text-sm text-gray-700 list-disc list-inside space-y-0.5">
                          {item.places.map((place, j) => (
                            <li key={j}>{place}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Itinerary will be shared shortly.</p>
              )}
            </div>
          </div>
          {(lead?.payment_policy?.trim() || lead?.cancellation_policy?.trim()) && (
            <div className="mt-4 space-y-4">
              {lead.payment_policy?.trim() && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Payment Policy</h3>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.payment_policy.trim()}</p>
                  </div>
                </div>
              )}
              {lead.cancellation_policy?.trim() && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <h3 className="font-semibold text-gray-900">Cancellation Policy</h3>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.cancellation_policy.trim()}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {(lead?.termsAndConditions?.trim() || lead?.memorableTrip?.trim()) && (
            <div className="mt-4 space-y-4">
              {lead.termsAndConditions?.trim() && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-slate-600" />
                    <h3 className="font-semibold text-gray-900">Terms And Conditions</h3>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.termsAndConditions.trim()}</p>
                  </div>
                </div>
              )}
              {lead.memorableTrip?.trim() && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-rose-600" />
                    <h3 className="font-semibold text-gray-900">Memorable Trip</h3>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.memorableTrip.trim()}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {(lead?.inclusions?.trim() || lead?.exclusions?.trim()) && (
            <div className="mt-4 space-y-4">
              {lead.inclusions?.trim() && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-gray-900">Package Inclusions</h3>
                  </div>
                  <div className="p-4">
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      {lead.inclusions.trim().split(/\r?\n/).filter(Boolean).map((line, i) => (
                        <li key={i}>{line.replace(/^[\s•\-]+/, '').trim() || line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {lead.exclusions?.trim() && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <h3 className="font-semibold text-gray-900">Package Exclusions</h3>
                  </div>
                  <div className="p-4">
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      {lead.exclusions.trim().split(/\r?\n/).filter(Boolean).map((line, i) => (
                        <li key={i}>{line.replace(/^[\s•\-]+/, '').trim() || line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
