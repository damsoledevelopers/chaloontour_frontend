'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '../../../components/Layout/DashboardLayout';
import TourPDFDocument from '../../../components/TourPDF/TourPDFGenerator';
import { api } from '../../../lib/api';
import {
    FileText, Plus, Trash2, Download, Eye, EyeOff, Printer,
    ChevronDown, ChevronUp, Plane, Hotel, MapPin, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ────────────────────── helpers ──────────────────── */
const emptyHotel = () => ({ name: '', nights: '', roomCategory: 'Standard Double', roomSharing: '', destination: '' });
const emptyFlight = () => ({ from: '', depDate: '', depTime: '', to: '', arrDate: '', arrTime: '', airline: '', flightNo: '', pnr: '' });
const emptyDay = () => ({ dayLabel: '', date: '', title: '', description: '', places: [''] });

const defaultData = () => ({
    // summary
    perPersonCost: '',
    totalPax: '',
    vehicleType: 'Ertiga or Innova',
    hotelCategory: '3-Star Category',
    mealPlan: 'Breakfast Only',
    tourDuration: '05 Nights 06 Days',
    tourDateFrom: '',
    tourDateTo: '',
    pickupPoint: 'Jammu Bus Stand',
    dropPoint: 'Amritsar Airport',
    destinations: 'Jammu, Katra, Shivkhori, Amritsar',
    packageName: '',
    // hero images (optional uploads)
    heroMain: '',
    heroSub1: '',
    heroSub2: '',
    // hotels
    hotels: [
        { name: 'Hotel Rama Trident', nights: '02 Nights', roomCategory: 'Standard Double', roomSharing: 'Double', destination: 'Katra' },
        { name: 'Clarks Inn Express', nights: '01 Night', roomCategory: 'Standard Double', roomSharing: 'Double', destination: 'Jammu' },
        { name: 'One Earth GG Regency', nights: '01 Night', roomCategory: 'Standard Double', roomSharing: 'Double', destination: 'Amritsar' },
    ],
    accommodationNote: 'Early check-in and check-out subject to availability of rooms; otherwise extra charges may apply as per hotel norms. Hotel may change at the time of final booking due to availability.',
    // flights
    flights: [
        { from: 'Pune', depDate: '05/04/2026', depTime: '02:05 PM', to: 'Delhi', arrDate: '05/04/2026', arrTime: '04:15 PM', airline: 'IndiGo', flightNo: '6E-2285', pnr: 'M1JMVB' },
        { from: 'Amritsar', depDate: '10/04/2026', depTime: '11:20 PM', to: 'Pune', arrDate: '11/04/2026', arrTime: '01:00 AM', airline: 'IndiGo', flightNo: '6E-6129', pnr: 'M7RHMM' },
    ],
    flightNote: 'Flight rates and seats may change at the time of final booking.',
    inclusions: '',
    exclusions: '',
    paymentPolicy: '',
    cancellationPolicy: '',
    termsAndConditions: '',
    memorableTrip: '',
    // itinerary
    itinerary: [
        {
            dayLabel: 'Day 1',
            date: '05 April 2026',
            title: 'Arrive Delhi & Proceed to Jammu-Katra',
            description: 'Guests departing from their own city. Upon arrival at Delhi airport or railway station proceed to Volvo junction. Overnight travel by Volvo bus from Delhi to Katra. On next day morning reach at Katra around 09:00 AM – 10:00 AM.',
            places: [],
        },
        {
            dayLabel: 'Day 2',
            date: '06 April 2026',
            title: 'Katra – Leisure Day',
            description: 'In the morning enjoy breakfast and take rest in the hotel. At noon after finishing your lunch you can visit the local market of Katra. Where you can buy dry fruits, warm clothes and other varieties.',
            places: [],
        },
        {
            dayLabel: 'Day 3',
            date: '07 April 2026',
            title: 'Vaishnodevi Temple Darshan',
            description: 'On arrival at Katra, our driver assists to transfer you to the prebooked hotel. Check in at hotel, freshen up and leave for Banganga to start your trek for Mata Vaishno Devi Shrine. The trek to shrine is 13 Kms one way and 26 Kms both ways. You can also hire Pithoo, Pony & Palki at your own expense. Kindly note you need to take yatra slip from Katra to start the yatra. Dinner at outside hotel and overnight stay at hotel in Katra.',
            places: ['Mata Vaishnodevi Temple', 'Ardhkuwari', 'Bhairavnath Temple', 'Ban Ganga'],
        },
        {
            dayLabel: 'Day 4',
            date: '08 April 2026',
            title: 'Katra to Shivkhori to Jammu',
            description: 'After breakfast you will be transferred to Shivkhori. Shiv Khori temple is dedicated to Lord Shiva situated in Reasi district of Jammu and Kashmir. The natural cave is almost 200 metres long and contains a self-made lingam. Also visit Baba Dhansar temple. Post tour return back to Jammu for night stay.',
            places: ["Lord Shiva's Caves", 'Shiv Parvati Temples', 'Swami Amarnath Cave', 'Baba Dhansar Temple'],
        },
        {
            dayLabel: 'Day 5',
            date: '09 April 2026',
            title: 'Jammu – Amritsar',
            description: 'In the morning proceed for Amritsar. Upon arrival in the evening visit Golden Temple which has unique Sikh architecture. Later visit Jallianwala Bagh which is adjacent to Golden Temple. Return to hotel and overnight stay in Amritsar.',
            places: ['Golden Temple', 'Jallianwala Bagh'],
        },
        {
            dayLabel: 'Day 6',
            date: '10 April 2026',
            title: 'Amritsar Local and Departure',
            description: 'After breakfast, spend half day at Amritsar. Explore the local market famous for warm clothes, footwear and clothes. Visit Indo-Pak Wagah Border, then proceed to Airport or Railway station for your onward journey with great memories.',
            places: ['Atari Indo-Pak Wagah Border'],
        },
    ],
    // contact
    quoteNumber: '',
    quoteDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    ceoName: 'Mr. Utkarsh Kale (C.E.O.)',
    cell1: '9960625167',
    cell2: '9136549898',
    companyEmail: 'bookings@chaloontour.com',
    companyWebsite: 'www.chaloontour.com',
});

const formatDate = (value, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-IN', options);
};

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
    const base = defaultData();
    const images = Array.isArray(lead?.tripImages) ? lead.tripImages.filter(Boolean) : [];
    const destinations = Array.isArray(lead?.destinations) && lead.destinations.length > 0
        ? lead.destinations.join(', ')
        : (lead?.destination || '');

    // Helper to get full URL for trip images
    const getTripImg = (img) => {
        if (!img) return '';
        if (img.startsWith('data:') || img.startsWith('http')) return img;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://crm.chaloontour.com/api';
        const base = apiUrl.replace(/\/api\/?$/, '');
        return `${base}/uploads/${img.startsWith('/') ? img.slice(1) : img}`;
    };

    return {
        ...base,
        quoteNumber: lead?.leadId || '',
        quoteDate: formatDate(lead?.createdAt, { day: '2-digit', month: 'short', year: 'numeric' }),
        perPersonCost: lead?.packageCostPerPerson != null
            ? String(lead.packageCostPerPerson)
            : (lead?.total_amount != null ? String(lead.total_amount) : ''),
        totalPax: buildPaxLabel(lead),
        vehicleType: lead?.vehicleType || '',
        hotelCategory: lead?.hotelCategory || '',
        mealPlan: lead?.mealPlan || '',
        tourDuration: buildTourDuration(lead),
        tourDateFrom: formatDate(lead?.tourStartDate || lead?.travel_date),
        tourDateTo: formatDate(lead?.tourEndDate || lead?.travel_date),
        pickupPoint: lead?.pickupPoint || '',
        dropPoint: lead?.dropPoint || '',
        destinations,
        packageName: lead?.packageName || '',
        heroMain: getTripImg(images[0]),
        heroSub1: getTripImg(images[1]),
        heroSub2: getTripImg(images[2]),
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
                date: formatDate(day?.date, { day: '2-digit', month: 'long', year: 'numeric' }),
                title: day?.route || '',
                description: day?.description || '',
                places: Array.isArray(day?.places) ? day.places.filter(Boolean) : [],
            }))
            : [],
    };
};

/* ─────────────────── SECTION HEADER ──────────────── */
function SectionCard({ icon: Icon, title, children, accent = 'blue' }) {
    const [open, setOpen] = useState(true);
    const colors = {
        blue: 'border-blue-400 bg-blue-50',
        green: 'border-emerald-400 bg-emerald-50',
        purple: 'border-purple-400 bg-purple-50',
        orange: 'border-orange-400 bg-orange-50',
    };
    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden`}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between px-5 py-3.5 border-l-4 ${colors[accent]} transition-colors hover:bg-opacity-80`}
            >
                <div className="flex items-center gap-2.5">
                    <Icon className="h-4.5 w-4.5 text-gray-600" size={18} />
                    <span className="font-semibold text-gray-800 text-sm">{title}</span>
                </div>
                {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {open && <div className="px-5 py-4 border-t border-gray-100">{children}</div>}
        </div>
    );
}

/* ─────────────────── FIELD COMPONENT ──────────────── */
function Field({ label, children, className = '' }) {
    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
            {children}
        </div>
    );
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-gray-400';
const textareaCls = `${inputCls} resize-none`;

/* ─────────────────── MAIN PAGE ──────────────────── */
function TourPDFPageContent() {
    const searchParams = useSearchParams();
    const leadId = searchParams.get('leadId') || searchParams.get('id');
    const isExport = searchParams.get('export') === '1';
    const shouldPreviewLead = searchParams.get('preview') === '1';

    const [data, setData] = useState(defaultData());
    const [preview, setPreview] = useState(isExport || shouldPreviewLead);
    const [loadingLeadData, setLoadingLeadData] = useState(!!leadId);
    const pdfRef = useRef(null);

    useEffect(() => {
        if (!leadId) return;

        let isMounted = true;

        const loadLead = async () => {
            setLoadingLeadData(true);
            try {
                const response = await api.get(`/leads/${leadId}`);
                if (!isMounted) return;
                setData(mapLeadToTourPdfData(response.data?.lead || {}));
                if (shouldPreviewLead) {
                    setPreview(true);
                }
            } catch (error) {
                if (!isMounted) return;
                toast.error(error.response?.data?.message || 'Failed to load lead for Tour PDF preview.');
            } finally {
                if (isMounted) {
                    setLoadingLeadData(false);
                }
            }
        };

        loadLead();

        return () => {
            isMounted = false;
        };
    }, [leadId, shouldPreviewLead]);

    const set = useCallback((field, value) => {
        setData(d => ({ ...d, [field]: value }));
    }, []);

    // Marker for Puppeteer
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.setExportData = (payload) => {
                setData(payload);
            };
        }
    }, []);

    // Marker for Puppeteer with robust rendering signal
    useEffect(() => {
        // We only wait for data injection if we are in export mode
        if (!isExport || loadingLeadData) return;

        const waitForRender = async () => {
            try {
                // Ensure fonts are fully loaded
                if (document.fonts) {
                    await document.fonts.ready;
                }

                // Small delay to allow React to paint the injected data
                await new Promise(r => setTimeout(r, 500));

                // Ensure all images are loaded
                const images = Array.from(document.images);
                await Promise.all(
                    images.map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise(resolve => {
                            img.onload = img.onerror = resolve;
                        });
                    })
                );

                // Signal to Puppeteer that we are ready
                window.RENDER_COMPLETE = true;
                console.log('RENDER_COMPLETE - Robust signal sent');
            } catch (err) {
                console.error('Render signal failed:', err);
                // Fallback to avoid hanging Puppeteer
                window.RENDER_COMPLETE = true;
            }
        };

        // SAFETY FALLBACK: If images or fonts take too long, signal ready anyway after 5s
        const fallbackTimer = setTimeout(() => {
            if (!window.RENDER_COMPLETE) {
                window.RENDER_COMPLETE = true;
                console.warn('RENDER_COMPLETE - Fallback triggered after 5s');
            }
        }, 5000);

        waitForRender();
        return () => clearTimeout(fallbackTimer);
    }, [isExport, loadingLeadData, data]);

    if (isExport) {
        return (
            <div className="bg-white min-h-screen">
                <TourPDFDocument data={data} pdfMode={true} />
            </div>
        );
    }

    /* hotel helpers */
    const addHotel = () => setData(d => ({ ...d, hotels: [...d.hotels, emptyHotel()] }));
    const removeHotel = i => setData(d => ({ ...d, hotels: d.hotels.filter((_, idx) => idx !== i) }));
    const updateHotel = (i, field, val) =>
        setData(d => ({
            ...d, hotels: d.hotels.map((h, idx) => idx === i ? { ...h, [field]: val } : h),
        }));

    /* flight helpers */
    const addFlight = () => setData(d => ({ ...d, flights: [...d.flights, emptyFlight()] }));
    const removeFlight = i => setData(d => ({ ...d, flights: d.flights.filter((_, idx) => idx !== i) }));
    const updateFlight = (i, field, val) =>
        setData(d => ({
            ...d, flights: d.flights.map((f, idx) => idx === i ? { ...f, [field]: val } : f),
        }));

    /* itinerary helpers */
    const addDay = () => setData(d => ({ ...d, itinerary: [...d.itinerary, emptyDay()] }));
    const removeDay = i => setData(d => ({ ...d, itinerary: d.itinerary.filter((_, idx) => idx !== i) }));
    const updateDay = (i, field, val) =>
        setData(d => ({
            ...d, itinerary: d.itinerary.map((day, idx) => idx === i ? { ...day, [field]: val } : day),
        }));
    const updatePlace = (di, pi, val) =>
        setData(d => ({
            ...d, itinerary: d.itinerary.map((day, idx) =>
                idx === di ? { ...day, places: day.places.map((p, pid) => pid === pi ? val : p) } : day
            ),
        }));
    const addPlace = di =>
        setData(d => ({
            ...d, itinerary: d.itinerary.map((day, idx) =>
                idx === di ? { ...day, places: [...day.places, ''] } : day
            ),
        }));
    const removePlace = (di, pi) =>
        setData(d => ({
            ...d, itinerary: d.itinerary.map((day, idx) =>
                idx === di ? { ...day, places: day.places.filter((_, pid) => pid !== pi) } : day
            ),
        }));

    /* image upload helpers */
    const handleHeroImagesChange = (event) => {
        const files = Array.from(event.target.files || []).slice(0, 3);
        if (!files.length) return;

        files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result;
                if (!result || typeof result !== 'string') return;
                setData((prev) => {
                    const fieldMap = ['heroMain', 'heroSub1', 'heroSub2'];
                    const field = fieldMap[index];
                    if (!field) return prev;
                    return { ...prev, [field]: result };
                });
            };
            reader.readAsDataURL(file);
        });
        toast.success('Images added to the tour cover.');
    };

    const clearHeroImages = () => {
        setData((prev) => ({
            ...prev,
            heroMain: '',
            heroSub1: '',
            heroSub2: '',
        }));
        toast.success('Cover images cleared.');
    };

    /* Print in the current document so CSS modules, colors, and images match the preview */
    const handleDirectPrint = () => {
        const printRoot = document.getElementById('pdf-print-root');
        const pdfEl =
            printRoot?.querySelector('#pdf-document') || document.getElementById('pdf-document');
        if (!pdfEl) {
            toast.error('PDF content not ready. Try again in a moment.');
            return;
        }
        window.print();
    };

    const handleDirectDownload = async () => {
        if (!leadId) {
            toast.error('Cannot download: No lead ID found.');
            return;
        }

        const toastId = toast.loading('Generating PDF...');
        try {
            const fileNameBase = data.packageName?.trim() || `Tour-Quotation-${data.quoteNumber || leadId}`;
            const sanitizedFileName = fileNameBase.replace(/[/\\?%*:|"<>]/g, '-');

            const response = await api.post('/leads/convert-to-pdf', {
                leadId,
                data,
                fileName: sanitizedFileName
            }, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${sanitizedFileName}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('PDF Downloaded!', { id: toastId });
        } catch (error) {
            console.error('Download Error:', error);
            let msg = 'Failed to generate PDF. Please try again.';
            
            // If response is a blob (due to responseType: 'blob'), we need to parse it to get the JSON error
            const data = error.response?.data;
            if (data instanceof Blob && (data.type.includes('application/json') || data.type === '')) {
                try {
                    const text = await data.text();
                    const json = JSON.parse(text);
                    msg = json.message || msg;
                    if (json.details || json.error) {
                        console.error('PDF Backend Error:', json.error);
                        console.error('PDF Backend Details:', json.details);
                    }
                } catch (e) {
                    console.error('Failed to parse error blob:', e);
                }
            } else if (data && typeof data === 'object') {
                msg = data.message || msg;
            } else {
                msg = error.message || msg;
            }
            
            toast.error(msg, { id: toastId });
        }
    };

    const handleDownloadWord = async () => {
        if (!leadId) {
            toast.error('Cannot download: No lead ID found.');
            return;
        }

        console.log('Starting Word download for lead:', leadId);
        const toastId = toast.loading('Generating Word document...');
        try {
            const fileNameBase = data.packageName?.trim() || `Tour-Quotation-${data.quoteNumber || leadId}`;
            const sanitizedFileName = fileNameBase.replace(/[/\\?%*:|"<>]/g, '-');

            // Send the same data to docx converter
            const response = await api.post('/leads/convert-to-docx', {
                leadId,
                data,
                fileName: sanitizedFileName
            }, {
                responseType: 'blob'
            });

            console.log('Word document received from server');
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${sanitizedFileName}.docx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Word Doc Downloaded!', { id: toastId });
        } catch (error) {
            console.error('Word Download Error:', error);
            let errMsg = 'Failed to generate Word document.';
            if (error.response?.data?.error) {
                errMsg += ` Error: ${error.response.data.error}`;
            } else if (error.message) {
                errMsg += ` (${error.message})`;
            }
            toast.error(errMsg, { id: toastId });
        }
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-5 pb-8">
                {/* ── PAGE HEADER ── */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            Tour Details Generator
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {leadId
                                ? (loadingLeadData ? 'Loading selected lead into preview...' : 'Previewing the selected lead. You can download PDF, download Word, or print.')
                                : 'Fill in the tour details and download a professional tour details PDF.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setPreview(p => !p)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${preview
                                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            {preview ? <EyeOff size={15} /> : <Eye size={15} />}
                            {preview ? 'Hide Preview' : 'Show Preview'}
                        </button>
                        <button
                            onClick={handleDirectDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <Download size={15} />
                            Download PDF
                        </button>
                        <button
                            onClick={handleDownloadWord}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                            <FileText size={15} />
                            Download Word
                        </button>
                        <button
                            onClick={handleDirectPrint}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
                        >
                            <Printer size={15} />
                            Print
                        </button>
                    </div>
                </div>

                <div className={`grid gap-6 ${preview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="flex flex-col gap-4">

                        {/* Quote Meta */}
                        <SectionCard icon={Info} title="Quote Information" accent="blue">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Quote Number">
                                    <input className={inputCls} value={data.quoteNumber} onChange={e => set('quoteNumber', e.target.value)} placeholder="e.g. COT-2026-001" />
                                </Field>
                                <Field label="Quote Date">
                                    <input className={inputCls} value={data.quoteDate} onChange={e => set('quoteDate', e.target.value)} placeholder="25 Apr 2026" />
                                </Field>
                                <Field label="Package Name (PDF Title)" className="col-span-2">
                                    <input className={inputCls} value={data.packageName} onChange={e => set('packageName', e.target.value)} placeholder="e.g. Summer Special Himachal Tour" />
                                </Field>
                            </div>
                        </SectionCard>

                        {/* Images Upload */}
                        <SectionCard icon={FileText} title="Tour Images (Cover)" accent="purple">
                            <div className="flex flex-col gap-3">
                                <Field label="Upload up to 3 images">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleHeroImagesChange}
                                        className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                                    />
                                </Field>
                                {(data.heroMain || data.heroSub1 || data.heroSub2) && (
                                    <>
                                        <p className="text-xs text-gray-500">
                                            These images appear on the first page. Only uploaded images will be shown in the PDF.
                                        </p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {['heroMain', 'heroSub1', 'heroSub2'].map((key, idx) => (
                                                <div key={key} className="flex flex-col gap-1">
                                                    <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                                                        {idx === 0 ? 'Main Image' : `Sub Image ${idx}`}
                                                    </span>
                                                    <div className="aspect-video rounded-lg border border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                                                        {data[key] ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={data[key]} alt={key} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[11px] text-gray-400">No image added</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div>
                                            <button
                                                type="button"
                                                onClick={clearHeroImages}
                                                className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
                                            >
                                                <Trash2 size={12} /> Clear Images
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </SectionCard>

                        {/* Tour Summary */}
                        <SectionCard icon={FileText} title="Tour Summary" accent="blue">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Per Person Cost (Rs.)">
                                    <input className={inputCls} value={data.perPersonCost} onChange={e => set('perPersonCost', e.target.value)} placeholder="e.g. 15000" />
                                </Field>
                                <Field label="Total No. of Pax">
                                    <input className={inputCls} value={data.totalPax} onChange={e => set('totalPax', e.target.value)} placeholder="e.g. 06 Person" />
                                </Field>
                                <Field label="Vehicle Type">
                                    <input className={inputCls} value={data.vehicleType} onChange={e => set('vehicleType', e.target.value)} placeholder="e.g. Ertiga or Innova" />
                                </Field>
                                <Field label="Hotel Category">
                                    <input className={inputCls} value={data.hotelCategory} onChange={e => set('hotelCategory', e.target.value)} placeholder="e.g. 3-Star Category" />
                                </Field>
                                <Field label="Meal Plan">
                                    <input className={inputCls} value={data.mealPlan} onChange={e => set('mealPlan', e.target.value)} placeholder="e.g. Breakfast Only" />
                                </Field>
                                <Field label="Tour Duration">
                                    <input className={inputCls} value={data.tourDuration} onChange={e => set('tourDuration', e.target.value)} placeholder="e.g. 05 Nights 06 Days" />
                                </Field>
                                <Field label="Tour Date (From)">
                                    <input className={inputCls} value={data.tourDateFrom} onChange={e => set('tourDateFrom', e.target.value)} placeholder="e.g. 05/04/2026" />
                                </Field>
                                <Field label="Tour Date (To)">
                                    <input className={inputCls} value={data.tourDateTo} onChange={e => set('tourDateTo', e.target.value)} placeholder="e.g. 10/04/2026" />
                                </Field>
                                <Field label="Pick Up Point">
                                    <input className={inputCls} value={data.pickupPoint} onChange={e => set('pickupPoint', e.target.value)} placeholder="e.g. Jammu Bus Stand" />
                                </Field>
                                <Field label="Drop Point">
                                    <input className={inputCls} value={data.dropPoint} onChange={e => set('dropPoint', e.target.value)} placeholder="e.g. Amritsar Airport" />
                                </Field>
                                <Field label="Destinations" className="col-span-2">
                                    <input className={inputCls} value={data.destinations} onChange={e => set('destinations', e.target.value)} placeholder="e.g. Jammu, Katra, Shivkhori, Amritsar" />
                                </Field>
                            </div>
                        </SectionCard>

                        {/* Hotels */}
                        <SectionCard icon={Hotel} title="Accommodation" accent="green">
                            <div className="flex flex-col gap-3">
                                {data.hotels.map((h, i) => (
                                    <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200 relative">
                                        <button
                                            type="button"
                                            onClick={() => removeHotel(i)}
                                            className="absolute top-2 right-2 text-red-400 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <p className="text-xs font-bold text-gray-500 mb-2">Hotel {i + 1}</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Field label="Hotel Name">
                                                <input className={inputCls} value={h.name} onChange={e => updateHotel(i, 'name', e.target.value)} placeholder="Hotel name" />
                                            </Field>
                                            <Field label="Destination">
                                                <input className={inputCls} value={h.destination} onChange={e => updateHotel(i, 'destination', e.target.value)} placeholder="e.g. Katra" />
                                            </Field>
                                            <Field label="No. of Nights">
                                                <input className={inputCls} value={h.nights} onChange={e => updateHotel(i, 'nights', e.target.value)} placeholder="e.g. 02 Nights" />
                                            </Field>
                                            <Field label="Room Category">
                                                <input className={inputCls} value={h.roomCategory} onChange={e => updateHotel(i, 'roomCategory', e.target.value)} placeholder="e.g. Standard Double" />
                                            </Field>
                                            <Field label="Room Sharing" className="col-span-2">
                                                <input className={inputCls} value={h.roomSharing} onChange={e => updateHotel(i, 'roomSharing', e.target.value)} placeholder="e.g. Double" />
                                            </Field>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addHotel}
                                    className="flex items-center gap-1.5 text-sm text-emerald-700 font-medium hover:text-emerald-900 transition-colors"
                                >
                                    <Plus size={14} /> Add Hotel
                                </button>
                                <Field label="Accommodation Note">
                                    <textarea
                                        className={textareaCls}
                                        rows={2}
                                        value={data.accommodationNote}
                                        onChange={e => set('accommodationNote', e.target.value)}
                                        placeholder="e.g. Early check-in subject to availability..."
                                    />
                                </Field>
                            </div>
                        </SectionCard>

                        {/* Flights */}
                        <SectionCard icon={Plane} title="Flight Details" accent="purple">
                            <div className="flex flex-col gap-3">
                                {data.flights.map((f, i) => (
                                    <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200 relative">
                                        <button
                                            type="button"
                                            onClick={() => removeFlight(i)}
                                            className="absolute top-2 right-2 text-red-400 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <p className="text-xs font-bold text-gray-500 mb-2">Flight {i + 1}</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <Field label="From (City)">
                                                <input className={inputCls} value={f.from} onChange={e => updateFlight(i, 'from', e.target.value)} placeholder="e.g. Pune" />
                                            </Field>
                                            <Field label="Dep. Date">
                                                <input className={inputCls} value={f.depDate} onChange={e => updateFlight(i, 'depDate', e.target.value)} placeholder="05/04/2026" />
                                            </Field>
                                            <Field label="Dep. Time">
                                                <input className={inputCls} value={f.depTime} onChange={e => updateFlight(i, 'depTime', e.target.value)} placeholder="02:05 PM" />
                                            </Field>
                                            <Field label="To (City)">
                                                <input className={inputCls} value={f.to} onChange={e => updateFlight(i, 'to', e.target.value)} placeholder="e.g. Delhi" />
                                            </Field>
                                            <Field label="Arr. Date">
                                                <input className={inputCls} value={f.arrDate} onChange={e => updateFlight(i, 'arrDate', e.target.value)} placeholder="05/04/2026" />
                                            </Field>
                                            <Field label="Arr. Time">
                                                <input className={inputCls} value={f.arrTime} onChange={e => updateFlight(i, 'arrTime', e.target.value)} placeholder="04:15 PM" />
                                            </Field>
                                            <Field label="Airline">
                                                <input className={inputCls} value={f.airline} onChange={e => updateFlight(i, 'airline', e.target.value)} placeholder="e.g. IndiGo" />
                                            </Field>
                                            <Field label="Flight No.">
                                                <input className={inputCls} value={f.flightNo} onChange={e => updateFlight(i, 'flightNo', e.target.value)} placeholder="e.g. 6E-2285" />
                                            </Field>
                                            <Field label="PNR">
                                                <input className={inputCls} value={f.pnr} onChange={e => updateFlight(i, 'pnr', e.target.value)} placeholder="e.g. M1JMVB" />
                                            </Field>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addFlight}
                                    className="flex items-center gap-1.5 text-sm text-purple-700 font-medium hover:text-purple-900 transition-colors"
                                >
                                    <Plus size={14} /> Add Flight
                                </button>
                                <Field label="Flight Note">
                                    <textarea
                                        className={textareaCls}
                                        rows={2}
                                        value={data.flightNote}
                                        onChange={e => set('flightNote', e.target.value)}
                                        placeholder="e.g. Flight rates and seats may change..."
                                    />
                                </Field>
                            </div>
                        </SectionCard>

                        {/* Itinerary */}
                        <SectionCard icon={MapPin} title="Tour Itinerary" accent="orange">
                            <div className="flex flex-col gap-4">
                                {data.itinerary.map((day, di) => (
                                    <div key={di} className="bg-gray-50 rounded-lg p-3 border border-gray-200 relative">
                                        <button
                                            type="button"
                                            onClick={() => removeDay(di)}
                                            className="absolute top-2 right-2 text-red-400 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <p className="text-xs font-bold text-orange-600 mb-2">Day {di + 1}</p>
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <Field label="Day Label">
                                                <input className={inputCls} value={day.dayLabel} onChange={e => updateDay(di, 'dayLabel', e.target.value)} placeholder="e.g. Day 1" />
                                            </Field>
                                            <Field label="Date">
                                                <input className={inputCls} value={day.date} onChange={e => updateDay(di, 'date', e.target.value)} placeholder="e.g. 05 April 2026" />
                                            </Field>
                                            <Field label="Title">
                                                <input className={inputCls} value={day.title} onChange={e => updateDay(di, 'title', e.target.value)} placeholder="e.g. Arrive Delhi" />
                                            </Field>
                                        </div>
                                        <Field label="Description" className="mb-2">
                                            <textarea
                                                className={textareaCls}
                                                rows={3}
                                                value={day.description}
                                                onChange={e => updateDay(di, 'description', e.target.value)}
                                                placeholder="Describe the day's activities..."
                                            />
                                        </Field>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Places to Visit</label>
                                            <div className="flex flex-col gap-1.5">
                                                {day.places.map((p, pi) => (
                                                    <div key={pi} className="flex gap-2">
                                                        <input
                                                            className={inputCls}
                                                            value={p}
                                                            onChange={e => updatePlace(di, pi, e.target.value)}
                                                            placeholder={`Place ${pi + 1}`}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removePlace(di, pi)}
                                                            className="text-red-400 hover:text-red-600 flex-shrink-0"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => addPlace(di)}
                                                    className="flex items-center gap-1.5 text-xs text-orange-700 font-medium hover:text-orange-900 transition-colors mt-0.5"
                                                >
                                                    <Plus size={12} /> Add Place
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addDay}
                                    className="flex items-center gap-1.5 text-sm text-orange-700 font-medium hover:text-orange-900 transition-colors"
                                >
                                    <Plus size={14} /> Add Day
                                </button>
                            </div>
                        </SectionCard>

                        <SectionCard icon={FileText} title="Package Inclusions / Exclusions" accent="green">
                            <div className="grid grid-cols-1 gap-3">
                                <Field label="Package Inclusions">
                                    <textarea
                                        className={textareaCls}
                                        rows={4}
                                        value={data.inclusions}
                                        onChange={e => set('inclusions', e.target.value)}
                                        placeholder="One inclusion per line"
                                    />
                                </Field>
                                <Field label="Package Exclusions">
                                    <textarea
                                        className={textareaCls}
                                        rows={4}
                                        value={data.exclusions}
                                        onChange={e => set('exclusions', e.target.value)}
                                        placeholder="One exclusion per line"
                                    />
                                </Field>
                                <Field label="Payment Policy">
                                    <textarea
                                        className={textareaCls}
                                        rows={4}
                                        value={data.paymentPolicy}
                                        onChange={e => set('paymentPolicy', e.target.value)}
                                        placeholder="One payment policy point per line"
                                    />
                                </Field>
                                <Field label="Cancellation Policy">
                                    <textarea
                                        className={textareaCls}
                                        rows={4}
                                        value={data.cancellationPolicy}
                                        onChange={e => set('cancellationPolicy', e.target.value)}
                                        placeholder="One cancellation policy point per line"
                                    />
                                </Field>
                                <Field label="Terms And Conditions">
                                    <textarea
                                        className={textareaCls}
                                        rows={4}
                                        value={data.termsAndConditions}
                                        onChange={e => set('termsAndConditions', e.target.value)}
                                        placeholder="One term or condition per line"
                                    />
                                </Field>
                                <Field label="Tip For Memorable Trip">
                                    <textarea
                                        className={textareaCls}
                                        rows={4}
                                        value={data.memorableTrip}
                                        onChange={e => set('memorableTrip', e.target.value)}
                                        placeholder="Add a memorable closing message or helpful trip tips"
                                    />
                                </Field>
                            </div>
                        </SectionCard>

                        {/* Contact */}
                        <SectionCard icon={Info} title="Company Contact Details" accent="blue">
                            <div className="grid grid-cols-3 gap-3">
                                <Field label="CEO / Rep Name" className="col-span-3">
                                    <input className={inputCls} value={data.ceoName} onChange={e => set('ceoName', e.target.value)} placeholder="e.g. Mr. Utkarsh Kale (C.E.O.)" />
                                </Field>
                                <Field label="Cell 1">
                                    <input className={inputCls} value={data.cell1} onChange={e => set('cell1', e.target.value)} placeholder="9960625167" />
                                </Field>
                                <Field label="Cell 2">
                                    <input className={inputCls} value={data.cell2} onChange={e => set('cell2', e.target.value)} placeholder="9136549898" />
                                </Field>
                                <Field label="Mail ID" className="col-span-3">
                                    <input className={inputCls} value={data.companyEmail} onChange={e => set('companyEmail', e.target.value)} placeholder="bookings@chaloontour.com" />
                                </Field>
                                <Field label="Website" className="col-span-3">
                                    <input className={inputCls} value={data.companyWebsite} onChange={e => set('companyWebsite', e.target.value)} placeholder="www.chaloontour.com" />
                                </Field>
                            </div>
                        </SectionCard>
                    </div>

                    {/* ── PREVIEW COLUMN ── */}
                    {preview && (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm font-semibold text-gray-700">PDF Preview</p>
                            <div
                                className="overflow-auto rounded-xl border border-gray-200 shadow-inner bg-gray-100 p-3"
                                style={{ maxHeight: '90vh' }}
                            >
                                <div style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.33%' }}>
                                    <TourPDFDocument data={data} ref={pdfRef} compactPreview />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden printable element always in DOM — pdfMode assigns id="pdf-document" for print/export */}
            <div id="pdf-print-root" style={{ display: 'none' }}>
                <TourPDFDocument data={data} pdfMode />
            </div>
        </DashboardLayout>
    );
}

export default function TourPDFPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
            </div>
        }>
            <TourPDFPageContent />
        </Suspense>
    );
}
