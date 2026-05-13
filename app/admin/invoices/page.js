'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import toast from 'react-hot-toast';
import { Plus, Eye, Pencil, Download, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import DashboardLayout from '../../../components/Layout/DashboardLayout';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/api';

const PAYMENT_METHODS = ['UPI', 'Cash', 'Bank', 'Card'];

const getToday = () => new Date().toISOString().slice(0, 10);

const formatInputDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const formatDisplayDate = (value) => {
  if (!value) return '--';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB');
};

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeList = (values) => {
  const next = (Array.isArray(values) ? values : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return next.length ? next : [''];
};

const splitContactNumbers = (value) => {
  const next = String(value || '')
    .split(/[\/,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return next.length ? next : [''];
};

const buildDuration = (nights, days) => {
  const n = Number(nights);
  const d = Number(days);
  if (!Number.isFinite(n) && !Number.isFinite(d)) return '';
  const nightsLabel = Number.isFinite(n) ? `${String(n).padStart(2, '0')}N` : '';
  const daysLabel = Number.isFinite(d) ? `${String(d).padStart(2, '0')}D` : '';
  return [nightsLabel, daysLabel].filter(Boolean).join(' / ');
};

const buildTourNameFromLead = (lead) => {
  if (Array.isArray(lead?.destinations) && lead.destinations.length) {
    return lead.destinations.join(', ');
  }
  return lead?.destination || '';
};

const getLeadKidsCount = (lead) => {
  const directKidsCount = Number(lead?.kidsCount);
  if (Number.isFinite(directKidsCount) && directKidsCount >= 0) return directKidsCount;

  if (!Array.isArray(lead?.paxBreakup)) return 0;
  return lead.paxBreakup.reduce((sum, item) => {
    const type = String(item?.type || '').trim().toLowerCase();
    const count = Number(item?.count);
    if (!Number.isFinite(count) || count <= 0) return sum;
    return /(kid|kids|child|children|infant)/i.test(type) ? sum + count : sum;
  }, 0);
};

const getLeadAdultCount = (lead) => {
  if (Array.isArray(lead?.paxBreakup) && lead.paxBreakup.length) {
    const adultCount = lead.paxBreakup.reduce((sum, item) => {
      const type = String(item?.type || '').trim().toLowerCase();
      const count = Number(item?.count);
      if (!Number.isFinite(count) || count <= 0) return sum;
      return /(adult|adults)/i.test(type) ? sum + count : sum;
    }, 0);
    if (adultCount > 0) return adultCount;
  }

  const totalPax = Number(lead?.paxCount);
  const kidsCount = getLeadKidsCount(lead);
  if (Number.isFinite(totalPax) && totalPax >= 0) {
    return Math.max(0, totalPax - kidsCount);
  }
  return 0;
};

const getNextReceiptNumber = (invoices = []) => {
  const maxNumber = invoices.reduce((max, invoice) => {
    const match = String(invoice?.receiptNumber || '').match(/(\d+)(?!.*\d)/);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  return `COT/${String(maxNumber + 1).padStart(3, '0')}`;
};

const getInvoiceId = (invoice) => String(invoice?._id || invoice?.id || '');

const createEmptyForm = (invoices = []) => ({
  sourceType: 'lead',
  selectedLeadId: '',
  receiptNumber: getNextReceiptNumber(invoices),
  receiptDate: getToday(),
  officeAddress: '',
  companyName: 'Chalo On Tour',
  website: 'www.chaloontour.com',
  customerName: '',
  contactNumbers: [''],
  email: '',
  address: '',
  tourName: '',
  tourDuration: '',
  startDate: '',
  endDate: '',
  pricePerPerson: '',
  numberOfPersons: '',
  kidsPricePerPerson: '',
  kidsCount: '',
  touristNames: [''],
  advanceAmount: '',
  paymentMethod: 'UPI',
  paymentDate: getToday(),
  transactionId: '',
});

const hydrateInvoiceToForm = (invoice, invoices = []) => ({
  ...createEmptyForm(invoices),
  ...invoice,
  selectedLeadId: invoice?.selectedLeadId || invoice?.lead?._id || invoice?.lead || '',
  receiptDate: formatInputDate(invoice?.receiptDate),
  startDate: formatInputDate(invoice?.startDate),
  endDate: formatInputDate(invoice?.endDate),
  paymentDate: formatInputDate(invoice?.paymentDate),
  contactNumbers: normalizeList(invoice?.contactNumbers),
  touristNames: normalizeList(invoice?.touristNames),
});

const mapInvoiceFromApi = (invoice) => ({
  ...invoice,
  id: getInvoiceId(invoice),
  selectedLeadId: invoice?.selectedLeadId || invoice?.lead?._id || invoice?.lead || '',
  receiptDate: formatInputDate(invoice?.receiptDate),
  startDate: formatInputDate(invoice?.startDate),
  endDate: formatInputDate(invoice?.endDate),
  paymentDate: formatInputDate(invoice?.paymentDate),
  contactNumbers: normalizeList(invoice?.contactNumbers),
  touristNames: normalizeList(invoice?.touristNames),
});

const mergeLeadIntoForm = (lead, currentForm) => {
  const paxCount = Number(lead?.paxCount);
  const adultCount = getLeadAdultCount(lead);
  const kidsCount = getLeadKidsCount(lead);
  const billablePaxCount = adultCount > 0 ? adultCount : Number.isFinite(paxCount) && paxCount > 0 ? paxCount : 1;
  const perPersonCost =
    lead?.packageCostPerPerson != null
      ? String(lead.packageCostPerPerson)
      : lead?.total_amount != null
      ? String(Math.round(Number(lead.total_amount) / billablePaxCount))
      : currentForm.pricePerPerson;

  return {
    ...currentForm,
    sourceType: 'lead',
    selectedLeadId: lead?._id || currentForm.selectedLeadId,
    customerName: lead?.name || currentForm.customerName,
    contactNumbers: splitContactNumbers(lead?.phone),
    email: lead?.email || currentForm.email,
    tourName: buildTourNameFromLead(lead) || currentForm.tourName,
    tourDuration: buildDuration(lead?.tourNights, lead?.tourDays) || currentForm.tourDuration,
    startDate: formatInputDate(lead?.tourStartDate || lead?.travel_date) || currentForm.startDate,
    endDate: formatInputDate(lead?.tourEndDate || lead?.travel_date) || currentForm.endDate,
    pricePerPerson: perPersonCost,
    numberOfPersons:
      adultCount > 0
        ? String(adultCount)
        : kidsCount > 0
        ? currentForm.numberOfPersons || '0'
        : currentForm.numberOfPersons || String(billablePaxCount),
    kidsPricePerPerson:
      lead?.kidsPackageCostPerPerson != null ? String(lead.kidsPackageCostPerPerson) : currentForm.kidsPricePerPerson,
    kidsCount: kidsCount > 0 ? String(kidsCount) : currentForm.kidsCount,
    touristNames: normalizeList(lead?.name ? [lead.name] : currentForm.touristNames),
    advanceAmount:
      lead?.advance_amount != null ? String(lead.advance_amount) : currentForm.advanceAmount,
  };
};

const dummyInvoices = [];

const inputClassName =
  'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-500';

const textareaClassName = `${inputClassName} resize-none`;

function Field({ label, children, helper }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {helper ? <p className="mt-1 text-xs text-gray-500">{helper}</p> : null}
    </div>
  );
}

function ArrayField({
  label,
  values,
  onChange,
  onAdd,
  onRemove,
  disabled,
  placeholder,
  type = 'text',
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {!disabled && (
          <button
            type="button"
            onClick={onAdd}
            className="text-xs font-medium text-red-600 hover:text-red-700"
          >
            + Add more
          </button>
        )}
      </div>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={`${label}-${index}`} className="flex items-center gap-2">
            <input
              type={type}
              value={value}
              onChange={(e) => onChange(index, e.target.value)}
              disabled={disabled}
              className={inputClassName}
              placeholder={placeholder}
            />
            {!disabled && values.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReceiptPdfDocument({ invoice }) {
  const customerContacts = normalizeList(invoice?.contactNumbers).filter(Boolean).join(' / ');
  const amountReceived = Math.max(0, toNumber(invoice?.advanceAmount));
  const totalAmount = Math.max(0, toNumber(invoice?.totalAmount));
  const balanceDue = Math.max(0, totalAmount - amountReceived);
  
  const receiptLogoSrc = typeof window !== 'undefined'? `${window.location.origin}/Chalo-on-tour.jpg.jpeg`: '';  
  const primaryColor = '#1e3a8a'; // Deep Navy
  const accentColor = '#ef4444'; // Red from logo
  const borderColor = '#cbd5e1';
  const lightBg = '#f8fafc';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  
  return (
    <div
      id="pdf-document"
      style={{
        width: '210mm',
        height: '296.8mm', // Slightly under 297mm to prevent empty 2nd page
        margin: '0 auto',
        background: '#fff',
        color: '#1e293b',
        padding: '12mm 15mm 10mm 15mm', // Tighter bottom padding
        fontFamily: "'Inter', 'Segoe UI', Roboto, sans-serif",
        fontSize: '9.5pt',
        lineHeight: 1.4,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Google Fonts Import */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Dancing+Script:wght@700&display=swap');
        #pdf-document { font-family: 'Inter', sans-serif !important; }
        .signature-text { font-family: 'Dancing Script', cursive !important; }
      `}} />

      {/* Watermark Logo */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-30deg)',
        opacity: 0.03,
        width: '500px',
        zIndex: 0,
        pointerEvents: 'none'
      }}>
        <img src={receiptLogoSrc} alt="" style={{ width: '100%' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' }}>
          <div style={{ width: '320px' }}>
            <img src={receiptLogoSrc} alt="Chalo On Tour" style={{ width: '100%', display: 'block' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ margin: 0, fontSize: '22pt', fontWeight: 800, color: primaryColor, textTransform: 'uppercase', letterSpacing: '2px', lineHeight: 1 }}>Receipt</h1>
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', color: '#64748b', fontSize: '9pt' }}>
                <div><span style={{ fontWeight: 600, color: '#1e293b' }}>Receipt No:</span> {invoice?.receiptNumber || '--'}</div>
                <div><span style={{ fontWeight: 600, color: '#1e293b' }}>Date:</span> {formatDisplayDate(invoice?.receiptDate)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Address & Bill To Bar */}
        <div style={{ display: 'flex', gap: '30px', marginBottom: '25px', padding: '15px', background: lightBg, borderRadius: '12px', border: `1px solid ${borderColor}` }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '7.5pt', color: accentColor, fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>From</h3>
            <p style={{ margin: 0, fontWeight: 800, fontSize: '10.5pt', color: primaryColor }}>Chalo On Tour</p>
            <p style={{ margin: '4px 0', color: '#475569', fontSize: '8.5pt', lineHeight: 1.3 }}>
              Near Police Station, Ghodegaon,<br />
              Tal- Ambegaon, Dist Pune. 412 408
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '8.5pt' }}><strong>Tel:</strong> {customerContacts || '+91 97676 13498'}</p>
          </div>
          
          <div style={{ width: '1px', background: borderColor }}></div>

          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '7.5pt', color: accentColor, fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Bill To</h3>
            <p style={{ margin: 0, fontWeight: 800, fontSize: '10.5pt', color: primaryColor }}>{invoice?.customerName || '--'}</p>
            <p style={{ margin: '4px 0', color: '#475569', fontSize: '8.5pt', whiteSpace: 'pre-line', lineHeight: 1.3 }}>
              {invoice?.address || '--'}
            </p>
            {(invoice?.email || invoice?.contactNumbers?.[0]) && (
              <p style={{ margin: '4px 0 0 0', fontSize: '8.5pt' }}>
                {invoice?.email && <span><strong>Email:</strong> {invoice.email}</span>}
                {invoice?.email && invoice?.contactNumbers?.[0] && <span> | </span>}
                {invoice?.contactNumbers?.[0] && <span><strong>Ph:</strong> {invoice.contactNumbers[0]}</span>}
              </p>
            )}
          </div>
        </div>

        {/* Tour Highlights */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr', gap: '15px', marginBottom: '20px' }}>
          <div style={{ padding: '8px 12px', border: `1px solid ${borderColor}`, borderRadius: '8px' }}>
            <span style={{ display: 'block', fontSize: '7pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Tour Destination</span>
            <span style={{ fontWeight: 800, color: primaryColor, fontSize: '10pt' }}>{invoice?.tourName || '--'}</span>
          </div>
          <div style={{ padding: '8px 12px', border: `1px solid ${borderColor}`, borderRadius: '8px' }}>
            <span style={{ display: 'block', fontSize: '7pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Duration</span>
            <span style={{ fontWeight: 700, fontSize: '10pt' }}>{invoice?.tourDuration || '--'}</span>
          </div>
          <div style={{ padding: '8px 12px', border: `1px solid ${borderColor}`, borderRadius: '8px' }}>
            <span style={{ display: 'block', fontSize: '7pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Passengers</span>
            <span style={{ fontWeight: 700, fontSize: '10pt' }}>
              {invoice?.numberOfPersons || 0} Adult{toNumber(invoice?.numberOfPersons) !== 1 ? 's' : ''}
              {toNumber(invoice?.kidsCount) > 0 ? ` + ${invoice.kidsCount} Child` : ''}
            </span>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ borderRadius: '12px', overflow: 'hidden', border: `1px solid ${borderColor}`, marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: primaryColor, color: '#fff' }}>
                <th style={{ padding: '10px 15px', textAlign: 'left', fontWeight: 700, fontSize: '8.5pt', textTransform: 'uppercase' }}>Service Description</th>
                <th style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 700, fontSize: '8.5pt', textTransform: 'uppercase', width: '100px' }}>Rate</th>
                <th style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 700, fontSize: '8.5pt', textTransform: 'uppercase', width: '80px' }}>Qty</th>
                <th style={{ padding: '10px 15px', textAlign: 'right', fontWeight: 700, fontSize: '8.5pt', textTransform: 'uppercase', width: '110px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td style={{ padding: '12px 15px' }}>
                  <div style={{ fontWeight: 700, fontSize: '10pt' }}>{invoice?.tourName || 'Tour Package'}</div>
                  <div style={{ fontSize: '7.5pt', color: '#64748b', marginTop: '2px' }}>Main Adult Package / Inclusion Details</div>
                </td>
                <td style={{ padding: '12px 15px', textAlign: 'center', fontSize: '9pt' }}>{formatCurrency(invoice?.pricePerPerson)}</td>
                <td style={{ padding: '12px 15px', textAlign: 'center', fontSize: '9pt' }}>{invoice?.numberOfPersons}</td>
                <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: 700, fontSize: '9pt' }}>{formatCurrency(toNumber(invoice?.pricePerPerson) * toNumber(invoice?.numberOfPersons))}</td>
              </tr>
              {toNumber(invoice?.kidsCount) > 0 && (
                <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '12px 15px' }}>
                    <div style={{ fontWeight: 700, fontSize: '10pt' }}>Child Tour Package</div>
                    <div style={{ fontSize: '7.5pt', color: '#64748b', marginTop: '1px' }}>Junior Pack</div>
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'center', fontSize: '9pt' }}>{formatCurrency(invoice?.kidsPricePerPerson)}</td>
                  <td style={{ padding: '12px 15px', textAlign: 'center', fontSize: '9pt' }}>{invoice?.kidsCount}</td>
                  <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: 700, fontSize: '9pt' }}>{formatCurrency(toNumber(invoice?.kidsPricePerPerson) * toNumber(invoice?.kidsCount))}</td>
                </tr>
              )}
              
              {/* Passenger List Row */}
              <tr style={{ background: '#f8fafc' }}>
                <td colSpan={4} style={{ padding: '8px 15px' }}>
                  <div style={{ fontSize: '7pt', fontWeight: 800, color: primaryColor, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Passenger List</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 15px' }}>
                    {(invoice?.touristNames || []).filter(Boolean).map((name, idx) => (
                      <div key={idx} style={{ fontSize: '8.5pt', color: '#475569' }}>
                        <span style={{ fontWeight: 700, color: '#94a3b8', marginRight: '3px' }}>{String(idx + 1).padStart(2, '0')}.</span> {name}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Section */}
        <div style={{ display: 'flex', gap: '30px', marginBottom: '20px' }}>
          {/* Detailed Calculations & Terms */}
          <div style={{ flex: 1.3 }}>
            <div style={{ padding: '15px', borderRadius: '12px', background: lightBg, border: `1px solid ${borderColor}`, height: '100%', boxSizing: 'border-box' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '8pt', color: primaryColor, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>Payment Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '7pt', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Amount Received</div>
                  <div style={{ fontSize: '10.5pt', fontWeight: 700, color: '#16a34a' }}>{formatCurrency(amountReceived)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '7pt', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Method</div>
                  <div style={{ fontSize: '10.5pt', fontWeight: 700 }}>{invoice?.paymentMethod || 'UPI'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '7pt', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Transaction ID</div>
                  <div style={{ fontSize: '9pt', fontFamily: 'monospace', color: '#475569' }}>{invoice?.transactionId || '--'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '7pt', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Receipt Date</div>
                  <div style={{ fontSize: '9pt', fontWeight: 600 }}>{formatDisplayDate(invoice?.receiptDate)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Totals & Signatory */}
          <div style={{ flex: 1 }}>
            <div style={{ borderRadius: '12px', background: lightBg, border: `1px solid ${borderColor}`, padding: '15px', color: primaryColor }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', opacity: 0.7, fontSize: '8.5pt', fontWeight: 600 }}>
                <span>Subtotal</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#16a34a', fontSize: '8.5pt', fontWeight: 700 }}>
                <span>Advance Received</span>
                <span>- {formatCurrency(amountReceived)}</span>
              </div>
              <div style={{ height: '1px', background: borderColor, marginBottom: '10px' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Balance Payable</span>
                <span style={{ fontSize: '16pt', fontWeight: 900 }}>{formatCurrency(balanceDue)}</span>
              </div>
            </div>

            {invoice?.balanceAmountPayableDate && (
              <div style={{ marginTop: '8px', textAlign: 'right', fontSize: '8.5pt', fontWeight: 700, color: accentColor }}>
                Balance Amount Payable Date: {formatDisplayDate(invoice.balanceAmountPayableDate)}
              </div>
            )}
          </div>
        </div>
        {/* Final Row: Thank You & Signatory */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '15px' }}>
          <div style={{ padding: '12px 30px', border: `1px solid ${borderColor}`, borderRadius: '100px', background: '#fff', color: primaryColor, fontWeight: 900, fontSize: '10pt', textTransform: 'uppercase', letterSpacing: '1.5px', boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.1)', alignSelf: 'center' }}>
            Thank You For Your Business!
          </div>

          <div style={{ width: '320px' }}>
            {/* Authorised Signatory Section */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', height: '110px', marginBottom: '5px' }}>
              {/* Stamp */}
              <div style={{ width: '100px', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <img 
                  src={`${baseUrl}/stamp-sign.png`}
                  alt="Official Stamp" 
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'contrast(1.6)', mixBlendMode: 'multiply' }} 
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
              {/* Signature Side */}
              <div style={{ width: '160px', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <img 
                  src={`${baseUrl}/signature.png`}
                  alt="Signature" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%', 
                    objectFit: 'contain', 
                    filter: 'contrast(1.8) brightness(1.1) multiply', // High contrast filter
                    mixBlendMode: 'multiply' // Blend out off-white scanned background
                  }} 
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ height: '1.5px', background: primaryColor, width: '100%', marginBottom: '4px', opacity: 0.2 }}></div>
              <div style={{ fontSize: '9pt', fontWeight: 900, color: primaryColor, textTransform: 'uppercase' }}>Mr. Utkarsh Kale</div>
              <div style={{ fontSize: '7pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.2px' }}>Authorized Signatory</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '15px', fontSize: '7.5pt', color: '#94a3b8', borderTop: `1px solid ${borderColor}`, paddingTop: '12px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 700, color: primaryColor, textTransform: 'uppercase' }}>Chalo On Tour</p>
            <p style={{ margin: '3px 0' }}>Near Police Station, Ghodegaon, Tal- Ambegaon, Dist Pune | www.chaloontour.com</p>
            <p style={{ margin: '8px 0 0 0', fontStyle: 'italic', opacity: 0.5 }}>*** This is a system-generated document. Digital Verification Active. ***</p>
          </div>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const { user, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState(dummyInvoices);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [formData, setFormData] = useState(() => createEmptyForm(dummyInvoices));
  const [leads, setLeads] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingLeadDetails, setLoadingLeadDetails] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState('');
  const [downloadingPdfId, setDownloadingPdfId] = useState('');

  const isViewMode = modalMode === 'view';

  const calculatedTotal = useMemo(() => {
    const adultTotal =
      Math.max(0, toNumber(formData.pricePerPerson)) * Math.max(0, toNumber(formData.numberOfPersons));
    const kidsTotal =
      Math.max(0, toNumber(formData.kidsPricePerPerson)) * Math.max(0, toNumber(formData.kidsCount));
    return adultTotal + kidsTotal;
  }, [formData.pricePerPerson, formData.numberOfPersons, formData.kidsPricePerPerson, formData.kidsCount]);

  const balanceAmount = useMemo(
    () => Math.max(0, calculatedTotal - Math.max(0, toNumber(formData.advanceAmount))),
    [calculatedTotal, formData.advanceAmount]
  );

  const paymentStatus = useMemo(() => {
    const advanceAmount = Math.max(0, toNumber(formData.advanceAmount));
    if (calculatedTotal <= 0) return 'Pending';
    if (advanceAmount <= 0) return 'Unpaid';
    if (advanceAmount >= calculatedTotal) return 'Paid';
    return 'Partial';
  }, [calculatedTotal, formData.advanceAmount]);

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const response = await api.get('/leads?limit=500&recent=1');
      setLeads(response.data?.leads || []);
    } catch (error) {
      setLeads([]);
      toast.error(error.response?.data?.message || 'Failed to load leads. Manual receipt is still available.');
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const response = await api.get('/invoices');
      setInvoices((response.data?.invoices || []).map(mapInvoiceFromApi));
    } catch (error) {
      setInvoices([]);
      toast.error(error.response?.data?.message || 'Failed to load receipts');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchNextReceiptNumber = async () => {
    try {
      const response = await api.get('/invoices/meta/next-receipt-number');
      return response.data?.receiptNumber || getNextReceiptNumber(invoices);
    } catch {
      return getNextReceiptNumber(invoices);
    }
  };

  useEffect(() => {
    if (authLoading || !user) return;
    fetchInvoices();
  }, [authLoading, user]);

  useEffect(() => {
    if (!isFormOpen || modalMode === 'view' || formData.sourceType !== 'lead') return;
    fetchLeads();
  }, [isFormOpen, modalMode, formData.sourceType]);

  const openCreateModal = async () => {
    setModalMode('create');
    setActiveInvoice(null);
    setFormData(createEmptyForm(invoices));
    setIsFormOpen(true);
    const receiptNumber = await fetchNextReceiptNumber();
    setFormData((prev) => ({ ...prev, receiptNumber }));
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setActiveInvoice(null);
    setModalMode('create');
    setFormData(createEmptyForm(invoices));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleArrayFieldChange = (field, index, value) => {
    setFormData((prev) => {
      const next = [...prev[field]];
      next[index] = value;
      return { ...prev, [field]: next };
    });
  };

  const addArrayItem = (field) => {
    setFormData((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayItem = (field, index) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSourceTypeChange = (sourceType) => {
    setFormData((prev) => ({
      ...prev,
      sourceType,
      selectedLeadId: sourceType === 'manual' ? '' : prev.selectedLeadId,
    }));
  };

  const handleLeadSelection = async (leadId) => {
    setFormData((prev) => ({ ...prev, selectedLeadId: leadId }));
    if (!leadId) return;

    setLoadingLeadDetails(true);
    try {
      const response = await api.get(`/leads/${leadId}`);
      const lead = response.data?.lead;
      if (!lead) {
        toast.error('Lead not found');
        return;
      }
      setFormData((prev) => mergeLeadIntoForm(lead, prev));
      toast.success('Lead details fetched into receipt form');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch selected lead');
    } finally {
      setLoadingLeadDetails(false);
    }
  };

  const openModalForInvoice = (invoice, mode) => {
    setActiveInvoice(invoice);
    setModalMode(mode);
    setFormData(hydrateInvoiceToForm(invoice, invoices));
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (savingInvoice) return;

    if (formData.sourceType === 'lead' && !formData.selectedLeadId) {
      toast.error('Please select a lead to autofill the receipt');
      return;
    }

    const cleanedContactNumbers = normalizeList(formData.contactNumbers);
    const cleanedTourists = normalizeList(formData.touristNames);

    const payload = {
      sourceType: formData.sourceType,
      selectedLeadId: formData.selectedLeadId,
      receiptNumber: formData.receiptNumber.trim() || getNextReceiptNumber(invoices),
      receiptDate: formData.receiptDate || getToday(),
      officeAddress: formData.officeAddress.trim(),
      companyName: formData.companyName.trim(),
      website: formData.website.trim(),
      customerName: formData.customerName.trim(),
      contactNumbers: cleanedContactNumbers,
      email: formData.email.trim(),
      address: formData.address.trim(),
      tourName: formData.tourName.trim(),
      tourDuration: formData.tourDuration.trim(),
      startDate: formData.startDate || '',
      endDate: formData.endDate || '',
      pricePerPerson: Math.max(0, toNumber(formData.pricePerPerson)),
      numberOfPersons: Math.max(0, toNumber(formData.numberOfPersons)),
      kidsPricePerPerson: Math.max(0, toNumber(formData.kidsPricePerPerson)),
      kidsCount: Math.max(0, toNumber(formData.kidsCount)),
      totalAmount: calculatedTotal,
      touristNames: cleanedTourists,
      advanceAmount: Math.max(0, toNumber(formData.advanceAmount)),
      paymentMethod: formData.paymentMethod,
      paymentDate: formData.paymentDate || '',
      transactionId: formData.transactionId.trim(),
      balanceAmount,
      status: paymentStatus,
    };

    setSavingInvoice(true);
    try {
      if (modalMode === 'edit' && activeInvoice) {
        const response = await api.put(`/invoices/${getInvoiceId(activeInvoice)}`, payload);
        const savedInvoice = mapInvoiceFromApi(response.data?.invoice || {});
        setInvoices((prev) =>
          prev.map((invoice) => (getInvoiceId(invoice) === getInvoiceId(activeInvoice) ? savedInvoice : invoice))
        );
        toast.success('Receipt updated successfully');
      } else {
        const response = await api.post('/invoices', payload);
        const savedInvoice = mapInvoiceFromApi(response.data?.invoice || {});
        setInvoices((prev) => [savedInvoice, ...prev]);
        toast.success('Receipt created successfully');
      }
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save receipt');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleDownload = async (invoice, type) => {
    if (type !== 'pdf') {
      toast.error('Only PDF download is available right now.');
      return;
    }

    const invoiceId = getInvoiceId(invoice);
    if (!invoiceId || downloadingPdfId) return;

    let mountNode;
    let root;
    try {
      setDownloadingPdfId(invoiceId);
      const html2pdf = (await import('html2pdf.js')).default;

      mountNode = document.createElement('div');
      mountNode.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;background:#fff;z-index:-1;';
      document.body.appendChild(mountNode);

      root = createRoot(mountNode);
      root.render(<ReceiptPdfDocument invoice={invoice} />);

      // Wait for fonts and content to load
      if (document.fonts) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));

      const pdfEl = mountNode.querySelector('#pdf-document');
      if (!pdfEl) {
        throw new Error('Receipt PDF content not ready.');
      }

      await html2pdf()
        .set({
          margin: 0,
          filename: `${String(invoice.receiptNumber || 'receipt').replace(/[^\w-/]+/g, '-')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(pdfEl)
        .save();

      toast.success(`PDF downloaded for ${invoice.receiptNumber}`);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'PDF download failed');
    } finally {
      if (root) {
        root.unmount();
      }
      if (mountNode?.parentNode) {
        mountNode.parentNode.removeChild(mountNode);
      }
      setDownloadingPdfId('');
    }
  };

  const handleDelete = async (invoice) => {
    if (!window.confirm(`Delete receipt ${invoice.receiptNumber}?`)) return;
    const invoiceId = getInvoiceId(invoice);
    if (!invoiceId) return;

    setDeletingInvoiceId(invoiceId);
    try {
      await api.delete(`/invoices/${invoiceId}`);
      setInvoices((prev) => prev.filter((item) => getInvoiceId(item) !== invoiceId));
      toast.success('Receipt deleted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete receipt');
    } finally {
      setDeletingInvoiceId('');
    }
  };

  if (authLoading || !user) return null;

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col overflow-hidden px-4 py-4 md:px-6 md:py-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Invoices / Receipts</h1>
            <p className="mt-1 text-sm text-gray-500">
              Create receipt-style invoices with lead autofill, manual entry, and automatic amount calculation.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
          >
            <Plus className="h-4 w-4" />
            Create Receipt
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Receipt No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Tour
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Source
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Advance
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Balance
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {loadingInvoices ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">
                        Loading receipts...
                      </td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">
                        No receipts yet. Use &quot;Create Receipt&quot; to make one from a lead or manually.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice) => (
                      <tr key={getInvoiceId(invoice)} className="hover:bg-gray-50/60">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          {invoice.receiptNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{invoice.customerName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{invoice.tourName || '--'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {invoice.sourceType === 'lead' ? 'Lead' : 'Manual'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {formatDisplayDate(invoice.receiptDate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          {formatCurrency(invoice.totalAmount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                          {formatCurrency(invoice.advanceAmount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                          {formatCurrency(invoice.balanceAmount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span
                            className={
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                              (invoice.status === 'Paid'
                                ? 'bg-green-50 text-green-700 ring-1 ring-green-100'
                                : invoice.status === 'Partial'
                                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                                : invoice.status === 'Unpaid'
                                ? 'bg-red-50 text-red-700 ring-1 ring-red-100'
                                : 'bg-gray-100 text-gray-700 ring-1 ring-gray-200')
                            }
                          >
                            {invoice.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openModalForInvoice(invoice, 'view')}
                              className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 hover:border-gray-300 hover:text-gray-900"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openModalForInvoice(invoice, 'edit')}
                              className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 hover:border-gray-300 hover:text-gray-900"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDownload(invoice, 'pdf')}
                              disabled={downloadingPdfId === getInvoiceId(invoice)}
                              className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 hover:border-gray-300 hover:text-gray-900"
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(invoice)}
                              disabled={deletingInvoiceId === getInvoiceId(invoice)}
                              className="rounded-md border border-gray-200 bg-white p-1.5 text-red-500 hover:border-red-200 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isFormOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
            <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {modalMode === 'create' && 'Create Receipt'}
                    {modalMode === 'edit' && 'Edit Receipt'}
                    {modalMode === 'view' && 'Receipt Details'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Select a lead for autofill or switch to manual entry for non-lead receipts.
                  </p>
                </div>
                <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-800">
                  ✕
                </button>
              </div>

              <form id="receipt-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-6">
                  <section className="rounded-xl border border-gray-200 p-4">
                    <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">Receipt Source</h3>
                        <p className="text-sm text-gray-500">
                          Lead receipts autofill available lead data. Manual receipts require full entry.
                        </p>
                      </div>
                      {formData.sourceType === 'lead' && (
                        <button
                          type="button"
                          onClick={fetchLeads}
                          disabled={loadingLeads || savingInvoice}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RefreshCw className={`h-4 w-4 ${loadingLeads ? 'animate-spin' : ''}`} />
                          Refresh Leads
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-gray-200 p-4">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="radio"
                            name="sourceType"
                            checked={formData.sourceType === 'lead'}
                            onChange={() => handleSourceTypeChange('lead')}
                            disabled={isViewMode || savingInvoice}
                            className="mt-1"
                          />
                          <div>
                            <p className="font-medium text-gray-900">Use Lead</p>
                            <p className="text-sm text-gray-500">
                              Select a lead and autofill customer, contact, tour and payment values where available.
                            </p>
                          </div>
                        </label>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-4">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="radio"
                            name="sourceType"
                            checked={formData.sourceType === 'manual'}
                            onChange={() => handleSourceTypeChange('manual')}
                            disabled={isViewMode || savingInvoice}
                            className="mt-1"
                          />
                          <div>
                            <p className="font-medium text-gray-900">Manual Receipt</p>
                            <p className="text-sm text-gray-500">
                              Use this when the receipt is for someone outside the leads system.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {formData.sourceType === 'lead' && (
                      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                        <Field
                          label="Select Lead"
                          helper={loadingLeadDetails ? 'Fetching selected lead details...' : 'Choose a lead to fill as much receipt data as possible.'}
                        >
                          <select
                            value={formData.selectedLeadId}
                            onChange={(e) => handleLeadSelection(e.target.value)}
                            disabled={isViewMode || loadingLeads || loadingLeadDetails || savingInvoice}
                            className={inputClassName}
                            required={formData.sourceType === 'lead'}
                          >
                            <option value="">
                              {loadingLeads ? 'Loading leads...' : 'Select a lead'}
                            </option>
                            {leads.map((lead) => (
                              <option key={lead._id} value={lead._id}>
                                {(lead.leadId ? `${lead.leadId} - ` : '') + lead.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <div className="flex items-end">
                          {loadingLeadDetails && (
                            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading lead
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="rounded-xl border border-gray-200 p-4">
                    <h3 className="mb-4 text-base font-semibold text-gray-900">1. Basic Receipt Information</h3>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Field label="Receipt Number">
                        <input
                          type="text"
                          name="receiptNumber"
                          value={formData.receiptNumber}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="COT/052"
                          required
                        />
                      </Field>
                      <Field label="Receipt Date">
                        <input
                          type="date"
                          name="receiptDate"
                          value={formData.receiptDate}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          required
                        />
                      </Field>
                      <Field label="Website">
                        <input
                          type="text"
                          name="website"
                          value={formData.website}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="www.chaloontour.com"
                        />
                      </Field>
                      <Field label="Company Name">
                        <input
                          type="text"
                          name="companyName"
                          value={formData.companyName}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="Chalo On Tour"
                          required
                        />
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Office Address">
                          <textarea
                            name="officeAddress"
                            value={formData.officeAddress}
                            onChange={handleChange}
                            disabled={isViewMode}
                            className={textareaClassName}
                            rows={3}
                            placeholder="Enter office address"
                          />
                        </Field>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-gray-200 p-4">
                    <h3 className="mb-4 text-base font-semibold text-gray-900">2. Customer Details (Receipt To)</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Customer Name">
                        <input
                          type="text"
                          name="customerName"
                          value={formData.customerName}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="Customer full name"
                          required
                        />
                      </Field>
                      <Field label="Email ID">
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="customer@example.com"
                        />
                      </Field>
                      <ArrayField
                        label="Contact Number"
                        values={formData.contactNumbers}
                        onChange={(index, value) => handleArrayFieldChange('contactNumbers', index, value)}
                        onAdd={() => addArrayItem('contactNumbers')}
                        onRemove={(index) => removeArrayItem('contactNumbers', index)}
                        disabled={isViewMode}
                        placeholder="Enter contact number"
                      />
                      <Field label="Address">
                        <textarea
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={textareaClassName}
                          rows={4}
                          placeholder="Enter customer address"
                        />
                      </Field>
                    </div>
                  </section>

                  <section className="rounded-xl border border-gray-200 p-4">
                    <h3 className="mb-4 text-base font-semibold text-gray-900">3. Tour / Product Details</h3>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="md:col-span-2">
                        <Field label="Tour Name / Product Name">
                          <input
                            type="text"
                            name="tourName"
                            value={formData.tourName}
                            onChange={handleChange}
                            disabled={isViewMode}
                            className={inputClassName}
                            placeholder="Shimla Kullu Manali Tour"
                            required
                          />
                        </Field>
                      </div>
                      <Field label="Tour Duration">
                        <input
                          type="text"
                          name="tourDuration"
                          value={formData.tourDuration}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="05N / 06D"
                        />
                      </Field>
                      <Field label="Adult Count">
                        <input
                          type="number"
                          name="numberOfPersons"
                          value={formData.numberOfPersons}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="1"
                          min="0"
                          required
                        />
                      </Field>
                      <Field label="Start Date">
                        <input
                          type="date"
                          name="startDate"
                          value={formData.startDate}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                        />
                      </Field>
                      <Field label="End Date">
                        <input
                          type="date"
                          name="endDate"
                          value={formData.endDate}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                        />
                      </Field>
                      <Field label="Adult Price Per Person">
                        <input
                          type="number"
                          name="pricePerPerson"
                          value={formData.pricePerPerson}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="30000"
                          min="0"
                          required
                        />
                      </Field>
                      <Field label="Kids Count">
                        <input
                          type="number"
                          name="kidsCount"
                          value={formData.kidsCount}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="0"
                          min="0"
                        />
                      </Field>
                      <Field label="Kids Price Per Person">
                        <input
                          type="number"
                          name="kidsPricePerPerson"
                          value={formData.kidsPricePerPerson}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="0"
                          min="0"
                        />
                      </Field>
                      <Field label="Total Amount" helper="Auto-calculated from adult and kids pricing.">
                        <input
                          type="text"
                          value={calculatedTotal > 0 ? String(calculatedTotal) : ''}
                          readOnly
                          className={`${inputClassName} bg-gray-50 font-semibold`}
                          placeholder="Auto calculated"
                        />
                      </Field>
                    </div>
                  </section>

                  <section className="rounded-xl border border-gray-200 p-4">
                    <h3 className="mb-4 text-base font-semibold text-gray-900">4. Tourist Details</h3>
                    <ArrayField
                      label="Tourist Name(s)"
                      values={formData.touristNames}
                      onChange={(index, value) => handleArrayFieldChange('touristNames', index, value)}
                      onAdd={() => addArrayItem('touristNames')}
                      onRemove={(index) => removeArrayItem('touristNames', index)}
                      disabled={isViewMode}
                      placeholder="Enter tourist name"
                    />
                  </section>

                  <section className="rounded-xl border border-gray-200 p-4">
                    <h3 className="mb-4 text-base font-semibold text-gray-900">5. Payment Details</h3>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Advance Amount">
                        <input
                          type="number"
                          name="advanceAmount"
                          value={formData.advanceAmount}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="0"
                          min="0"
                        />
                      </Field>
                      <Field label="Payment Method">
                        <select
                          name="paymentMethod"
                          value={formData.paymentMethod}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Payment Date">
                        <input
                          type="date"
                          name="paymentDate"
                          value={formData.paymentDate}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                        />
                      </Field>
                      <Field label="Transaction ID">
                        <input
                          type="text"
                          name="transactionId"
                          value={formData.transactionId}
                          onChange={handleChange}
                          disabled={isViewMode}
                          className={inputClassName}
                          placeholder="Optional transaction reference"
                        />
                      </Field>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div className="rounded-xl bg-gray-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Amount</p>
                        <p className="mt-2 text-lg font-semibold text-gray-900">{formatCurrency(calculatedTotal)}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Balance Amount</p>
                        <p className="mt-2 text-lg font-semibold text-gray-900">{formatCurrency(balanceAmount)}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Payment Status</p>
                        <p className="mt-2 text-lg font-semibold text-gray-900">{paymentStatus}</p>
                      </div>
                    </div>
                  </section>
                </div>
              </form>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {isViewMode ? 'Close' : 'Cancel'}
                </button>
                {!isViewMode && (
                  <button
                    type="submit"
                    form="receipt-form"
                    disabled={savingInvoice}
                    className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                  >
                    {savingInvoice ? 'Saving...' : modalMode === 'edit' ? 'Save Changes' : 'Save Receipt'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

