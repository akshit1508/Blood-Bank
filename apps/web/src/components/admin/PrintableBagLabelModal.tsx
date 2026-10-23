'use client';

import React, { useRef } from 'react';

export interface BagLabelData {
  bagBarcode: string;
  unitCode?: string;
  donationCode: string;
  donorCode?: string;
  donorName?: string;
  bloodGroup: string;
  componentType: string;
  volumeMl: number;
  bagType: string;
  collectionDate: string;
  expiryDate?: string;
  collectionLocation?: string;
  centreName?: string;
  anticoagulant?: string;
  testedStatus?: string;
}

interface PrintableBagLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  labelData: BagLabelData | null;
}

export default function PrintableBagLabelModal({
  isOpen,
  onClose,
  labelData,
}: PrintableBagLabelModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !labelData) return null;

  const handlePrint = () => {
    window.print();
  };

  // Human-readable format of blood group
  const formattedBloodGroup = labelData.bloodGroup
    ?.replace('_POSITIVE', ' Rh +VE (POSITIVE)')
    ?.replace('_NEGATIVE', ' Rh -VE (NEGATIVE)')
    || labelData.bloodGroup;

  const shortBloodGroup = labelData.bloodGroup
    ?.replace('_POSITIVE', '+')
    ?.replace('_NEGATIVE', '-')
    || labelData.bloodGroup;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Non-printable) */}
        <div
          className="no-print"
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0f172a',
            color: '#ffffff',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
              🏷️ Blood Bag Phlebotomy Label
            </h3>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
              Standard ISBT-compatible blood bag barcode label
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.4rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Printable Label Preview Area */}
        <div
          style={{
            padding: '1.25rem',
            overflowY: 'auto',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Physical Bag Label Container (standard 100mm x 100mm aspect ratio) */}
          <div
            id="blood-bag-printable-label"
            ref={printAreaRef}
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: '#ffffff',
              border: '2px solid #0f172a',
              borderRadius: '8px',
              padding: '0.85rem',
              fontFamily: 'monospace, sans-serif',
              color: '#000000',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Top Bar: Centre & Caution */}
            <div
              style={{
                borderBottom: '1.5px solid #000000',
                paddingBottom: '0.35rem',
                marginBottom: '0.45rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {labelData.centreName || 'CENTRAL BLOOD CENTRE & COMPONENT FACILITY'}
              </div>
              <div style={{ fontSize: '0.6rem', color: '#dc2626', fontWeight: 800, marginTop: '2px' }}>
                ⚠ QUARANTINE / TESTING PENDING — NOT FOR TRANSFUSION
              </div>
            </div>

            {/* Barcode & Bag Identification Block */}
            <div
              style={{
                textAlign: 'center',
                backgroundColor: '#ffffff',
                border: '1px dashed #64748b',
                padding: '0.4rem 0.2rem',
                borderRadius: '4px',
                marginBottom: '0.5rem',
              }}
            >
              {/* Simulated Code128 Barcode Visual */}
              <div
                aria-label={labelData.bagBarcode}
                style={{
                  height: '38px',
                  margin: '0 auto 0.25rem auto',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '2px',
                  background: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 5px, #fff 5px, #fff 8px, #000 8px, #000 11px, #fff 11px, #fff 13px)',
                  width: '85%',
                }}
              />
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  letterSpacing: '2px',
                  fontFamily: 'monospace',
                }}
              >
                *{labelData.bagBarcode}*
              </div>
              {labelData.unitCode && (
                <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '2px' }}>
                  Unit Code: <strong>{labelData.unitCode}</strong>
                </div>
              )}
            </div>

            {/* Primary Grid: Blood Group & Bag Details */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: '0.5rem',
                borderBottom: '1.5px solid #000',
                paddingBottom: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              {/* Left Column: Huge Blood Group */}
              <div
                style={{
                  border: '2px solid #000',
                  borderRadius: '6px',
                  padding: '0.35rem',
                  textAlign: 'center',
                  backgroundColor: '#fef2f2',
                }}
              >
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  ABO / Rh Group
                </div>
                <div
                  style={{
                    fontSize: '2.4rem',
                    fontWeight: 900,
                    lineHeight: 1.1,
                    color: '#b91c1c',
                    fontFamily: 'sans-serif',
                  }}
                >
                  {shortBloodGroup}
                </div>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#000' }}>
                  {formattedBloodGroup}
                </div>
              </div>

              {/* Right Column: Volume & Bag Specs */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  fontSize: '0.65rem',
                  lineHeight: 1.35,
                }}
              >
                <div>
                  <div style={{ color: '#64748b' }}>VOLUME:</div>
                  <strong style={{ fontSize: '0.9rem' }}>{labelData.volumeMl || 450} mL</strong> ± 10%
                </div>
                <div>
                  <div style={{ color: '#64748b' }}>BAG TYPE:</div>
                  <strong>{labelData.bagType || 'CPDA-1 SINGLE'}</strong>
                </div>
                <div>
                  <div style={{ color: '#64748b' }}>COMPONENT:</div>
                  <strong>{labelData.componentType || 'WHOLE BLOOD'}</strong>
                </div>
              </div>
            </div>

            {/* Traceability Grid: Donor & Dates */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.4rem',
                fontSize: '0.65rem',
                marginBottom: '0.5rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>Donation No:</span>
                <div style={{ fontWeight: 800 }}>{labelData.donationCode}</div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Donor ID:</span>
                <div style={{ fontWeight: 800 }}>{labelData.donorCode || 'N/A'}</div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Collection Date:</span>
                <div style={{ fontWeight: 700 }}>
                  {new Date(labelData.collectionDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  {new Date(labelData.collectionDate).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Expiry (Est):</span>
                <div style={{ fontWeight: 700, color: labelData.expiryDate ? '#0f172a' : '#94a3b8' }}>
                  {labelData.expiryDate
                    ? new Date(labelData.expiryDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Pending Component Prep'}
                </div>
              </div>
            </div>

            {/* Storage and Safety Footnote */}
            <div
              style={{
                borderTop: '1px solid #000',
                paddingTop: '0.35rem',
                fontSize: '0.55rem',
                color: '#334155',
                lineHeight: 1.25,
                textAlign: 'center',
              }}
            >
              <div>🌡️ <strong>STORAGE: Store at 2°C to 6°C.</strong> Do Not Freeze.</div>
              <div>Inspect bag for hemolysis, turbidity, or leakage before processing.</div>
              <div>Collect & test strictly per DGHS / NBTC Indian Transfusion Rules.</div>
            </div>
          </div>
        </div>

        {/* Modal Actions (Non-printable) */}
        <div
          className="no-print"
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            🖨️ Thermal barcode / standard A4 label printing
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              style={{
                padding: '0.45rem 1.15rem',
                borderRadius: '6px',
                border: 'none',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
              }}
            >
              🖨️ Print Label Now
            </button>
          </div>
        </div>
      </div>

      {/* Global CSS for Print Media */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #blood-bag-printable-label,
          #blood-bag-printable-label * {
            visibility: visible;
          }
          #blood-bag-printable-label {
            position: fixed;
            left: 0;
            top: 0;
            width: 100mm;
            max-width: 100mm;
            border: 2px solid #000000 !important;
            box-shadow: none !important;
            padding: 8mm !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
