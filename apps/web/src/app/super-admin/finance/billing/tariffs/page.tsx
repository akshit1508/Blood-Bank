'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  TariffItem,
  fetchTariffs,
  updateTariff,
  formatINR,
} from '@/lib/billing-api';
import { TableSkeleton } from '@/components/admin/LoadingSkeleton';
import {
  ArrowLeft,
  LayoutGrid,
  Table as TableIcon,
  Edit3,
  CheckCircle,
  FileText,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';

export default function TariffsConfigPage() {
  const [tariffs, setTariffs] = useState<TariffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode: 'cards' (everything visible on mobile without scrolling) or 'table' (fully scrollable table)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Auto-set default based on screen size: table on desktop, cards on mobile
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setViewMode('table');
    }
  }, []);

  // Edit modal / drawer
  const [editingTariff, setEditingTariff] = useState<TariffItem | null>(null);
  const [processingFeeInput, setProcessingFeeInput] = useState<string>('');
  const [crossmatchFeeInput, setCrossmatchFeeInput] = useState<string>('');
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadTariffs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTariffs();
      setTariffs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tariffs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTariffs();
  }, [loadTariffs]);

  const handleOpenEdit = (t: TariffItem) => {
    setEditingTariff(t);
    setProcessingFeeInput(t.processingFee.toString());
    setCrossmatchFeeInput(t.crossmatchFee.toString());
    setDescriptionInput(t.description || '');
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSaveTariff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTariff) return;

    const base = parseFloat(processingFeeInput);
    const cross = parseFloat(crossmatchFeeInput) || 0;

    if (isNaN(base) || base < 0) {
      setSaveError('Base processing fee must be a non-negative number.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      await updateTariff({
        componentType: editingTariff.componentType,
        processingFee: base,
        crossmatchFee: cross,
        description: descriptionInput.trim() || undefined,
      });

      setSaveSuccess(`Tariff for ${editingTariff.componentType} updated successfully!`);
      setEditingTariff(null);
      await loadTariffs();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update tariff');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="tariffs-container" style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
      {/* Scoped responsive styles */}
      <style jsx>{`
        @media (max-width: 640px) {
          .tariffs-container {
            padding: 0.85rem !important;
          }
          .tariffs-title {
            font-size: 1.35rem !important;
          }
          .tariffs-header-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.65rem !important;
          }
          .tariffs-toggle-group {
            width: 100% !important;
            display: flex !important;
          }
          .tariffs-toggle-group button {
            flex: 1 1 50% !important;
            justify-content: center !important;
          }
          .modal-content-box {
            padding: 1.25rem !important;
          }
        }
      `}</style>

      {/* Back button & title */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          href="/super-admin/finance/billing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#64748b',
            textDecoration: 'none',
            fontSize: '0.85rem',
            marginBottom: '0.65rem',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Billing Desk</span>
        </Link>
        <h1 className="tariffs-title" style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
          Processing Fee Tariffs &amp; Cost Recovery Master
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.35rem 0 0 0' }}>
          Configure statutory standard processing charges and compatibility testing fees across blood components.
        </p>
      </div>

      {/* Statutory Guidance Alert */}
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '0.5rem',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.825rem',
          color: '#1e40af',
          lineHeight: 1.5,
        }}
      >
        <strong>National Blood Transfusion Council (NBTC) Regulatory Note:</strong> Blood and blood components cannot be commercially traded. The fees specified below represent authorized cost recovery for non-remunerated donor recruitment, blood bag consumables, nucleic acid / viral marker screening, blood grouping, cold chain maintenance, and serological crossmatching.
      </div>

      {saveSuccess && (
        <div style={{ padding: '0.75rem 1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '0.375rem', color: '#047857', fontSize: '0.875rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={16} />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Tariff Rates Master Card */}
      <div style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        {/* Card Header with View Mode Switcher */}
        <div
          className="tariffs-header-row"
          style={{
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} style={{ color: '#d97706' }} />
            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
              Standard Processing Fee Schedule
            </span>
            {tariffs.length > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                }}
              >
                {tariffs.length} Components
              </span>
            )}
          </div>

          {/* View Mode Toggle: Cards (No Scroll) vs Table (Scrollable) */}
          <div
            className="tariffs-toggle-group"
            style={{
              display: 'inline-flex',
              padding: '2px',
              backgroundColor: '#f1f5f9',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: viewMode === 'cards' ? 700 : 600,
                backgroundColor: viewMode === 'cards' ? '#ffffff' : 'transparent',
                color: viewMode === 'cards' ? '#0f172a' : '#64748b',
                border: 'none',
                borderRadius: '4px',
                boxShadow: viewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Everything visible on mobile screen without scrolling"
            >
              <LayoutGrid size={13} />
              <span>Compact Cards (No Scroll)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: viewMode === 'table' ? 700 : 600,
                backgroundColor: viewMode === 'table' ? '#ffffff' : 'transparent',
                color: viewMode === 'table' ? '#0f172a' : '#64748b',
                border: 'none',
                borderRadius: '4px',
                boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Complete table view with horizontal scrolling"
            >
              <TableIcon size={13} />
              <span>Scrollable Table</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '1rem' }}>
            <TableSkeleton rows={4} />
          </div>
        ) : error ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#dc2626' }}>{error}</div>
        ) : viewMode === 'cards' ? (
          /* Option 1: Mobile-friendly Cards where EVERYTHING is visible without scrolling */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tariffs.map((t, index) => (
              <div
                key={t._id}
                style={{
                  padding: '1rem 1.15rem',
                  borderBottom: index === tariffs.length - 1 ? 'none' : '1px solid #f1f5f9',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafcff',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {/* Top Row: Component Name, Type Badge, and Edit Action Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                      {t.componentType.replace(/_/g, ' ')}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.12rem 0.45rem',
                        borderRadius: '4px',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #dbeafe',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Cost Recovery
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenEdit(t)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.375rem',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      color: '#0f172a',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      flexShrink: 0,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <Edit3 size={12} />
                    <span>Edit Rate</span>
                  </button>
                </div>

                {/* Subtitle / Description */}
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem', lineHeight: 1.35 }}>
                  {t.description || 'Statutory cost-recovery fee schedule under NBTC guidelines'}
                </p>

                {/* 3 Metrics Strip - 100% visible on mobile screens without any horizontal scrolling */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.4rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '0.65rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, display: 'block', letterSpacing: '0.03em' }}>
                      BASE FEE
                    </span>
                    <div style={{ fontSize: '0.925rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatINR(t.processingFee)}
                    </div>
                  </div>

                  <div style={{ borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', minWidth: 0 }}>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, display: 'block', letterSpacing: '0.03em' }}>
                      CROSSMATCH
                    </span>
                    <div style={{ fontSize: '0.925rem', fontWeight: 700, color: '#475569', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatINR(t.crossmatchFee)}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '0.65rem', color: '#166534', fontWeight: 800, display: 'block', letterSpacing: '0.03em' }}>
                      TOTAL RECOVERY
                    </span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#16a34a', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatINR(t.processingFee + t.crossmatchFee)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Option 2: Full Table wrapped in smooth horizontal scroll */
          <div>
            <div
              style={{
                padding: '0.5rem 1.15rem',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '0.725rem',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>👉 Swipe left/right on mobile to scroll through all columns &amp; action buttons.</span>
            </div>

            <div
              className="admin-table-scroll"
              style={{
                width: '100%',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#475569' }}>Component Type</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Standard Base Fee</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Crossmatch Fee</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#166534', textAlign: 'right' }}>Total Combined</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#475569' }}>Description</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tariffs.map((t) => (
                    <tr key={t._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{t.componentType.replace(/_/g, ' ')}</span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {formatINR(t.processingFee)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatINR(t.crossmatchFee)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 800, color: '#16a34a', whiteSpace: 'nowrap' }}>
                        {formatINR(t.processingFee + t.crossmatchFee)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.8rem', minWidth: '180px' }}>
                        {t.description || 'Standard cost-recovery charge'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleOpenEdit(t)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '0.375rem',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            color: '#0f172a',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <Edit3 size={12} />
                          <span>Edit Rate</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingTariff && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="modal-content-box"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              maxWidth: 480,
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Edit Fee Tariff: {editingTariff.componentType.replace(/_/g, ' ')}
                </h3>
              </div>
              <button
                onClick={() => setEditingTariff(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {saveError && (
              <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={16} />
                <span>{saveError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTariff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Standard Base Processing Fee (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={processingFeeInput}
                  onChange={(e) => setProcessingFeeInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Crossmatching &amp; Compatibility Fee (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={crossmatchFeeInput}
                  onChange={(e) => setCrossmatchFeeInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Description / Regulatory Rationale
                </label>
                <input
                  type="text"
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="e.g. Approved under State Blood Council Revision 2026"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditingTariff(null)}
                  style={{
                    padding: '0.6rem 1rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 700,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
