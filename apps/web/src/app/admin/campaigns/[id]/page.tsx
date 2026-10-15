'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { AdminRole } from '@/lib/auth-api';
import {
  CampaignItem,
  CampaignFinancials,
  CampaignBudgetRevisionItem,
  CampaignStatus,
  ExpenseCategory,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_BADGE_COLORS,
  EXPENSE_CATEGORY_LABELS,
  fetchCampaignById,
  fetchCampaignFinancials,
  fetchCampaignBudgetRevisions,
  reviseCampaignBudget,
  updateCampaign,
  linkExpenseToCampaign,
  unlinkExpenseFromCampaign,
  fetchAvailableExpensesForLinking,
  createCampaignExpenditure,
  approveCampaignExpense,
  rejectCampaignExpense,
  getReceiptStreamUrl,
  CreateCampaignExpensePayload,
} from '@/lib/campaign-api';

export default function CampaignCommandCenterPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { admin } = useAdminAuth();
  const isSuperAdmin = admin?.role === AdminRole.SUPER_ADMIN;

  const [campaign, setCampaign] = useState<CampaignItem | null>(null);
  const [financials, setFinancials] = useState<CampaignFinancials | null>(null);
  const [revisions, setRevisions] = useState<CampaignBudgetRevisionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status Updating
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // Revise Budget Modal State
  const [isReviseModalOpen, setIsReviseModalOpen] = useState<boolean>(false);
  const [newBudgetInput, setNewBudgetInput] = useState<string>('');
  const [revisionReason, setRevisionReason] = useState<string>('');
  const [revising, setRevising] = useState<boolean>(false);
  const [reviseError, setReviseError] = useState<string | null>(null);

  // Add Expenditure Modal State
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState<boolean>(false);
  const [addingExpense, setAddingExpense] = useState<boolean>(false);
  const [addExpenseError, setAddExpenseError] = useState<string | null>(null);
  const [expenseFormData, setExpenseFormData] = useState<{
    title: string;
    category: ExpenseCategory;
    amount: string;
    invoiceNumber: string;
    vendorName: string;
    expenseDate: string;
    description: string;
    taxAmount: string;
    gstinNumber: string;
    receiptFile: File | null;
  }>({
    title: '',
    category: ExpenseCategory.STAFF_CAMP_MEALS,
    amount: '',
    invoiceNumber: '',
    vendorName: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    description: '',
    taxAmount: '',
    gstinNumber: '',
    receiptFile: null,
  });

  // Link Existing Expense Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [availableExpenses, setAvailableExpenses] = useState<any[]>([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>('');
  const [linking, setLinking] = useState<boolean>(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Action in progress IDs
  const [actionExpenseId, setActionExpenseId] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch general campaign
      const campData = await fetchCampaignById(id);
      setCampaign(campData);
      setNewBudgetInput(String(campData.approvedBudget || 0));

      // Fetch financials & revisions (both Super Admin and Admin can view financials for operational clarity)
      const [finData, revData] = await Promise.allSettled([
        fetchCampaignFinancials(id),
        fetchCampaignBudgetRevisions(id),
      ]);

      if (finData.status === 'fulfilled') {
        setFinancials(finData.value);
      }
      if (revData.status === 'fulfilled') {
        setRevisions(revData.value);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign command center.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleStatusChange = async (nextStatus: CampaignStatus) => {
    if (!campaign || campaign.status === nextStatus) return;
    try {
      setUpdatingStatus(true);
      await updateCampaign(campaign._id, { status: nextStatus });
      await loadAllData();
    } catch (err: any) {
      alert(`Status transition failed: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReviseBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    const numBudget = Number(newBudgetInput);
    if (isNaN(numBudget) || numBudget < 0) {
      setReviseError('Budget must be a non-negative number.');
      return;
    }
    if (!revisionReason.trim()) {
      setReviseError('Mandatory justification reason is required for budget revisions.');
      return;
    }

    try {
      setRevising(true);
      setReviseError(null);
      await reviseCampaignBudget(campaign._id, {
        newBudget: numBudget,
        reason: revisionReason.trim(),
        budgetVersion: campaign.budgetVersion,
      });

      setIsReviseModalOpen(false);
      setRevisionReason('');
      await loadAllData();
    } catch (err: any) {
      setReviseError(err.message || 'Budget revision failed.');
    } finally {
      setRevising(false);
    }
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    if (!expenseFormData.title.trim()) {
      setAddExpenseError('Expenditure title / item description is required.');
      return;
    }
    const numAmount = Number(expenseFormData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setAddExpenseError('Amount must be greater than zero.');
      return;
    }
    if (!expenseFormData.invoiceNumber.trim()) {
      setAddExpenseError('Invoice / Bill Number is required for systematic tracking.');
      return;
    }
    if (!expenseFormData.vendorName.trim()) {
      setAddExpenseError('Vendor / Merchant Name is required.');
      return;
    }

    try {
      setAddingExpense(true);
      setAddExpenseError(null);
      await createCampaignExpenditure(campaign._id, {
        title: expenseFormData.title.trim(),
        category: expenseFormData.category,
        amount: numAmount,
        invoiceNumber: expenseFormData.invoiceNumber.trim(),
        vendorName: expenseFormData.vendorName.trim(),
        expenseDate: expenseFormData.expenseDate,
        description: expenseFormData.description.trim() || undefined,
        taxAmount: expenseFormData.taxAmount ? Number(expenseFormData.taxAmount) : undefined,
        gstinNumber: expenseFormData.gstinNumber.trim() || undefined,
        receiptFile: expenseFormData.receiptFile,
      });

      setIsAddExpenseModalOpen(false);
      setExpenseFormData({
        title: '',
        category: ExpenseCategory.STAFF_CAMP_MEALS,
        amount: '',
        invoiceNumber: '',
        vendorName: '',
        expenseDate: new Date().toISOString().slice(0, 10),
        description: '',
        taxAmount: '',
        gstinNumber: '',
        receiptFile: null,
      });
      await loadAllData();
    } catch (err: any) {
      setAddExpenseError(err.message || 'Failed to record campaign expenditure.');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleApproveExpense = async (expenseId: string, voucherNum: string) => {
    if (!confirm(`Confirm approval of invoice ${voucherNum} for this campaign?`)) return;
    try {
      setActionExpenseId(expenseId);
      await approveCampaignExpense(expenseId, 'Approved for campaign budget accounting');
      await loadAllData();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setActionExpenseId(null);
    }
  };

  const handleRejectExpense = async (expenseId: string, voucherNum: string) => {
    const reason = prompt(`Enter rejection reason for invoice ${voucherNum}:`);
    if (!reason || !reason.trim()) return;

    try {
      setActionExpenseId(expenseId);
      await rejectCampaignExpense(expenseId, reason.trim());
      await loadAllData();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setActionExpenseId(null);
    }
  };

  const handleOpenLinkModal = async () => {
    try {
      setLinkError(null);
      setIsLinkModalOpen(true);
      const exps = await fetchAvailableExpensesForLinking();
      setAvailableExpenses(exps);
      if (exps.length > 0) {
        setSelectedExpenseId(exps[0]._id);
      }
    } catch (err: any) {
      setLinkError('Failed to load eligible unlinked expenses.');
    }
  };

  const handleLinkExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign || !selectedExpenseId) return;

    try {
      setLinking(true);
      setLinkError(null);
      await linkExpenseToCampaign(campaign._id, selectedExpenseId);
      setIsLinkModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      setLinkError(err.message || 'Failed to link expense.');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkExpense = async (expenseId: string, voucherNum: string) => {
    if (!campaign) return;
    if (!confirm(`Are you sure you want to unlink voucher ${voucherNum} from this campaign?`)) return;

    try {
      setActionExpenseId(expenseId);
      await unlinkExpenseFromCampaign(campaign._id, expenseId);
      await loadAllData();
    } catch (err: any) {
      alert(`Unlink failed: ${err.message}`);
    } finally {
      setActionExpenseId(null);
    }
  };

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (isoStr?: string) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && !campaign) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0b1120', color: '#f8fafc', padding: '3rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: '1rem', color: '#94a3b8' }}>Loading Campaign Command Center...</div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0b1120', color: '#f8fafc', padding: '2rem' }}>
        <div style={{ backgroundColor: '#450a0a', border: '1px solid #dc2626', color: '#fecaca', borderRadius: '8px', padding: '1.5rem', maxWidth: '600px', margin: '2rem auto' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Campaign Not Found</h2>
          <p>{error || 'The requested campaign record could not be loaded.'}</p>
          <Link href="/admin/campaigns" style={{ color: '#38bdf8', textDecoration: 'underline', fontSize: '0.9rem' }}>
            ← Back to Campaigns List
          </Link>
        </div>
      </div>
    );
  }

  const badge = CAMPAIGN_STATUS_BADGE_COLORS[campaign.status] || CAMPAIGN_STATUS_BADGE_COLORS[CampaignStatus.PLANNED];
  const bm = financials?.budgetMetrics;
  const cm = financials?.collectionMetrics;
  const util = bm?.utilizationPercentage || 0;
  const isOver = bm?.isOverBudget || false;
  const pendingReviewCount = financials?.linkedExpenses?.filter((e) => e.status === 'SUBMITTED').length || 0;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b1120', color: '#f8fafc', padding: '1.75rem' }}>
      {/* Breadcrumb & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          <Link href="/admin/campaigns" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Campaigns
          </Link>
          <span>/</span>
          <span style={{ color: '#f8fafc', fontWeight: 600 }}>{campaign.campaignCode}</span>
        </div>

        <Link
          href="/admin/campaigns"
          style={{
            backgroundColor: '#1e293b',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '0.4rem 0.85rem',
            fontSize: '0.8rem',
            textDecoration: 'none',
          }}
        >
          ← Back to All Campaigns
        </Link>
      </div>

      {/* Header Banner */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '0.9rem',
                color: '#38bdf8',
                backgroundColor: '#0369a120',
                border: '1px solid #0284c740',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
              }}
            >
              {campaign.campaignCode}
            </span>

            <span
              style={{
                backgroundColor: badge.bg,
                color: badge.text,
                border: `1px solid ${badge.border}`,
                borderRadius: '9999px',
                padding: '0.25rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {CAMPAIGN_STATUS_LABELS[campaign.status]}
            </span>

            {/* Status Change Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Transition:</span>
              <select
                disabled={updatingStatus}
                value={campaign.status}
                onChange={(e) => handleStatusChange(e.target.value as CampaignStatus)}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {Object.values(CampaignStatus).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
            {campaign.name}
          </h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', color: '#94a3b8', fontSize: '0.875rem' }}>
            <div>
              📍 <strong>{campaign.venue}</strong>, {campaign.city}
            </div>
            <div>
              🗓️ <strong>{formatDate(campaign.startDate)}</strong> to <strong>{formatDate(campaign.endDate)}</strong>
            </div>
            <div>
              🎯 Target: <strong>{campaign.targetDonations} units</strong>
            </div>
          </div>

          {campaign.description && (
            <p style={{ margin: '0.75rem 0 0 0', color: '#cbd5e1', fontSize: '0.875rem', maxWidth: '750px', lineHeight: 1.5 }}>
              {campaign.description}
            </p>
          )}
        </div>

        {/* Action Buttons: Add Expenditure & Revise Budget */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.65rem' }}>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setAddExpenseError(null);
                setIsAddExpenseModalOpen(true);
              }}
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.2rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#059669')}
              onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#10b981')}
            >
              <span>+</span> Add Campaign Expenditure
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => {
                  setReviseError(null);
                  setNewBudgetInput(String(campaign.approvedBudget || 0));
                  setIsReviseModalOpen(true);
                }}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.65rem 1.2rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0369a1')}
                onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0284c7')}
              >
                <span>⚙️</span> Revise Approved Budget
              </button>
            )}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
            Version: {campaign.budgetVersion} • Concurrency Locked
          </span>
        </div>
      </div>

      {/* Pending Review Alert Banner for Super Admin */}
      {isSuperAdmin && pendingReviewCount > 0 && (
        <div
          style={{
            backgroundColor: '#451a03',
            border: '1px solid #d97706',
            color: '#fef3c7',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <div>
              <strong style={{ display: 'block', fontSize: '0.9rem' }}>
                {pendingReviewCount} Campaign Expenditure{pendingReviewCount > 1 ? 's' : ''} Submitted by Admin Staff Pending Review
              </strong>
              <span style={{ fontSize: '0.8rem', color: '#fde68a' }}>
                Review attached invoices and click &ldquo;✓ Approve&rdquo; in the table below to include them in approved expenditures.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Financial Command Cards (Super Admin) */}
      {bm && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>💰</span> Budget vs. Actuals Financial Control
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Integer-Paise Authoritative Accounting • Only APPROVED Expenses Count as Liabilities
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            {/* Approved Budget */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Approved Budget
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#38bdf8' }}>
                {formatCurrency(bm.approvedBudget)}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.775rem', marginTop: '0.25rem' }}>
                Revision #{campaign.budgetRevisionCount} • v{campaign.budgetVersion}
              </div>
            </div>

            {/* Actual Expenditure */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Actual Expenditure
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isOver ? '#ef4444' : '#f59e0b' }}>
                {formatCurrency(bm.actualExpenditure)}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.775rem', marginTop: '0.25rem' }}>
                {financials?.expenseCounts?.approved || 0} approved liabilities
              </div>
            </div>

            {/* Cash Disbursed */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Cash Disbursed
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#10b981' }}>
                {formatCurrency(bm.cashDisbursed)}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.775rem', marginTop: '0.25rem' }}>
                Pending: {formatCurrency(bm.pendingDisbursement)}
              </div>
            </div>

            {/* Remaining Budget */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Remaining Budget
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isOver ? '#ef4444' : '#10b981' }}>
                {formatCurrency(bm.remainingBudget)}
              </div>
              <div style={{ color: isOver ? '#f87171' : '#64748b', fontSize: '0.775rem', marginTop: '0.25rem' }}>
                {isOver ? `Over budget by ${formatCurrency(bm.overspending)}` : 'Within approved limits'}
              </div>
            </div>

            {/* Cost Per Completed Donation */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Cost / Completed Unit
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#c084fc' }}>
                {cm?.costPerCompletedDonation !== null && cm?.costPerCompletedDonation !== undefined
                  ? formatCurrency(cm.costPerCompletedDonation)
                  : 'N/A'}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.775rem', marginTop: '0.25rem' }}>
                {cm?.completedDonations || 0} completed units
              </div>
            </div>
          </div>

          {/* Budget Utilization Bar */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '10px',
              padding: '1rem 1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>
                Budget Utilization: <strong style={{ color: isOver ? '#ef4444' : '#f8fafc' }}>{util}%</strong> of approved {formatCurrency(bm.approvedBudget)}
              </span>
              <span style={{ color: isOver ? '#ef4444' : util > 80 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                {isOver ? '⚠️ OVER BUDGET' : util > 80 ? '⚠️ High Utilization (>80%)' : '✓ Normal Spending'}
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, util)}%`,
                  height: '100%',
                  backgroundColor: isOver ? '#ef4444' : util > 80 ? '#f59e0b' : '#10b981',
                  borderRadius: '9999px',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Systematic Campaign Expenditures & Invoices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.75rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#f8fafc' }}>
                🧾 Campaign Invoices & Expenditures
              </h2>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                Systematically documented invoices, vendor bills, and campaign liabilities.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                onClick={() => {
                  setAddExpenseError(null);
                  setIsAddExpenseModalOpen(true);
                }}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>+</span> Add Expenditure
              </button>

              <button
                onClick={handleOpenLinkModal}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#38bdf8',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Link Existing Expense
              </button>
            </div>
          </div>

          {/* Systematic Invoices Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Invoice & Voucher #</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Vendor / Payee</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Item Details & Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Invoice Document</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Amount (₹)</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Management</th>
                </tr>
              </thead>
              <tbody>
                {!financials?.linkedExpenses || financials.linkedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧾</div>
                      <strong style={{ display: 'block', color: '#94a3b8', fontSize: '1rem', marginBottom: '0.25rem' }}>
                        No expenditures recorded for this campaign yet
                      </strong>
                      <span>
                        Click &ldquo;+ Add Expenditure&rdquo; above to log campaign bills, refreshments, medical supplies, or transport expenses with invoices.
                      </span>
                    </td>
                  </tr>
                ) : (
                  financials.linkedExpenses.map((exp) => {
                    const isSubmitted = exp.status === 'SUBMITTED';
                    const isApproved = exp.status === 'APPROVED';
                    const isRejected = exp.status === 'REJECTED';
                    const isDraft = exp.status === 'DRAFT';

                    return (
                      <tr
                        key={exp._id}
                        style={{
                          borderBottom: '1px solid #1e293b',
                          backgroundColor: isSubmitted ? '#1e1c14' : 'transparent',
                        }}
                      >
                        {/* Invoice & Voucher Code */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                color: '#f59e0b',
                                backgroundColor: '#78350f30',
                                border: '1px solid #d9770640',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                              }}
                            >
                              {exp.invoiceNumber ? `INV: ${exp.invoiceNumber}` : 'NO INVOICE #'}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>
                            {exp.expenseCode || exp.voucherNumber}
                          </span>
                        </td>

                        {/* Vendor Name */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <strong style={{ color: '#f8fafc', display: 'block' }}>
                            {exp.vendorName || 'Direct Vendor'}
                          </strong>
                          {exp.creatorName && (
                            <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                              Added by {exp.creatorName}
                            </span>
                          )}
                        </td>

                        {/* Title & Category */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ color: '#e2e8f0', fontWeight: 500, display: 'block' }}>
                            {exp.title}
                          </span>
                          <span
                            style={{
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              color: '#38bdf8',
                              backgroundColor: '#0369a120',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              display: 'inline-block',
                              marginTop: '0.2rem',
                            }}
                          >
                            {EXPENSE_CATEGORY_LABELS[exp.category as ExpenseCategory] || exp.category}
                          </span>
                          {exp.description && (
                            <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>
                              {exp.description}
                            </p>
                          )}
                        </td>

                        {/* Date */}
                        <td style={{ padding: '0.85rem 1rem', color: '#94a3b8' }}>
                          {formatDate(exp.expenseDate)}
                        </td>

                        {/* Invoice Document Stream */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {exp.receipt?.fileId ? (
                            <a
                              href={getReceiptStreamUrl(exp._id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                backgroundColor: '#1e293b',
                                color: '#38bdf8',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                padding: '0.25rem 0.6rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                              }}
                            >
                              <span>📄</span> View Bill ({exp.receipt.originalName?.slice(-12) || 'Invoice'})
                            </a>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic' }}>
                              No file attached
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.925rem', color: isApproved ? '#f59e0b' : '#f8fafc' }}>
                            {formatCurrency(exp.amount)}
                          </span>
                          {exp.paidAmount !== undefined && exp.paidAmount > 0 && (
                            <div style={{ fontSize: '0.725rem', color: '#10b981', marginTop: '0.15rem' }}>
                              Paid: {formatCurrency(exp.paidAmount)}
                            </div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span
                            style={{
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.55rem',
                              borderRadius: '9999px',
                              backgroundColor: isApproved
                                ? '#064e3b'
                                : isSubmitted
                                ? '#451a03'
                                : isRejected
                                ? '#450a0a'
                                : '#334155',
                              color: isApproved
                                ? '#34d399'
                                : isSubmitted
                                ? '#f59e0b'
                                : isRejected
                                ? '#f87171'
                                : '#cbd5e1',
                              border: `1px solid ${
                                isApproved
                                  ? '#059669'
                                  : isSubmitted
                                  ? '#d97706'
                                  : isRejected
                                  ? '#dc2626'
                                  : '#475569'
                              }`,
                            }}
                          >
                            {isSubmitted ? 'PENDING APPROVAL' : exp.status}
                          </span>
                        </td>

                        {/* Super Admin & Admin Actions */}
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', alignItems: 'center' }}>
                            {/* Super Admin Approval buttons for SUBMITTED expenses */}
                            {isSuperAdmin && isSubmitted && (
                              <>
                                <button
                                  disabled={actionExpenseId === exp._id}
                                  onClick={() => handleApproveExpense(exp._id, exp.invoiceNumber || exp.voucherNumber)}
                                  style={{
                                    backgroundColor: '#059669',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '0.3rem 0.65rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                  title="Approve expense to count toward campaign expenditure"
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  disabled={actionExpenseId === exp._id}
                                  onClick={() => handleRejectExpense(exp._id, exp.invoiceNumber || exp.voucherNumber)}
                                  style={{
                                    backgroundColor: 'transparent',
                                    color: '#f87171',
                                    border: '1px solid #7f1d1d',
                                    borderRadius: '4px',
                                    padding: '0.3rem 0.55rem',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                  }}
                                  title="Reject expense"
                                >
                                  ✕ Reject
                                </button>
                              </>
                            )}

                            {/* Unlink button */}
                            <button
                              disabled={actionExpenseId === exp._id}
                              onClick={() => handleUnlinkExpense(exp._id, exp.invoiceNumber || exp.voucherNumber)}
                              style={{
                                backgroundColor: 'transparent',
                                color: '#94a3b8',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                padding: '0.3rem 0.55rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                              title="Unlink from this campaign"
                            >
                              Unlink
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense Category Breakdown */}
        {financials?.categoryBreakdown && financials.categoryBreakdown.length > 0 && (
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#f8fafc' }}>
              Expense Breakdown by Category
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {financials.categoryBreakdown.map((item) => (
                <div key={item.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                      {item.categoryLabel} <span style={{ color: '#64748b' }}>({item.count} items)</span>
                    </span>
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                      {formatCurrency(item.amount)} ({item.percentageOfExpenditure}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${item.percentageOfExpenditure}%`,
                        height: '100%',
                        backgroundColor: '#38bdf8',
                        borderRadius: '9999px',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Budget Revision Audit Timeline (Super Admin) */}
      {isSuperAdmin && (
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📜</span> Budget Revision Audit History
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Immutable Audit Trail • Mandatory Justifications
            </span>
          </div>

          {revisions.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
              No budget revisions recorded.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {revisions.map((rev) => {
                const isPositive = rev.deltaPaise > 0;
                const isZero = rev.deltaPaise === 0;

                return (
                  <div
                    key={rev._id}
                    style={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            color: '#38bdf8',
                            backgroundColor: '#0369a130',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                          }}
                        >
                          Rev #{rev.revisionNumber}
                        </span>
                        <strong style={{ color: '#f8fafc', fontSize: '0.925rem' }}>
                          {formatCurrency(rev.previousBudget)} → {formatCurrency(rev.newBudget)}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: isZero ? '#94a3b8' : isPositive ? '#10b981' : '#ef4444',
                          }}
                        >
                          ({isPositive ? `+${formatCurrency(rev.delta)}` : formatCurrency(rev.delta)})
                        </span>
                      </div>

                      <div style={{ color: '#cbd5e1', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '0.35rem' }}>
                        &ldquo;{rev.reason}&rdquo;
                      </div>

                      <div style={{ color: '#64748b', fontSize: '0.775rem' }}>
                        Revised by <strong>{rev.actorName}</strong> ({rev.actorEmail}) • Role: {rev.actorRole}
                      </div>
                    </div>

                    <div style={{ color: '#64748b', fontSize: '0.775rem' }}>
                      {formatDateTime(rev.timestamp)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Campaign Expenditure Modal */}
      {isAddExpenseModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#f8fafc' }}>
                  Add Campaign Expenditure
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Associate an operational invoice with <strong>{campaign.campaignCode}</strong>
                </span>
              </div>
              <button
                onClick={() => setIsAddExpenseModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {addExpenseError && (
              <div
                style={{
                  backgroundColor: '#450a0a',
                  border: '1px solid #dc2626',
                  color: '#fecaca',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                {addExpenseError}
              </div>
            )}

            <form onSubmit={handleAddExpenseSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {/* Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Expenditure Title / Item *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Refreshments & Juice for Donors, Sound Setup, Mobile Van Fuel"
                    value={expenseFormData.title}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, title: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.55rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Category & Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Category *
                    </label>
                    <select
                      value={expenseFormData.category}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value as ExpenseCategory })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {Object.values(ExpenseCategory).map((cat) => (
                        <option key={cat} value={cat}>
                          {EXPENSE_CATEGORY_LABELS[cat] || cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={expenseFormData.amount}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Invoice # & Vendor Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Invoice / Bill Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. INV-2026-9021 or BILL-4412"
                      value={expenseFormData.invoiceNumber}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, invoiceNumber: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Vendor / Merchant Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. City Refreshments, Audio Rentals"
                      value={expenseFormData.vendorName}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, vendorName: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Expense Date & GSTIN */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Invoice / Incurred Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={expenseFormData.expenseDate}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, expenseDate: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Vendor GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 27AABCT3518Q1ZV"
                      value={expenseFormData.gstinNumber}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, gstinNumber: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Invoice File Upload */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Invoice / Receipt Document Attachment
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setExpenseFormData({ ...expenseFormData, receiptFile: file });
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px dashed #334155',
                      borderRadius: '6px',
                      padding: '0.65rem',
                      color: '#94a3b8',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                    Upload scanned bill or receipt (PDF, PNG, JPG). Required for Super Admin systematic audit.
                  </span>
                </div>

                {/* Description / Itemization */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Description & Item Breakdown (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Details of goods, snacks, or logistical equipment used during the camp..."
                    value={expenseFormData.description}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.55rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '0.55rem 1rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingExpense}
                  style={{
                    backgroundColor: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: addingExpense ? 'not-allowed' : 'pointer',
                    opacity: addingExpense ? 0.7 : 1,
                  }}
                >
                  {addingExpense ? 'Saving Expenditure...' : 'Save & Submit Expenditure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revise Budget Modal */}
      {isReviseModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '500px',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Revise Approved Campaign Budget
              </h2>
              <button
                onClick={() => setIsReviseModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {reviseError && (
              <div
                style={{
                  backgroundColor: '#450a0a',
                  border: '1px solid #dc2626',
                  color: '#fecaca',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                {reviseError}
              </div>
            )}

            <form onSubmit={handleReviseBudgetSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <div style={{ color: '#94a3b8' }}>Current Approved Budget:</div>
                  <strong style={{ fontSize: '1.15rem', color: '#38bdf8' }}>
                    {formatCurrency(campaign.approvedBudget)}
                  </strong>
                  <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Version: {campaign.budgetVersion} • Concurrency Locked
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Proposed New Approved Budget (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newBudgetInput}
                    onChange={(e) => setNewBudgetInput(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.55rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                  {Number(newBudgetInput) !== (campaign.approvedBudget || 0) && (
                    <div style={{ fontSize: '0.775rem', marginTop: '0.35rem', color: Number(newBudgetInput) > (campaign.approvedBudget || 0) ? '#10b981' : '#ef4444' }}>
                      Delta: {Number(newBudgetInput) > (campaign.approvedBudget || 0) ? '+' : ''}
                      {formatCurrency(Number(newBudgetInput) - (campaign.approvedBudget || 0))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Mandatory Business Justification Reason *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide specific justification (e.g., expanded venue canopy costs, 50% higher donor turnout forecast, audio rental additions)..."
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.55rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsReviseModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '0.55rem 1rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revising}
                  style={{
                    backgroundColor: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: revising ? 'not-allowed' : 'pointer',
                    opacity: revising ? 0.7 : 1,
                  }}
                >
                  {revising ? 'Saving Revision...' : 'Confirm Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Existing Expense Modal */}
      {isLinkModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '520px',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Link Existing Expense
              </h2>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {linkError && (
              <div
                style={{
                  backgroundColor: '#450a0a',
                  border: '1px solid #dc2626',
                  color: '#fecaca',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                {linkError}
              </div>
            )}

            {availableExpenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                No unlinked approved expenses found in the system. Use &ldquo;+ Add Campaign Expenditure&rdquo; to record a new one!
              </div>
            ) : (
              <form onSubmit={handleLinkExpenseSubmit}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Select Approved Expense Voucher *
                  </label>
                  <select
                    value={selectedExpenseId}
                    onChange={(e) => setSelectedExpenseId(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.55rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {availableExpenses.map((exp) => (
                      <option key={exp._id} value={exp._id}>
                        {exp.voucherNumber} — {exp.title} ({formatCurrency(exp.amount)})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsLinkModalOpen(false)}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #334155',
                      color: '#94a3b8',
                      borderRadius: '6px',
                      padding: '0.55rem 1rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={linking}
                    style={{
                      backgroundColor: '#0284c7',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '6px',
                      padding: '0.55rem 1.25rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: linking ? 'not-allowed' : 'pointer',
                      opacity: linking ? 0.7 : 1,
                    }}
                  >
                    {linking ? 'Linking...' : 'Link to Campaign'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
