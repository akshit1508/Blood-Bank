'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  RecordAcquisitionAdjustmentInput,
  createBloodAcquisition,
  fetchBloodAcquisitions,
  fetchBloodAcquisitionById,
  fetchBloodAcquisitionUnits,
  fetchBloodAcquisitionSummary,
  recordAcquisitionAdjustment,
  uploadAcquisitionInvoice,
  uploadAcquisitionCertificate,
} from '@/lib/blood-acquisition-api';
import { fetchActiveVendorOptions, ActiveVendorOption } from '@/lib/vendor-api';
import { BloodGroup } from '@/lib/donor-api';
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
  const [vendors, setVendors] = useState<ActiveVendorOption[]>([]);
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
  const [formVendorId, setFormVendorId] = useState('');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formReferenceNumber, setFormReferenceNumber] = useState('');
  const [formReceivedDate, setFormReceivedDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [formTransportCharges, setFormTransportCharges] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');
  const [formReconciliationNotes, setFormReconciliationNotes] = useState('');
  const [formClearanceCertNo, setFormClearanceCertNo] = useState('');
  const [formSourceTestingCertified, setFormSourceTestingCertified] = useState(false);
  const [formInvoiceFile, setFormInvoiceFile] = useState<File | null>(null);
  const [formCertificateFile, setFormCertificateFile] = useState<File | null>(null);

  const [formItems, setFormItems] = useState<BloodAcquisitionItemInput[]>([
    {
      bloodGroup: BloodGroup.A_POSITIVE,
      componentType: 'PRBC',
      invoicedQuantity: 10,
      receivedQuantity: 10,
      acceptedQuantity: 10,
      rejectedQuantity: 0,
      pendingInspectionQuantity: 0,
      unitCost: 1200,
      testingRequired: true,
      volumePerUnit: 450,
      storageLocation: '',
      rejectionReason: '',
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

  // Modal: Record Adjustment / Credit Note
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjType, setAdjType] = useState<'CREDIT_NOTE' | 'SUPPLIER_REFUND'>('CREDIT_NOTE');
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjReference, setAdjReference] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjNotes, setAdjNotes] = useState('');
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);

  // Load List & Stats
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, statsRes, vendorOptions] = await Promise.all([
        fetchBloodAcquisitions({
          sourceType: sourceFilter || undefined,
          status: statusFilter || undefined,
          search: searchTerm || undefined,
          page,
          limit: 10,
        }),
        fetchBloodAcquisitionSummary(),
        fetchActiveVendorOptions().catch(() => []),
      ]);

      setReceipts(listRes.items);
      setTotalPages(listRes.totalPages);
      setTotalCount(listRes.total);
      setStats(statsRes);
      setVendors(vendorOptions);
    } catch (err: any) {
      setError(err.message || 'Failed to load blood acquisitions.');
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, statusFilter, searchTerm, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Form Item Management
  const handleAddItem = () => {
    setFormItems((prev) => [
      ...prev,
      {
        bloodGroup: BloodGroup.O_POSITIVE,
        componentType: 'PRBC',
        invoicedQuantity: 5,
        receivedQuantity: 5,
        acceptedQuantity: 5,
        rejectedQuantity: 0,
        pendingInspectionQuantity: 0,
        unitCost: 1200,
        testingRequired: true,
        volumePerUnit: 450,
        storageLocation: '',
        rejectionReason: '',
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
      const current = { ...updated[index], [field]: value };

      // Auto-balance if user updates receivedQuantity
      if (field === 'receivedQuantity') {
        const rec = Number(value) || 0;
        const rej = Number(current.rejectedQuantity) || 0;
        current.acceptedQuantity = Math.max(0, rec - rej);
      } else if (field === 'rejectedQuantity') {
        const rej = Number(value) || 0;
        const rec = Number(current.receivedQuantity) || 0;
        current.acceptedQuantity = Math.max(0, rec - rej);
      }

      updated[index] = current;
      return updated;
    });
  };

  // Calculations for Form
  const formCalculations = useMemo(() => {
    let invoicedUnits = 0;
    let receivedUnits = 0;
    let acceptedUnits = 0;
    let rejectedUnits = 0;
    let totalAcquisitionCost = 0;
    let hasDiscrepancy = false;
    let anyDirectIntake = false;

    for (const it of formItems) {
      const inv = Number(it.invoicedQuantity) || 0;
      const rec = Number(it.receivedQuantity) || 0;
      const acc = Number(it.acceptedQuantity) || 0;
      const rej = Number(it.rejectedQuantity) || 0;
      const cost = Number(it.unitCost) || 0;

      invoicedUnits += inv;
      receivedUnits += rec;
      acceptedUnits += acc;
      rejectedUnits += rej;
      totalAcquisitionCost += inv * cost;

      if (inv !== rec || rej > 0) {
        hasDiscrepancy = true;
      }
      if (!it.testingRequired) {
        anyDirectIntake = true;
      }
    }

    const transport = Number(formTransportCharges) || 0;
    const totalPayable = totalAcquisitionCost + transport;

    return {
      invoicedUnits,
      receivedUnits,
      acceptedUnits,
      rejectedUnits,
      totalAcquisitionCost,
      transport,
      totalPayable,
      hasDiscrepancy,
      anyDirectIntake,
    };
  }, [formItems, formTransportCharges]);

  // Open Drawer & Fetch Details
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
    setShowAdjustmentModal(false);
  };

  // Validation before Confirmation Step
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

    // Inspect each item row invariants
    for (let i = 0; i < formItems.length; i++) {
      const item = formItems[i];
      const inv = Number(item.invoicedQuantity) || 0;
      const rec = Number(item.receivedQuantity) || 0;
      const acc = Number(item.acceptedQuantity) || 0;
      const rej = Number(item.rejectedQuantity) || 0;

      if (inv < 1) {
        setSubmitError(`Row ${i + 1}: Invoiced quantity must be at least 1.`);
        return;
      }
      if (rec < 0 || acc < 0 || rej < 0) {
        setSubmitError(`Row ${i + 1}: Quantities cannot be negative.`);
        return;
      }
      if (rec !== acc + rej) {
        setSubmitError(
          `Row ${i + 1}: Received (${rec}) must equal Accepted (${acc}) + Rejected (${rej}).`,
        );
        return;
      }
      if (rej > 0 && (!item.rejectionReason || !item.rejectionReason.trim())) {
        setSubmitError(
          `Row ${i + 1}: Rejection reason is mandatory since ${rej} unit(s) were rejected.`,
        );
        return;
      }
    }

    if (
      formCalculations.hasDiscrepancy &&
      (!formReconciliationNotes || !formReconciliationNotes.trim())
    ) {
      setSubmitError(
        'Discrepancy detected between invoiced and accepted units. Reconciliation notes are mandatory.',
      );
      return;
    }

    if (formCalculations.anyDirectIntake) {
      if (!formClearanceCertNo.trim()) {
        setSubmitError(
          'Direct inventory intake (testingRequired = No) requires a valid clearance certificate number.',
        );
        return;
      }
      if (!formSourceTestingCertified) {
        setSubmitError(
          'Direct inventory intake requires checking the source testing certification attestation.',
        );
        return;
      }
    }

    setShowConfirmStep(true);
  };

  // Execute Creation
  const handleExecuteCreate = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const payload: CreateBloodAcquisitionInput = {
      sourceType: formSourceType,
      sourceName: formSourceName.trim(),
      vendorId: formVendorId || undefined,
      invoiceNumber: formInvoiceNumber.trim() || undefined,
      referenceNumber: formReferenceNumber.trim() || undefined,
      receivedDate: new Date(formReceivedDate).toISOString(),
      transportCharges: Number(formTransportCharges) || 0,
      clearanceCertificateNumber: formClearanceCertNo.trim() || undefined,
      sourceTestingCertified: Boolean(formSourceTestingCertified),
      hasDiscrepancy: formCalculations.hasDiscrepancy,
      reconciliationNotes: formReconciliationNotes.trim() || undefined,
      notes: formNotes.trim() || undefined,
      items: formItems.map((it) => ({
        bloodGroup: it.bloodGroup,
        componentType: it.componentType,
        invoicedQuantity: Number(it.invoicedQuantity),
        receivedQuantity: Number(it.receivedQuantity),
        acceptedQuantity: Number(it.acceptedQuantity),
        rejectedQuantity: Number(it.rejectedQuantity) || 0,
        pendingInspectionQuantity: 0,
        unitCost: Number(it.unitCost) || 0,
        testingRequired: Boolean(it.testingRequired),
        volumePerUnit: it.volumePerUnit ? Number(it.volumePerUnit) : 450,
        expiryDate: it.expiryDate
          ? new Date(it.expiryDate).toISOString()
          : undefined,
        storageLocation: it.storageLocation?.trim() || undefined,
        rejectionReason: it.rejectionReason?.trim() || undefined,
        itemNotes: it.itemNotes?.trim() || undefined,
      })),
    } as any;

    try {
      const res = await createBloodAcquisition(payload);

      // Upload files if provided
      if (formInvoiceFile && res.receipt?._id) {
        await uploadAcquisitionInvoice(res.receipt._id, formInvoiceFile).catch(console.error);
      }
      if (formCertificateFile && res.receipt?._id) {
        await uploadAcquisitionCertificate(res.receipt._id, formCertificateFile).catch(console.error);
      }

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
    setFormVendorId('');
    setFormInvoiceNumber('');
    setFormReferenceNumber('');
    setFormReceivedDate(new Date().toISOString().slice(0, 10));
    setFormTransportCharges(0);
    setFormNotes('');
    setFormReconciliationNotes('');
    setFormClearanceCertNo('');
    setFormSourceTestingCertified(false);
    setFormInvoiceFile(null);
    setFormCertificateFile(null);
    setFormItems([
      {
        bloodGroup: BloodGroup.A_POSITIVE,
        componentType: 'PRBC',
        invoicedQuantity: 10,
        receivedQuantity: 10,
        acceptedQuantity: 10,
        rejectedQuantity: 0,
        pendingInspectionQuantity: 0,
        unitCost: 1200,
        testingRequired: true,
        volumePerUnit: 450,
        storageLocation: '',
        rejectionReason: '',
        itemNotes: '',
      },
    ]);
    setShowCreateModal(false);
    setShowConfirmStep(false);
    setSubmitError(null);
    setCreatedSuccess(null);
  };

  // Submit Credit Note / Adjustment
  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceipt) return;
    setAdjSubmitting(true);
    setAdjError(null);

    try {
      const updated = await recordAcquisitionAdjustment(selectedReceipt._id, {
        adjustmentType: adjType,
        amount: Number(adjAmount),
        creditNoteReference: adjReference.trim(),
        reason: adjReason.trim(),
        notes: adjNotes.trim() || undefined,
      });

      setSelectedReceipt(updated);
      setShowAdjustmentModal(false);
      setAdjAmount(0);
      setAdjReference('');
      setAdjReason('');
      setAdjNotes('');
      await loadData();
    } catch (err: any) {
      setAdjError(err.message || 'Failed to record credit adjustment.');
    } finally {
      setAdjSubmitting(false);
    }
  };

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
            Blood Acquisition & Costing
          </h1>
          <p
            style={{
              margin: '0.25rem 0 0 0',
              color: '#64748b',
              fontSize: '0.9rem',
            }}
          >
            External consignment intake, medical clearance certification, and supplier payable reconciliation.
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
            + New Blood Consignment
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
          subtitle="External consignments"
          accentColor="#0284c7"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
        />
        <StatCard
          title="Units Received"
          value={stats.totalUnitsReceived}
          subtitle="Total accepted blood units"
          accentColor="#dc2626"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          }
        />
        <StatCard
          title="Direct To Inventory"
          value={stats.directToInventory}
          subtitle="Medically certified units"
          accentColor="#16a34a"
          badge="Clearance Verified"
          badgeType="success"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
        />
        <StatCard
          title="Pending Testing"
          value={stats.pendingTesting}
          subtitle="Awaiting lab quarantine gate"
          accentColor="#d97706"
          badge={stats.pendingTesting > 0 ? 'Testing Required' : undefined}
          badgeType="warning"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
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
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '280px' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Receipt Code, Supplier Name, Invoice No..."
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

      {/* Consignments Table */}
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
          <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
            {error}
          </div>
        ) : receipts.length === 0 ? (
          <div style={{ padding: '3rem 1rem' }}>
            <EmptyState
              title="No Blood Consignments Found"
              description="No external blood receipts have been recorded yet. Click '+ New Blood Consignment' to record physical intake and financial liability."
              actionText="+ New Blood Consignment"
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
                  <th style={{ padding: '0.75rem 1rem' }}>Supplier / Source</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Invoice / Ref</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Accepted Units</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Net Payable / Paid</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Payment Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Intake Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((rcpt) => {
                  const sourceLabel =
                    EXTERNAL_SOURCE_TYPE_LABELS[rcpt.sourceType] || rcpt.sourceType;
                  const fin = rcpt.financials;

                  return (
                    <tr
                      key={rcpt._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                        <div>{rcpt.receiptCode}</div>
                        {rcpt.hasDiscrepancy && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                            }}
                          >
                            Discrepancy
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
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
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                        <div>{rcpt.invoiceNumber || rcpt.referenceNumber || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(rcpt.receivedDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          {rcpt.totalUnitsGenerated} units
                        </span>
                        {rcpt.unitsSummary && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
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
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          ₹{(fin?.effectiveNetLiability ?? rcpt.totalPayable ?? 0).toLocaleString()}
                        </div>
                        {fin && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Paid: ₹{fin.paidAmount.toLocaleString()} | Due: ₹{fin.outstandingBalance.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              fin?.paymentStatus === 'PAID'
                                ? '#dcfce7'
                                : fin?.paymentStatus === 'PARTIALLY_PAID'
                                ? '#fef9c3'
                                : '#fee2e2',
                            color:
                              fin?.paymentStatus === 'PAID'
                                ? '#166534'
                                : fin?.paymentStatus === 'PARTIALLY_PAID'
                                ? '#854d0e'
                                : '#991b1b',
                          }}
                        >
                          {fin?.paymentStatus || 'UNPAID'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <StatusBadge status={rcpt.status} size="sm" />
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
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
              Total <strong>{totalCount}</strong> consignments recorded
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

      {/* CREATE MODAL */}
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
              maxWidth: '920px',
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
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  {createdSuccess
                    ? 'Consignment Registered Successfully'
                    : showConfirmStep
                    ? 'Confirm Blood Consignment & Payable Draft'
                    : 'Record External Blood Consignment'}
                </h2>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                  {createdSuccess
                    ? 'Traceable Blood Units and Expense Draft have been generated.'
                    : showConfirmStep
                    ? 'Review quantities, inspection results, and payable liability before committing.'
                    : 'Intake external units with supplier invoices, inspection quantities, and medical clearance.'}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
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
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#166534' }}>
                        Consignment Registered: {createdSuccess.receipt.receiptCode}
                      </h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#15803d' }}>
                      Supplier: <strong>{createdSuccess.receipt.sourceName}</strong> &bull; Total Payable:{' '}
                      <strong>₹{(createdSuccess.receipt.totalPayable || 0).toLocaleString()}</strong>
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
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                        {createdSuccess.totalUnitsCreated}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Accepted Units Created</div>
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
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>
                        {createdSuccess.directInventoryCount}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#166534' }}>Direct to Inventory (Available)</div>
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
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>
                        {createdSuccess.pendingTestingCount}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#b45309' }}>Queued for Testing</div>
                    </div>
                  </div>

                  {createdSuccess.expense && (
                    <div
                      style={{
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        color: '#1e40af',
                      }}
                    >
                      <strong>Linked Phase 3 Expense Created:</strong> {createdSuccess.expense.expenseCode} (DRAFT status).
                      <br />
                      This expense requires Super Admin review and approval in Expenditure Management before payment disbursement can occur.
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Supplier: </span>
                        <strong>{formSourceName}</strong> ({EXTERNAL_SOURCE_TYPE_LABELS[formSourceType]})
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Invoice No: </span>
                        <strong>{formInvoiceNumber || formReferenceNumber || 'None'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Received Date: </span>
                        <strong>{formReceivedDate}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Total Payable: </span>
                        <strong style={{ color: '#0f172a' }}>
                          ₹{formCalculations.totalPayable.toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Discrepancy Banner */}
                  {formCalculations.hasDiscrepancy && (
                    <div
                      style={{
                        backgroundColor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1.25rem',
                        fontSize: '0.85rem',
                        color: '#9f1239',
                      }}
                    >
                      <strong>Discrepancy Flagged:</strong> Invoiced units ({formCalculations.invoicedUnits}) vs
                      Accepted units ({formCalculations.acceptedUnits}). Rejected: {formCalculations.rejectedUnits} units.
                      <div style={{ marginTop: '0.25rem' }}>
                        Reconciliation Notes: <em>{formReconciliationNotes}</em>
                      </div>
                    </div>
                  )}

                  {/* Medical Clearance Banner */}
                  {formCalculations.anyDirectIntake && (
                    <div
                      style={{
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1.25rem',
                        fontSize: '0.85rem',
                        color: '#166534',
                      }}
                    >
                      <strong>Direct Intake Medical Clearance:</strong> Certificate #{formClearanceCertNo}.
                      Source testing certified by medical staff.
                    </div>
                  )}

                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#0f172a' }}>
                    Inspection Breakdown & Traceable Units to Generate:
                  </h4>
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead style={{ backgroundColor: '#f1f5f9' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Group / Component</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Invoiced</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Accepted</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Rejected</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Unit Cost</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Destination</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formItems.map((it, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>
                              {it.bloodGroup} {it.componentType}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{it.invoicedQuantity}</td>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#16a34a' }}>
                              {it.acceptedQuantity}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', color: '#dc2626' }}>
                              {it.rejectedQuantity || 0}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>₹{it.unitCost || 0}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {it.testingRequired ? (
                                <span style={{ color: '#d97706', fontWeight: 600 }}>Queued for Testing</span>
                              ) : (
                                <span style={{ color: '#16a34a', fontWeight: 600 }}>Direct Available</span>
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                      {isSubmitting ? 'Registering Consignment...' : `Commit Consignment (${formCalculations.acceptedUnits} Units)`}
                    </button>
                  </div>
                </div>
              ) : (
                /* Main Consignment Entry Form */
                <form onSubmit={handleOpenConfirm}>
                  {/* Section 1: Supplier & Invoice Info */}
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
                      1. Supplier & Invoice Information
                    </h3>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Source Type *
                        </label>
                        <select
                          value={formSourceType}
                          onChange={(e) => setFormSourceType(e.target.value as ExternalSourceType)}
                          required
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                          }}
                        >
                          {Object.entries(EXTERNAL_SOURCE_TYPE_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Supplier Name *
                        </label>
                        <input
                          type="text"
                          value={formSourceName}
                          onChange={(e) => setFormSourceName(e.target.value)}
                          placeholder="e.g. Apollo Blood Centre"
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
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Link Registered Vendor (Optional)
                        </label>
                        <select
                          value={formVendorId}
                          onChange={(e) => setFormVendorId(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            backgroundColor: '#fff',
                          }}
                        >
                          <option value="">-- No Vendor Link --</option>
                          {vendors.map((v) => (
                            <option key={v._id} value={v._id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Supplier Invoice Number
                        </label>
                        <input
                          type="text"
                          value={formInvoiceNumber}
                          onChange={(e) => setFormInvoiceNumber(e.target.value)}
                          placeholder="e.g. INV-2026-8941"
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
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Reference / Batch No
                        </label>
                        <input
                          type="text"
                          value={formReferenceNumber}
                          onChange={(e) => setFormReferenceNumber(e.target.value)}
                          placeholder="e.g. BATCH-772"
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
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
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

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Transport Charges (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formTransportCharges}
                          onChange={(e) => setFormTransportCharges(Number(e.target.value))}
                          placeholder="0"
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
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Attach Supplier Invoice (PDF/Img)
                        </label>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(e) => setFormInvoiceFile(e.target.files?.[0] || null)}
                          style={{
                            fontSize: '0.8rem',
                            paddingTop: '0.25rem',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Consignment Blood Units & Inspection */}
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
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                        2. Consignment Blood Items & Inspection ({formItems.length})
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
                        + Add Blood Item
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
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) 40px',
                            gap: '0.65rem',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                              Blood Group
                            </label>
                            <select
                              value={item.bloodGroup}
                              onChange={(e) => handleItemChange(index, 'bloodGroup', e.target.value)}
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 700 }}
                            >
                              {ALL_BLOOD_GROUPS.map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                              Component
                            </label>
                            <select
                              value={item.componentType}
                              onChange={(e) => handleItemChange(index, 'componentType', e.target.value)}
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                              {ALL_COMPONENTS.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                              Invoiced Qty
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={item.invoicedQuantity}
                              onChange={(e) => handleItemChange(index, 'invoicedQuantity', Number(e.target.value))}
                              required
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 600 }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                              Received Qty
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={item.receivedQuantity}
                              onChange={(e) => handleItemChange(index, 'receivedQuantity', Number(e.target.value))}
                              required
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 600 }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                              Accepted Qty
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={item.acceptedQuantity}
                              onChange={(e) => handleItemChange(index, 'acceptedQuantity', Number(e.target.value))}
                              required
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 700, color: '#16a34a' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                              Rejected Qty
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={item.rejectedQuantity || 0}
                              onChange={(e) => handleItemChange(index, 'rejectedQuantity', Number(e.target.value))}
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 700, color: '#dc2626' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                              Unit Cost (₹)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={item.unitCost || 0}
                              onChange={(e) => handleItemChange(index, 'unitCost', Number(e.target.value))}
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                              Lab Testing?
                            </label>
                            <select
                              value={item.testingRequired ? 'yes' : 'no'}
                              onChange={(e) => handleItemChange(index, 'testingRequired', e.target.value === 'yes')}
                              style={{
                                width: '100%',
                                padding: '0.35rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                color: item.testingRequired ? '#d97706' : '#16a34a',
                                fontWeight: 600,
                              }}
                            >
                              <option value="yes">Yes (Quarantine)</option>
                              <option value="no">No (Pre-Cleared)</option>
                            </select>
                          </div>

                          {/* Rejection Reason if rejected > 0 */}
                          {(Number(item.rejectedQuantity) || 0) > 0 && (
                            <div style={{ gridColumn: 'span 3' }}>
                              <label style={{ fontSize: '0.75rem', color: '#dc2626', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
                                Rejection Reason *
                              </label>
                              <input
                                type="text"
                                value={item.rejectionReason || ''}
                                onChange={(e) => handleItemChange(index, 'rejectionReason', e.target.value)}
                                placeholder="e.g. Hemolyzed, broken seal, clotted..."
                                required
                                style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #f87171' }}
                              />
                            </div>
                          )}

                          {/* Delete button */}
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

                  {/* Discrepancy Reconciliation Notes (if discrepancy exists) */}
                  {formCalculations.hasDiscrepancy && (
                    <div
                      style={{
                        backgroundColor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                      }}
                    >
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#9f1239', marginBottom: '0.25rem' }}>
                        Discrepancy Reconciliation Notes *
                      </label>
                      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.775rem', color: '#be123c' }}>
                        Invoiced units differ from received/accepted units. Document the variance cause and supplier notification.
                      </p>
                      <textarea
                        value={formReconciliationNotes}
                        onChange={(e) => setFormReconciliationNotes(e.target.value)}
                        placeholder="State why units were short-shipped, rejected on arrival, and supplier credit notice reference..."
                        required
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '0.45rem',
                          borderRadius: '6px',
                          border: '1px solid #f43f5e',
                          fontSize: '0.85rem',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}

                  {/* Medical Clearance Gate (if any item has testingRequired = false) */}
                  {formCalculations.anyDirectIntake && (
                    <div
                      style={{
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                      }}
                    >
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#166534', fontWeight: 700 }}>
                        3. Medical Clearance Gate (Direct Intake Authorization)
                      </h4>
                      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.775rem', color: '#15803d' }}>
                        Direct inventory intake without in-house lab quarantine requires documentation of clearance from a regulated blood centre.
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#166534', marginBottom: '2px' }}>
                            Clearance Certificate Number *
                          </label>
                          <input
                            type="text"
                            value={formClearanceCertNo}
                            onChange={(e) => setFormClearanceCertNo(e.target.value)}
                            placeholder="e.g. CERT-NAT-2026-991"
                            required
                            style={{
                              width: '100%',
                              padding: '0.4rem',
                              borderRadius: '4px',
                              border: '1px solid #86efac',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#166534', marginBottom: '2px' }}>
                            Upload Clearance Certificate File
                          </label>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => setFormCertificateFile(e.target.files?.[0] || null)}
                            style={{ fontSize: '0.75rem', paddingTop: '2px' }}
                          />
                        </div>
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#166534', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formSourceTestingCertified}
                          onChange={(e) => setFormSourceTestingCertified(e.target.checked)}
                          required
                        />
                        <span>
                          <strong>Medical Attestation:</strong> I attest that source-testing documentation, negative viral markers (HIV/HBV/HCV/Syphilis), and valid licensing have been authenticated.
                        </span>
                      </label>
                    </div>
                  )}

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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: '#475569' }}>
                      Accepted Units to generate: <strong style={{ color: '#0f172a' }}>{formCalculations.acceptedUnits} Units</strong> &bull; Total Payable:{' '}
                      <strong style={{ color: '#0f172a' }}>₹{formCalculations.totalPayable.toLocaleString()}</strong>
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
                        Review & Confirm Consignment &rarr;
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
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
              maxWidth: '720px',
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
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    {selectedReceipt.receiptCode}
                  </h2>
                  <StatusBadge status={selectedReceipt.status} size="sm" />
                  {selectedReceipt.hasDiscrepancy && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontWeight: 700,
                      }}
                    >
                      Discrepancy Flagged
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                  Consignment Intake &bull; {selectedReceipt.sourceName}
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
              {/* Financial & Costing Card */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                    Financial Liability & Payment Status
                  </h3>
                  {selectedReceipt.financials?.expenseCode && (
                    <Link
                      href={`/super-admin/finance/expenditure?search=${selectedReceipt.financials.expenseCode}`}
                      style={{ fontSize: '0.775rem', color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}
                    >
                      Linked Expense: {selectedReceipt.financials.expenseCode} &rarr;
                    </Link>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Original Invoice Total</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                      ₹{(selectedReceipt.financials?.totalPayable ?? selectedReceipt.totalPayable ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Approved Credit Notes</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626' }}>
                      -₹{(selectedReceipt.financials?.totalAdjustments ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: '#f0fdf4', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#166534' }}>Effective Net Liability</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#166534' }}>
                      ₹{(selectedReceipt.financials?.effectiveNetLiability ?? selectedReceipt.totalPayable ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                    textAlign: 'center',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Paid to Supplier</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                      ₹{(selectedReceipt.financials?.paidAmount ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Outstanding Dues</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#d97706' }}>
                      ₹{(selectedReceipt.financials?.outstandingBalance ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Payment Status</div>
                    <div style={{ marginTop: '2px' }}>
                      <span
                        style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor:
                            selectedReceipt.financials?.paymentStatus === 'PAID'
                              ? '#dcfce7'
                              : selectedReceipt.financials?.paymentStatus === 'PARTIALLY_PAID'
                              ? '#fef9c3'
                              : '#fee2e2',
                          color:
                            selectedReceipt.financials?.paymentStatus === 'PAID'
                              ? '#166534'
                              : selectedReceipt.financials?.paymentStatus === 'PARTIALLY_PAID'
                              ? '#854d0e'
                              : '#991b1b',
                        }}
                      >
                        {selectedReceipt.financials?.paymentStatus || 'UNPAID'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Overpayment / Refund Receivable */}
                {(selectedReceipt.financials?.supplierRefundReceivable || 0) > 0 && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: '#1e40af',
                    }}
                  >
                    <strong>Supplier Refund Receivable:</strong> ₹{selectedReceipt.financials?.supplierRefundReceivable.toLocaleString()}{' '}
                    (Excess paid over reduced net liability after credit note applied).
                  </div>
                )}

                {/* Record Credit Note Button */}
                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    onClick={() => setShowAdjustmentModal(true)}
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
                    + Record Credit Note / Refund
                  </button>
                </div>
              </div>

              {/* Adjustments List */}
              {selectedReceipt.adjustments && selectedReceipt.adjustments.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                    Supplier Adjustments & Credit Notes ({selectedReceipt.adjustments.length})
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>
                        <th style={{ padding: '0.4rem', textAlign: 'left' }}>Ref No</th>
                        <th style={{ padding: '0.4rem', textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '0.4rem', textAlign: 'left' }}>Reason</th>
                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '0.4rem', textAlign: 'left' }}>Approved By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReceipt.adjustments.map((adj, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.4rem', fontWeight: 600 }}>{adj.creditNoteReference}</td>
                          <td style={{ padding: '0.4rem' }}>{adj.adjustmentType}</td>
                          <td style={{ padding: '0.4rem', color: '#475569' }}>{adj.reason}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                            -₹{adj.amount.toLocaleString()}
                          </td>
                          <td style={{ padding: '0.4rem', color: '#64748b' }}>{adj.approvedByName || 'Super Admin'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Document Attachments Card */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  fontSize: '0.85rem',
                }}
              >
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                  Consignment Documents & Verification
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Supplier Invoice:</span>
                    {selectedReceipt.invoiceDocumentKey ? (
                      <a
                        href={`/api/blood-acquisitions/${selectedReceipt._id}/invoice-file`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}
                      >
                        📄 View Attached Invoice &rarr;
                      </a>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>No invoice document uploaded</span>
                    )}
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Clearance Certificate:</span>
                    {selectedReceipt.clearanceCertificateNumber ? (
                      <div>
                        <strong>{selectedReceipt.clearanceCertificateNumber}</strong>
                        {selectedReceipt.clearanceCertificateKey && (
                          <div>
                            <a
                              href={`/api/blood-acquisitions/${selectedReceipt._id}/certificate-file`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#16a34a', fontWeight: 600, textDecoration: 'none', fontSize: '0.8rem' }}
                            >
                              📄 View Certificate &rarr;
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>Quarantined for lab testing</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Individual Units Traceability List */}
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                Traceable Blood Units Generated ({selectedUnits.length})
              </h3>

              {drawerLoading ? (
                <TableSkeleton rows={4} />
              ) : selectedUnits.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No units found for this receipt.</div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                    <thead style={{ backgroundColor: '#f8fafc' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Unit Code</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Group / Type</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Unit Status</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Testing / Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUnits.map((u) => (
                        <tr key={u._id} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#0f172a' }}>
                            {u.unitCode}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <span style={{ fontWeight: 700, color: '#dc2626' }}>{u.bloodGroup}</span>{' '}
                            <span style={{ color: '#64748b' }}>{u.componentType}</span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <StatusBadge status={u.status} size="sm" />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {u.status === 'TESTING' ? (
                              <Link href="/admin/testing" style={{ color: '#d97706', textDecoration: 'none', fontWeight: 600 }}>
                                &rarr; Lab Testing
                              </Link>
                            ) : u.inventory ? (
                              <Link href="/admin/inventory" style={{ color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>
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

      {/* ADJUSTMENT MODAL */}
      {showAdjustmentModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Record Supplier Credit Note / Refund
              </h3>
              <button
                onClick={() => setShowAdjustmentModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRecordAdjustment}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                  Adjustment Type *
                </label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as any)}
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                >
                  <option value="CREDIT_NOTE">Credit Note (Liability Reduction)</option>
                  <option value="SUPPLIER_REFUND">Supplier Cash/Bank Refund</option>
                </select>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                  Credit Note / Reference Number *
                </label>
                <input
                  type="text"
                  value={adjReference}
                  onChange={(e) => setAdjReference(e.target.value)}
                  placeholder="e.g. CN-2026-0041"
                  required
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '5px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                  Adjustment Amount (₹) *
                </label>
                <input
                  type="number"
                  min={1}
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(Number(e.target.value))}
                  required
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '5px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                  Reason *
                </label>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. Return of 2 hemolyzed whole blood units"
                  required
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '5px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                  Internal Notes
                </label>
                <textarea
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  placeholder="Optional internal audit memo..."
                  rows={2}
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '5px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              {adjError && (
                <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.5rem', borderRadius: '5px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                  {adjError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '0.4rem 0.8rem', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjSubmitting}
                  style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {adjSubmitting ? 'Recording...' : 'Apply Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
