'use client';

import Image from 'next/image';
import { Merriweather } from 'next/font/google';
import { forwardRef } from 'react';
import styles from './TourPDF.module.css';

/** Embedded serif for preview + Puppeteer PDF (headless Linux often lacks Georgia). */
const tripTitleFont = Merriweather({
    weight: '700',
    style: 'italic',
    subsets: ['latin'],
    display: 'block',
});

const BulletIcon = () => (
    <svg viewBox="0 0 24 24" className={styles.bulletIcon} width="16" height="16">
        <path d="M4 12h12.17l-3.28-3.29c-.39-.39-.39-1.02 0-1.41a.9959.9959 0 0 1 1.41 0l5 5c.39.39.39 1.02 0 1.41l-5 5a.9959.9959 0 0 1-1.41 0c-.39-.39-.39-1.02 0-1.41L16.17 13H4c-.55 0-1-.45-1-1s.45-1 1-1z" fill="#c62828" />
    </svg>
);

const getListItems = (value) =>
    String(value || '')
        .split(/\r?\n/)
        .map((item) => item.replace(/^[\s•\-*➳]+/, '').trim())
        .filter(Boolean);

/** Plain red trip title — no glow or outline (preview + PDF). */
const tripTitleSurfaceStyle = {
    fontSize: '22pt',
    fontWeight: 700,
    fontStyle: 'italic',
    color: '#c62828',
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: '0.02em',
    textShadow: 'none',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
};

const TourPDFDocument = forwardRef(function TourPDFDocument({ data, compactPreview = false, pdfMode = false }, ref) {
    const {
        packageName,
        perPersonCost,
        totalPax,
        vehicleType,
        hotelCategory,
        mealPlan,
        tourDuration,
        tourDateFrom,
        tourDateTo,
        pickupPoint,
        dropPoint,
        destinations,
        heroMain,
        heroSub1,
        heroSub2,
        hotels,
        flights,
        itinerary,
        accommodationNote,
        flightNote,
        inclusions,
        exclusions,
        paymentPolicy,
        cancellationPolicy,
        termsAndConditions,
        memorableTrip,
        ceoName,
        cell1,
        cell2,
        companyEmail,
        companyWebsite,
    } = data;

    const inclusionItems = getListItems(inclusions);
    const exclusionItems = getListItems(exclusions);
    const paymentPolicyItems = getListItems(paymentPolicy);
    const cancellationPolicyItems = getListItems(cancellationPolicy);
    const termsItems = getListItems(termsAndConditions);
    const allItinerary = Array.isArray(itinerary) ? itinerary : [];
    
    const tripTitleLabel = packageName?.trim() || destinations?.trim() || "Your Trip";
    const tripTitle = `Let's Explore ${tripTitleLabel}`;

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
        } catch (e) {
            return dateStr;
        }
    };

    const tourDateRange = tourDateFrom && tourDateTo 
        ? `${formatDate(tourDateFrom)} to ${formatDate(tourDateTo)}`
        : tourDateFrom ? formatDate(tourDateFrom) : '--';

    return (
        <div 
          className={`${styles.pdfRoot} ${pdfMode ? styles.pdfMode : ''} pdf-root-print`} 
          ref={ref} 
          id={pdfMode ? "pdf-document" : undefined}
        >
            <style dangerouslySetInnerHTML={{ __html: `
                .pdf-root-print table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .pdf-root-print th, .pdf-root-print td { border: 1px solid #000; padding: 10px 12px; }
                .pdf-root-print { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                .tour-pdf-trip-title {
                    font-size: 22pt;
                    font-weight: 700;
                    font-style: italic;
                    color: #c62828;
                    text-align: center;
                    line-height: 1.2;
                    letter-spacing: 0.02em;
                    text-shadow: none;
                    -webkit-text-stroke: 0 transparent;
                    print-color-adjust: exact;
                    -webkit-print-color-adjust: exact;
                }
                @media print {
                    .pdf-root-print { width: 210mm !important; }
                    .tour-pdf-trip-title {
                        font-size: 22pt !important;
                        font-weight: 700 !important;
                        font-style: italic !important;
                        color: #c62828 !important;
                        text-shadow: none !important;
                        -webkit-text-stroke: 0 transparent !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                }
            `}} />

            <div className={styles.watermark}>
                <img src="/Chalo-on-tour.jpg.jpeg" alt="" style={{ width: '400px' }} />
            </div>

            {/* Header */}
            <div className={styles.header}>
                <div className={styles.logoBox}>
                    <img src="/Chalo-on-tour.jpg.jpeg" alt="Chalo On Tour" className={styles.logoImg} />
                </div>
                <h1
                    className={`${styles.mainTitle} tour-pdf-trip-title ${tripTitleFont.className}`}
                    style={tripTitleSurfaceStyle}
                >
                    {tripTitle}
                </h1>
            </div>

            {/* Images Section */}
            <div className={styles.imageSection}>
                <div className={styles.mainImageWrap}>
                    <img src={heroMain || "/Chalo-on-tour.jpg.jpeg"} className={styles.fullImg} alt="Main" />
                </div>
                <div className={styles.subImagesGrid}>
                    <div className={styles.subImageWrap}>
                        <img src={heroSub1 || "/Chalo-on-tour.jpg.jpeg"} className={styles.fullImg} alt="Sub 1" />
                    </div>
                    <div className={styles.subImageWrap}>
                        <img src={heroSub2 || "/Chalo-on-tour.jpg.jpeg"} className={styles.fullImg} alt="Sub 2" />
                    </div>
                </div>
            </div>

            {/* TOUR SUMMARY */}
            <div className={styles.sectionBlock}>
                <table className={styles.tableHeader}>
                    <tbody>
                        <tr>
                            <td style={{ background: '#1565c0' }}>
                                <span className={styles.tableHeaderText}>TOUR SUMMARY: -</span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table className={`${styles.table} ${styles.summaryTable}`}>
                    <tbody>
                        <tr>
                            <td>01.</td>
                            <td>Per Person Cost</td>
                            <td>{perPersonCost ? `Rs. ${Number(perPersonCost).toLocaleString('en-IN')} /- Per Person` : '--'}</td>
                        </tr>
                        <tr>
                            <td>02.</td>
                            <td>Total No. of Pax</td>
                            <td>{totalPax || '--'}</td>
                        </tr>
                        <tr>
                            <td>03.</td>
                            <td>Vehicle Type</td>
                            <td>{vehicleType || '--'}</td>
                        </tr>
                        <tr>
                            <td>04.</td>
                            <td>Hotel Category</td>
                            <td>{hotelCategory || '--'}</td>
                        </tr>
                        <tr>
                            <td>05.</td>
                            <td>Meal Plan</td>
                            <td>{mealPlan || '--'}</td>
                        </tr>
                        <tr>
                            <td>06.</td>
                            <td>Tour Duration</td>
                            <td>{tourDuration || '--'}</td>
                        </tr>
                        <tr>
                            <td>07.</td>
                            <td>Tour Date</td>
                            <td>{tourDateRange}</td>
                        </tr>
                        <tr>
                            <td>08.</td>
                            <td>Pick up</td>
                            <td>{pickupPoint || '--'}</td>
                        </tr>
                        <tr>
                            <td>09.</td>
                            <td>Drop</td>
                            <td>{dropPoint || '--'}</td>
                        </tr>
                        <tr>
                            <td>10.</td>
                            <td>Destinations</td>
                            <td>{destinations || '--'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ACCOMMODATION */}
            <div className={styles.sectionBlock}>
                <table className={styles.tableHeader}>
                    <tbody>
                        <tr>
                            <td style={{ background: '#1565c0' }}>
                                <span className={styles.tableHeaderText}>ACCOMMODATION: -</span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table className={`${styles.table} ${styles.accommodationTable}`}>
                    <thead>
                        <tr>
                            <th>Sr.No</th>
                            <th>Hotel Name</th>
                            <th>No. of Nights</th>
                            <th>Room Category</th>
                            <th>Room Sharing</th>
                            <th>Destination</th>
                        </tr>
                    </thead>
                    <tbody>
                        {hotels?.length > 0 ? hotels.map((h, i) => (
                            <tr key={i}>
                                <td style={{ textAlign: 'center' }}>{String(i + 1).padStart(2, '0')}.</td>
                                <td>{h.name}</td>
                                <td style={{ textAlign: 'center' }}>{h.nights} Nights</td>
                                <td>{h.roomCategory}</td>
                                <td>{h.roomSharing}</td>
                                <td>{h.destination}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan="6" style={{ textAlign: 'center' }}>No accommodation listed</td></tr>
                        )}
                    </tbody>
                </table>
                {accommodationNote && <p style={{ fontSize: '9pt', fontStyle: 'italic', marginTop: '-15px', marginBottom: '15px' }}>* {accommodationNote}</p>}
            </div>

            {/* FLIGHT DETAILS */}
            {flights?.length > 0 && (
                <div className={styles.sectionBlock}>
                    <table className={styles.tableHeader}>
                        <tbody>
                            <tr>
                                <td style={{ background: '#1565c0' }}>
                                    <span className={styles.tableHeaderText}>FLIGHT DETAILS: -</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table className={`${styles.table} ${styles.flightTable}`}>
                        <thead>
                            <tr>
                                <th>Sr.No</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Airline</th>
                                <th>PNR Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flights.map((f, i) => (
                                <tr key={i}>
                                    <td style={{ textAlign: 'center' }}>{String(i + 1).padStart(2, '0')}.</td>
                                    <td>{f.from}</td>
                                    <td>{f.to}</td>
                                    <td>{f.airline}</td>
                                    <td>{f.pnr}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {flightNote && <p style={{ fontSize: '9pt', fontStyle: 'italic', marginTop: '-15px', marginBottom: '15px' }}>* {flightNote}</p>}
                </div>
            )}

            {/* TOUR ITINERARY */}
            <div className={styles.sectionBlock}>
                <table className={styles.tableHeader}>
                    <tbody>
                        <tr>
                            <td style={{ background: '#c62828' }}>
                                <span className={styles.tableHeaderText}>TOUR ITINERARY: -</span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {allItinerary.map((day, di) => (
                    <div key={di} className="itinerary-day" style={{ marginBottom: '15px' }}>
                        <table className={styles.dayTable}>
                            <tbody>
                                <tr>
                                    <td>
                                        <span className={styles.dayTableText}>
                                            {day.dayLabel || `Day ${di + 1}`} :- {day.title} ({day.date || ''})
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div className={styles.itineraryContent}>
                            <p style={{ marginTop: '10px' }}>{day.description}</p>
                            {day.places?.length > 0 && (
                                <>
                                    <div className={styles.placesTitle}>Places to Visit: -</div>
                                    <ul className={styles.placesList}>
                                        {day.places.filter(Boolean).map((place, pi) => (
                                            <li key={pi} className={styles.placeItem}>
                                                <BulletIcon />
                                                <span className={styles.placeText}>{place}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* POLICIES & SECTIONS */}
            <div className={styles.optionalSection}>
                {inclusionItems.length > 0 && (
                    <div>
                        <div className={styles.optionalHeading}>Package Inclusions</div>
                        <ul className={styles.optionalList}>
                            {inclusionItems.map((item, i) => (
                                <li key={i} className={styles.optionalListItem}>
                                    <BulletIcon />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {exclusionItems.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                        <div className={styles.optionalHeading}>Package Exclusions</div>
                        <ul className={styles.optionalList}>
                            {exclusionItems.map((item, i) => (
                                <li key={i} className={styles.optionalListItem}>
                                    <BulletIcon />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {paymentPolicyItems.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                        <div className={styles.optionalHeading}>Payment Policy</div>
                        <ul className={styles.optionalList}>
                            {paymentPolicyItems.map((item, i) => (
                                <li key={i} className={styles.optionalListItem}>
                                    <BulletIcon />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {cancellationPolicyItems.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                        <div className={styles.optionalHeading}>Cancellation Policy</div>
                        <ul className={styles.optionalList}>
                            {cancellationPolicyItems.map((item, i) => (
                                <li key={i} className={styles.optionalListItem}>
                                    <BulletIcon />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {termsItems.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                        <div className={styles.optionalHeading}>Terms And Conditions</div>
                        <ul className={styles.optionalList}>
                            {termsItems.map((item, i) => (
                                <li key={i} className={styles.optionalListItem}>
                                    <BulletIcon />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {memorableTrip && (
                <div className={styles.memorableTripBox}>
                    <div className={styles.memorableTripHeading}>Tip For Memorable Trip</div>
                    <p className={styles.memorableTripText}>{memorableTrip}</p>
                </div>
            )}

            {/* Footer */}
            <div className={styles.footer}>
                <div className={styles.textBlue} style={{ fontSize: '13pt', marginBottom: '5px', fontWeight: 'bold' }}>Thank You</div>
                <p className={styles.footerNote} style={{ fontSize: '10pt', color: '#444' }}>
                    Let's stay connected via email, phone, WhatsApp, Facebook, Instagram, and more. We look forward to seeing you again on another memorable Chalo On Tour Trip.
                </p>

                <div className={styles.companyInfoFooter}>
                    <div style={{ marginTop: '15px' }}>
                        <div style={{ fontWeight: 'bold' }}>Thanks & Regards</div>
                        <div className={styles.companyLink}>CHALO ON TOUR</div>
                        <div className={styles.ceoName}>{ceoName || 'Mr. Utkarsh Kale (C.E.O.)'}</div>
                        <div className={styles.contactLine}>Cell: - {cell1} {cell2 ? `/ ${cell2}` : ''}</div>
                        <div className={styles.contactLine}>Mail ID: - <span style={{ color: '#c62828' }}>{companyEmail}</span></div>
                        <div className={styles.contactLine}>Website: - <a href={`https://${companyWebsite}`} className={styles.companyLinkInline}>{companyWebsite}</a></div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default TourPDFDocument;
