'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  InventoryItem,
  InventorySummary,
  InventoryStatus,
  fetchInventory,
  fetchInventoryById,
  fetchInventorySummary,
  discardInventoryItem,
  evaluateInventoryExpiry,
  getFriendlyInventoryErrorMessage,
} from '@/lib/inventory-api';
import { BloodGroup } from '@/lib/donor-api';
import { BloodUnitComponent } from '@/lib/blood-unit-api';

const BLOOD_GROUPS = [
  BloodGroup.A_POSITIVE,
  BloodGroup.A_NEGATIVE,
  BloodGroup.B_POSITIVE,
  BloodGroup.B_NEGATIVE,
  BloodGroup.AB_POSITIVE,
  BloodGroup.AB_NEGATIVE,
  BloodGroup.O_POSITIVE,
  BloodGroup.O_NEGATIVE,
];

const COMPONENT_TYPES = [
  BloodUnitComponent.WHOLE_BLOOD,
  BloodUnitComponent.PRBC,
  BloodUnitComponent.FFP,
  BloodUnitComponent.PLATELETS,
];

export default function AdminInventoryPage() {
  // Inventory items state
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selected item for detail drawer
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Summary state
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBloodGroup, setFilterBloodGroup] = useState<string>('');
  const [filterComponent, setFilterComponent] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterExpiringSoon, setFilterExpiringSoon] = useState<boolean>(false);

  // Expiry check action state
  const [evaluatingExpiry, setEvaluatingExpiry] = useState(false);

  // Discard Modal state
  const [discardModalItem, setDiscardModalItem] = useState<InventoryItem | null>(null);
  const [discardReason, setDiscardReason] = useState('');
  const [discardSubmitting, setDiscardSubmitting] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);

  // Load summary metrics
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await fetchInventorySummary();
      setSummary(data);
    } catch {
      // Tolerate summary metrics failure silently
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Load inventory queue
  const loadInventory = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchInventory({
        bloodGroup: filterBloodGroup || undefined,
        componentType: filterComponent || undefined,
        status: filterStatus || undefined,
        expiringSoon: filterExpiringSoon || undefined,
        search: searchTerm.trim() || undefined,
        page,
        limit: 10,
      });

      setItems(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.total);

      // Keep selectedItem in sync if open
      setSelectedItem((prev) => {
        if (!prev) return null;
        return data.items.find((item) => item._id === prev._id) || prev;
      });
    } catch (err: any) {
      setErrorMessage(getFriendlyInventoryErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filterBloodGroup, filterComponent, filterStatus, filterExpiringSoon, searchTerm, page]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Read URL search parameter for pre-filtering or auto-inspection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    const unitCodeParam = params.get('unitCode');

    if (searchParam) {
      setSearchTerm(searchParam);
    } else if (unitCodeParam) {
      setSearchTerm(unitCodeParam);
    }
  }, []);

  // Inspect detail record
  const handleSelectItem = async (item: InventoryItem) => {
    setDetailLoading(true);
    try {
      const full = await fetchInventoryById(item._id);
      setSelectedItem(full);
    } catch {
      setSelectedItem(item);
    } finally {
      setDetailLoading(false);
    }
  };

  // Run Expiry Check
  const handleRunExpiryCheck = async () => {
    setEvaluatingExpiry(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await evaluateInventoryExpiry();
      setSuccessMessage(
        `Expiry evaluation completed: Evaluated ${result.evaluatedCount} unit(s). ${result.expiredCount} unit(s) moved to EXPIRED.`,
      );
      await loadInventory();
      await loadSummary();
      if (selectedItem) {
        handleSelectItem(selectedItem);
      }
    } catch (err: any) {
      setErrorMessage(getFriendlyInventoryErrorMessage(err));
    } finally {
      setEvaluatingExpiry(false);
    }
  };

  // Open Discard Modal
  const openDiscardModal = (item: InventoryItem) => {
    setDiscardModalItem(item);
    setDiscardReason('');
    setDiscardError(null);
  };

  // Close Discard Modal
  const closeDiscardModal = () => {
    setDiscardModalItem(null);
    setDiscardReason('');
    setDiscardError(null);
  };

  // Submit Discard
  const handleSubmitDiscard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discardModalItem) return;

    const trimmedReason = discardReason.trim();
    if (!trimmedReason) {
      setDiscardError('Discard reason is mandatory.');
      return;
    }

    setDiscardSubmitting(true);
    setDiscardError(null);
    try {
      const updated = await discardInventoryItem(discardModalItem._id, trimmedReason);
      setSuccessMessage(
        `Unit '${updated.bloodUnit?.unitCode || discardModalItem._id}' successfully moved to DISCARDED.`,
      );
      closeDiscardModal();
      await loadInventory();
      await loadSummary();

      if (selectedItem?._id === discardModalItem._id) {
        setSelectedItem(updated);
      }
    } catch (err: any) {
      setDiscardError(getFriendlyInventoryErrorMessage(err));
    } finally {
      setDiscardSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            Inventory &amp; Expiry Management
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
            Operational Lifecycle, Real-time Expiry Tracking, and Controlled Discard Workflow.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              loadInventory();
              loadSummary();
            }}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            ↻ Refresh Stock
          </button>
          <button
            onClick={handleRunExpiryCheck}
            disabled={evaluatingExpiry}
            style={{
              backgroundColor: evaluatingExpiry ? '#94a3b8' : '#e0f2fe',
              color: '#0369a1',
              border: '1px solid #7dd3fc',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: evaluatingExpiry ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 1px 2px rgba(3, 105, 161, 0.1)',
            }}
          >
            {evaluatingExpiry ? 'Evaluating...' : '⏱ Run Expiry Check'}
          </button>
        </div>
      </div>

      {/* Operational Lifecycle Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Total Available Units Card */}
        <div
          style={{
            backgroundColor: '#0f172a',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.775rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#94a3b8' }}>
              Available Stock
            </span>
            <span style={{ fontSize: '0.725rem', backgroundColor: '#15803d', color: '#ffffff', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
              READY
            </span>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, marginTop: '0.35rem' }}>
            {summaryLoading ? '...' : summary?.totalAvailable ?? 0}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#86efac', marginTop: '0.25rem' }}>
            ✓ Verified Safe & Unexpired
          </span>
        </div>

        {/* Expiring Soon (< 7 Days) Card */}
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
          }}
          onClick={() => {
            setFilterExpiringSoon((prev) => !prev);
            setPage(1);
          }}
          title="Click to toggle Expiring Soon filter"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.775rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#92400e', fontWeight: 600 }}>
              Expiring Soon
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                backgroundColor: filterExpiringSoon ? '#d97706' : '#fef3c7',
                color: filterExpiringSoon ? '#ffffff' : '#b45309',
                border: '1px solid #fcd34d',
                padding: '0.1rem 0.45rem',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              {filterExpiringSoon ? 'FILTER ACTIVE' : '≤ 7 DAYS'}
            </span>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#b45309', marginTop: '0.35rem' }}>
            {summaryLoading ? '...' : summary?.expiringSoon ?? 0}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#d97706', marginTop: '0.25rem' }}>
            ⚠️ Priority Dispatch Needed
          </span>
        </div>

        {/* Expired Units Card */}
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
          }}
          onClick={() => {
            setFilterStatus(InventoryStatus.EXPIRED);
            setFilterExpiringSoon(false);
            setPage(1);
          }}
          title="Click to view Expired units"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.775rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#991b1b', fontWeight: 600 }}>
              Expired Units
            </span>
            <span style={{ fontSize: '0.7rem', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
              BLOCKED
            </span>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#dc2626', marginTop: '0.35rem' }}>
            {summaryLoading ? '...' : summary?.expired ?? 0}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#b91c1c', marginTop: '0.25rem' }}>
            🛑 Ineligible for Distribution
          </span>
        </div>

        {/* Discarded Units Card */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
          }}
          onClick={() => {
            setFilterStatus(InventoryStatus.DISCARDED);
            setFilterExpiringSoon(false);
            setPage(1);
          }}
          title="Click to view Discarded units"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.775rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569', fontWeight: 600 }}>
              Discarded Units
            </span>
            <span style={{ fontSize: '0.7rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
              AUDITED
            </span>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#475569', marginTop: '0.35rem' }}>
            {summaryLoading ? '...' : summary?.discarded ?? 0}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.25rem' }}>
            🗑️ Documented Disposal
          </span>
        </div>
      </div>

      {/* Available Blood Group Breakdown Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        {BLOOD_GROUPS.map((bg) => {
          const count = summary?.byBloodGroup?.[bg] ?? 0;
          return (
            <div
              key={bg}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <span
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  fontSize: '0.775rem',
                  fontWeight: 800,
                }}
              >
                {bg}
              </span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: count > 0 ? '#0f172a' : '#94a3b8' }}>
                {summaryLoading ? '...' : count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search Unit Code, Storage Location..."
            style={{
              flex: 1,
              padding: '0.45rem 0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Blood Group Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 500 }}>
              Group:
            </label>
            <select
              value={filterBloodGroup}
              onChange={(e) => {
                setFilterBloodGroup(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Groups</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>

          {/* Component Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 500 }}>
              Component:
            </label>
            <select
              value={filterComponent}
              onChange={(e) => {
                setFilterComponent(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Components</option>
              {COMPONENT_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {ct}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 500 }}>
              Status:
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Statuses</option>
              <option value={InventoryStatus.AVAILABLE}>AVAILABLE</option>
              <option value={InventoryStatus.EXPIRED}>EXPIRED</option>
              <option value={InventoryStatus.DISCARDED}>DISCARDED</option>
            </select>
          </div>

          {/* Expiring Soon Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setFilterExpiringSoon((prev) => !prev);
              setPage(1);
            }}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filterExpiringSoon ? '1px solid #d97706' : '1px solid #cbd5e1',
              backgroundColor: filterExpiringSoon ? '#fef3c7' : '#ffffff',
              color: filterExpiringSoon ? '#b45309' : '#475569',
            }}
          >
            {filterExpiringSoon ? '✓ Expiring Soon (< 7d)' : 'Expiring Soon'}
          </button>

          <button
            onClick={() => {
              loadInventory();
              loadSummary();
            }}
            style={{
              padding: '0.45rem 0.85rem',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#065f46',
              fontSize: '1.1rem',
              cursor: 'pointer',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMessage}</span>
          <button
            onClick={() => loadInventory()}
            style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              padding: '0.25rem 0.65rem',
              borderRadius: '4px',
              color: '#991b1b',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Split Layout: Table (left) & Detail Panel (right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedItem ? '1fr 520px' : '1fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Table Container */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              Loading operational inventory records from database...
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: '#334155' }}>
                No inventory records match the current filter criteria.
              </p>
              <p style={{ margin: '0.5rem 0 1.25rem 0', fontSize: '0.875rem' }}>
                Try clearing filters or running an expiry evaluation.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterBloodGroup('');
                  setFilterComponent('');
                  setFilterStatus('');
                  setFilterExpiringSoon(false);
                  setPage(1);
                }}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '0.5rem 1.15rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        color: '#475569',
                      }}
                    >
                      <th style={{ padding: '0.75rem 1rem' }}>Unit Code</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Blood Group</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Component</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Expiry Date</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Storage</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Inventory Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Testing</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const isSelected = selectedItem?._id === item._id;
                      const isAvailable = item.status === InventoryStatus.AVAILABLE;
                      const isExpired = item.status === InventoryStatus.EXPIRED || item.isExpired;
                      const isDiscarded = item.status === InventoryStatus.DISCARDED;
                      const isExpiringSoon = item.isExpiringSoon && !isExpired && !isDiscarded;

                      return (
                        <tr
                          key={item._id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isSelected
                              ? '#f8fafc'
                              : isDiscarded
                              ? '#fdf2f2'
                              : isExpired
                              ? '#fff5f5'
                              : 'transparent',
                          }}
                        >
                          {/* Unit Code */}
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <strong style={{ color: '#0f172a' }}>{item.bloodUnit?.unitCode || 'N/A'}</strong>
                          </td>

                          {/* Blood Group */}
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              {item.bloodUnit?.bloodGroup || 'N/A'}
                            </span>
                          </td>

                          {/* Component */}
                          <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                            {item.bloodUnit?.componentType || 'WHOLE_BLOOD'}
                            {item.bloodUnit?.volume && (
                              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>
                                {item.bloodUnit.volume} mL
                              </span>
                            )}
                          </td>

                          {/* Expiry Date */}
                          <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                            <div>
                              {item.bloodUnit?.expiryDate
                                ? new Date(item.bloodUnit.expiryDate).toLocaleDateString()
                                : '—'}
                            </div>
                            {isExpired && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.7rem',
                                  color: '#dc2626',
                                  backgroundColor: '#fee2e2',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '3px',
                                  fontWeight: 700,
                                  marginTop: '0.15rem',
                                }}
                              >
                                EXPIRED
                              </span>
                            )}
                            {isExpiringSoon && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.7rem',
                                  color: '#b45309',
                                  backgroundColor: '#fef3c7',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '3px',
                                  fontWeight: 700,
                                  marginTop: '0.15rem',
                                }}
                              >
                                EXPIRING SOON
                              </span>
                            )}
                          </td>

                          {/* Storage */}
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                            {item.bloodUnit?.storageLocation || 'Unassigned'}
                          </td>

                          {/* Status Badge */}
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {isAvailable && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  backgroundColor: '#dcfce7',
                                  color: '#166534',
                                  border: '1px solid #bbf7d0',
                                }}
                              >
                                AVAILABLE
                              </span>
                            )}
                            {item.status === InventoryStatus.EXPIRED && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                }}
                              >
                                EXPIRED
                              </span>
                            )}
                            {item.status === InventoryStatus.DISCARDED && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1',
                                }}
                              >
                                DISCARDED
                              </span>
                            )}
                          </td>

                          {/* Testing Code & Clearance */}
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ color: '#0f172a', fontWeight: 600, display: 'block' }}>
                              {item.testing?.testingCode || '—'}
                            </span>
                            <span style={{ color: '#15803d', fontSize: '0.75rem', fontWeight: 600 }}>
                              ✓ APPROVED
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                onClick={() => handleSelectItem(item)}
                                style={{
                                  backgroundColor: isSelected ? '#0f172a' : '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  color: isSelected ? '#ffffff' : '#334155',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '4px',
                                  fontSize: '0.775rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {isSelected ? 'Inspecting' : 'Trace'}
                              </button>
                              {!isDiscarded && (
                                <button
                                  onClick={() => openDiscardModal(item)}
                                  style={{
                                    backgroundColor: '#fee2e2',
                                    border: '1px solid #fca5a5',
                                    color: '#991b1b',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '4px',
                                    fontSize: '0.775rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                  title="Discard this inventory item"
                                >
                                  Discard
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer / Pagination */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '0.825rem',
                  color: '#64748b',
                }}
              >
                <span>
                  Showing {items.length} of {totalItems} unit(s)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '0.3rem 0.65rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      background: page <= 1 ? '#f1f5f9' : '#ffffff',
                      color: page <= 1 ? '#94a3b8' : '#334155',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    &larr; Prev
                  </button>
                  <span>
                    Page {page} of {totalPages || 1}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    style={{
                      padding: '0.3rem 0.65rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      background: page >= totalPages ? '#f1f5f9' : '#ffffff',
                      color: page >= totalPages ? '#94a3b8' : '#334155',
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Detail Panel */}
        {selectedItem && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '1.25rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Inventory Unit Traceability
                </div>
                <h2 style={{ margin: '0.2rem 0', fontSize: '1.25rem', color: '#0f172a' }}>
                  {selectedItem.bloodUnit?.unitCode}
                </h2>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      backgroundColor:
                        selectedItem.status === InventoryStatus.AVAILABLE
                          ? '#dcfce7'
                          : selectedItem.status === InventoryStatus.EXPIRED
                          ? '#fee2e2'
                          : '#f1f5f9',
                      color:
                        selectedItem.status === InventoryStatus.AVAILABLE
                          ? '#166534'
                          : selectedItem.status === InventoryStatus.EXPIRED
                          ? '#dc2626'
                          : '#475569',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    STATUS: {selectedItem.status}
                  </span>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                    }}
                  >
                    {selectedItem.bloodUnit?.bloodGroup}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                {selectedItem.status !== InventoryStatus.DISCARDED && (
                  <button
                    onClick={() => openDiscardModal(selectedItem)}
                    style={{
                      backgroundColor: '#fee2e2',
                      border: '1px solid #fca5a5',
                      color: '#991b1b',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Discard Unit
                  </button>
                )}
                <button
                  onClick={() => setSelectedItem(null)}
                  aria-label="Close detail panel"
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.25rem',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    lineHeight: 1,
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                Refreshing record details...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Discarded Banner if applicable */}
                {selectedItem.status === InventoryStatus.DISCARDED && (
                  <div
                    style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#991b1b', fontWeight: 700, marginBottom: '0.25rem' }}>
                      <span>🗑️ DISCARDED FROM INVENTORY</span>
                    </div>
                    <div style={{ color: '#7f1d1d' }}>
                      <strong>Reason: </strong> {selectedItem.discardReason || 'No reason documented'}
                    </div>
                    {selectedItem.discardedAt && (
                      <div style={{ color: '#991b1b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        Discarded on: {new Date(selectedItem.discardedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Expired Warning Banner */}
                {(selectedItem.status === InventoryStatus.EXPIRED || selectedItem.isExpired) &&
                  selectedItem.status !== InventoryStatus.DISCARDED && (
                    <div
                      style={{
                        backgroundColor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        color: '#9f1239',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      <strong>🛑 Unit Expired: </strong> This physical blood unit has passed its expiration date and is withheld from distribution.
                    </div>
                  )}

                {/* Expiring Soon Banner */}
                {selectedItem.isExpiringSoon &&
                  selectedItem.status === InventoryStatus.AVAILABLE && (
                    <div
                      style={{
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        color: '#92400e',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      <strong>⚠️ Expiring Soon: </strong> This unit expires within 7 days. Prioritize for allocation.
                    </div>
                  )}

                {/* Card 1: Operational Inventory State */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>
                    📦 Operational Inventory Record
                  </strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Current Status:</span>
                      <strong
                        style={{
                          color:
                            selectedItem.status === InventoryStatus.AVAILABLE
                              ? '#166534'
                              : selectedItem.status === InventoryStatus.EXPIRED
                              ? '#dc2626'
                              : '#475569',
                        }}
                      >
                        {selectedItem.status}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Added to Inventory:</span>
                      <span style={{ color: '#334155' }}>
                        {selectedItem.createdAt
                          ? new Date(selectedItem.createdAt).toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Physical Blood Unit */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>
                    🩸 Physical Blood Unit
                  </strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Unit Code:</span>
                      <strong style={{ color: '#0f172a' }}>{selectedItem.bloodUnit?.unitCode}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Blood Group:</span>
                      <span
                        style={{
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '3px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        {selectedItem.bloodUnit?.bloodGroup}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Component / Volume:</span>
                      <span style={{ color: '#334155' }}>
                        {selectedItem.bloodUnit?.componentType || 'WHOLE_BLOOD'} &bull; {selectedItem.bloodUnit?.volume || 450} mL
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Storage Location:</span>
                      <span style={{ color: '#334155' }}>
                        {selectedItem.bloodUnit?.storageLocation || 'Unassigned'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Collection Date:</span>
                      <span style={{ color: '#334155' }}>
                        {selectedItem.bloodUnit?.collectionDate
                          ? new Date(selectedItem.bloodUnit.collectionDate).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Expiry Date:</span>
                      <strong
                        style={{
                          color:
                            selectedItem.isExpired
                              ? '#dc2626'
                              : selectedItem.isExpiringSoon
                              ? '#b45309'
                              : '#334155',
                        }}
                      >
                        {selectedItem.bloodUnit?.expiryDate
                          ? new Date(selectedItem.bloodUnit.expiryDate).toLocaleDateString()
                          : 'None'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Card 3: Source Donation */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                      📋 Source Donation
                    </strong>
                    {selectedItem.donation?.donationCode && (
                      <Link
                        href={`/admin/donations?search=${encodeURIComponent(selectedItem.donation.donationCode)}`}
                        style={{
                          fontSize: '0.72rem',
                          color: '#2563eb',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        View in Donations &rarr;
                      </Link>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Donation Code:</span>
                      <strong style={{ color: '#0f172a' }}>{selectedItem.donation?.donationCode || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Donation Date:</span>
                      <span style={{ color: '#334155' }}>
                        {selectedItem.donation?.donationDate
                          ? new Date(selectedItem.donation.donationDate).toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Type & Status:</span>
                      <span style={{ color: '#334155' }}>
                        {selectedItem.donation?.donationType || 'WHOLE_BLOOD'} &bull; {selectedItem.donation?.status || 'COMPLETED'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Registered Donor */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                      👤 Registered Donor
                    </strong>
                    {selectedItem.donor?.donorCode && (
                      <Link
                        href={`/admin/donors?search=${encodeURIComponent(selectedItem.donor.donorCode)}`}
                        style={{
                          fontSize: '0.72rem',
                          color: '#2563eb',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        View Donor Profile &rarr;
                      </Link>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Donor Code:</span>
                      <strong style={{ color: '#0f172a' }}>{selectedItem.donor?.donorCode || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Blood Group:</span>
                      <span style={{ color: '#334155', fontWeight: 600 }}>{selectedItem.donor?.bloodGroup || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Card 5: Laboratory Safety Testing Clearance */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                      🔬 Laboratory Clearance
                    </strong>
                    {selectedItem.bloodUnit?._id && (
                      <Link
                        href={`/admin/testing?bloodUnitId=${encodeURIComponent(selectedItem.bloodUnit._id)}`}
                        style={{
                          fontSize: '0.72rem',
                          color: '#2563eb',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        Open Testing Session &rarr;
                      </Link>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Testing Code:</span>
                      <strong style={{ color: '#0f172a' }}>{selectedItem.testing?.testingCode || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Laboratory Decision:</span>
                      <span style={{ color: '#166534', fontWeight: 700 }}>
                        ✓ {selectedItem.testing?.decision || 'APPROVED'}
                      </span>
                    </div>
                    {selectedItem.testing?.completedAt && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Clearance Finalized:</span>
                        <span style={{ color: '#334155' }}>
                          {new Date(selectedItem.testing.completedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 6: Audit & Lifecycle History */}
                {selectedItem.history && selectedItem.history.length > 0 && (
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>
                      📜 Lifecycle Audit History ({selectedItem.history.length})
                    </strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {selectedItem.history.map((h, idx) => (
                        <div
                          key={h._id || idx}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            padding: '0.45rem 0.6rem',
                            fontSize: '0.75rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>
                              {h.fromStatus ? `${h.fromStatus} → ` : 'NEW → '}
                              <span
                                style={{
                                  color:
                                    h.toStatus === InventoryStatus.AVAILABLE
                                      ? '#166534'
                                      : h.toStatus === InventoryStatus.EXPIRED
                                      ? '#dc2626'
                                      : '#475569',
                                }}
                              >
                                {h.toStatus}
                              </span>
                            </span>
                            <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                              {new Date(h.changedAt).toLocaleString()}
                            </span>
                          </div>
                          {h.reason && (
                            <div style={{ color: '#475569', marginTop: '0.2rem', fontStyle: 'italic' }}>
                              &ldquo;{h.reason}&rdquo;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Discard Confirmation Modal */}
      {discardModalItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#991b1b', fontWeight: 700 }}>
                Discard Inventory Unit
              </h3>
              <button
                onClick={closeDiscardModal}
                disabled={discardSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#475569' }}>
              You are about to discard blood unit{' '}
              <strong style={{ color: '#0f172a' }}>{discardModalItem.bloodUnit?.unitCode}</strong>{' '}
              ({discardModalItem.bloodUnit?.bloodGroup}). This action will mark the inventory unit as{' '}
              <strong style={{ color: '#991b1b' }}>DISCARDED</strong> and prevent it from being allocated.
            </p>

            {discardError && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.8rem',
                }}
              >
                {discardError}
              </div>
            )}

            <form onSubmit={handleSubmitDiscard}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Mandatory Discard Reason:
                </label>
                <textarea
                  required
                  rows={3}
                  value={discardReason}
                  onChange={(e) => setDiscardReason(e.target.value)}
                  placeholder="e.g., Physical unit passed expiration date, visual contamination, hemolysis observed, broken container seal..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={closeDiscardModal}
                  disabled={discardSubmitting}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={discardSubmitting || !discardReason.trim()}
                  style={{
                    padding: '0.5rem 1.15rem',
                    backgroundColor: discardSubmitting || !discardReason.trim() ? '#fca5a5' : '#dc2626',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: discardSubmitting || !discardReason.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {discardSubmitting ? 'Discarding...' : 'Confirm Discard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
