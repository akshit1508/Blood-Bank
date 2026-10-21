'use client';

import React, { Suspense, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import PublicLayout from '@/components/public/PublicLayout';

function CertificateContent() {
  const searchParams = useSearchParams();

  const certNum = searchParams.get('certNum') || 'CERT-DONATION-2026';
  const donorName = searchParams.get('name') || 'Honorable Life Saver';
  const bloodGroup = searchParams.get('group') || 'O+';
  const donationDate = searchParams.get('date') || 'Today';
  const venue = searchParams.get('venue') || 'Central Blood Transfusion & Healthcare Center';
  const code = searchParams.get('code') || '';
  const volume = searchParams.get('volume') || '450';

  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  const cleanBloodGroup = bloodGroup.replace('_', ' ').replace('POSITIVE', '+').replace('NEGATIVE', '-');

  const handlePrint = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const certElement = certRef.current || document.getElementById('blood-donation-certificate-print');
      if (!certElement) {
        window.print();
        return;
      }

      const canvas = await html2canvas(certElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fffdfa',
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');

      const oldFrame = document.getElementById('certificate-print-frame');
      if (oldFrame) {
        oldFrame.remove();
      }
      const printFrame = document.createElement('iframe');
      printFrame.id = 'certificate-print-frame';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      printFrame.style.visibility = 'hidden';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (frameDoc && printFrame.contentWindow) {
        frameDoc.open();
        frameDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Blood Donation Certificate - ${donorName}</title>
              <style>
                @page {
                  size: landscape;
                  margin: 0;
                }
                html, body {
                  margin: 0;
                  padding: 0;
                  width: 100%;
                  height: 100%;
                  background: #ffffff;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .cert-img-wrapper {
                  width: 100%;
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 8mm;
                  box-sizing: border-box;
                }
                img {
                  max-width: 100%;
                  max-height: 100%;
                  width: auto;
                  height: auto;
                  object-fit: contain;
                  display: block;
                  margin: auto;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              </style>
            </head>
            <body>
              <div class="cert-img-wrapper">
                <img id="print-cert-img" src="${dataUrl}" />
              </div>
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.focus();
                    window.print();
                  }, 300);
                };
              </script>
            </body>
          </html>
        `);
        frameDoc.close();
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Print generation failed:', err);
      window.print();
    }
  };

  const handleDownloadImage = async () => {
    if (!certRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fffdfa',
        logging: false,
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const safeName = donorName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Blood_Donation_Certificate_${safeName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to download image:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareText = `🩸 I am proud to share that I donated blood at ${venue}! My certificate: ${certNum}. One blood donation can save up to 3 lives. Be a donor today!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Blood Donation Certificate - ${donorName}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback
      }
    }

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Top Banner with Action Buttons */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#ffffff',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
            }}
          >
            🎖️
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              Verified Blood Donation Certificate
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>
              ✓ Authenticated Record • {certNum}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={downloading}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.55rem 1rem',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: downloading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
            }}
          >
            <span>🖼️</span> {downloading ? 'Generating...' : downloadSuccess ? '✓ Saved!' : 'Download Image (PNG)'}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.55rem 1rem',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
            }}
          >
            <span>🖨️</span> Print / Save PDF
          </button>

          <button
            type="button"
            onClick={handleShare}
            style={{
              backgroundColor: '#25d366',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.55rem 1rem',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)',
            }}
          >
            <span>📲</span> Share Certificate
          </button>
        </div>
      </div>

      {/* Official Certificate Canvas */}
      <div
        id="blood-donation-certificate-print"
        ref={certRef}
        style={{
          backgroundColor: '#fffdfa',
          border: '8px double #d97706',
          borderRadius: '14px',
          padding: '3rem 2.25rem',
          position: 'relative',
          boxShadow: '0 15px 35px -5px rgba(217, 119, 6, 0.2), 0 0 0 1px #fde68a inset',
          textAlign: 'center',
          fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          color: '#0f172a',
          overflow: 'hidden',
          marginBottom: '2rem',
        }}
      >
        {/* Corner Ornaments */}
        <div style={{ position: 'absolute', top: '12px', left: '12px', width: '32px', height: '32px', borderTop: '3px solid #b45309', borderLeft: '3px solid #b45309' }} />
        <div style={{ position: 'absolute', top: '12px', right: '12px', width: '32px', height: '32px', borderTop: '3px solid #b45309', borderRight: '3px solid #b45309' }} />
        <div style={{ position: 'absolute', bottom: '12px', left: '12px', width: '32px', height: '32px', borderBottom: '3px solid #b45309', borderLeft: '3px solid #b45309' }} />
        <div style={{ position: 'absolute', bottom: '12px', right: '12px', width: '32px', height: '32px', borderBottom: '3px solid #b45309', borderRight: '3px solid #b45309' }} />

        {/* Watermark Logo */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.04,
            fontSize: '22rem',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          🩸
        </div>

        {/* Top Organization Emblem */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              border: '2px solid #ef4444',
              marginBottom: '0.5rem',
              color: '#dc2626',
              fontSize: '2rem',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)',
            }}
          >
            🩸
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.18em', color: '#991b1b', textTransform: 'uppercase' }}>
            CENTRAL BLOOD TRANSFUSION & HEALTHCARE SERVICE
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.2rem' }}>
            National Voluntary Blood Donation Mission • Life Saving Initiative
          </div>
        </div>

        {/* Certificate Title */}
        <div style={{ margin: '1rem 0 1.25rem 0' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '0.35rem 1.75rem',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#92400e',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: '0.75rem',
            }}
          >
            ⭐ Official Certificate of Appreciation ⭐
          </div>
          <h1
            style={{
              fontSize: '2.4rem',
              fontWeight: 900,
              margin: 0,
              color: '#881337',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            HONORING A HERO
          </h1>
          <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.9rem', color: '#475569', fontStyle: 'italic' }}>
            This certificate of life-saving honor is proudly and gratefully conferred upon
          </p>
        </div>

        {/* Recipient Donor Name */}
        <div style={{ margin: '1.25rem 0 1.5rem 0' }}>
          <div
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: '#0f172a',
              fontFamily: "Georgia, 'Times New Roman', serif",
              letterSpacing: '0.02em',
              borderBottom: '2px dashed #d97706',
              display: 'inline-block',
              paddingBottom: '0.4rem',
              paddingLeft: '2rem',
              paddingRight: '2rem',
            }}
          >
            {donorName}
          </div>
          {code && (
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.4rem', fontFamily: 'monospace' }}>
              Registration ID: {code}
            </div>
          )}
        </div>

        {/* Commendation Citation Text */}
        <p
          style={{
            maxWidth: '700px',
            margin: '0 auto 1.75rem auto',
            fontSize: '0.95rem',
            lineHeight: 1.7,
            color: '#334155',
          }}
        >
          In heartfelt recognition of your invaluable, selfless, and humanitarian contribution in donating blood.
          Your voluntary act has brought hope, healing, and life to patients in urgent medical need.
          <strong> A single blood donation has the power to save up to three lives.</strong>
        </p>

        {/* Key Verification Data Pillows */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
            maxWidth: '740px',
            margin: '0 auto 2rem auto',
          }}
        >
          {/* Blood Group */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
              Blood Group
            </span>
            <strong style={{ fontSize: '1.2rem', color: '#dc2626' }}>
              🩸 {cleanBloodGroup}
            </strong>
          </div>

          {/* Donation Date */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
              Date of Donation
            </span>
            <strong style={{ fontSize: '0.925rem', color: '#0f172a' }}>
              {donationDate}
            </strong>
          </div>

          {/* Certificate Number */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
              Certificate ID
            </span>
            <strong style={{ fontSize: '0.8rem', color: '#92400e', fontFamily: 'monospace' }}>
              {certNum}
            </strong>
          </div>

          {/* Units & Volume */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
              Contribution Volume
            </span>
            <strong style={{ fontSize: '0.925rem', color: '#059669' }}>
              {volume} ml Whole Blood
            </strong>
          </div>
        </div>

        {/* Location Info */}
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '2rem' }}>
          📍 Event / Center: <strong>{venue}</strong>
        </div>

        {/* Signatures & Official Gold Seal */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: '1px solid #fde68a',
            paddingTop: '1.75rem',
            maxWidth: '740px',
            margin: '0 auto',
            flexWrap: 'wrap',
            gap: '1.25rem',
          }}
        >
          {/* Signature 1 */}
          <div style={{ textAlign: 'center', minWidth: '150px' }}>
            <div
              style={{
                fontFamily: "'Brush Script MT', 'Dancing Script', cursive, serif",
                fontSize: '1.5rem',
                color: '#0369a1',
                height: '34px',
              }}
            >
              Dr. S. K. Gupta
            </div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '0.25rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
              Medical Officer / Director
            </div>
            <div style={{ fontSize: '0.675rem', color: '#64748b' }}>
              Blood Transfusion Services
            </div>
          </div>

          {/* Golden Official Stamp */}
          <div
            style={{
              width: '95px',
              height: '95px',
              borderRadius: '50%',
              border: '3px double #d97706',
              backgroundColor: '#fffdf5',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(217, 119, 6, 0.25)',
              padding: '0.2rem',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '1.15rem' }}>🎖️</span>
            <span style={{ fontSize: '0.58rem', fontWeight: 900, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              VERIFIED DONATION
            </span>
            <span style={{ fontSize: '0.52rem', color: '#b45309' }}>
              ★ SAVE LIVES ★
            </span>
          </div>

          {/* Signature 2 */}
          <div style={{ textAlign: 'center', minWidth: '150px' }}>
            <div
              style={{
                fontFamily: "'Brush Script MT', 'Dancing Script', cursive, serif",
                fontSize: '1.5rem',
                color: '#92400e',
                height: '34px',
              }}
            >
              Authorized Officer
            </div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '0.25rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
              Camp Coordinator
            </div>
            <div style={{ fontSize: '0.675rem', color: '#64748b' }}>
              Campaign Drive Operations
            </div>
          </div>
        </div>
      </div>

      {/* Global Print Style */}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
          #blood-donation-certificate-print {
            visibility: visible !important;
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function PublicCertificatePage() {
  return (
    <PublicLayout>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading verified certificate...</div>}>
        <CertificateContent />
      </Suspense>
    </PublicLayout>
  );
}
