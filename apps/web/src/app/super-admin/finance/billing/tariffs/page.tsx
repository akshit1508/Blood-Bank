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

export default function TariffsConfigPage() {
  const [tariffs, setTariffs] = useState<TariffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
      {/* Back button & title */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href="/super-admin/finance/billing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#64748b',
            textDecoration: 'none',
            fontSize: '0.875rem',
            marginBottom: '0.75rem',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Billing Desk
        </Link>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Processing Fee Tariffs & Cost Recovery Master
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.35rem 0 0 0' }}>
          Configure statutory standard processing charges and compatibility testing fees across blood components.
        </p>
      </div>

      {/* Statutory Guidance Alert */}
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          fontSize: '0.85rem',
          color: '#1e40af',
          lineHeight: 1.5,
        }}
      >
        <strong>National Blood Transfusion Council (NBTC) Regulatory Note:</strong> Blood and blood components cannot be commercially traded. The fees specified below represent authorized cost recovery for non-remunerated donor recruitment, blood bag consumables, nucleic acid / viral marker screening, blood grouping, cold chain maintenance, and serological crossmatching.
      </div>

      {saveSuccess && (
        <div style={{ padding: '0.75rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '0.375rem', color: '#047857', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          {saveSuccess}
        </div>
      )}

      {/* Tariff Rates Master Card */}
      <div style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#0f172a' }}>
          Standard Processing Fee Schedule
        </div>

        {loading ? (
          <TableSkeleton rows={4} />
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>{error}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Component Type</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Standard Base Fee</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Crossmatch Fee</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Total Combined</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Description</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tariffs.map((t) => (
                <tr key={t._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{t.componentType}</span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                    {formatINR(t.processingFee)}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>
                    {formatINR(t.crossmatchFee)}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                    {formatINR(t.processingFee + t.crossmatchFee)}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                    {t.description || 'Standard cost-recovery charge'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
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
                      }}
                    >
                      Edit Rate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              maxWidth: 480,
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Edit Fee Tariff: {editingTariff.componentType}
                </h3>
              </div>
              <button
                onClick={() => setEditingTariff(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                &times;
              </button>
            </div>

            {saveError && (
              <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {saveError}
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
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Crossmatching & Compatibility Fee (₹)
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
