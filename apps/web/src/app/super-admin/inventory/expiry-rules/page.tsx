'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ExpiryRuleItem,
  COMPONENT_DISPLAY_LABELS,
  COMPONENT_TEMPERATURE_GUIDES,
  fetchExpiryRules,
  updateExpiryRule,
  recalculateInventoryExpiries,
} from '@/lib/expiry-rules-api';
import StaffAttributionBadge from '@/components/admin/StaffAttributionBadge';
import { TableSkeleton } from '@/components/admin/LoadingSkeleton';
import {
  ArrowLeft,
  LayoutGrid,
  Table as TableIcon,
  Edit3,
  CheckCircle,
  AlertCircle,
  SlidersHorizontal,
  Clock,
  ShieldCheck,
  Thermometer,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export default function ExpiryRulesConfigPage() {
  const [rules, setRules] = useState<ExpiryRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode: 'cards' or 'table' (defaults to table on desktop, cards on mobile)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setViewMode('table');
    }
  }, []);

  // Edit modal
  const [editingRule, setEditingRule] = useState<ExpiryRuleItem | null>(null);
  const [shelfLifeInput, setShelfLifeInput] = useState<string>('');
  const [temperatureInput, setTemperatureInput] = useState<string>('');
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [isActiveInput, setIsActiveInput] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Recalculation action state
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcSuccess, setRecalcSuccess] = useState<string | null>(null);
  const [recalcError, setRecalcError] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchExpiryRules();
      setRules(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load blood unit expiry rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleOpenEdit = (rule: ExpiryRuleItem) => {
    setEditingRule(rule);
    setShelfLifeInput(rule.shelfLifeDays.toString());
    setTemperatureInput(rule.storageTemperature || '2°C to 6°C');
    setDescriptionInput(rule.description || '');
    setIsActiveInput(rule.isActive !== false);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    const days = parseInt(shelfLifeInput, 10);
    if (isNaN(days) || days < 1) {
      setSaveError('Shelf life must be a positive number of days (at least 1 day).');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      await updateExpiryRule({
        componentType: editingRule.componentType,
        shelfLifeDays: days,
        storageTemperature: temperatureInput.trim() || undefined,
        description: descriptionInput.trim() || undefined,
        isActive: isActiveInput,
      });

      setSaveSuccess(
        `Expiry policy for ${COMPONENT_DISPLAY_LABELS[editingRule.componentType] || editingRule.componentType} updated to ${days} days!`,
      );
      setEditingRule(null);
      await loadRules();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update expiry rule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (
      !window.confirm(
        'Are you sure you want to recalculate and backfill expiry dates for inventory blood units based on the current active shelf-life rules?',
      )
    ) {
      return;
    }

    setIsRecalculating(true);
    setRecalcError(null);
    setRecalcSuccess(null);

    try {
      const res = await recalculateInventoryExpiries();
      setRecalcSuccess(res.message);
    } catch (err: any) {
      setRecalcError(err.message || 'Failed to recalculate inventory expiries.');
    } finally {
      setIsRecalculating(false);
    }
  };

  // KPI Calculations
  const shortest = rules.length
    ? rules.reduce((min, r) => (r.shelfLifeDays < min.shelfLifeDays ? r : min), rules[0])
    : null;
  const longest = rules.length
    ? rules.reduce((max, r) => (r.shelfLifeDays > max.shelfLifeDays ? r : max), rules[0])
    : null;
  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.75rem 1rem' }}>
      {/* Top Breadcrumb & Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <Link
          href="/admin/inventory"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            color: '#475569',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
            padding: '0.4rem 0.75rem',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <ArrowLeft size={16} /> Back to Inventory
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              backgroundColor: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              cursor: isRecalculating ? 'not-allowed' : 'pointer',
            }}
            title="Recalculate expiry dates for all legacy units missing an expiry timestamp"
          >
            <RefreshCw size={14} className={isRecalculating ? 'animate-spin' : ''} />
            {isRecalculating ? 'Recalculating Units...' : 'Recalculate Inventory Expiries'}
          </button>

          <button
            onClick={loadRules}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Header Banner */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                }}
              >
                <Clock size={20} />
              </span>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Blood Unit Expiry &amp; Shelf-Life Policies
              </h1>
            </div>
            <p style={{ margin: '0.45rem 0 0 0', color: '#64748b', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: '820px' }}>
              Authoritative Super Admin regulatory rules governing maximum shelf-life (days) and storage requirements
              for all blood components. When units are collected from donors or acquired from external centres,
              their physical expiry date is automatically calculated based on these active rules.
            </p>
          </div>

          {/* View Mode Toggle */}
          <div
            style={{
              display: 'inline-flex',
              padding: '0.2rem',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              onClick={() => setViewMode('cards')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: viewMode === 'cards' ? '#ffffff' : 'transparent',
                color: viewMode === 'cards' ? '#0f172a' : '#64748b',
                boxShadow: viewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <LayoutGrid size={14} /> Cards View
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: viewMode === 'table' ? '#ffffff' : 'transparent',
                color: viewMode === 'table' ? '#0f172a' : '#64748b',
                boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <TableIcon size={14} /> Table View
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {saveSuccess && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              color: '#065f46',
              fontSize: '0.85rem',
            }}
          >
            <CheckCircle size={16} />
            <span>{saveSuccess}</span>
          </div>
        )}

        {recalcSuccess && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              color: '#1e40af',
              fontSize: '0.85rem',
            }}
          >
            <Sparkles size={16} />
            <span>{recalcSuccess}</span>
          </div>
        )}

        {(error || recalcError) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>{error || recalcError}</span>
            </div>
            {error && (
              <button
                onClick={loadRules}
                style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  borderRadius: '6px',
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '1.15rem', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Managed Components
          </span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
            {rules.length}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, marginTop: '0.15rem', display: 'block' }}>
            ✓ {activeCount} Policies Active
          </span>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '1.15rem', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Shortest Shelf-Life
          </span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#b45309', marginTop: '0.25rem' }}>
            {shortest ? `${shortest.shelfLifeDays} Days` : '—'}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem', display: 'block' }}>
            {shortest ? COMPONENT_DISPLAY_LABELS[shortest.componentType] || shortest.componentType : 'N/A'}
          </span>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '1.15rem', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Longest Shelf-Life
          </span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.25rem' }}>
            {longest ? `${longest.shelfLifeDays} Days` : '—'}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem', display: 'block' }}>
            {longest ? COMPONENT_DISPLAY_LABELS[longest.componentType] || longest.componentType : 'N/A'}
          </span>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '1.15rem', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Auto-Calculation Sync
          </span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', marginTop: '0.25rem' }}>
            Active
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem', display: 'block' }}>
            Applied at collection / intake
          </span>
        </div>
      </div>

      {/* Main Content: Cards or Table */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : viewMode === 'cards' ? (
        /* CARDS VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {rules.map((rule) => {
            const label = COMPONENT_DISPLAY_LABELS[rule.componentType] || rule.componentType;
            return (
              <div
                key={rule._id}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1.35rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        {label}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          color: '#64748b',
                          backgroundColor: '#f1f5f9',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          display: 'inline-block',
                          marginTop: '0.25rem',
                        }}
                      >
                        {rule.componentType}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                        backgroundColor: rule.isActive ? '#ecfdf5' : '#f1f5f9',
                        color: rule.isActive ? '#047857' : '#64748b',
                        border: `1px solid ${rule.isActive ? '#a7f3d0' : '#cbd5e1'}`,
                      }}
                    >
                      {rule.isActive ? 'Active Rule' : 'Inactive'}
                    </span>
                  </div>

                  {/* Main Shelf Life Days Highlight */}
                  <div
                    style={{
                      marginTop: '1.15rem',
                      padding: '1rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      Authoritative Shelf-Life
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a' }}>
                        {rule.shelfLifeDays}
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569' }}>
                        Days from collection
                      </span>
                    </div>
                  </div>

                  {/* Storage Temperature & Conditions */}
                  <div style={{ marginTop: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                      <Thermometer size={14} style={{ color: '#0284c7' }} />
                      <span>Optimal Storage Temperature:</span>
                    </div>
                    <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0f172a', marginTop: '0.2rem', paddingLeft: '1.25rem' }}>
                      {rule.storageTemperature || '2°C to 6°C'}
                    </div>
                  </div>

                  {/* Description / Clinical Guidelines */}
                  {rule.description && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.45, fontStyle: 'italic' }}>
                      &ldquo;{rule.description}&rdquo;
                    </div>
                  )}
                </div>

                {/* Footer with Staff Attribution & Edit Button */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <StaffAttributionBadge
                      label="Updated by"
                      name={rule.updatedByName || 'Super Admin'}
                      role={rule.updatedByRole || 'SUPER_ADMIN'}
                      timestamp={rule.updatedAt}
                      size="xs"
                    />
                  </div>

                  <button
                    onClick={() => handleOpenEdit(rule)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={13} /> Edit Policy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Component</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Shelf-Life (Days)</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Storage Temperature</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Description &amp; Preservation</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Policy Status</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Staff Attribution</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const label = COMPONENT_DISPLAY_LABELS[rule.componentType] || rule.componentType;
                  return (
                    <tr
                      key={rule._id}
                      style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{label}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                          {rule.componentType}
                        </div>
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                          {rule.shelfLifeDays}
                        </span>{' '}
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>days</span>
                      </td>

                      <td style={{ padding: '1rem', color: '#334155', fontWeight: 600, fontSize: '0.825rem' }}>
                        {rule.storageTemperature || '2°C to 6°C'}
                      </td>

                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.8rem', maxWidth: '300px' }}>
                        {rule.description || '—'}
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            backgroundColor: rule.isActive ? '#ecfdf5' : '#f1f5f9',
                            color: rule.isActive ? '#047857' : '#64748b',
                            border: `1px solid ${rule.isActive ? '#a7f3d0' : '#cbd5e1'}`,
                          }}
                        >
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <StaffAttributionBadge
                          label="Updated by"
                          name={rule.updatedByName || 'Super Admin'}
                          role={rule.updatedByRole || 'SUPER_ADMIN'}
                          timestamp={rule.updatedAt}
                          size="xs"
                        />
                      </td>

                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenEdit(rule)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingRule && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setEditingRule(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '540px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                  }}
                >
                  <SlidersHorizontal size={18} />
                </span>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Edit Expiry Policy
                </h2>
              </div>
              <button
                onClick={() => setEditingRule(null)}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#94a3b8',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveRule}>
              {saveError && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    marginBottom: '1rem',
                  }}
                >
                  {saveError}
                </div>
              )}

              {/* Component Identifier */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Blood Component
                </label>
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontWeight: 700,
                    color: '#0f172a',
                    fontSize: '0.875rem',
                  }}
                >
                  {COMPONENT_DISPLAY_LABELS[editingRule.componentType] || editingRule.componentType} ({editingRule.componentType})
                </div>
              </div>

              {/* Shelf-Life in Days */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Shelf-Life Duration (Days from Collection) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="1825"
                  value={shelfLifeInput}
                  onChange={(e) => setShelfLifeInput(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                {/* Preset quick buttons */}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', alignSelf: 'center' }}>Presets:</span>
                  {[5, 35, 42, 365].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setShelfLifeInput(preset.toString())}
                      style={{
                        padding: '0.15rem 0.45rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: '#334155',
                      }}
                    >
                      {preset}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Storage Temperature Requirements */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Optimal Storage Temperature Range
                </label>
                <input
                  type="text"
                  value={temperatureInput}
                  onChange={(e) => setTemperatureInput(e.target.value)}
                  placeholder="e.g. 2°C to 6°C"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Clinical Description / Notes */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Preservation &amp; Handling Guidelines
                </label>
                <textarea
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  rows={3}
                  placeholder="Clinical preservation guidelines, additive solution, or regulatory compliance notes..."
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.825rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Active Toggle */}
              <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActiveInput}
                  onChange={(e) => setIsActiveInput(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="isActiveCheck" style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Policy Active (Applied to newly collected/acquired blood units)
                </label>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSaving ? 'Saving Policy...' : 'Save Expiry Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
