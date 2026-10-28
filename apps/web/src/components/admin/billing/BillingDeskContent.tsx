'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BloodIssueInvoice,
  BloodIssueCollection,
  InvoiceStatus,
  CollectionPaymentMethod,
  WaiverCategory,
  WAIVER_CATEGORY_LABELS,
  COLLECTION_PAYMENT_METHOD_LABELS,
  DailyRegisterData,
  RevenueSummaryData,
  fetchInvoices,
  fetchCollections,
  fetchDailyRegister,
  fetchRevenueSummary,
  recordCollection,
  applyWaiver,
  cancelInvoice,
  formatINR,
  fetchUnbilledIssues,
  generateInvoice,
} from '@/lib/billing-api';
import StatCard from '@/components/admin/StatCard';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { TableSkeleton } from '@/components/admin/LoadingSkeleton';
import StaffAttributionBadge from '@/components/admin/StaffAttributionBadge';

interface BillingDeskContentProps {
  portalRole: 'ADMIN' | 'SUPER_ADMIN';
}

export default function BillingDeskContent({ portalRole }: BillingDeskContentProps) {
  const isSuperAdmin = portalRole === 'SUPER_ADMIN';
  const basePath = isSuperAdmin ? '/super-admin/finance' : '/admin/finance';

  const [activeTab, setActiveTab] = useState<'invoices' | 'unbilled' | 'collections' | 'daily_register'>('invoices');

  // Unbilled Issues state
  const [unbilledIssues, setUnbilledIssues] = useState<any[]>([]);
  const [unbilledLoading, setUnbilledLoading] = useState(false);
  const [billingIssueId, setBillingIssueId] = useState<string | null>(null);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);

  // Revenue Summary
  const [summary, setSummary] = useState<RevenueSummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Invoices tab state
  const [invoices, setInvoices] = useState<BloodIssueInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Collections tab state
  const [collections, setCollections] = useState<BloodIssueCollection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [collectionsSearch, setCollectionsSearch] = useState<string>('');
  const [collectionsPage, setCollectionsPage] = useState<number>(1);
  const [collectionsTotalPages, setCollectionsTotalPages] = useState<number>(1);

  // Daily Register tab state
  const [dailyRegister, setDailyRegister] = useState<DailyRegisterData | null>(null);
  const [registerDate, setRegisterDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [registerLoading, setRegisterLoading] = useState(false);

  // Modals state
  const [selectedInvoice, setSelectedInvoice] = useState<BloodIssueInvoice | null>(null);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [waiverModalOpen, setWaiverModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Collection form state
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectMethod, setCollectMethod] = useState<CollectionPaymentMethod>(CollectionPaymentMethod.CASH);
  const [collectRef, setCollectRef] = useState<string>('');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [collectNotes, setCollectNotes] = useState<string>('');
  const [isSubmittingCollect, setIsSubmittingCollect] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);

  // Waiver form state
  const [waiverCategory, setWaiverCategory] = useState<WaiverCategory>(WaiverCategory.BPL_CARDHOLDER);
  const [waiverAmount, setWaiverAmount] = useState<string>('');
  const [isFullWaiver, setIsFullWaiver] = useState<boolean>(false);
  const [waiverReason, setWaiverReason] = useState<string>('');
  const [waiverDocRef, setWaiverDocRef] = useState<string>('');
  const [isSubmittingWaiver, setIsSubmittingWaiver] = useState(false);
  const [waiverError, setWaiverError] = useState<string | null>(null);

  // Load summary metrics
  const loadSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const data = await fetchRevenueSummary();
      setSummary(data);
    } catch {
      // Non-blocking error
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // Load invoices
  const loadInvoices = useCallback(async () => {
    try {
      setInvoicesLoading(true);
      setInvoicesError(null);
      const res = await fetchInvoices({
        status: statusFilter,
        search: searchTerm.trim() || undefined,
        page,
        limit: 15,
      });
      setInvoices(res.data);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch (err: any) {
      setInvoicesError(err.message || 'Failed to load invoices');
    } finally {
      setInvoicesLoading(false);
    }
  }, [statusFilter, searchTerm, page]);

  // Load collections
  const loadCollections = useCallback(async () => {
    try {
      setCollectionsLoading(true);
      setCollectionsError(null);
      const res = await fetchCollections({
        paymentMethod: methodFilter,
        search: collectionsSearch.trim() || undefined,
        page: collectionsPage,
        limit: 15,
      });
      setCollections(res.data);
      setCollectionsTotalPages(res.totalPages);
    } catch (err: any) {
      setCollectionsError(err.message || 'Failed to load collections');
    } finally {
      setCollectionsLoading(false);
    }
  }, [methodFilter, collectionsSearch, collectionsPage]);

  // Load daily register
  const loadDailyRegister = useCallback(async () => {
    try {
      setRegisterLoading(true);
      const data = await fetchDailyRegister(registerDate);
      setDailyRegister(data);
    } catch {
      // Non-blocking
    } finally {
      setRegisterLoading(false);
    }
  }, [registerDate]);

  // Load unbilled completed issues
  const loadUnbilled = useCallback(async () => {
    try {
      setUnbilledLoading(true);
      const data = await fetchUnbilledIssues();
      setUnbilledIssues(data);
    } catch {
      // Non-blocking
    } finally {
      setUnbilledLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadUnbilled();
  }, [loadSummary, loadUnbilled]);

  // Read URL search parameter if present
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('search');
    if (q) {
      setSearchTerm(q);
      setActiveTab('invoices');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'invoices') {
      loadInvoices();
      loadUnbilled();
    } else if (activeTab === 'unbilled') {
      loadUnbilled();
    } else if (activeTab === 'collections') {
      loadCollections();
    } else if (activeTab === 'daily_register') {
      loadDailyRegister();
    }
  }, [activeTab, loadInvoices, loadUnbilled, loadCollections, loadDailyRegister]);

  // Handle Generate Invoice for unbilled issue
  const handleGenerateInvoice = async (issueId: string) => {
    setBillingIssueId(issueId);
    setBillingSuccess(null);
    try {
      const inv = await generateInvoice(issueId);
      setBillingSuccess(`Invoice ${inv.invoiceNumber} generated successfully for issue ${inv.issueCode}!`);
      await Promise.all([loadInvoices(), loadSummary(), loadUnbilled()]);
      setActiveTab('invoices');
    } catch (err: any) {
      alert(err.message || 'Failed to generate invoice');
    } finally {
      setBillingIssueId(null);
    }
  };

  // Open Collect Payment Modal
  const handleOpenCollect = (invoice: BloodIssueInvoice) => {
    setSelectedInvoice(invoice);
    setCollectAmount(invoice.outstandingAmount.toFixed(2));
    setCollectMethod(CollectionPaymentMethod.CASH);
    setCollectRef(`CASH-${Date.now().toString().slice(-6)}`);
    setCashTendered(invoice.outstandingAmount.toFixed(2));
    setCollectNotes('');
    setCollectError(null);
    setCollectModalOpen(true);
  };

  // Submit Payment Collection
  const handleSubmitCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amt = parseFloat(collectAmount);
    if (isNaN(amt) || amt <= 0) {
      setCollectError('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    if (amt > selectedInvoice.outstandingAmount + 0.001) {
      setCollectError(
        `Amount cannot exceed remaining balance of ${formatINR(selectedInvoice.outstandingAmount)}.`,
      );
      return;
    }

    setIsSubmittingCollect(true);
    setCollectError(null);

    try {
      await recordCollection(selectedInvoice._id, {
        amount: amt,
        paymentMethod: collectMethod,
        referenceNumber: collectRef.trim() || `REF-${Date.now()}`,
        notes: collectNotes.trim() || undefined,
      });

      setCollectModalOpen(false);
      setSelectedInvoice(null);
      await Promise.all([loadInvoices(), loadSummary()]);
    } catch (err: any) {
      setCollectError(err.message || 'Failed to record payment');
    } finally {
      setIsSubmittingCollect(false);
    }
  };

  // Open Waiver Modal
  const handleOpenWaiver = (invoice: BloodIssueInvoice) => {
    setSelectedInvoice(invoice);
    setWaiverCategory(WaiverCategory.BPL_CARDHOLDER);
    setIsFullWaiver(false);
    setWaiverAmount(Math.min(500, invoice.outstandingAmount).toFixed(2));
    setWaiverReason('');
    setWaiverDocRef('');
    setWaiverError(null);
    setWaiverModalOpen(true);
  };

  // Submit Waiver
  const handleSubmitWaiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amt = parseFloat(waiverAmount);
    if (!isFullWaiver && (isNaN(amt) || amt <= 0)) {
      setWaiverError('Please enter a valid waiver amount.');
      return;
    }

    if (!waiverReason.trim() || waiverReason.trim().length < 5) {
      setWaiverError('Please provide a medical or administrative justification (min 5 chars).');
      return;
    }

    setIsSubmittingWaiver(true);
    setWaiverError(null);

    try {
      await applyWaiver(selectedInvoice._id, {
        category: waiverCategory,
        reason: waiverReason.trim(),
        amount: isFullWaiver ? undefined : amt,
        isFullWaiver,
        documentRef: waiverDocRef.trim() || undefined,
      });

      setWaiverModalOpen(false);
      setSelectedInvoice(null);
      await Promise.all([loadInvoices(), loadSummary()]);
    } catch (err: any) {
      setWaiverError(err.message || 'Failed to apply waiver');
    } finally {
      setIsSubmittingWaiver(false);
    }
  };

  // Open Printable Receipt View
  const handleOpenReceipt = (invoice: BloodIssueInvoice) => {
    setSelectedInvoice(invoice);
    setReceiptModalOpen(true);
  };

  // Calculate Cash Change
  const cashGiven = parseFloat(cashTendered) || 0;
  const billAmount = parseFloat(collectAmount) || 0;
  const cashChange = Math.max(0, cashGiven - billAmount);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Blood Issue Billing & Cashier Desk
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.35rem 0 0 0' }}>
            Authoritative processing fee invoicing, fee exemptions, spot payment collection, and daily revenue reconciliation.
          </p>
        </div>

        {isSuperAdmin && (
          <Link
            href="/super-admin/finance/billing/tariffs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.1rem',
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Fee Tariffs Configuration
          </Link>
        )}
      </div>

      {/* Financial Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <StatCard
          title="Total Processing Billed"
          value={formatINR(summary?.totalInvoicedAmount || 0)}
          icon={<span style={{ fontWeight: 700 }}>₹</span>}
          subtitle={`${summary?.totalInvoicesCount || 0} total invoices`}
          accentColor="#0284c7"
          loading={loadingSummary}
        />
        <StatCard
          title="Total Collected (Revenue)"
          value={formatINR(summary?.totalCollectedAmount || 0)}
          icon={<span style={{ fontWeight: 700 }}>✓</span>}
          subtitle={`${summary?.paidCount || 0} paid, ${summary?.partialCount || 0} partial`}
          accentColor="#16a34a"
          loading={loadingSummary}
        />
        <StatCard
          title="Outstanding Receivables"
          value={formatINR(summary?.totalOutstandingAmount || 0)}
          icon={<span style={{ fontWeight: 700 }}>!</span>}
          subtitle={`${summary?.pendingCount || 0} invoices awaiting settlement`}
          accentColor="#dc2626"
          loading={loadingSummary}
        />
        <StatCard
          title="Today's Collections"
          value={formatINR(summary?.todayCollectionsAmount || 0)}
          icon={<span style={{ fontWeight: 700 }}>📅</span>}
          subtitle={`${summary?.todayCollectionsCount || 0} transaction(s) today`}
          accentColor="#d97706"
          loading={loadingSummary}
        />
      </div>

      {/* Tab Switcher */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '1.25rem',
          gap: '0.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('invoices')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'invoices' ? '2px solid #dc2626' : '2px solid transparent',
            color: activeTab === 'invoices' ? '#dc2626' : '#64748b',
            fontWeight: activeTab === 'invoices' ? 600 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          Blood Invoices Queue ({totalCount})
        </button>
        <button
          onClick={() => setActiveTab('unbilled')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'unbilled' ? '2px solid #dc2626' : '2px solid transparent',
            color: activeTab === 'unbilled' ? '#dc2626' : '#64748b',
            fontWeight: activeTab === 'unbilled' ? 600 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>Pending Billing</span>
          {unbilledIssues.length > 0 && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: '10px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {unbilledIssues.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('collections')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'collections' ? '2px solid #dc2626' : '2px solid transparent',
            color: activeTab === 'collections' ? '#dc2626' : '#64748b',
            fontWeight: activeTab === 'collections' ? 600 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          Collections Register
        </button>
        <button
          onClick={() => setActiveTab('daily_register')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'daily_register' ? '2px solid #dc2626' : '2px solid transparent',
            color: activeTab === 'daily_register' ? '#dc2626' : '#64748b',
            fontWeight: activeTab === 'daily_register' ? 600 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          Daily Day-End Cashier Book
        </button>
      </div>

      {billingSuccess && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            color: '#15803d',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{billingSuccess}</span>
          <button
            type="button"
            onClick={() => setBillingSuccess(null)}
            style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: INVOICES QUEUE */}
      {activeTab === 'invoices' && (
        <div style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {unbilledIssues.length > 0 && (
            <div
              style={{
                margin: '1rem',
                padding: '12px 16px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af' }}>
                <span style={{ fontSize: '18px' }}>🩸</span>
                <span>
                  <strong>{unbilledIssues.length} completed blood issue(s)</strong> have been dispatched to patients and are ready to be billed.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('unbilled')}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                View & Bill Dispatched Units →
              </button>
            </div>
          )}

          {/* Filters Bar */}
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
              <input
                type="text"
                placeholder="Search Invoice #, Issue #, Request #, Patient, Hospital..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  flex: 1,
                  minWidth: 240,
                }}
              />

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  background: '#ffffff',
                }}
              >
                <option value="all">All Statuses</option>
                <option value={InvoiceStatus.PENDING}>Pending Collection</option>
                <option value={InvoiceStatus.PARTIALLY_COLLECTED}>Partially Collected</option>
                <option value={InvoiceStatus.PAID}>Paid Full</option>
                <option value={InvoiceStatus.WAIVED}>Waived / Exempt</option>
                <option value={InvoiceStatus.CANCELLED}>Cancelled</option>
              </select>
            </div>

            <button
              onClick={loadInvoices}
              style={{
                padding: '0.5rem 0.85rem',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                background: '#ffffff',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Table */}
          {invoicesLoading ? (
            <TableSkeleton rows={6} />
          ) : invoicesError ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
              {invoicesError}
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              title="No Blood Issue Invoices Found"
              description="No billing invoices match the active filters or blood issues have not yet been billed."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Invoice #</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Patient & Hospital</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Units & Components</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Subtotal</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Waiver</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Outstanding</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{inv.invoiceNumber}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                          Issue: {inv.issueCode} &bull; {new Date(inv.invoiceDate).toLocaleDateString('en-IN')}
                        </div>
                        <StaffAttributionBadge
                          label="Billed by"
                          name={inv.billedByName}
                          role={inv.billedByRole || 'RECEPTIONIST'}
                        />
                        {inv.status === InvoiceStatus.CANCELLED && inv.cancelledByName && (
                          <div style={{ marginTop: '0.2rem' }}>
                            <StaffAttributionBadge
                              label="Cancelled by"
                              name={inv.cancelledByName}
                              role={inv.cancelledByRole || 'ADMIN'}
                              timestamp={inv.cancelledAt}
                            />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 500, color: '#1e293b' }}>{inv.patient.name} ({inv.patient.age}y, {inv.patient.gender})</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {inv.hospitalName} {inv.patient.hospitalCaseNumber ? `(Case #${inv.patient.hospitalCaseNumber})` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {inv.items.map((it, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '0.25rem',
                                background: '#f1f5f9',
                                color: '#334155',
                              }}
                            >
                              {it.bloodGroup} {it.componentType} ({it.unitCode})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 500 }}>
                        {formatINR(inv.subtotal)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: inv.waiverAmount > 0 ? '#16a34a' : '#64748b' }}>
                        {inv.waiverAmount > 0 ? `-${formatINR(inv.waiverAmount)}` : '₹0.00'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: inv.outstandingAmount > 0 ? '#b91c1c' : '#16a34a' }}>
                        {formatINR(inv.outstandingAmount)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <StatusBadge status={inv.status} />
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          {inv.outstandingAmount > 0 && inv.status !== InvoiceStatus.CANCELLED && (
                            <>
                              <button
                                onClick={() => handleOpenCollect(inv)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Collect
                              </button>
                              <button
                                onClick={() => handleOpenWaiver(inv)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  background: '#f8fafc',
                                  color: '#334155',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Waiver
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleOpenReceipt(inv)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              background: '#f1f5f9',
                              color: '#0f172a',
                              border: '1px solid #cbd5e1',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Receipt
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e1',
                    background: page <= 1 ? '#f1f5f9' : '#ffffff',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e1',
                    background: page >= totalPages ? '#f1f5f9' : '#ffffff',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: PENDING BILLING / UNBILLED ISSUES */}
      {activeTab === 'unbilled' && (
        <div style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div
            style={{
              padding: '1.25rem 1rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Dispatched Blood Issues Awaiting Invoicing
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Completed clinical blood issues awaiting bill generation and cashier payment collection.
              </p>
            </div>
            <button
              type="button"
              onClick={loadUnbilled}
              style={{
                padding: '0.5rem 0.85rem',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                background: '#ffffff',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Refresh List
            </button>
          </div>

          {unbilledLoading ? (
            <TableSkeleton rows={4} />
          ) : unbilledIssues.length === 0 ? (
            <EmptyState
              title="All Blood Issues Invoiced"
              description="There are currently no unbilled blood issues. All dispatched units have been invoiced and recorded."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Issue Code</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Requisition #</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Recipient / Ward</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Issued Blood Units</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Dispatched At</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unbilledIssues.map((issue) => (
                    <tr key={issue._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                        {issue.issueCode}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: '#475569' }}>
                        {issue.requestCode}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 500, color: '#1e293b' }}>
                        {issue.recipientName || 'Ward Patient'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {(issue.issuedUnits || []).map((u: any, idx: number) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '0.25rem',
                                background: '#fee2e2',
                                color: '#991c1c',
                                border: '1px solid #fecaca',
                                fontWeight: 600,
                              }}
                            >
                              {u.unitCode} ({u.bloodGroup} {u.componentType})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                        {issue.issuedAt ? new Date(issue.issuedAt).toLocaleString('en-IN') : 'N/A'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          disabled={billingIssueId === issue._id}
                          onClick={() => handleGenerateInvoice(issue._id)}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: billingIssueId === issue._id ? 'not-allowed' : 'pointer',
                            opacity: billingIssueId === issue._id ? 0.6 : 1,
                            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                          }}
                        >
                          {billingIssueId === issue._id ? 'Generating...' : '💳 Generate Bill & Invoice'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COLLECTIONS REGISTER */}
      {activeTab === 'collections' && (
        <div style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
              <input
                type="text"
                placeholder="Search Receipt #, Invoice #, Reference, Cashier..."
                value={collectionsSearch}
                onChange={(e) => {
                  setCollectionsSearch(e.target.value);
                  setCollectionsPage(1);
                }}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  flex: 1,
                  minWidth: 240,
                }}
              />
              <select
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setCollectionsPage(1);
                }}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  background: '#ffffff',
                }}
              >
                <option value="all">All Payment Methods</option>
                <option value={CollectionPaymentMethod.CASH}>Cash</option>
                <option value={CollectionPaymentMethod.UPI}>UPI / QR Code</option>
                <option value={CollectionPaymentMethod.CARD}>Credit/Debit Card</option>
                <option value={CollectionPaymentMethod.NEFT_RTGS}>NEFT/RTGS</option>
                <option value={CollectionPaymentMethod.HOSPITAL_CREDIT}>Hospital Credit</option>
              </select>
            </div>
          </div>

          {collectionsLoading ? (
            <TableSkeleton rows={6} />
          ) : collections.length === 0 ? (
            <EmptyState
              title="No Collection Transactions Found"
              description="No payment receipts have been recorded matching the active criteria."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Receipt #</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Invoice #</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Method & Reference</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Cashier / Officer</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map((col) => (
                    <tr key={col._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                        {col.receiptNumber}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                        {col.invoiceNumber}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 500, color: '#1e293b' }}>
                          {COLLECTION_PAYMENT_METHOD_LABELS[col.paymentMethod] || col.paymentMethod}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Ref: {col.referenceNumber}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                        {formatINR(col.amount)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <StaffAttributionBadge
                          name={col.collectedByName}
                          role={col.collectedByRole || 'RECEPTIONIST'}
                        />
                        {col.isReversed && (
                          <div style={{ marginTop: '0.2rem' }}>
                            <StaffAttributionBadge
                              label="Reversed by"
                              name={col.reversedByName}
                              role={col.reversedByRole || 'ADMIN'}
                              timestamp={col.reversedAt}
                            />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                        {new Date(col.paymentDate).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DAILY CASHIER REGISTER */}
      {activeTab === 'daily_register' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Date Picker Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              background: '#ffffff',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <span style={{ fontWeight: 600, color: '#0f172a', marginRight: '0.75rem' }}>Select Cashier Day:</span>
              <input
                type="date"
                value={registerDate}
                onChange={(e) => setRegisterDate(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
              Day Collections: <strong style={{ color: '#16a34a', fontSize: '1.1rem' }}>{formatINR(dailyRegister?.totalCollectionsAmount || 0)}</strong> ({dailyRegister?.totalCount || 0} receipts)
            </div>
          </div>

          {/* Breakdown by Payment Method */}
          {dailyRegister && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
              }}
            >
              {Object.entries(dailyRegister.byMethod).map(([method, data]) => (
                <div
                  key={method}
                  style={{
                    background: '#ffffff',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                    {COLLECTION_PAYMENT_METHOD_LABELS[method as CollectionPaymentMethod] || method}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '0.35rem' }}>
                    {formatINR(data.totalAmount)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    {data.count} transaction(s)
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Transactions List */}
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#0f172a' }}>
              Cashier Day-End Transactions
            </div>
            {registerLoading ? (
              <TableSkeleton rows={4} />
            ) : !dailyRegister?.transactions?.length ? (
              <EmptyState
                title="No Collections On Selected Date"
                description={`No payment receipts were recorded on ${registerDate}.`}
              />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Receipt #</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Invoice #</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Method</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Reference</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Cashier</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRegister.transactions.map((tx) => (
                    <tr key={tx._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{tx.receiptNumber}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{tx.invoiceNumber}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{COLLECTION_PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{tx.referenceNumber}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>{formatINR(tx.amount)}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <StaffAttributionBadge
                          name={tx.collectedByName}
                          role="RECEPTIONIST"
                        />
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>{new Date(tx.paymentDate).toLocaleTimeString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: RECORD PAYMENT COLLECTION */}
      {collectModalOpen && selectedInvoice && (
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
              maxWidth: 540,
              width: '100%',
              padding: '1.75rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Collect Payment Receipt
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Invoice {selectedInvoice.invoiceNumber} &bull; {selectedInvoice.patient.name}
                </div>
              </div>
              <button
                onClick={() => setCollectModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                &times;
              </button>
            </div>

            {/* Balance Overview Box */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.25rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>Gross Subtotal:</span>
                <span style={{ fontWeight: 600 }}>{formatINR(selectedInvoice.subtotal)}</span>
              </div>
              {selectedInvoice.waiverAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem', color: '#16a34a' }}>
                  <span>Approved Waivers / Discounts:</span>
                  <span>-{formatINR(selectedInvoice.waiverAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>Already Collected:</span>
                <span>{formatINR(selectedInvoice.collectedAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1', fontWeight: 700 }}>
                <span style={{ color: '#0f172a' }}>Remaining Balance Due:</span>
                <span style={{ color: '#dc2626', fontSize: '1.1rem' }}>{formatINR(selectedInvoice.outstandingAmount)}</span>
              </div>
            </div>

            {collectError && (
              <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {collectError}
              </div>
            )}

            <form onSubmit={handleSubmitCollect} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Payment Amount */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Collection Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedInvoice.outstandingAmount}
                  required
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => setCollectAmount(selectedInvoice.outstandingAmount.toFixed(2))}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.25rem', cursor: 'pointer' }}
                  >
                    Pay Full ({formatINR(selectedInvoice.outstandingAmount)})
                  </button>
                  {selectedInvoice.outstandingAmount > 100 && (
                    <button
                      type="button"
                      onClick={() => setCollectAmount((selectedInvoice.outstandingAmount / 2).toFixed(2))}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.25rem', cursor: 'pointer' }}
                    >
                      Pay Half
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Payment Method *
                </label>
                <select
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value as CollectionPaymentMethod)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '0.9rem',
                    background: '#ffffff',
                  }}
                >
                  <option value={CollectionPaymentMethod.CASH}>Cash</option>
                  <option value={CollectionPaymentMethod.UPI}>UPI / Dynamic QR</option>
                  <option value={CollectionPaymentMethod.CARD}>Credit / Debit Card</option>
                  <option value={CollectionPaymentMethod.NEFT_RTGS}>NEFT / RTGS Bank Transfer</option>
                  <option value={CollectionPaymentMethod.HOSPITAL_CREDIT}>Hospital Institutional Credit Folio</option>
                </select>
              </div>

              {/* Cash Change Calculator */}
              {collectMethod === CollectionPaymentMethod.CASH && (
                <div style={{ background: '#ecfdf5', padding: '0.85rem', borderRadius: '0.375rem', border: '1px solid #a7f3d0' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#065f46', marginBottom: '0.2rem' }}>
                        Cash Tendered by Patient (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.45rem',
                          border: '1px solid #6ee7b7',
                          borderRadius: '0.25rem',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 600 }}>Change to Return</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#047857' }}>{formatINR(cashChange)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reference Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Reference / Transaction / Voucher # *
                </label>
                <input
                  type="text"
                  required
                  value={collectRef}
                  onChange={(e) => setCollectRef(e.target.value)}
                  placeholder="e.g. UPI UTR, Card Auth Code, Cash Receipt #"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Receipt Notes (Optional)
                </label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="Optional cashier remarks"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setCollectModalOpen(false)}
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
                  disabled={isSubmittingCollect}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    cursor: isSubmittingCollect ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmittingCollect ? 'Recording...' : 'Record Payment Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: APPLY WAIVER */}
      {waiverModalOpen && selectedInvoice && (
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
              maxWidth: 520,
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Apply Fee Waiver / Exemption
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Invoice {selectedInvoice.invoiceNumber} &bull; Outstanding: {formatINR(selectedInvoice.outstandingAmount)}
                </div>
              </div>
              <button
                onClick={() => setWaiverModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                &times;
              </button>
            </div>

            {/* Regulatory Notice */}
            <div style={{ padding: '0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.375rem', fontSize: '0.8rem', color: '#1e40af', marginBottom: '1rem' }}>
              <strong>Policy Threshold:</strong> Standard Admins can authorize up to ₹500.00. Waivers exceeding ₹500 or 100% full exemptions require Super Admin authorization.
            </div>

            {waiverError && (
              <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {waiverError}
              </div>
            )}

            <form onSubmit={handleSubmitWaiver} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Waiver / Exemption Category *
                </label>
                <select
                  value={waiverCategory}
                  onChange={(e) => setWaiverCategory(e.target.value as WaiverCategory)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    background: '#ffffff',
                  }}
                >
                  {Object.entries(WAIVER_CATEGORY_LABELS).map(([cat, label]) => (
                    <option key={cat} value={cat}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Full Waiver Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="fullWaiver"
                  checked={isFullWaiver}
                  onChange={(e) => setIsFullWaiver(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="fullWaiver" style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
                  100% Full Fee Exemption ({formatINR(selectedInvoice.outstandingAmount)})
                </label>
              </div>

              {/* Amount input if not full */}
              {!isFullWaiver && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Waiver Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedInvoice.outstandingAmount}
                    required
                    value={waiverAmount}
                    onChange={(e) => setWaiverAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.375rem',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>
              )}

              {/* Document Reference */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Document / Certificate # (BPL / Scheme / Card ID)
                </label>
                <input
                  type="text"
                  value={waiverDocRef}
                  onChange={(e) => setWaiverDocRef(e.target.value)}
                  placeholder="e.g. BPL-KA-2026-9921, AB-PMJAY-1234"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {/* Justification */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Audit Justification & Remarks *
                </label>
                <textarea
                  required
                  rows={3}
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  placeholder="Detailed justification for clinical or financial concession..."
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setWaiverModalOpen(false)}
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
                  disabled={isSubmittingWaiver}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    cursor: isSubmittingWaiver ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmittingWaiver ? 'Applying...' : 'Apply Waiver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PRINTABLE INVOICE / RECEIPT */}
      {receiptModalOpen && selectedInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
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
              maxWidth: 720,
              width: '100%',
              padding: '2rem',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Action Bar (Hidden in Print) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
                Printable Official Bill & Receipt Voucher
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: '0.4rem 0.85rem',
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print Bill
                </button>
                <button
                  onClick={() => setReceiptModalOpen(false)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Receipt Body */}
            <div id="printable-receipt" style={{ color: '#0f172a', fontFamily: 'sans-serif' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>
                  Regional Blood Transfusion Center
                </h2>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.2rem' }}>
                  Licensed under Drugs & Cosmetics Act &bull; NABH Accredited Facility
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  National Blood Processing & Compatibility Testing Service Invoice
                </div>
              </div>

              {/* Metadata 2-Column Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.375rem' }}>
                  <div><strong>Invoice #:</strong> {selectedInvoice.invoiceNumber}</div>
                  <div><strong>Issue Code:</strong> {selectedInvoice.issueCode}</div>
                  <div><strong>Date & Time:</strong> {new Date(selectedInvoice.invoiceDate).toLocaleString('en-IN')}</div>
                  <div><strong>Billed By:</strong> {selectedInvoice.billedByName}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.375rem' }}>
                  <div><strong>Patient:</strong> {selectedInvoice.patient.name} ({selectedInvoice.patient.age}y, {selectedInvoice.patient.gender})</div>
                  <div><strong>Hospital:</strong> {selectedInvoice.hospitalName}</div>
                  <div><strong>Physician:</strong> {selectedInvoice.doctorName}</div>
                  {selectedInvoice.patient.hospitalCaseNumber && (
                    <div><strong>Case / IPD #:</strong> {selectedInvoice.patient.hospitalCaseNumber}</div>
                  )}
                </div>
              </div>

              {/* Items Breakdown Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Blood Component & Unit Code</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Base Processing</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Crossmatching</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.5rem' }}>
                        <strong>{item.bloodGroup} {item.componentType}</strong> &bull; Unit Code: {item.unitCode}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatINR(item.baseProcessingFee)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatINR(item.crossmatchFee)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>{formatINR(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary */}
              <div style={{ marginLeft: 'auto', maxWidth: 320, fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                  <span>Gross Processing Subtotal:</span>
                  <span style={{ fontWeight: 600 }}>{formatINR(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.waiverAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', color: '#16a34a' }}>
                    <span>Approved Concessions / Waivers:</span>
                    <span style={{ fontWeight: 600 }}>-{formatINR(selectedInvoice.waiverAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: '1px solid #cbd5e1', fontWeight: 700 }}>
                  <span>Net Payable Amount:</span>
                  <span>{formatINR(selectedInvoice.netPayable)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', color: '#16a34a' }}>
                  <span>Amount Received:</span>
                  <span style={{ fontWeight: 600 }}>{formatINR(selectedInvoice.collectedAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: '2px solid #0f172a', fontWeight: 800 }}>
                  <span>Outstanding Balance:</span>
                  <span style={{ color: selectedInvoice.outstandingAmount > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatINR(selectedInvoice.outstandingAmount)}
                  </span>
                </div>
              </div>

              {/* Statutory Footnote & Stamp */}
              <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ maxWidth: 420 }}>
                  <p style={{ margin: '0 0 0.25rem 0' }}>
                    <strong>Statutory Regulatory Notice:</strong> Under National Blood Transfusion Council regulations, charges are strictly cost-recovery processing fees for donor screening, viral marker testing, grouping, and storage. Blood cannot be commercially sold.
                  </p>
                  <p style={{ margin: 0 }}>This is a computer-generated authorized voucher.</p>
                </div>
                <div style={{ textAlign: 'center', width: 180 }}>
                  <div style={{ height: 24, fontSize: '0.75rem', color: '#475569', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedInvoice.billedByName ? `${selectedInvoice.billedByName} (${selectedInvoice.billedByRole || 'RECEPTIONIST'})` : ''}
                  </div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '0.25rem', fontWeight: 600, color: '#334155' }}>
                    Authorized Cashier
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
