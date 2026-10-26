'use client';

import React, { useState, useRef } from 'react';

export interface BloodDonationCertificateData {
  certificateNumber: string;
  donorName: string;
  donorCode?: string;
  donorPhone?: string;
  bloodGroup: string;
  donationDate: string;
  campaignName?: string;
  venue?: string;
  unitCode?: string;
  volume?: number;
  componentType?: string;
  issuedBy?: string;
}

interface BloodDonationCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: BloodDonationCertificateData | null;
  onWhatsAppSent?: (code: string) => void;
  onOpenBagLabel?: () => void;
}

export function formatPhoneForWhatsApp(phone?: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '91' + digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = '91' + digits.substring(1);
  }
  return digits;
}

export default function BloodDonationCertificateModal({
  isOpen,
  onClose,
  data,
  onWhatsAppSent,
  onOpenBagLabel,
}: BloodDonationCertificateModalProps) {
  const [customPhone, setCustomPhone] = useState<string>('');
  const [phoneInitialized, setPhoneInitialized] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);

  const certCardRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  // Initialize phone when data loads
  const donorPhone = data.donorPhone || '';
  const currentPhone = phoneInitialized ? customPhone : donorPhone;

  const formattedDate = (() => {
    try {
      const d = new Date(data.donationDate);
      if (isNaN(d.getTime())) return data.donationDate;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return data.donationDate;
    }
  })();

  const cleanBloodGroup = data.bloodGroup
    ? data.bloodGroup.replace('_', ' ').replace('POSITIVE', '+').replace('NEGATIVE', '-')
    : 'Unknown';

  const campaignOrLocation = data.campaignName
    ? `${data.campaignName}${data.venue ? ` • ${data.venue}` : ''}`
    : data.venue || 'Regional Blood Transfusion Center';

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const certVerificationUrl = `${origin}/certificate?certNum=${encodeURIComponent(
    data.certificateNumber
  )}&name=${encodeURIComponent(data.donorName)}&group=${encodeURIComponent(
    cleanBloodGroup
  )}&date=${encodeURIComponent(formattedDate)}&venue=${encodeURIComponent(
    campaignOrLocation
  )}&code=${encodeURIComponent(data.unitCode || data.donorCode || '')}&volume=${
    data.volume || 450
  }`;

  const whatsappMessage = `🩸 *CERTIFICATE OF BLOOD DONATION APPRECIATION* 🩸

Dear *${data.donorName}*,

Thank you for your noble and selfless blood donation! Your generosity gives someone another chance at life.

📜 *Certificate No:* ${data.certificateNumber}
🩸 *Blood Group:* ${cleanBloodGroup}
🗓️ *Date of Donation:* ${formattedDate}
📍 *Location / Event:* ${campaignOrLocation}
❤️ *Life Impact:* Your single donation can save up to 3 precious lives!

🖼️ *View & Download Your Official Digital Certificate:*
${certVerificationUrl}

*"The blood you donate gives someone another chance at life."*

With heartfelt gratitude,
*Central Blood Transfusion & Healthcare Service*`;

  // Render high-res image of the certificate element
  const generateCertificateBlob = async (): Promise<Blob | null> => {
    const certElement = certCardRef.current || document.getElementById('blood-donation-certificate-print');
    if (!certElement) return null;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(certElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fffdfa',
        logging: false,
      });
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    } catch (err) {
      console.error('Failed to render certificate to image canvas:', err);
      return null;
    }
  };

  // Primary action: Send on WhatsApp with Certificate image + message + direct link
  const handleSendWhatsApp = async () => {
    setIsProcessing(true);
    setActionNotice(null);

    const targetPhone = (currentPhone || donorPhone).trim();
    const cleanPhone = formatPhoneForWhatsApp(targetPhone);
    const safeDonorName = (data.donorName || 'Donor').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Blood_Donation_Certificate_${safeDonorName}.png`;

    try {
      // 1. Generate image blob
      const blob = await generateCertificateBlob();

      // 2. Check native Mobile Web Share API support (Android/iOS)
      if (blob && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Blood Donation Certificate - ${data.donorName}`,
              text: whatsappMessage,
              files: [file],
            });
            setIsProcessing(false);
            return;
          } catch (shareErr: any) {
            if (shareErr.name === 'AbortError') {
              setIsProcessing(false);
              return;
            }
            console.warn('Native share failed, proceeding with desktop fallback', shareErr);
          }
        }
      }

      // 3. Desktop / Web fallback: Copy image to clipboard & auto-download image file
      if (blob) {
        try {
          if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob }),
            ]);
          }
        } catch (clipErr) {
          console.warn('Clipboard image write failed:', clipErr);
        }

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
      }

      // 4. Alert user with helpful guidance for WhatsApp Web paste
      setActionNotice({
        type: 'info',
        message: '📋 Certificate image copied to clipboard & downloaded! In the WhatsApp chat, simply press Ctrl+V (or Paste) to send the certificate image with your message.',
      });

      // 5. Open WhatsApp Web / App
      const encodedText = encodeURIComponent(whatsappMessage);
      const url = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
        : `https://api.whatsapp.com/send?text=${encodedText}`;

      window.open(url, '_blank', 'noopener,noreferrer');
      if (onWhatsAppSent) {
        onWhatsAppSent(data.unitCode || data.certificateNumber);
      }
    } catch (err: any) {
      console.error('WhatsApp dispatch error:', err);
      // Fallback redirect
      const encodedText = encodeURIComponent(whatsappMessage);
      const url = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
        : `https://api.whatsapp.com/send?text=${encodedText}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      if (onWhatsAppSent) {
        onWhatsAppSent(data.unitCode || data.certificateNumber);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadImage = async () => {
    setIsProcessing(true);
    try {
      const blob = await generateCertificateBlob();
      if (!blob) return;
      const safeDonorName = (data.donorName || 'Donor').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Blood_Donation_Certificate_${safeDonorName}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setActionNotice({
        type: 'success',
        message: '✓ Certificate image downloaded successfully in high resolution!',
      });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyImage = async () => {
    setIsProcessing(true);
    try {
      const blob = await generateCertificateBlob();
      if (!blob) return;
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setActionNotice({
          type: 'success',
          message: '✓ Certificate image copied to clipboard! You can now paste (Ctrl+V) directly into WhatsApp, Telegram, or email.',
        });
        setTimeout(() => setActionNotice(null), 4500);
      }
    } catch (err) {
      console.error('Copy image failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setActionNotice({
        type: 'success',
        message: '✓ Appreciation message & certificate download link copied to clipboard!',
      });
      setTimeout(() => setActionNotice(null), 3000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = async () => {
    setIsProcessing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const certElement = certCardRef.current || document.getElementById('blood-donation-certificate-print');
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

      // Create or reuse hidden print iframe
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
              <title>Blood Donation Certificate - ${data.donorName}</title>
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
      console.error('Print generation failed, falling back to window.print():', err);
      window.print();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="modal-backdrop-print-safe"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '920px',
            width: '100%',
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid #fde68a',
            overflow: 'hidden',
          }}
        >
          {/* Header Action Bar */}
          <div
            className="no-print"
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: '#fffbeb',
              borderBottom: '1px solid #fde68a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🏆</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  Blood Donation Certificate Generated
                </h3>
                <span style={{ fontSize: '0.775rem', color: '#64748b' }}>
                  Official appreciation record for <strong>{data.donorName}</strong> ({cleanBloodGroup})
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Download PNG Button */}
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isProcessing}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 0.95rem',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                }}
              >
                <span>🖼️</span> Download PNG
              </button>

              {/* Print / Save PDF Button */}
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 0.95rem',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                }}
              >
                <span>🖨️</span> Print / Save PDF
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#64748b',
                  borderRadius: '8px',
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close ✕
              </button>
            </div>
          </div>

          {/* Toast / Guidance Notice */}
          {actionNotice && (
            <div
              className="no-print"
              style={{
                backgroundColor: actionNotice.type === 'success' ? '#f0fdf4' : '#eff6ff',
                borderBottom: actionNotice.type === 'success' ? '1px solid #bbf7d0' : '1px solid #bfdbfe',
                padding: '0.75rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontSize: '0.825rem',
                color: actionNotice.type === 'success' ? '#166534' : '#1e40af',
                fontWeight: 600,
              }}
            >
              <span>{actionNotice.type === 'success' ? '✅' : 'ℹ️'}</span>
              <span>{actionNotice.message}</span>
            </div>
          )}

          {/* Scrollable Content: WhatsApp Bar + Certificate Canvas */}
          <div style={{ overflowY: 'auto', padding: '1.25rem', backgroundColor: '#f8fafc' }}>
            {/* WhatsApp Dispatch Control Banner */}
            <div
              className="no-print"
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: '#25d366',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '1.4rem',
                    flexShrink: 0,
                    boxShadow: '0 4px 10px rgba(37, 211, 102, 0.35)',
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.586-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.04-1.046-.077-.282-.094-.65-.228-1.144-.442-2.096-.906-3.46-3.056-3.565-3.197-.105-.141-.855-1.139-.855-2.172 0-1.033.541-1.541.733-1.752.193-.211.422-.264.563-.264.141 0 .281.002.404.008.129.006.302-.049.472.361.176.423.6 1.464.652 1.57.053.106.088.23.018.371-.07.141-.106.229-.211.353-.106.123-.222.276-.317.371-.106.106-.217.221-.093.434.123.213.549.907 1.178 1.467.81.721 1.493.945 1.706 1.051.213.106.338.088.463-.053.125-.141.536-.623.678-.835.141-.212.282-.176.474-.106.193.07 1.22.576 1.431.681.211.106.352.159.404.247.053.088.053.511-.091.916z"/>
                  </svg>
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.925rem', color: '#065f46' }}>
                    Send Certificate to Donor on WhatsApp
                  </strong>
                  <span style={{ fontSize: '0.785rem', color: '#047857' }}>
                    Sends certificate image + appreciation details + online verification link directly to the donor.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Donor Phone (e.g. 9876543210)"
                    value={currentPhone}
                    onChange={(e) => {
                      setPhoneInitialized(true);
                      setCustomPhone(e.target.value);
                    }}
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #a7f3d0',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      width: '180px',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Send on WhatsApp Button */}
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  disabled={isProcessing}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.55rem 1.1rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Share certificate image and message on WhatsApp"
                >
                  <span>📲</span> {isProcessing ? 'Preparing Image...' : 'Send on WhatsApp'}
                </button>

                {/* Copy Image Button */}
                <button
                  type="button"
                  onClick={handleCopyImage}
                  disabled={isProcessing}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                    borderRadius: '8px',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                  }}
                  title="Copy high-resolution certificate image to clipboard (Ctrl+V)"
                >
                  📋 Copy Image
                </button>

                {/* Copy Text Button */}
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                    borderRadius: '8px',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Copy formatted message text & verification link"
                >
                  📄 Copy Text
                </button>
              </div>
            </div>

            {/* PRESTIGIOUS PRINTABLE CERTIFICATE CARD */}
            <div
              id="blood-donation-certificate-print"
              ref={certCardRef}
              style={{
                backgroundColor: '#fffdfa',
                border: '8px double #d97706',
                borderRadius: '12px',
                padding: '2.5rem 2rem',
                position: 'relative',
                boxShadow: '0 10px 25px -5px rgba(217, 119, 6, 0.15), 0 0 0 1px #fde68a inset',
                textAlign: 'center',
                fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                color: '#0f172a',
                overflow: 'hidden',
              }}
            >
              {/* Corner Ornaments */}
              <div style={{ position: 'absolute', top: '10px', left: '10px', width: '28px', height: '28px', borderTop: '3px solid #b45309', borderLeft: '3px solid #b45309' }} />
              <div style={{ position: 'absolute', top: '10px', right: '10px', width: '28px', height: '28px', borderTop: '3px solid #b45309', borderRight: '3px solid #b45309' }} />
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '28px', height: '28px', borderBottom: '3px solid #b45309', borderLeft: '3px solid #b45309' }} />
              <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '28px', height: '28px', borderBottom: '3px solid #b45309', borderRight: '3px solid #b45309' }} />

              {/* Watermark Logo / Emblem */}
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

              {/* Top Organization Emblem & Authority */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fee2e2', border: '2px solid #ef4444', marginBottom: '0.5rem', color: '#dc2626', fontSize: '1.8rem', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)' }}>
                  🩸
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.18em', color: '#991b1b', textTransform: 'uppercase' }}>
                  CENTRAL BLOOD TRANSFUSION & HEALTHCARE SERVICE
                </div>
                <div style={{ fontSize: '0.725rem', color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.15rem' }}>
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
                    fontSize: '2.1rem',
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
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#475569', fontStyle: 'italic' }}>
                  This certificate of life-saving honor is proudly and gratefully conferred upon
                </p>
              </div>

              {/* Recipient Donor Name */}
              <div style={{ margin: '1.25rem 0 1.5rem 0' }}>
                <div
                  style={{
                    fontSize: '2.25rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    letterSpacing: '0.02em',
                    borderBottom: '2px dashed #d97706',
                    display: 'inline-block',
                    paddingBottom: '0.4rem',
                    paddingLeft: '1.5rem',
                    paddingRight: '1.5rem',
                  }}
                >
                  {data.donorName}
                </div>
                {data.donorCode && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem', fontFamily: 'monospace' }}>
                    Registration Code: {data.donorCode}
                  </div>
                )}
              </div>

              {/* Commendation Citation Text */}
              <p
                style={{
                  maxWidth: '680px',
                  margin: '0 auto 1.75rem auto',
                  fontSize: '0.925rem',
                  lineHeight: 1.65,
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
                  maxWidth: '720px',
                  margin: '0 auto 2rem auto',
                }}
              >
                {/* Blood Group */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                    Blood Group
                  </span>
                  <strong style={{ fontSize: '1.15rem', color: '#dc2626' }}>
                    🩸 {cleanBloodGroup}
                  </strong>
                </div>

                {/* Donation Date */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                    Date of Donation
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                    {formattedDate}
                  </strong>
                </div>

                {/* Certificate Number */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                    Certificate ID
                  </span>
                  <strong style={{ fontSize: '0.8rem', color: '#92400e', fontFamily: 'monospace' }}>
                    {data.certificateNumber}
                  </strong>
                </div>

                {/* Units & Volume */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                    Contribution Volume
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: '#059669' }}>
                    {data.volume || 450} ml Whole Blood
                  </strong>
                </div>
              </div>

              {/* Event / Center Location */}
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '2rem' }}>
                📍 Camp / Center: <strong>{campaignOrLocation}</strong>
                {data.unitCode && (
                  <span> • Issued Blood Unit: <code style={{ color: '#92400e', fontWeight: 700 }}>{data.unitCode}</code></span>
                )}
              </div>

              {/* Signatures & Official Gold Seal */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  borderTop: '1px solid #fde68a',
                  paddingTop: '1.5rem',
                  maxWidth: '720px',
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
                      fontSize: '1.45rem',
                      color: '#0369a1',
                      height: '32px',
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
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    border: '3px double #d97706',
                    backgroundColor: '#fffdf5',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)',
                    padding: '0.2rem',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>🎖️</span>
                  <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    VERIFIED DONATION
                  </span>
                  <span style={{ fontSize: '0.5rem', color: '#b45309' }}>
                    ★ SAVE LIVES ★
                  </span>
                </div>

                {/* Signature 2 */}
                <div style={{ textAlign: 'center', minWidth: '150px' }}>
                  <div
                    style={{
                      fontFamily: "'Brush Script MT', 'Dancing Script', cursive, serif",
                      fontSize: '1.45rem',
                      color: '#92400e',
                      height: '32px',
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
          </div>

          {/* Modal Footer */}
          <div
            className="no-print"
            style={{
              padding: '0.85rem 1.5rem',
              backgroundColor: '#fffbeb',
              borderTop: '1px solid #fde68a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              💡 Sending on WhatsApp delivers both the <strong>certificate image</strong> and verified digital link directly to the donor.
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={isProcessing}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 1.1rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>📲</span> {isProcessing ? 'Processing...' : 'Send on WhatsApp'}
              </button>
              {onOpenBagLabel && (
                <button
                  type="button"
                  onClick={onOpenBagLabel}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.45rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>🏷️</span> Print Bag Label
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Print Media Query to isolate Certificate during fallback window.print() */}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
          .modal-backdrop-print-safe {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            display: block !important;
            overflow: visible !important;
          }
          .modal-backdrop-print-safe > div {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            background: transparent !important;
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
    </>
  );
}
