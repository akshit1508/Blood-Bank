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
        return { label: 'INFLOW', bg: '#064e3b', color: '#34d399', border: '#059669' };
      case FinancialTransactionDirection.OUTFLOW:
        return { label: 'OUTFLOW', bg: '#4c0519', color: '#fb7185', border: '#e11d48' };
      case FinancialTransactionDirection.ACCRUAL:
        return { label: 'ACCRUAL', bg: '#1e293b', color: '#93c5fd', border: '#3b82f6' };
      case FinancialTransactionDirection.ADJUSTMENT:
        return { label: 'ADJUSTMENT', bg: '#312e81', color: '#c084fc', border: '#8b5cf6' };
      default:
        return { label: dir, bg: '#1e293b', color: '#94a3b8', border: '#475569' };
    }
  };

  // Helper for status badge
  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (['APPROVED', 'PAID', 'COMPLETED', 'CONFIRMED', 'DISBURSED'].includes(s)) {
      return { bg: '#064e3b', color: '#34d399', border: '#059669' };
    }
    if (['PENDING', 'PARTIALLY_PAID', 'PARTIALLY_COLLECTED', 'SUBMITTED', 'DRAFT'].includes(s)) {
      return { bg: '#451a03', color: '#fbbf24', border: '#b45309' };
    }
    if (['REJECTED', 'CANCELLED', 'REVERSED'].includes(s)) {
      return { bg: '#450a0a', color: '#f87171', border: '#dc2626' };
    }
    return { bg: '#1e293b', color: '#cbd5e1', border: '#334155' };
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0b1120',
        color: '#f8fafc',
        padding: '2rem 2.5rem',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '1.75rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.65rem',
              fontWeight: 900,
              color: '#ffffff',
              boxShadow: '0 8px 20px rgba(220, 38, 38, 0.3)',
            }}
          >
            ₹
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Financial Control Center
              </h1>
              <span
                style={{
                  backgroundColor: '#450a0a',
                  color: '#f87171',
                  border: '1px solid #7f1d1d',
                  borderRadius: '9999px',
                  padding: '0.2rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                Super Admin Exclusive
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Centralized real-time accounting, multi-stream liquidity audit, cash vs. accruals, and transaction ledger.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.15rem',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: exportingCsv ? 'not-allowed' : 'pointer',
              opacity: exportingCsv ? 0.6 : 1,
              transition: 'background-color 0.2s',
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
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            <span>🖨️ Print Statement</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            color: '#fecaca',
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
              color: '#f87171',
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
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Reporting Period Filter
          </span>
          {kpiData && (
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Active Range: <strong style={{ color: '#f8fafc' }}>{kpiData.period.presetName}</strong> (
              {new Date(kpiData.period.startDate).toLocaleDateString()} &ndash;{' '}
              {new Date(kpiData.period.endDate).toLocaleDateString()})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
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
                  backgroundColor: isActive ? '#dc2626' : '#1e293b',
                  color: isActive ? '#ffffff' : '#cbd5e1',
                  border: isActive ? '1px solid #ef4444' : '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 700 : 600,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 8px rgba(220, 38, 38, 0.4)' : 'none',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Inputs */}
        {period === FinancialPeriodPreset.CUSTOM && (
          <div
            style={{
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ color: '#94a3b8' }}>From Date:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  padding: '0.4rem 0.65rem',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ color: '#94a3b8' }}>To Date:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
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
                backgroundColor: '#dc2626',
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
          style={{
            background: 'linear-gradient(90deg, #0f172a 0%, #172554 50%, #0f172a 100%)',
            border: '1px solid #1e3a8a',
            borderRadius: '14px',
            padding: '1.25rem 1.75rem',
            marginBottom: '1.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: '#1e3a8a',
                border: '1px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
              }}
            >
              ⚖️
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#93c5fd', letterSpacing: '0.05em' }}>
                Net Working Capital Position (Receivables vs. Payables)
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#ffffff', marginTop: '0.2rem' }}>
                {formatCurrencyINR(kpiData.receivablesVsPayables.netWorkingPositionInr)}
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8', marginLeft: '0.75rem' }}>
                  (Receivables: {formatCurrencyINR(kpiData.receivablesVsPayables.receivablesInr)} &ndash; Payables:{' '}
                  {formatCurrencyINR(kpiData.receivablesVsPayables.payablesInr)})
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              href="/super-admin/finance/dues"
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155',
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
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
              }}
            >
              Billing Desk &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* 10 Core Authoritative Financial KPI Cards */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '0.85rem' }}>
          Key Financial Metrics &amp; Cash Flow
        </div>

        {loadingKpi ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1rem' }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: '115px',
                  backgroundColor: '#0f172a',
                  borderRadius: '14px',
                  border: '1px solid #1e293b',
                }}
              />
            ))}
          </div>
        ) : kpiData ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1rem' }}>
            {/* 1. Actual Money Received */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #065f46', borderRadius: '14px', padding: '1.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>
                1. Money Received (Inflow)
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#6ee7b7', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.actualMoneyReceived.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Confirmed billing collections &amp; receipts.
              </p>
              <Link href="/super-admin/finance/billing" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Collections &rarr;
              </Link>
            </div>

            {/* 2. Recognized Expenditure */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #92400e', borderRadius: '14px', padding: '1.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
                2. Approved Expenditure
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fcd34d', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.recognizedExpenditure.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Approved operating, camp &amp; payroll liabilities.
              </p>
              <Link href="/super-admin/finance/expenses" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Expenses &rarr;
              </Link>
            </div>

            {/* 3. Actual Cash Outflows */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #9f1239', borderRadius: '14px', padding: '1.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fb7185', textTransform: 'uppercase' }}>
                3. Cash Outflows
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fda4af', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.actualCashOutflows.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Supplier payments &amp; salary transfers.
              </p>
              <Link href="/super-admin/finance/payments" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fb7185', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Disbursements &rarr;
              </Link>
            </div>

            {/* 4. Outstanding Payables */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #991b1b', borderRadius: '14px', padding: '1.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase' }}>
                4. Outstanding Payables
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fca5a5', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.outstandingPayables.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Supplier dues ({formatCurrencyINR(kpiData.kpis.outstandingPayables.supplierPayablesInr)}) + Payroll.
              </p>
              <Link href="/super-admin/finance/dues" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Dues Roster &rarr;
              </Link>
            </div>

            {/* 5. Outstanding Receivables */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e40af', borderRadius: '14px', padding: '1.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase' }}>
                5. Blood Issue Receivables
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#93c5fd', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.outstandingReceivables.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Uncollected hospital invoice balances.
              </p>
              <Link href="/super-admin/finance/billing" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Invoices &rarr;
              </Link>
            </div>

            {/* 6. Blood Acquisition Cost */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '1.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                6. Acquisition Cost
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ffffff', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.bloodAcquisitionCost.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Consignment unit charges &amp; transport.
              </p>
              <Link href="/super-admin/finance/acquisition-costing" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Acquisition &rarr;
              </Link>
            </div>

            {/* 7. Campaign Expenditure */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '1.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                7. Campaign Expenses
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ffffff', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.campaignExpenditure.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Mobile camp logistics, canopy &amp; meals.
              </p>
              <Link href="/admin/campaigns" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Campaigns &rarr;
              </Link>
            </div>

            {/* 8. Payroll Expense */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '1.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                8. Payroll Expense
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ffffff', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.payrollExpense.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Approved salary commitments for period.
              </p>
              <Link href="/super-admin/payroll" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Payroll &rarr;
              </Link>
            </div>

            {/* 9. Gross Invoices Billed */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '1.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                9. Gross Billed
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ffffff', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.totalInvoicedGross.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Waivers: {formatCurrencyINR(kpiData.kpis.totalInvoicedGross.waiversInr)}
              </p>
              <Link href="/super-admin/finance/billing" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                View Invoices &rarr;
              </Link>
            </div>

            {/* 10. Total Collections Received */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '1.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                10. Total Remittances
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ffffff', marginTop: '0.4rem' }}>
                {formatCurrencyINR(kpiData.kpis.totalCollectionsReceived.inr)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.35rem 0 0 0', lineHeight: 1.35 }}>
                Cash, UPI &amp; card cashier desk receipts.
              </p>
              <Link href="/super-admin/finance/billing" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textDecoration: 'none', marginTop: '0.65rem', display: 'inline-block' }}>
                Daily Register &rarr;
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* Visual Breakdowns Section */}
      {kpiData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Expense Category Breakdown */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '14px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '0.04em' }}>
                Expenditure Category Distribution
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
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
                        <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{cat.label}</span>
                        <span style={{ color: '#f8fafc', fontWeight: 700 }}>{formatCurrencyINR(cat.amountInr)}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '9999px', overflow: 'hidden' }}>
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
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '14px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '0.04em' }}>
                Payment Channel Breakdown
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
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
                        <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{pm.label}</span>
                        <span style={{ color: '#f8fafc', fontWeight: 700 }}>
                          {formatCurrencyINR(pm.amountInr)} <small style={{ color: '#94a3b8', fontWeight: 400 }}>({pm.count} txns)</small>
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '9999px', overflow: 'hidden' }}>
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
        style={{
          backgroundColor: '#0f172a',
          border: pendingExpenses.length > 0 ? '1px solid #d97706' : '1px solid #1e293b',
          borderRadius: '14px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            borderBottom: '1px solid #1e293b',
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
                  color: '#ffffff',
                  letterSpacing: '0.02em',
                }}
              >
                Unapproved Bills & Expenditure Approvals Queue
              </h2>
              {pendingExpenses.length > 0 ? (
                <span
                  style={{
                    backgroundColor: '#78350f',
                    color: '#fef3c7',
                    border: '1px solid #d97706',
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
                    backgroundColor: '#064e3b',
                    color: '#a7f3d0',
                    border: '1px solid #059669',
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
            <p style={{ margin: '0.35rem 0 0 0', color: '#94a3b8', fontSize: '0.825rem' }}>
              Admin officers upload bills, merchant invoices, and field expenses here. Once approved by Super Admin, the status switches to APPROVED, and the dashboard automatically updates actual expenditures and payables.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={loadPendingExpenses}
              disabled={loadingPending}
              style={{
                backgroundColor: '#1e293b',
                color: '#94a3b8',
                border: '1px solid #334155',
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
                color: '#38bdf8',
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
              backgroundColor: approvalFeedbackType === 'success' ? '#064e3b' : '#450a0a',
              border: approvalFeedbackType === 'success' ? '1px solid #059669' : '1px solid #dc2626',
              color: approvalFeedbackType === 'success' ? '#a7f3d0' : '#fecaca',
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: '#1e293b',
                  borderBottom: '1px solid #334155',
                  color: '#94a3b8',
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
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>✓</div>
                    <strong style={{ color: '#94a3b8', display: 'block', fontSize: '0.95rem' }}>
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
                      borderBottom: '1px solid #1e293b',
                      backgroundColor: '#17120a',
                    }}
                  >
                    {/* Invoice & Voucher # */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          color: '#f59e0b',
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
                              backgroundColor: '#0369a130',
                              border: '1px solid #0284c7',
                              color: '#38bdf8',
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
                              backgroundColor: '#1e293b',
                              border: '1px solid #475569',
                              color: '#cbd5e1',
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
                      <div style={{ color: '#f8fafc', fontWeight: 600 }}>{exp.title}</div>
                      {exp.description && (
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.2rem', maxWidth: '240px' }}>
                          {exp.description}
                        </div>
                      )}
                    </td>

                    {/* Category & Cost Center */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 500 }}>
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
                            backgroundColor: '#88133730',
                            border: '1px solid #be123c',
                            color: '#fda4af',
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
                            backgroundColor: '#1e293b',
                            color: '#94a3b8',
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
                    <td style={{ padding: '0.75rem 0.85rem', color: '#cbd5e1' }}>
                      {exp.vendorName || 'N/A'}
                    </td>

                    {/* Incurred Date */}
                    <td style={{ padding: '0.75rem 0.85rem', color: '#94a3b8' }}>
                      {new Date(exp.expenseDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.925rem' }}>
                        {formatCurrencyINR(exp.amount)}
                      </span>
                    </td>

                    {/* Status: NOT APPROVED */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <span
                        style={{
                          backgroundColor: '#451a03',
                          border: '1px solid #d97706',
                          color: '#fef3c7',
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
                            color: '#f87171',
                            border: '1px solid #7f1d1d',
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
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '14px',
          padding: '1.5rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            borderBottom: '1px solid #1e293b',
            paddingBottom: '1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.02em' }}>
                Unified Financial Transaction Ledger
              </h2>
              <span
                style={{
                  backgroundColor: '#1e293b',
                  color: '#cbd5e1',
                  borderRadius: '9999px',
                  padding: '0.15rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid #334155',
                }}
              >
                {ledgerData?.total || 0} Records
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Chronological audit timeline across billing, collections, expenses, supplier payments, and payroll.
            </p>
          </div>

          {/* Filter Controls */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
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
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
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
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
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
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#0b1120', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
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
                  <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td colSpan={9} style={{ padding: '1rem 0.75rem' }}>
                      <div style={{ height: '16px', backgroundColor: '#1e293b', borderRadius: '4px', width: '100%' }} />
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
                        borderBottom: '1px solid #1e293b',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.4)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.75rem', whiteSpace: 'nowrap', fontFamily: 'monospace', color: '#cbd5e1' }}>
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc' }}>
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
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>{item.typeLabel}</div>
                      </td>
                      <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>{item.category}</td>
                      <td style={{ padding: '0.75rem', color: '#cbd5e1', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
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
                              ? '#34d399'
                              : item.direction === FinancialTransactionDirection.OUTFLOW
                              ? '#fb7185'
                              : '#f8fafc',
                        }}
                      >
                        {item.direction === FinancialTransactionDirection.INFLOW ? '+ ' : ''}
                        {item.direction === FinancialTransactionDirection.OUTFLOW ? '- ' : ''}
                        {formatCurrencyINR(item.amountInr)}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
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
                              backgroundColor: '#1e293b',
                              color: '#93c5fd',
                              border: '1px solid #334155',
                              textDecoration: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            View &rarr;
                          </Link>
                        ) : (
                          <span style={{ color: '#475569' }}>—</span>
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
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '1.25rem',
              marginTop: '0.5rem',
              borderTop: '1px solid #1e293b',
              fontSize: '0.8rem',
              color: '#94a3b8',
            }}
          >
            <div>
              Showing page <strong style={{ color: '#f8fafc' }}>{ledgerData.page}</strong> of{' '}
              <strong style={{ color: '#f8fafc' }}>{ledgerData.totalPages}</strong> ({ledgerData.total} total items)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={ledgerData.page <= 1}
                style={{
                  padding: '0.4rem 0.85rem',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
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
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
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
    </div>
  );
}
