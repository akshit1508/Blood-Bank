'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FinancialPeriodPreset,
  FinancialTransactionType,
  FinancialTransactionDirection,
  FinancialKpiData,
  FinancialLedgerResponse,
  FinancialTrendsResponse,
  fetchFinancialKpiSummary,
  fetchFinancialLedger,
  fetchFinancialTrends,
  downloadFinancialCsv,
  formatCurrencyINR,
  purgeAllFinancialData,
} from '@/lib/financial-control-center-api';
import {
  ExpenseItem,
  ExpenseStatus,
  fetchExpenses,
  approveExpense,
  rejectExpense,
  openExpenseReceiptInNewTab,
  downloadExpenseReceipt,
  EXPENSE_CATEGORY_LABELS,
} from '@/lib/expense-api';

export default function FinancialControlCenterPage() {
  // Period state
  const [period, setPeriod] = useState<FinancialPeriodPreset>(FinancialPeriodPreset.THIS_MONTH);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [appliedCustom, setAppliedCustom] = useState<{ start: string; end: string } | null>(null);

  // Data state
  const [kpiData, setKpiData] = useState<FinancialKpiData | null>(null);
  const [trendsData, setTrendsData] = useState<FinancialTrendsResponse | null>(null);
  const [ledgerData, setLedgerData] = useState<FinancialLedgerResponse | null>(null);

  // Unapproved bills / expenditures state
  const [pendingExpenses, setPendingExpenses] = useState<ExpenseItem[]>([]);
  const [loadingPending, setLoadingPending] = useState<boolean>(true);
  const [actionExpenseId, setActionExpenseId] = useState<string | null>(null);
  const [approvalFeedbackMessage, setApprovalFeedbackMessage] = useState<string | null>(null);
  const [approvalFeedbackType, setApprovalFeedbackType] = useState<'success' | 'error' | null>(null);

  // Loading states
  const [loadingKpi, setLoadingKpi] = useState<boolean>(true);
  const [loadingLedger, setLoadingLedger] = useState<boolean>(true);
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [purging, setPurging] = useState<boolean>(false);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);

  // Ledger query controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Load KPI & Trends
  const loadKpisAndTrends = useCallback(async () => {
    try {
      setLoadingKpi(true);
      setErrorMessage(null);

      const sDate = period === FinancialPeriodPreset.CUSTOM && appliedCustom ? appliedCustom.start : undefined;
      const eDate = period === FinancialPeriodPreset.CUSTOM && appliedCustom ? appliedCustom.end : undefined;

      const [kpiRes, trendRes] = await Promise.all([
        fetchFinancialKpiSummary(period, sDate, eDate),
        fetchFinancialTrends(period, sDate, eDate),
      ]);

      setKpiData(kpiRes);
      setTrendsData(trendRes);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load financial KPI data.');
    } finally {
      setLoadingKpi(false);
    }
  }, [period, appliedCustom]);

  // Load Ledger
  const loadLedger = useCallback(async () => {
    try {
      setLoadingLedger(true);

      const sDate = period === FinancialPeriodPreset.CUSTOM && appliedCustom ? appliedCustom.start : undefined;
      const eDate = period === FinancialPeriodPreset.CUSTOM && appliedCustom ? appliedCustom.end : undefined;

      const res = await fetchFinancialLedger({
        period,
        startDate: sDate,
        endDate: eDate,
        type: typeFilter !== 'ALL' ? (typeFilter as FinancialTransactionType) : undefined,
        direction: directionFilter !== 'ALL' ? (directionFilter as FinancialTransactionDirection) : undefined,
        search: searchQuery.trim() || undefined,
        page: currentPage,
        limit: pageSize,
      });

      setLedgerData(res);
    } catch (err: any) {
      // Catch ledger fetch errors gracefully
    } finally {
      setLoadingLedger(false);
    }
  }, [period, appliedCustom, typeFilter, directionFilter, searchQuery, currentPage]);

  // Load unapproved bills queue (status: SUBMITTED)
  const loadPendingExpenses = useCallback(async () => {
    try {
      setLoadingPending(true);
      const res = await fetchExpenses({ status: ExpenseStatus.SUBMITTED, limit: 50 });
      setPendingExpenses(res.items || []);
    } catch {
      // Ignore or set empty
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    loadKpisAndTrends();
  }, [loadKpisAndTrends]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  useEffect(() => {
    loadPendingExpenses();
  }, [loadPendingExpenses]);

  const handlePurgeAllData = async () => {
    setPurging(true);
    setErrorMessage(null);
    setPurgeSuccess(null);
    try {
      const res = await purgeAllFinancialData();
      setShowPurgeModal(false);
      setPurgeSuccess(
        `✓ All finance data successfully purged for testing! (Cleared: ${res.expenses} expenses, ${res.payments} payment vouchers, ${res.bloodIssueInvoices} invoices, ${res.bloodIssueCollections} collections, ${res.monthlyPayrollRuns} payroll runs, ${res.salarySlips} slips, ${res.salaryDisbursements} disbursements)`
      );
      await Promise.all([loadKpisAndTrends(), loadLedger(), loadPendingExpenses()]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to purge financial data.');
    } finally {
      setPurging(false);
    }
  };

  const handleApproveBill = async (expense: ExpenseItem) => {
    try {
      setActionExpenseId(expense._id);
      setApprovalFeedbackMessage(null);
      await approveExpense(expense._id, 'Approved via Super Admin Financial Control Center');

      setApprovalFeedbackType('success');
      setApprovalFeedbackMessage(
        `✓ Successfully approved bill #${expense.invoiceNumber || expense.expenseCode} for ${formatCurrencyINR(expense.amount)}! Total recognized expenditure and payables have been updated on the dashboard.`
      );

      // Instantly reload pending list, KPIs and Ledger so the dashboard money increases/decreases immediately!
      await Promise.all([
        loadPendingExpenses(),
        loadKpisAndTrends(),
        loadLedger(),
      ]);
    } catch (err: any) {
      setApprovalFeedbackType('error');
      setApprovalFeedbackMessage(`Approval failed: ${err.message}`);
    } finally {
      setActionExpenseId(null);
    }
  };

  const handleRejectBill = async (expense: ExpenseItem) => {
    const reason = prompt(
      `Enter rejection reason for bill #${expense.invoiceNumber || expense.expenseCode}:`,
      'Disallowed expenditure / invalid invoice attachment'
    );
    if (!reason || !reason.trim()) return;

    try {
      setActionExpenseId(expense._id);
      setApprovalFeedbackMessage(null);
      await rejectExpense(expense._id, reason.trim());

      setApprovalFeedbackType('success');
      setApprovalFeedbackMessage(
        `Bill #${expense.invoiceNumber || expense.expenseCode} rejected and returned to submitter.`
      );

      await Promise.all([
        loadPendingExpenses(),
        loadKpisAndTrends(),
        loadLedger(),
      ]);
    } catch (err: any) {
      setApprovalFeedbackType('error');
      setApprovalFeedbackMessage(`Rejection failed: ${err.message}`);
    } finally {
      setActionExpenseId(null);
    }
  };

  const handleApplyCustomDates = () => {
    if (!customStart || !customEnd) return;
    setAppliedCustom({ start: customStart, end: customEnd });
    setCurrentPage(1);
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const sDate = period === FinancialPeriodPreset.CUSTOM && appliedCustom ? appliedCustom.start : undefined;
      const eDate = period === FinancialPeriodPreset.CUSTOM && appliedCustom ? appliedCustom.end : undefined;

      await downloadFinancialCsv({
        period,
        startDate: sDate,
        endDate: eDate,
        type: typeFilter !== 'ALL' ? (typeFilter as FinancialTransactionType) : undefined,
        direction: directionFilter !== 'ALL' ? (directionFilter as FinancialTransactionDirection) : undefined,
        search: searchQuery.trim() || undefined,
      });
    } catch (err: any) {
      alert(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setExportingCsv(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper for direction color badges
  const getDirectionBadge = (dir: FinancialTransactionDirection) => {
    switch (dir) {
      case FinancialTransactionDirection.INFLOW:
        return { label: 'INFLOW', bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' };
      case FinancialTransactionDirection.OUTFLOW:
        return { label: 'OUTFLOW', bg: '#fff1f2', color: '#9f1239', border: '#fecdd3' };
      case FinancialTransactionDirection.ACCRUAL:
        return { label: 'ACCRUAL', bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
      case FinancialTransactionDirection.ADJUSTMENT:
        return { label: 'ADJUSTMENT', bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' };
      default:
        return { label: dir, bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
    }
  };

  // Helper for status badge
  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (['APPROVED', 'PAID', 'COMPLETED', 'CONFIRMED', 'DISBURSED'].includes(s)) {
      return { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' };
    }
    if (['PENDING', 'PARTIALLY_PAID', 'PARTIALLY_COLLECTED', 'SUBMITTED', 'DRAFT'].includes(s)) {
      return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
    }
    if (['REJECTED', 'CANCELLED', 'REVERSED'].includes(s)) {
      return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
    }
    return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
  };

  return (
    <div
      className="fcc-container"
      style={{
        minHeight: '100vh',
        backgroundColor: '#fffbeb',
        color: '#0f172a',
        padding: '2rem 2.5rem',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        .fcc-container {
          min-height: 100vh;
          background-color: #fffbeb;
          color: #0f172a;
          padding: 2rem 2.5rem;
          box-sizing: border-box;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .fcc-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          gap: 1rem;
        }
        .fcc-visual-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .fcc-table-scroll {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: #d97706 #fef3c7;
        }
        .fcc-table-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .fcc-table-scroll::-webkit-scrollbar-track {
          background: #fef3c7;
          border-radius: 4px;
        }
        .fcc-table-scroll::-webkit-scrollbar-thumb {
          background: #d97706;
          border-radius: 4px;
        }

        @media (max-width: 900px) {
          .fcc-container {
            padding: 1.25rem 1rem !important;
          }
        }

        @media (max-width: 768px) {
          .fcc-container {
            padding: 0.85rem 0.65rem !important;
          }
          .fcc-header-wrap {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1rem !important;
            padding-bottom: 1.25rem !important;
            margin-bottom: 1.25rem !important;
          }
          .fcc-header-brand {
            width: 100% !important;
          }
          .fcc-header-title {
            font-size: 1.45rem !important;
            line-height: 1.25 !important;
          }
          .fcc-header-desc {
            font-size: 0.85rem !important;
            line-height: 1.4 !important;
          }
          .fcc-header-actions {
            width: 100% !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 0.5rem !important;
          }
          .fcc-header-actions button {
            flex: 1 1 calc(50% - 0.5rem) !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .fcc-header-actions button:last-child {
            flex: 1 1 100% !important;
          }
          .fcc-card {
            padding: 1rem !important;
          }
          .fcc-period-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.4rem !important;
          }
          .fcc-nwc-banner {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 1rem !important;
            gap: 1rem !important;
          }
          .fcc-nwc-actions {
            width: 100% !important;
            display: flex !important;
            gap: 0.5rem !important;
          }
          .fcc-nwc-actions a {
            flex: 1 !important;
            text-align: center !important;
            justify-content: center !important;
          }
          .fcc-visual-grid {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
          .fcc-section-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.75rem !important;
          }
          .fcc-section-header-actions {
            width: 100% !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
          }
          .fcc-ledger-filters {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.5rem !important;
          }
          .fcc-ledger-filters input,
          .fcc-ledger-filters select {
            width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
          }
          .fcc-custom-dates {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.65rem !important;
          }
          .fcc-custom-dates > div {
            width: 100% !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
          }
          .fcc-custom-dates input {
            flex: 1 !important;
            box-sizing: border-box !important;
          }
          .fcc-custom-dates button {
            width: 100% !important;
            padding: 0.6rem !important;
          }
          .fcc-purge-modal {
            padding: 1.25rem !important;
          }
        }

        @media (max-width: 640px) {
          .fcc-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.65rem !important;
          }
          .fcc-kpi-card {
            padding: 0.85rem !important;
          }
          .fcc-kpi-card .fcc-kpi-val {
            font-size: 1.2rem !important;
          }
          .fcc-pagination {
            flex-direction: column !important;
            gap: 0.75rem !important;
            align-items: stretch !important;
            text-align: center !important;
          }
          .fcc-pagination > div:last-child {
            display: flex !important;
            justify-content: space-between !important;
          }
          .fcc-pagination button {
            flex: 1 !important;
          }
        }

        @media (max-width: 480px) {
          .fcc-header-brand {
            width: 100% !important;
          }
          .fcc-header-title {
            font-size: 1.3rem !important;
          }
          .fcc-header-desc {
            font-size: 0.8rem !important;
          }
        }

        @media (max-width: 420px) {
          .fcc-kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Top Header */}
      <div
        className="fcc-header-wrap"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          borderBottom: '1px solid #fde68a',
          paddingBottom: '1.75rem',
          marginBottom: '2rem',
        }}
      >
        <div className="fcc-header-brand" style={{ flex: '1 1 auto', minWidth: 0, width: '100%', maxWidth: '100%' }}>
          <h1
            className="fcc-header-title"
            style={{
              margin: 0,
              fontSize: '1.85rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}
          >
            Financial Control Center
          </h1>
          <p
            className="fcc-header-desc"
            style={{
              margin: '0.35rem 0 0 0',
              color: '#64748b',
              fontSize: '0.875rem',
              lineHeight: 1.4,
            }}
          >
            Centralized real-time accounting, multi-stream liquidity audit, cash vs. accruals, and transaction ledger.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="fcc-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.15rem',
              backgroundColor: '#ffffff',
              color: '#92400e',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: exportingCsv ? 'not-allowed' : 'pointer',
              opacity: exportingCsv ? 0.6 : 1,
              transition: 'background-color 0.2s',
              boxShadow: '0 1px 2px rgba(180, 83, 9, 0.05)',
            }}
          >
            <span>{exportingCsv ? '⏳ Exporting...' : '📥 Export CSV'}</span>
          </button>
          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.15rem',
              backgroundColor: '#ffffff',
              color: '#92400e',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              boxShadow: '0 1px 2px rgba(180, 83, 9, 0.05)',
            }}
          >
            <span>🖨️ Print Statement</span>
          </button>
          <button
            onClick={() => setShowPurgeModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.15rem',
              backgroundColor: '#fff1f2',
              color: '#be123c',
              border: '1px solid #fecdd3',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 1px 2px rgba(190, 18, 60, 0.05)',
            }}
          >
            <span>🗑️ Purge Finance Data</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            fontSize: '0.85rem',
            marginBottom: '1.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠️ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#b91c1c',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              padding: '0 0.5rem',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Purge Success Alert */}
      {purgeSuccess && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            fontSize: '0.85rem',
            marginBottom: '1.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 600,
          }}
        >
          <span>{purgeSuccess}</span>
          <button
            onClick={() => setPurgeSuccess(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#065f46',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              padding: '0 0.5rem',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Reporting Period Filter Bar */}
      <div
        className="fcc-card"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          boxShadow: '0 1px 3px rgba(180, 83, 9, 0.06)',
        }}
      >
        <div className="fcc-period-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Reporting Period Filter
          </span>
          {kpiData && (
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Active Range: <strong style={{ color: '#0f172a' }}>{kpiData.period.presetName}</strong> (
              {new Date(kpiData.period.startDate).toLocaleDateString()} &ndash;{' '}
              {new Date(kpiData.period.endDate).toLocaleDateString()})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%' }}>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('control-center-period-scroll');
              if (el) el.scrollBy({ left: -180, behavior: 'smooth' });
            }}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              color: '#92400e',
              borderRadius: '6px',
              width: '26px',
              height: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              fontSize: '1rem',
              lineHeight: 1,
            }}
            aria-label="Scroll left"
          >
            ‹
          </button>
          <div
            id="control-center-period-scroll"
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              alignItems: 'center',
              gap: '0.5rem',
              overflowX: 'auto',
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch',
              flex: '1 1 auto',
              minWidth: 0,
            }}
          >
            {[
              { id: FinancialPeriodPreset.TODAY, label: 'Today' },
              { id: FinancialPeriodPreset.YESTERDAY, label: 'Yesterday' },
              { id: FinancialPeriodPreset.LAST_7_DAYS, label: 'Last 7 Days' },
              { id: FinancialPeriodPreset.LAST_15_DAYS, label: 'Last 15 Days' },
              { id: FinancialPeriodPreset.THIS_MONTH, label: 'This Month' },
              { id: FinancialPeriodPreset.LAST_MONTH, label: 'Last Month' },
              { id: FinancialPeriodPreset.THIS_FINANCIAL_YEAR, label: 'Financial Year (FY)' },
              { id: FinancialPeriodPreset.CUSTOM, label: 'Custom Range' },
            ].map((p) => {
              const isActive = period === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setPeriod(p.id);
                    setCurrentPage(1);
                  }}
                  style={{
                    backgroundColor: isActive ? '#d97706' : '#fffbeb',
                    color: isActive ? '#ffffff' : '#92400e',
                    border: isActive ? '1px solid #b45309' : '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '0.45rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: isActive ? 700 : 600,
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 2px 8px rgba(217, 119, 6, 0.3)' : 'none',
                    transition: 'all 0.15s ease-in-out',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('control-center-period-scroll');
              if (el) el.scrollBy({ left: 180, behavior: 'smooth' });
            }}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              color: '#92400e',
              borderRadius: '6px',
              width: '26px',
              height: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              fontSize: '1rem',
              lineHeight: 1,
            }}
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>

        {/* Custom Date Inputs */}
        {period === FinancialPeriodPreset.CUSTOM && (
          <div
            className="fcc-custom-dates"
            style={{
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid #fef3c7',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ color: '#64748b' }}>From Date:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #fde68a',
                  color: '#0f172a',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  padding: '0.4rem 0.65rem',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ color: '#64748b' }}>To Date:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #fde68a',
                  color: '#0f172a',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  padding: '0.4rem 0.65rem',
                  outline: 'none',
                }}
              />
            </div>
            <button
              onClick={handleApplyCustomDates}
              disabled={!customStart || !customEnd}
              style={{
                padding: '0.45rem 1.15rem',
                backgroundColor: '#d97706',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: !customStart || !customEnd ? 'not-allowed' : 'pointer',
                opacity: !customStart || !customEnd ? 0.5 : 1,
              }}
            >
              Apply Filter
            </button>
          </div>
        )}
      </div>

      {/* Net Working Capital Liquidity Banner */}
      {kpiData && (
        <div
          className="fcc-nwc-banner"
          style={{
            background: 'linear-gradient(90deg, #fffbeb 0%, #fef3c7 50%, #fffbeb 100%)',
            border: '1px solid #fde68a',
            borderRadius: '14px',
            padding: '1.25rem 1.75rem',
            marginBottom: '1.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem',
            boxShadow: '0 2px 10px rgba(180, 83, 9, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                flexShrink: 0,
              }}
            >
              ⚖️
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#92400e', letterSpacing: '0.05em' }}>
                Net Working Capital Position (Receivables vs. Payables)
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '0.2rem' }}>
                {formatCurrencyINR(kpiData.receivablesVsPayables.netWorkingPositionInr)}
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#78350f', marginLeft: '0.75rem', display: 'inline-block' }}>
                  (Receivables: {formatCurrencyINR(kpiData.receivablesVsPayables.receivablesInr)} &ndash; Payables:{' '}
                  {formatCurrencyINR(kpiData.receivablesVsPayables.payablesInr)})
                </span>
              </div>
            </div>
          </div>
          <div className="fcc-nwc-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              href="/super-admin/finance/dues"
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                color: '#92400e',
                border: '1px solid #fde68a',
                textDecoration: 'none',
              }}
            >
              Supplier Aging &rarr;
            </Link>
            <Link
              href="/super-admin/finance/billing"
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#d97706',
                color: '#ffffff',
                border: 'none',
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)',
              }}
            >
              Billing Desk &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* 10 Core Authoritative Financial KPI Cards */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#92400e', marginBottom: '0.85rem' }}>
          Key Financial Metrics &amp; Cash Flow
        </div>

        {loadingKpi ? (
          <div className="fcc-kpi-grid">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: '115px',
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #fde68a',
                }}
              />
            ))}
          </div>
        ) : kpiData ? (
          <div className="fcc-kpi-grid">
            {/* 1. Actual Money Received */}
            <div className="fcc-kpi-card" style={{ backgroundColor: '#ffffff', border: '1px solid #a7f3d0', borderRadius: '14px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(16, 185, 129, 0.08)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                1. Money Received (Inflow)
              </div>
              <div className="fcc-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#065f46', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.actualMoneyReceived.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Confirmed billing collections &amp; receipts.
              </p>
              <Link href="/super-admin/finance/billing" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Collections &rarr;
              </Link>
            </div>

            {/* 2. Recognized Expenditure */}
            <div className="fcc-kpi-card" style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '14px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(217, 119, 6, 0.08)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                2. Approved Expenditure
              </div>
              <div className="fcc-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#92400e', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.recognizedExpenditure.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Approved operating, camp &amp; payroll liabilities.
              </p>
              <Link href="/super-admin/finance/expenses" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Expenses &rarr;
              </Link>
            </div>

            {/* 3. Actual Cash Outflows */}
            <div className="fcc-kpi-card" style={{ backgroundColor: '#ffffff', border: '1px solid #fecdd3', borderRadius: '14px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(225, 29, 72, 0.08)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#e11d48', textTransform: 'uppercase' }}>
                3. Cash Outflows
              </div>
              <div className="fcc-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#9f1239', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.actualCashOutflows.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Supplier payments &amp; salary transfers.
              </p>
              <Link href="/super-admin/finance/payments" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e11d48', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Disbursements &rarr;
              </Link>
            </div>

            {/* 4. Outstanding Payables */}
            <div className="fcc-kpi-card" style={{ backgroundColor: '#ffffff', border: '1px solid #fecaca', borderRadius: '14px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(220, 38, 38, 0.08)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>
                4. Outstanding Payables
              </div>
              <div className="fcc-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#991b1b', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.outstandingPayables.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Supplier dues ({formatCurrencyINR(kpiData.kpis.outstandingPayables.supplierPayablesInr)}) + Payroll.
              </p>
              <Link href="/super-admin/finance/dues" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Dues Roster &rarr;
              </Link>
            </div>

            {/* 5. Outstanding Receivables */}
            <div className="fcc-kpi-card" style={{ backgroundColor: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(37, 99, 235, 0.08)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                5. Blood Issue Receivables
              </div>
              <div className="fcc-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1e40af', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.outstandingReceivables.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Uncollected hospital invoice balances.
              </p>
              <Link href="/super-admin/finance/billing" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Invoices &rarr;
              </Link>
            </div>

            {/* 6. Blood Acquisition Cost */}
            <div className="fcc-kpi-card" style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '14px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(180, 83, 9, 0.06)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                6. Acquisition Cost
              </div>
              <div className="fcc-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.bloodAcquisitionCost.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Consignment unit charges &amp; transport.
              </p>
              <Link href="/super-admin/finance/acquisition-costing" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Acquisition &rarr;
              </Link>
            </div>

            {/* 7. Campaign Expenditure */}
            <div className="fcc-kpi-card" style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '14px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(180, 83, 9, 0.06)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                7. Campaign Expenses
              </div>
              <div className="fcc-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.campaignExpenditure.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Mobile camp logistics, canopy &amp; meals.
              </p>
              <Link href="/admin/campaigns" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Campaigns &rarr;
              </Link>
            </div>

            {/* 8. Payroll Expense */}
            <div className="fcc-kpi-card" style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '14px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(180, 83, 9, 0.06)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                8. Payroll Expense
              </div>
              <div className="fcc-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.payrollExpense.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Approved salary commitments for period.
              </p>
              <Link href="/super-admin/payroll" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Payroll &rarr;
              </Link>
            </div>

            {/* 9. Gross Invoices Billed */}
            <div className="fcc-kpi-card" style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '14px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(180, 83, 9, 0.06)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                9. Gross Billed
              </div>
              <div className="fcc-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.totalInvoicedGross.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Waivers: {formatCurrencyINR(kpiData.kpis.totalInvoicedGross.waiversInr)}
              </p>
              <Link href="/super-admin/finance/billing" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Invoices &rarr;
              </Link>
            </div>

            {/* 10. Total Collections Received */}
            <div className="fcc-kpi-card" style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '14px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(180, 83, 9, 0.06)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                10. Total Remittances
              </div>
              <div className="fcc-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.totalCollectionsReceived.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Cash, UPI &amp; card cashier desk receipts.
              </p>
              <Link href="/super-admin/finance/billing" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                Daily Register &rarr;
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* Visual Breakdowns Section */}
      {kpiData && (
        <div className="fcc-visual-grid">
          {/* Expense Category Breakdown */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '14px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(180, 83, 9, 0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#92400e', letterSpacing: '0.04em' }}>
                Expenditure Category Distribution
              </span>
              <span style={{ fontSize: '0.75rem', color: '#78350f', fontWeight: 600 }}>
                {kpiData.expenseCategoryBreakdown.length} Categories
              </span>
            </div>

            {kpiData.expenseCategoryBreakdown.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b', fontSize: '0.8rem' }}>
                No approved expenses recorded in this period.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {kpiData.expenseCategoryBreakdown.map((cat) => {
                  const maxAmt = Math.max(...kpiData.expenseCategoryBreakdown.map((c) => c.amountInr), 1);
                  const pct = Math.min(100, Math.round((cat.amountInr / maxAmt) * 100));
                  return (
                    <div key={cat.category}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: '#334155', fontWeight: 500 }}>{cat.label}</span>
                        <span style={{ color: '#0f172a', fontWeight: 700 }}>{formatCurrencyINR(cat.amountInr)}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#fef3c7', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: '#f59e0b',
                            borderRadius: '9999px',
                            transition: 'width 0.4s ease-out',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Method Distribution */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '14px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(180, 83, 9, 0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#92400e', letterSpacing: '0.04em' }}>
                Payment Channel Breakdown
              </span>
              <span style={{ fontSize: '0.75rem', color: '#78350f', fontWeight: 600 }}>
                Inflows &amp; Outflows
              </span>
            </div>

            {kpiData.paymentMethodBreakdown.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b', fontSize: '0.8rem' }}>
                No payment transactions recorded in this period.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {kpiData.paymentMethodBreakdown.map((pm) => {
                  const maxAmt = Math.max(...kpiData.paymentMethodBreakdown.map((p) => p.amountInr), 1);
                  const pct = Math.min(100, Math.round((pm.amountInr / maxAmt) * 100));
                  return (
                    <div key={pm.method}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: '#334155', fontWeight: 500 }}>{pm.label}</span>
                        <span style={{ color: '#0f172a', fontWeight: 700 }}>
                          {formatCurrencyINR(pm.amountInr)} <small style={{ color: '#64748b', fontWeight: 400 }}>({pm.count} txns)</small>
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#ecfdf5', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: '#10b981',
                            borderRadius: '9999px',
                            transition: 'width 0.4s ease-out',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🛡️ UNAPPROVED VENDOR BILLS & EXPENDITURES QUEUE */}
      <div
        className="fcc-card"
        style={{
          backgroundColor: '#ffffff',
          border: pendingExpenses.length > 0 ? '1px solid #d97706' : '1px solid #fde68a',
          borderRadius: '14px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 10px rgba(180, 83, 9, 0.06)',
        }}
      >
        <div
          className="fcc-section-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            borderBottom: '1px solid #fef3c7',
            paddingBottom: '1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.35rem' }}>🛡️</span>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#0f172a',
                  letterSpacing: '0.02em',
                }}
              >
                Unapproved Bills & Expenditure Approvals Queue
              </h2>
              {pendingExpenses.length > 0 ? (
                <span
                  style={{
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  ⚠️ {pendingExpenses.length} Bill{pendingExpenses.length > 1 ? 's' : ''} Awaiting Approval
                </span>
              ) : (
                <span
                  style={{
                    backgroundColor: '#ecfdf5',
                    color: '#065f46',
                    border: '1px solid #a7f3d0',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  ✓ Zero Unapproved Backlog
                </span>
              )}
            </div>
            <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.825rem' }}>
              Admin officers upload bills, merchant invoices, and field expenses here. Once approved by Super Admin, the status switches to APPROVED, and the dashboard automatically updates actual expenditures and payables.
            </p>
          </div>

          <div className="fcc-section-header-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={loadPendingExpenses}
              disabled={loadingPending}
              style={{
                backgroundColor: '#fffbeb',
                color: '#92400e',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: loadingPending ? 'not-allowed' : 'pointer',
              }}
            >
              🔄 Refresh Queue
            </button>
            <Link
              href="/super-admin/finance/approvals"
              style={{
                color: '#d97706',
                fontSize: '0.825rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Approvals Center &rarr;
            </Link>
          </div>
        </div>

        {/* Feedback message banner */}
        {approvalFeedbackMessage && (
          <div
            style={{
              backgroundColor: approvalFeedbackType === 'success' ? '#ecfdf5' : '#fef2f2',
              border: approvalFeedbackType === 'success' ? '1px solid #a7f3d0' : '1px solid #fecaca',
              color: approvalFeedbackType === 'success' ? '#065f46' : '#b91c1c',
              borderRadius: '8px',
              padding: '0.85rem 1.25rem',
              marginBottom: '1.25rem',
              fontSize: '0.85rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{approvalFeedbackMessage}</span>
            <button
              onClick={() => setApprovalFeedbackMessage(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '1rem',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Table of Unapproved Bills */}
        <div className="fcc-table-scroll admin-table-scroll" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: '940px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: '#fef3c7',
                  borderBottom: '1px solid #fde68a',
                  color: '#92400e',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <th style={{ padding: '0.75rem 0.85rem' }}>Invoice & Voucher #</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Title & Description</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Category & Cost Center</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Source / Campaign</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Vendor / Merchant</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Incurred Date</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Amount (₹)</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>Status</th>
                <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Super Admin Decision</th>
              </tr>
            </thead>
            <tbody>
              {pendingExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#10b981' }}>✓</div>
                    <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.95rem' }}>
                      No bills or expenditures awaiting approval
                    </strong>
                    <span style={{ fontSize: '0.8rem' }}>
                      All operator bills, invoices, and field claims have been reviewed and reconciled.
                    </span>
                  </td>
                </tr>
              ) : (
                pendingExpenses.map((exp) => (
                  <tr
                    key={exp._id}
                    style={{
                      borderBottom: '1px solid #fef3c7',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {/* Invoice & Voucher # */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          color: '#d97706',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                        }}
                      >
                        {exp.invoiceNumber ? `#${exp.invoiceNumber}` : 'NO-INVOICE'}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.725rem', fontFamily: 'monospace' }}>
                        {exp.expenseCode}
                      </div>
                      {exp.receipt?.fileId && (
                        <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => openExpenseReceiptInNewTab(exp._id)}
                            style={{
                              backgroundColor: '#fffbeb',
                              border: '1px solid #fde68a',
                              color: '#b45309',
                              borderRadius: '4px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            📄 View Bill
                          </button>
                          <button
                            onClick={() => downloadExpenseReceipt(exp._id, exp.receipt?.originalName)}
                            style={{
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              color: '#475569',
                              borderRadius: '4px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                            }}
                          >
                            💾 Download
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Title & Description */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>{exp.title}</div>
                      {exp.description && (
                        <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem', maxWidth: '240px' }}>
                          {exp.description}
                        </div>
                      )}
                    </td>

                    {/* Category & Cost Center */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <div style={{ color: '#334155', fontWeight: 500 }}>
                        {(EXPENSE_CATEGORY_LABELS as Record<string, string>)[exp.category] || exp.category}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.725rem' }}>
                        {exp.costCenter?.replace(/_/g, ' ') || 'General Ops'}
                      </div>
                    </td>

                    {/* Source / Campaign */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      {exp.campaignId ? (
                        <span
                          style={{
                            backgroundColor: '#fff1f2',
                            border: '1px solid #fecdd3',
                            color: '#e11d48',
                            borderRadius: '4px',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <span>🎪</span> Campaign Drive
                        </span>
                      ) : (
                        <span
                          style={{
                            backgroundColor: '#fffbeb',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            borderRadius: '4px',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.725rem',
                          }}
                        >
                          🏥 Central Ops
                        </span>
                      )}
                    </td>

                    {/* Vendor / Merchant */}
                    <td style={{ padding: '0.75rem 0.85rem', color: '#0f172a' }}>
                      {exp.vendorName || 'N/A'}
                    </td>

                    {/* Incurred Date */}
                    <td style={{ padding: '0.75rem 0.85rem', color: '#64748b' }}>
                      {new Date(exp.expenseDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <span style={{ color: '#d97706', fontWeight: 800, fontSize: '0.925rem' }}>
                        {formatCurrencyINR(exp.amount)}
                      </span>
                    </td>

                    {/* Status: NOT APPROVED */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <span
                        style={{
                          backgroundColor: '#fffbeb',
                          border: '1px solid #fde68a',
                          color: '#b45309',
                          padding: '0.25rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <span>⏳</span> NOT APPROVED
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          disabled={actionExpenseId === exp._id}
                          onClick={() => handleApproveBill(exp)}
                          style={{
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.4rem 0.85rem',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: actionExpenseId === exp._id ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                          }}
                        >
                          <span>✓</span> {actionExpenseId === exp._id ? 'Approving...' : 'Approve Bill'}
                        </button>

                        <button
                          disabled={actionExpenseId === exp._id}
                          onClick={() => handleRejectBill(exp)}
                          style={{
                            backgroundColor: 'transparent',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: actionExpenseId === exp._id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Central Financial Transaction Ledger */}
      <div
        className="fcc-card"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '14px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(180, 83, 9, 0.06)',
        }}
      >
        <div
          className="fcc-section-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            borderBottom: '1px solid #fef3c7',
            paddingBottom: '1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.02em' }}>
                Unified Financial Transaction Ledger
              </h2>
              <span
                style={{
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  borderRadius: '9999px',
                  padding: '0.15rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid #fde68a',
                }}
              >
                {ledgerData?.total || 0} Records
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Chronological audit timeline across billing, collections, expenses, supplier payments, and payroll.
            </p>
          </div>

          {/* Filter Controls */}
          <div className="fcc-ledger-filters" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
            {/* Search */}
            <input
              type="text"
              placeholder="Search reference, vendor, hospital..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #fde68a',
                color: '#0f172a',
                fontSize: '0.8rem',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                outline: 'none',
                minWidth: '220px',
              }}
            />

            {/* Direction Filter */}
            <select
              value={directionFilter}
              onChange={(e) => {
                setDirectionFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #fde68a',
                color: '#0f172a',
                fontSize: '0.8rem',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Directions</option>
              <option value={FinancialTransactionDirection.INFLOW}>Inflow (Received)</option>
              <option value={FinancialTransactionDirection.OUTFLOW}>Outflow (Disbursed)</option>
              <option value={FinancialTransactionDirection.ACCRUAL}>Accrual (Billed/Obligation)</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #fde68a',
                color: '#0f172a',
                fontSize: '0.8rem',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Transaction Types</option>
              <option value={FinancialTransactionType.BLOOD_ISSUE_COLLECTION}>Billing Collections</option>
              <option value={FinancialTransactionType.BLOOD_ISSUE_INVOICE}>Issue Invoices</option>
              <option value={FinancialTransactionType.EXPENSE_LIABILITY}>Expenses Recognized</option>
              <option value={FinancialTransactionType.EXPENSE_PAYMENT}>Supplier Disbursements</option>
              <option value={FinancialTransactionType.PAYROLL_DISBURSEMENT}>Salary Disbursements</option>
              <option value={FinancialTransactionType.BLOOD_ACQUISITION_COST}>Blood Acquisitions</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="fcc-table-scroll admin-table-scroll" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: '940px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#fef3c7', color: '#92400e', borderBottom: '1px solid #fde68a' }}>
                <th style={{ padding: '0.85rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '0.85rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Reference #</th>
                <th style={{ padding: '0.85rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Type &amp; Flow</th>
                <th style={{ padding: '0.85rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Category</th>
                <th style={{ padding: '0.85rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '0.85rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', textAlign: 'right' }}>Amount (₹)</th>
                <th style={{ padding: '0.85rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Method</th>
                <th style={{ padding: '0.85rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '0.85rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingLedger ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #fef3c7' }}>
                    <td colSpan={9} style={{ padding: '1rem 0.75rem' }}>
                      <div style={{ height: '16px', backgroundColor: '#fffbeb', borderRadius: '4px', width: '100%' }} />
                    </td>
                  </tr>
                ))
              ) : !ledgerData || ledgerData.items.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '3rem 0', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    No financial transactions match the selected filters or reporting period.
                  </td>
                </tr>
              ) : (
                ledgerData.items.map((item) => {
                  const dirBadge = getDirectionBadge(item.direction);
                  const statBadge = getStatusBadge(item.status);

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #fef3c7',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fffbeb')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.75rem', whiteSpace: 'nowrap', fontFamily: 'monospace', color: '#64748b' }}>
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                        {item.reference}
                      </td>
                      <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            backgroundColor: dirBadge.bg,
                            color: dirBadge.color,
                            border: `1px solid ${dirBadge.border}`,
                          }}
                        >
                          {dirBadge.label}
                        </span>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>{item.typeLabel}</div>
                      </td>
                      <td style={{ padding: '0.75rem', color: '#334155' }}>{item.category}</td>
                      <td style={{ padding: '0.75rem', color: '#475569', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                        {item.description}
                      </td>
                      <td
                        style={{
                          padding: '0.75rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          color:
                            item.direction === FinancialTransactionDirection.INFLOW
                              ? '#059669'
                              : item.direction === FinancialTransactionDirection.OUTFLOW
                              ? '#e11d48'
                              : '#0f172a',
                        }}
                      >
                        {item.direction === FinancialTransactionDirection.INFLOW ? '+ ' : ''}
                        {item.direction === FinancialTransactionDirection.OUTFLOW ? '- ' : ''}
                        {formatCurrencyINR(item.amountInr)}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {item.paymentMethod || '—'}
                      </td>
                      <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            backgroundColor: statBadge.bg,
                            color: statBadge.color,
                            border: `1px solid ${statBadge.border}`,
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {item.sourceLink ? (
                          <Link
                            href={item.sourceLink}
                            style={{
                              padding: '0.3rem 0.65rem',
                              borderRadius: '6px',
                              backgroundColor: '#fffbeb',
                              color: '#92400e',
                              border: '1px solid #fde68a',
                              textDecoration: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            View &rarr;
                          </Link>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {ledgerData && ledgerData.totalPages > 1 && (
          <div
            className="fcc-pagination"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '1.25rem',
              marginTop: '0.5rem',
              borderTop: '1px solid #fde68a',
              fontSize: '0.8rem',
              color: '#64748b',
            }}
          >
            <div>
              Showing page <strong style={{ color: '#0f172a' }}>{ledgerData.page}</strong> of{' '}
              <strong style={{ color: '#0f172a' }}>{ledgerData.totalPages}</strong> ({ledgerData.total} total items)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={ledgerData.page <= 1}
                style={{
                  padding: '0.4rem 0.85rem',
                  backgroundColor: '#fffbeb',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: ledgerData.page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: ledgerData.page <= 1 ? 0.4 : 1,
                }}
              >
                &larr; Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(ledgerData.totalPages, p + 1))}
                disabled={ledgerData.page >= ledgerData.totalPages}
                style={{
                  padding: '0.4rem 0.85rem',
                  backgroundColor: '#fffbeb',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: ledgerData.page >= ledgerData.totalPages ? 'not-allowed' : 'pointer',
                  opacity: ledgerData.page >= ledgerData.totalPages ? 0.4 : 1,
                }}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Purge Finance Confirmation Modal */}
      {showPurgeModal && (
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
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="fcc-purge-modal"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '2rem',
              border: '1px solid #fde68a',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                }}
              >
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  Purge All Financial Data?
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                  Permanently clear all test financial records across all finance modules.
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.5rem',
                fontSize: '0.85rem',
                color: '#92400e',
                lineHeight: 1.5,
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 700 }}>Data that will be cleared for testing:</p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                <li>All Expenses & Bills (Expenditure Management)</li>
                <li>All Payment Vouchers & Disbursements</li>
                <li>All Blood Issue Invoices & Collections</li>
                <li>All Monthly Payroll Runs, Salary Slips & Disbursements</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setShowPurgeModal(false)}
                disabled={purging}
                style={{
                  padding: '0.65rem 1.25rem',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: purging ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePurgeAllData}
                disabled={purging}
                style={{
                  padding: '0.65rem 1.25rem',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: purging ? 'not-allowed' : 'pointer',
                  opacity: purging ? 0.7 : 1,
                }}
              >
                {purging ? '⏳ Purging Records...' : 'Yes, Purge All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
