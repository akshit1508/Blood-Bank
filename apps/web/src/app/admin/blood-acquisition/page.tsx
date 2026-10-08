'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ExternalSourceType,
  EXTERNAL_SOURCE_TYPE_LABELS,
  BloodAcquisitionReceipt,
  BloodAcquisitionDetail,
  AcquiredUnitTraceability,
  AcquisitionSummaryStats,
  CreateBloodAcquisitionInput,
  BloodAcquisitionItemInput,
  createBloodAcquisition,
  fetchBloodAcquisitions,
  fetchBloodAcquisitionById,
  fetchBloodAcquisitionUnits,
  fetchBloodAcquisitionSummary,
} from '@/lib/blood-acquisition-api';
import { BloodGroup } from '@/lib/donor-api';
import { BloodUnitComponent } from '@/lib/blood-unit-api';
import StatCard from '@/components/admin/StatCard';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { TableSkeleton } from '@/components/admin/LoadingSkeleton';

const ALL_BLOOD_GROUPS = [
  BloodGroup.A_POSITIVE,
  BloodGroup.A_NEGATIVE,
  BloodGroup.B_POSITIVE,
  BloodGroup.B_NEGATIVE,
  BloodGroup.AB_POSITIVE,
  BloodGroup.AB_NEGATIVE,
  BloodGroup.O_POSITIVE,
  BloodGroup.O_NEGATIVE,
];

const ALL_COMPONENTS = [
  { value: 'WHOLE_BLOOD', label: 'Whole Blood' },
  { value: 'PRBC', label: 'Packed Red Blood Cells (PRBC)' },
  { value: 'FFP', label: 'Fresh Frozen Plasma (FFP)' },
  { value: 'PLATELETS', label: 'Platelets' },
];

export default function AdminBloodAcquisitionPage() {
  const [receipts, setReceipts] = useState<BloodAcquisitionReceipt[]>([]);
  const [stats, setStats] = useState<AcquisitionSummaryStats>({
    totalReceipts: 0,
    totalUnitsReceived: 0,
    directToInventory: 0,
    pendingTesting: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal: New Receipt
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdSuccess, setCreatedSuccess] = useState<any | null>(null);

  // Form State
  const [formSourceType, setFormSourceType] = useState<ExternalSourceType>(
    ExternalSourceType.BLOOD_BANK,
  );
  const [formSourceName, setFormSourceName] = useState('');
  const [formReferenceNumber, setFormReferenceNumber] = useState('');
  const [formReceivedDate, setFormReceivedDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState<BloodAcquisitionItemInput[]>([
    {
      bloodGroup: BloodGroup.A_POSITIVE,
      componentType: 'PRBC',
      quantity: 10,
      testingRequired: false,
      volumePerUnit: 450,
      storageLocation: '',
      itemNotes: '',
    },
  ]);

  // Drawer: Selected Receipt Details
  const [selectedReceipt, setSelectedReceipt] =
    useState<BloodAcquisitionDetail | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<
    AcquiredUnitTraceability[]
  >([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Load List & Stats
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, statsRes] = await Promise.all([
        fetchBloodAcquisitions({
          sourceType: sourceFilter || undefined,
          status: statusFilter || undefined,
          search: searchTerm || undefined,
          page,
          limit: 10,
        }),
        fetchBloodAcquisitionSummary(),
      ]);

      setReceipts(listRes.items);
      setTotalPages(listRes.totalPages);
      setTotalCount(listRes.total);
      setStats(statsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load blood acquisitions.');
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, statusFilter, searchTerm, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Form Item changes
  const handleAddItem = () => {
    setFormItems((prev) => [
      ...prev,
      {
        bloodGroup: BloodGroup.O_POSITIVE,
        componentType: 'PRBC',
        quantity: 5,
        testingRequired: true,
        volumePerUnit: 450,
        storageLocation: '',
        itemNotes: '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof BloodAcquisitionItemInput,
    value: any,
  ) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Open Drawer & Fetch Units
  const handleOpenReceiptDetail = async (receiptId: string) => {
    setDrawerLoading(true);
    try {
      const [detail, units] = await Promise.all([
        fetchBloodAcquisitionById(receiptId),
        fetchBloodAcquisitionUnits(receiptId),
      ]);
      setSelectedReceipt(detail);
      setSelectedUnits(units);
    } catch (err: any) {
      alert(err.message || 'Failed to load receipt details');
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelectedReceipt(null);
    setSelectedUnits([]);
  };

  // Submit Handler
  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formSourceName.trim()) {
      setSubmitError('Source name is required.');
      return;
    }
    if (!formReceivedDate) {
      setSubmitError('Received date is required.');
      return;
    }

    for (let i = 0; i < formItems.length; i++) {
      const item = formItems[i];
      if (!item.quantity || item.quantity < 1) {
        setSubmitError(`Row ${i + 1}: Quantity must be at least 1 unit.`);
        return;
      }
    }

    setShowConfirmStep(true);
  };

  const handleExecuteCreate = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const payload: CreateBloodAcquisitionInput = {
      sourceType: formSourceType,
      sourceName: formSourceName.trim(),
      referenceNumber: formReferenceNumber.trim() || undefined,
      receivedDate: new Date(formReceivedDate).toISOString(),
      notes: formNotes.trim() || undefined,
      items: formItems.map((it) => ({
        bloodGroup: it.bloodGroup,
        componentType: it.componentType,
        quantity: Number(it.quantity),
        testingRequired: Boolean(it.testingRequired),
        volumePerUnit: it.volumePerUnit ? Number(it.volumePerUnit) : 450,
        expiryDate: it.expiryDate
          ? new Date(it.expiryDate).toISOString()
          : undefined,
        storageLocation: it.storageLocation?.trim() || undefined,
        itemNotes: it.itemNotes?.trim() || undefined,
      })),
    };

    try {
      const res = await createBloodAcquisition(payload);
      setCreatedSuccess(res);
      setShowConfirmStep(false);
      await loadData();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create blood acquisition.');
      setShowConfirmStep(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setFormSourceType(ExternalSourceType.BLOOD_BANK);
    setFormSourceName('');
    setFormReferenceNumber('');
    setFormReceivedDate(new Date().toISOString().slice(0, 10));
    setFormNotes('');
    setFormItems([
      {
        bloodGroup: BloodGroup.A_POSITIVE,
        componentType: 'PRBC',
        quantity: 10,
        testingRequired: false,
        volumePerUnit: 450,
        storageLocation: '',
        itemNotes: '',
      },
    ]);
    setShowCreateModal(false);
    setShowConfirmStep(false);
    setSubmitError(null);
    setCreatedSuccess(null);
  };

  const totalUnitsToCreate = formItems.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0),
    0,
  );

  return (
    <div
      style={{
        maxWidth: '100%',
        margin: '0 auto',
        padding: '0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '1rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            Blood Acquisition
          </h1>
          <p
            style={{
              margin: '0.25rem 0 0 0',
              color: '#64748b',
              fontSize: '0.9rem',
            }}
          >
            Receive and register bulk blood received from external hospitals,
            blood banks, and authorized centres.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              setPage(1);
              loadData();
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
            ↻ Refresh Roster
          </button>
          <button
            onClick={() => {
              setCreatedSuccess(null);
              setSubmitError(null);
              setShowCreateModal(true);
            }}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1.15rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
            }}
          >
            + New Blood Receipt
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <StatCard
          title="Total Receipts"
          value={stats.totalReceipts}
          subtitle="External acquisition events"
          accentColor="#0284c7"
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0284c7"
              strokeWidth="2"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
        />
        <StatCard
          title="Units Received"
          value={stats.totalUnitsReceived}
          subtitle="Total individual blood units"
          accentColor="#dc2626"
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2"
            >
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          }
        />
        <StatCard
          title="Direct To Inventory"
          value={stats.directToInventory}
          subtitle="Pre-cleared source units"
          accentColor="#16a34a"
          badge="Active Stock"
          badgeType="success"
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
        />
        <StatCard
          title="Pending Testing"
          value={stats.pendingTesting}
          subtitle="Awaiting lab clearance gate"
          accentColor="#d97706"
          badge={stats.pendingTesting > 0 ? 'Requires Action' : undefined}
          badgeType="warning"
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d97706"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
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
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            flex: 1,
            minWidth: '280px',
          }}
        >
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Receipt Code, Source Name, Reference No..."
            style={{
              flex: 1,
              padding: '0.45rem 0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Source Type Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              backgroundColor: '#fff',
            }}
          >
            <option value="">All Source Types</option>
            {Object.entries(EXTERNAL_SOURCE_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              backgroundColor: '#fff',
            }}
          >
            <option value="">All Statuses</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
      </div>

      {/* Receipts Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {loading ? (
          <div style={{ padding: '2rem' }}>
            <TableSkeleton rows={5} />
          </div>
        ) : error ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#dc2626',
            }}
          >
            {error}
          </div>
        ) : receipts.length === 0 ? (
          <div style={{ padding: '3rem 1rem' }}>
            <EmptyState
              title="No Blood Acquisitions Found"
              description="No external blood receipts have been recorded yet. Click '+ New Blood Receipt' to record your first bulk acquisition from a hospital or blood bank."
              actionText="+ New Blood Receipt"
              onAction={() => setShowCreateModal(true)}
            />
          </div>
        ) : (
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
                    backgroundColor: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    color: '#475569',
                    fontWeight: 600,
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem' }}>Receipt Code</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Source</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reference No</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Received Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Units</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((rcpt) => {
                  const sourceLabel =
                    EXTERNAL_SOURCE_TYPE_LABELS[rcpt.sourceType] ||
                    rcpt.sourceType;
                  const receivedDateFormatted = new Date(
                    rcpt.receivedDate,
                  ).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr
                      key={rcpt._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          fontWeight: 700,
                          color: '#0f172a',
                        }}
                      >
                        {rcpt.receiptCode}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: '#0f172a',
                          }}
                        >
                          {rcpt.sourceName}
                        </div>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: '#64748b',
                            display: 'inline-block',
                            backgroundColor: '#f1f5f9',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            marginTop: '2px',
                          }}
                        >
                          {sourceLabel}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          color: '#475569',
                        }}
                      >
                        {rcpt.referenceNumber || '—'}
                      </td>
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          color: '#334155',
                        }}
                      >
                        {receivedDateFormatted}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: '#0f172a',
                            fontSize: '0.95rem',
                          }}
                        >
                          {rcpt.totalUnitsGenerated} units
                        </span>
                        {rcpt.unitsSummary && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: '#64748b',
                              marginTop: '2px',
                            }}
                          >
                            {rcpt.unitsSummary.approved > 0 && (
                              <span style={{ color: '#16a34a' }}>
                                {rcpt.unitsSummary.approved} Approved{' '}
                              </span>
                            )}
                            {rcpt.unitsSummary.testing > 0 && (
                              <span style={{ color: '#d97706' }}>
                                • {rcpt.unitsSummary.testing} Testing
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <StatusBadge
                          status={rcpt.status}
                          size="sm"
                        />
                      </td>
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          textAlign: 'right',
                        }}
                      >
                        <button
                          onClick={() => handleOpenReceiptDetail(rcpt._id)}
                          style={{
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#0f172a',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '5px',
                            fontSize: '0.775rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          View Details &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {receipts.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              fontSize: '0.85rem',
              color: '#64748b',
            }}
          >
            <div>
              Total <strong>{totalCount}</strong> receipts recorded
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '0.3rem 0.6rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  backgroundColor: page <= 1 ? '#f1f5f9' : '#fff',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                &larr; Prev
              </button>
              <span style={{ padding: '0.3rem 0.6rem' }}>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '0.3rem 0.6rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  backgroundColor: page >= totalPages ? '#f1f5f9' : '#fff',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE MODAL / DRAWER */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #e2e8f0',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  {createdSuccess
                    ? 'Receipt Created Successfully'
                    : showConfirmStep
                      ? 'Confirm Bulk Blood Receipt'
                      : 'Record External Blood Acquisition'}
                </h2>
                <p
                  style={{
                    margin: '0.2rem 0 0 0',
                    color: '#64748b',
                    fontSize: '0.85rem',
                  }}
                >
                  {createdSuccess
                    ? 'Traceable Blood Units have been generated.'
                    : showConfirmStep
                      ? 'Review the acquisition details before creating individual Blood Unit records.'
                      : 'Register bulk physical units acquired from an external blood bank or hospital.'}
                </p>
              </div>
              <button
                onClick={handleResetForm}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem' }}>
              {createdSuccess ? (
                /* Success View */
                <div>
                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <span
                        style={{
                          backgroundColor: '#16a34a',
                          color: '#fff',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                        }}
                      >
                        ✓
                      </span>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.1rem',
                          color: '#166534',
                        }}
                      >
                        Receipt Registered: {createdSuccess.receipt.receiptCode}
                      </h3>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        color: '#15803d',
                      }}
                    >
                      Source: <strong>{createdSuccess.receipt.sourceName}</strong>
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '1rem',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <div
                      style={{
                        padding: '1rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '1.5rem',
                          fontWeight: 800,
                          color: '#0f172a',
                        }}
                      >
                        {createdSuccess.totalUnitsCreated}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Total Units Created
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '1rem',
                        backgroundColor: '#f0fdf4',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '1.5rem',
                          fontWeight: 800,
                          color: '#16a34a',
                        }}
                      >
                        {createdSuccess.directInventoryCount}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#166534' }}>
                        Direct to Inventory (Available)
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '1rem',
                        backgroundColor: '#fffbeb',
                        borderRadius: '8px',
                        border: '1px solid #fde68a',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '1.5rem',
                          fontWeight: 800,
                          color: '#d97706',
                        }}
                      >
                        {createdSuccess.pendingTestingCount}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                        Queued for Testing
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.75rem',
                    }}
                  >
                    <button
                      onClick={handleResetForm}
                      style={{
                        backgroundColor: '#0f172a',
                        color: '#fff',
                        padding: '0.5rem 1.25rem',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Done & Close
                    </button>
                  </div>
                </div>
              ) : showConfirmStep ? (
                /* Confirmation Review View */
                <div>
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '1rem',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '0.75rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div>
                        <span style={{ color: '#64748b' }}>Source: </span>
                        <strong>{formSourceName}</strong> (
                        {EXTERNAL_SOURCE_TYPE_LABELS[formSourceType]})
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Reference No: </span>
                        <strong>{formReferenceNumber || 'None'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Received Date: </span>
                        <strong>{formReceivedDate}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Total Units: </span>
                        <strong style={{ color: '#dc2626' }}>
                          {totalUnitsToCreate} Units
                        </strong>
                      </div>
                    </div>
                  </div>

                  <h4
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.9rem',
                      color: '#0f172a',
                    }}
                  >
                    Blood Breakdown to be generated:
                  </h4>
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.85rem',
                      }}
                    >
                      <thead style={{ backgroundColor: '#f1f5f9' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Group</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Component</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Quantity</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Workflow</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formItems.map((it, idx) => (
                          <tr
                            key={idx}
                            style={{ borderTop: '1px solid #f1f5f9' }}
                          >
                            <td
                              style={{
                                padding: '0.5rem 0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              {it.bloodGroup}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {it.componentType}
                            </td>
                            <td
                              style={{
                                padding: '0.5rem 0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              {it.quantity} units
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {it.testingRequired ? (
                                <span
                                  style={{
                                    color: '#d97706',
                                    fontWeight: 600,
                                  }}
                                >
                                  Queued for Testing
                                </span>
                              ) : (
                                <span
                                  style={{
                                    color: '#16a34a',
                                    fontWeight: 600,
                                  }}
                                >
                                  Direct to Inventory (Available)
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {submitError && (
                    <div
                      style={{
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      {submitError}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.75rem',
                    }}
                  >
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setShowConfirmStep(false)}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Back to Edit
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleExecuteCreate}
                      style={{
                        backgroundColor: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.5rem 1.25rem',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isSubmitting
                        ? 'Creating Units...'
                        : `Confirm Receipt (${totalUnitsToCreate} Units)`}
                    </button>
                  </div>
                </div>
              ) : (
                /* Main Receipt Entry Form */
                <form onSubmit={handleOpenConfirm}>
                  {/* Section 1: Source Info */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3
                      style={{
                        margin: '0 0 0.75rem 0',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        borderBottom: '1px solid #f1f5f9',
                        paddingBottom: '0.4rem',
                      }}
                    >
                      1. Source Information
                    </h3>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#334155',
                            marginBottom: '0.25rem',
                          }}
                        >
                          Source Type *
                        </label>
                        <select
                          value={formSourceType}
                          onChange={(e) =>
                            setFormSourceType(
                              e.target.value as ExternalSourceType,
                            )
                          }
                          required
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                          }}
                        >
                          {Object.entries(EXTERNAL_SOURCE_TYPE_LABELS).map(
                            ([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#334155',
                            marginBottom: '0.25rem',
                          }}
                        >
                          Source Name *
                        </label>
                        <input
                          type="text"
                          value={formSourceName}
                          onChange={(e) => setFormSourceName(e.target.value)}
                          placeholder="e.g. Apollo Hospital Blood Bank"
                          required
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#334155',
                            marginBottom: '0.25rem',
                          }}
                        >
                          Reference / Batch No
                        </label>
                        <input
                          type="text"
                          value={formReferenceNumber}
                          onChange={(e) =>
                            setFormReferenceNumber(e.target.value)
                          }
                          placeholder="e.g. REF-2026-X81"
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#334155',
                            marginBottom: '0.25rem',
                          }}
                        >
                          Received Date *
                        </label>
                        <input
                          type="date"
                          value={formReceivedDate}
                          onChange={(e) => setFormReceivedDate(e.target.value)}
                          required
                          max={new Date().toISOString().slice(0, 10)}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: '#334155',
                          marginBottom: '0.25rem',
                        }}
                      >
                        Notes / Consignment Details
                      </label>
                      <input
                        type="text"
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        placeholder="Transport vehicle, temperature bag, contact info..."
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.875rem',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* Section 2: Blood Details Table */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.75rem',
                        borderBottom: '1px solid #f1f5f9',
                        paddingBottom: '0.4rem',
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: '#0f172a',
                        }}
                      >
                        2. Blood Entries ({formItems.length})
                      </h3>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        style={{
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#0f172a',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '5px',
                          fontSize: '0.775rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        + Add Blood Entry
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {formItems.map((item, index) => (
                        <div
                          key={index}
                          style={{
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '0.85rem',
                            display: 'grid',
                            gridTemplateColumns:
                              '120px 180px 100px 140px 1fr 40px',
                            gap: '0.75rem',
                            alignItems: 'center',
                          }}
                        >
                          {/* Blood Group */}
                          <div>
                            <label
                              style={{
                                fontSize: '0.75rem',
                                color: '#64748b',
                                display: 'block',
                                marginBottom: '2px',
                              }}
                            >
                              Group
                            </label>
                            <select
                              value={item.bloodGroup}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  'bloodGroup',
                                  e.target.value,
                                )
                              }
                              style={{
                                width: '100%',
                                padding: '0.35rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                fontWeight: 700,
                              }}
                            >
                              {ALL_BLOOD_GROUPS.map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Component */}
                          <div>
                            <label
                              style={{
                                fontSize: '0.75rem',
                                color: '#64748b',
                                display: 'block',
                                marginBottom: '2px',
                              }}
                            >
                              Component
                            </label>
                            <select
                              value={item.componentType}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  'componentType',
                                  e.target.value,
                                )
                              }
                              style={{
                                width: '100%',
                                padding: '0.35rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                              }}
                            >
                              {ALL_COMPONENTS.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div>
                            <label
                              style={{
                                fontSize: '0.75rem',
                                color: '#64748b',
                                display: 'block',
                                marginBottom: '2px',
                              }}
                            >
                              Quantity
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  'quantity',
                                  Number(e.target.value),
                                )
                              }
                              required
                              style={{
                                width: '100%',
                                padding: '0.35rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                fontWeight: 600,
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>

                          {/* Testing Required */}
                          <div>
                            <label
                              style={{
                                fontSize: '0.75rem',
                                color: '#64748b',
                                display: 'block',
                                marginBottom: '2px',
                              }}
                            >
                              Testing Required?
                            </label>
                            <select
                              value={item.testingRequired ? 'yes' : 'no'}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  'testingRequired',
                                  e.target.value === 'yes',
                                )
                              }
                              style={{
                                width: '100%',
                                padding: '0.35rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                color: item.testingRequired
                                  ? '#d97706'
                                  : '#16a34a',
                                fontWeight: 600,
                              }}
                            >
                              <option value="no">No (Direct Stock)</option>
                              <option value="yes">Yes (Queue Testing)</option>
                            </select>
                          </div>

                          {/* Location / Note */}
                          <div>
                            <label
                              style={{
                                fontSize: '0.75rem',
                                color: '#64748b',
                                display: 'block',
                                marginBottom: '2px',
                              }}
                            >
                              Storage Location (optional)
                            </label>
                            <input
                              type="text"
                              value={item.storageLocation || ''}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  'storageLocation',
                                  e.target.value,
                                )
                              }
                              placeholder="e.g. Fridge A-2"
                              style={{
                                width: '100%',
                                padding: '0.35rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>

                          {/* Delete Row button */}
                          <div style={{ textAlign: 'center', paddingTop: '16px' }}>
                            <button
                              type="button"
                              disabled={formItems.length === 1}
                              onClick={() => handleRemoveItem(index)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: formItems.length === 1 ? '#cbd5e1' : '#dc2626',
                                cursor: formItems.length === 1 ? 'not-allowed' : 'pointer',
                                fontSize: '1.25rem',
                              }}
                            >
                              &times;
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {submitError && (
                    <div
                      style={{
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      {submitError}
                    </div>
                  )}

                  {/* Actions */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.875rem', color: '#475569' }}>
                      Total Units to generate:{' '}
                      <strong style={{ color: '#0f172a' }}>
                        {totalUnitsToCreate} Units
                      </strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={handleResetForm}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        style={{
                          backgroundColor: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.5rem 1.25rem',
                          borderRadius: '6px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
                        }}
                      >
                        Review & Confirm Receipt &rarr;
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER / MODAL */}
      {selectedReceipt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              width: '100%',
              maxWidth: '650px',
              height: '100%',
              overflowY: 'auto',
              boxShadow: '-4px 0 15px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#0f172a',
                    }}
                  >
                    {selectedReceipt.receiptCode}
                  </h2>
                  <StatusBadge
                    status={selectedReceipt.status}
                    size="sm"
                  />
                </div>
                <p
                  style={{
                    margin: '0.2rem 0 0 0',
                    color: '#64748b',
                    fontSize: '0.85rem',
                  }}
                >
                  Acquisition Traceability &bull; {selectedReceipt.sourceName}
                </p>
              </div>
              <button
                onClick={closeDrawer}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ padding: '1.5rem', flex: 1 }}>
              {/* Receipt Information Grid */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <span style={{ color: '#64748b' }}>Source Type: </span>
                  <strong>
                    {EXTERNAL_SOURCE_TYPE_LABELS[selectedReceipt.sourceType]}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Reference No: </span>
                  <strong>{selectedReceipt.referenceNumber || 'None'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Received Date: </span>
                  <strong>
                    {new Date(selectedReceipt.receivedDate).toLocaleDateString()}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Total Units: </span>
                  <strong>{selectedReceipt.totalUnitsGenerated} units</strong>
                </div>
                {selectedReceipt.notes && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748b' }}>Notes: </span>
                    <span>{selectedReceipt.notes}</span>
                  </div>
                )}
              </div>

              {/* Status Summary Banner */}
              {selectedReceipt.stats && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: '#16a34a',
                      }}
                    >
                      {selectedReceipt.stats.approved}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#166534' }}>
                      Approved
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: '#d97706',
                      }}
                    >
                      {selectedReceipt.stats.testing}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                      Testing
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: '#0284c7',
                      }}
                    >
                      {selectedReceipt.stats.inInventory}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#0369a1' }}>
                      In Inventory
                    </div>
                  </div>
                </div>
              )}

              {/* Individual Units Traceability List */}
              <h3
                style={{
                  margin: '0 0 0.75rem 0',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                Individual Traceable Blood Units ({selectedUnits.length})
              </h3>

              {drawerLoading ? (
                <TableSkeleton rows={4} />
              ) : selectedUnits.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  No units found for this receipt.
                </div>
              ) : (
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.825rem',
                    }}
                  >
                    <thead style={{ backgroundColor: '#f8fafc' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>
                          Unit Code
                        </th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>
                          Group / Type
                        </th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>
                          Unit Status
                        </th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>
                          Testing / Stock
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUnits.map((u) => (
                        <tr
                          key={u._id}
                          style={{ borderTop: '1px solid #f1f5f9' }}
                        >
                          <td
                            style={{
                              padding: '0.5rem 0.75rem',
                              fontWeight: 700,
                              color: '#0f172a',
                            }}
                          >
                            {u.unitCode}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <span style={{ fontWeight: 700, color: '#dc2626' }}>
                              {u.bloodGroup}
                            </span>{' '}
                            <span style={{ color: '#64748b' }}>
                              {u.componentType}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <StatusBadge
                              status={u.status}
                              size="sm"
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {u.status === 'TESTING' ? (
                              <Link
                                href="/admin/testing"
                                style={{
                                  color: '#d97706',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                }}
                              >
                                &rarr; Lab Testing
                              </Link>
                            ) : u.inventory ? (
                              <Link
                                href="/admin/inventory"
                                style={{
                                  color: '#16a34a',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                }}
                              >
                                &bull; In Inventory ({u.inventory.status})
                              </Link>
                            ) : (
                              <span style={{ color: '#64748b' }}>Approved</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={closeDrawer}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  border: 'none',
                  padding: '0.45rem 1rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
