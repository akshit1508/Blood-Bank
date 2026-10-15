'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { useAdminAuth } from '@/context/AdminAuthContext';
import { AdminRole } from '@/lib/auth-api';

export default function FinancialControlCenterPage() {
  const { admin } = useAdminAuth();

  // Period state
  const [period, setPeriod] = useState<FinancialPeriodPreset>(FinancialPeriodPreset.THIS_MONTH);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [appliedCustom, setAppliedCustom] = useState<{ start: string; end: string } | null>(null);

  // Data state
  const [kpiData, setKpiData] = useState<FinancialKpiData | null>(null);
  const [trendsData, setTrendsData] = useState<FinancialTrendsResponse | null>(null);
  const [ledgerData, setLedgerData] = useState<FinancialLedgerResponse | null>(null);

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
      setErrorMessage(err?.message || 'Failed to load financial KPI data');
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
      // ledger error caught gracefully
    } finally {
      setLoadingLedger(false);
    }
  }, [period, appliedCustom, typeFilter, directionFilter, searchQuery, currentPage]);

  useEffect(() => {
    loadKpisAndTrends();
  }, [loadKpisAndTrends]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

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
    const s = status.toUpperCase();
    if (['APPROVED', 'PAID', 'COMPLETED', 'CONFIRMED', 'DISBURSED'].includes(s)) {
      return { bg: '#064e3b', color: '#34d399' };
    }
    if (['PENDING', 'PARTIALLY_PAID', 'PARTIALLY_COLLECTED', 'SUBMITTED', 'DRAFT'].includes(s)) {
      return { bg: '#451a03', color: '#fbbf24' };
    }
    if (['REJECTED', 'CANCELLED', 'REVERSED'].includes(s)) {
      return { bg: '#450a0a', color: '#f87171' };
    }
    return { bg: '#1e293b', color: '#cbd5e1' };
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-[#f8fafc] p-4 md:p-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-gradient-to-br from-red-600 to-rose-700 rounded-xl shadow-lg shadow-red-900/30 text-white font-black text-xl">
              ₹
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Financial Control Center
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800">
                  Super Admin Exclusive
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Centralized real-time accounting, multi-stream liquidity audit, cash vs. accruals, and transaction ledger.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1e293b] hover:bg-[#334155] text-slate-200 text-sm font-semibold rounded-lg border border-slate-700 transition disabled:opacity-50"
          >
            <span>{exportingCsv ? 'Exporting...' : '📥 Export CSV'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1e293b] hover:bg-[#334155] text-slate-200 text-sm font-semibold rounded-lg border border-slate-700 transition"
          >
            <span>🖨️ Print Statement</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 font-bold hover:text-red-200">
            ✕
          </button>
        </div>
      )}

      {/* Reporting Period Filter Bar */}
      <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Reporting Period Filter
          </span>
          {kpiData && (
            <span className="text-xs text-slate-400 font-medium">
              Active Range: <span className="text-slate-200 font-semibold">{kpiData.period.presetName}</span> (
              {new Date(kpiData.period.startDate).toLocaleDateString()} &ndash;{' '}
              {new Date(kpiData.period.endDate).toLocaleDateString()})
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: FinancialPeriodPreset.TODAY, label: 'Today' },
            { id: FinancialPeriodPreset.YESTERDAY, label: 'Yesterday' },
            { id: FinancialPeriodPreset.LAST_7_DAYS, label: 'Last 7 Days' },
            { id: FinancialPeriodPreset.LAST_15_DAYS, label: 'Last 15 Days' },
            { id: FinancialPeriodPreset.THIS_MONTH, label: 'This Month' },
            { id: FinancialPeriodPreset.LAST_MONTH, label: 'Last Month' },
            { id: FinancialPeriodPreset.THIS_FINANCIAL_YEAR, label: 'Financial Year (FY)' },
            { id: FinancialPeriodPreset.CUSTOM, label: 'Custom Range' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPeriod(p.id);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === p.id
                  ? 'bg-red-600 text-white shadow-md shadow-red-900/40 ring-1 ring-red-400'
                  : 'bg-[#1e293b] text-slate-300 hover:bg-[#334155] border border-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs */}
        {period === FinancialPeriodPreset.CUSTOM && (
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">From:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-[#1e293b] border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-[#1e293b] border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <button
              onClick={handleApplyCustomDates}
              disabled={!customStart || !customEnd}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
              Apply Filter
            </button>
          </div>
        )}
      </div>

      {/* Net Working Capital Liquidity Banner */}
      {kpiData && (
        <div className="bg-gradient-to-r from-slate-900 via-[#131d36] to-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-950/80 border border-blue-800 rounded-xl text-blue-400 text-xl font-black">
              ⚖️
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                Working Capital Position (Receivables vs. Payables)
              </div>
              <div className="text-xl md:text-2xl font-black text-white mt-0.5">
                {formatCurrencyINR(kpiData.receivablesVsPayables.netWorkingPositionInr)}
                <span className="text-xs font-normal text-slate-400 ml-2">
                  (Receivables: {formatCurrencyINR(kpiData.receivablesVsPayables.receivablesInr)} &ndash; Payables:{' '}
                  {formatCurrencyINR(kpiData.receivablesVsPayables.payablesInr)})
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/super-admin/finance/dues"
              className="text-xs px-3.5 py-2 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-slate-300 font-semibold border border-slate-700 transition"
            >
              View Supplier Aging &rarr;
            </Link>
            <Link
              href="/super-admin/finance/billing"
              className="text-xs px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-900/30 transition"
            >
              Billing Desk &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* 10 Core Authoritative Financial KPI Cards */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Key Performance Indicators &amp; Cash Flow
        </div>

        {loadingKpi ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-28 bg-[#0f172a] rounded-2xl animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : kpiData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Actual Money Received */}
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-emerald-900/40 shadow-lg relative overflow-hidden">
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                1. Money Received (Inflow)
              </div>
              <div className="text-xl font-extrabold text-emerald-300 mt-1">
                {formatCurrencyINR(kpiData.kpis.actualMoneyReceived.inr)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Confirmed billing collections &amp; receipts.
              </p>
              <Link href="/super-admin/finance/billing" className="text-[10px] text-emerald-400 font-bold hover:underline mt-2 inline-block">
                View Collections &rarr;
              </Link>
            </div>

            {/* 2. Recognized Expenditure */}
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-amber-900/40 shadow-lg relative overflow-hidden">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                2. Approved Expenditure
              </div>
              <div className="text-xl font-extrabold text-amber-300 mt-1">
                {formatCurrencyINR(kpiData.kpis.recognizedExpenditure.inr)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Approved operating, camp &amp; payroll liabilities.
              </p>
              <Link href="/super-admin/finance/expenses" className="text-[10px] text-amber-400 font-bold hover:underline mt-2 inline-block">
                View Expenses &rarr;
              </Link>
            </div>

            {/* 3. Actual Cash Outflows */}
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-rose-900/40 shadow-lg relative overflow-hidden">
              <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wide">
                3. Cash Outflows
              </div>
              <div className="text-xl font-extrabold text-rose-300 mt-1">
                {formatCurrencyINR(kpiData.kpis.actualCashOutflows.inr)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Actual supplier payments &amp; salary transfers.
              </p>
              <Link href="/super-admin/finance/payments" className="text-[10px] text-rose-400 font-bold hover:underline mt-2 inline-block">
                View Disbursements &rarr;
              </Link>
            </div>

            {/* 4. Outstanding Payables */}
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-red-900/40 shadow-lg relative overflow-hidden">
              <div className="text-[11px] font-bold text-red-400 uppercase tracking-wide">
                4. Outstanding Payables
              </div>
              <div className="text-xl font-extrabold text-red-300 mt-1">
                {formatCurrencyINR(kpiData.kpis.outstandingPayables.inr)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Supplier dues ({formatCurrencyINR(kpiData.kpis.outstandingPayables.supplierPayablesInr)}) + Payroll.
              </p>
              <Link href="/super-admin/finance/dues" className="text-[10px] text-red-400 font-bold hover:underline mt-2 inline-block">
                View Dues Roster &rarr;
              </Link>
            </div>

            {/* 5. Outstanding Receivables */}
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-blue-900/40 shadow-lg relative overflow-hidden">
              <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wide">
                5. Blood Issue Receivables
              </div>
              <div className="text-xl font-extrabold text-blue-300 mt-1">
                {formatCurrencyINR(kpiData.kpis.outstandingReceivables.inr)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Uncollected hospital invoice balances.
              </p>
              <Link href="/super-admin/finance/billing" className="text-[10px] text-blue-400 font-bold hover:underline mt-2 inline-block">
                View Invoices &rarr;
              </Link>
            </div>

            {/* 6. Blood Acquisition Cost */}
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                6. Blood Acquisition Cost
              </div>
              <div className="text-xl font-extrabold text-slate-100 mt-1">
                {formatCurrencyINR(kpiData.kpis.bloodAcquisitionCost.inr)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                External consignment unit charges &amp; transport.
              </p>
              <Link href="/super-admin/finance/acquisition-costing" className="text-[10px] text-slate-300 font-bold hover:underline mt-2 inline-block">
                View Acquisition &rarr;
              </Link>
            </div>

            {/* 7. Campaign Expenditure */}
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                7. Campaign Expenses
              </div>
              <div className="text-xl font-extrabold text-slate-100 mt-1">
                {formatCurrencyINR(kpiData.kpis.campaignExpenditure.inr)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Mobile camp logistics, canopy, &amp; refreshments.
              </p>
              <Link href="/admin/campaigns" className="text-[10px] text-slate-300 font-bold hover:underline mt-2 inline-block">
                View Campaigns &rarr;
              </Link>
            </div>

            {/* 8. Payroll Expense */}
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                8. Payroll Expense
              </div>
              <div className="text-xl font-extrabold text-slate-100 mt-1">
                {formatCurrencyINR(kpiData.kpis.payrollExpense.inr)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Net approved salary commitments for period.
              </p>
              <Link href="/super-admin/payroll" className="text-[10px] text-slate-300 font-bold hover:underline mt-2 inline-block">
                View Payroll &rarr;
              </Link>
            </div>

            {/* 9. Total Invoices Billed */}
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                9. Gross Invoices Billed
              </div>
              <div className="text-xl font-extrabold text-slate-100 mt-1">
                {formatCurrencyINR(kpiData.kpis.totalInvoicedGross.inr)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Waivers: {formatCurrencyINR(kpiData.kpis.totalInvoicedGross.waiversInr)}
              </p>
              <Link href="/super-admin/finance/billing" className="text-[10px] text-slate-300 font-bold hover:underline mt-2 inline-block">
                View Billing &rarr;
              </Link>
            </div>

            {/* 10. Total Collections Received */}
            <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                10. Total Billing Remittances
              </div>
              <div className="text-xl font-extrabold text-slate-100 mt-1">
                {formatCurrencyINR(kpiData.kpis.totalCollectionsReceived.inr)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Cashier receipts across payment methods.
              </p>
              <Link href="/super-admin/finance/billing" className="text-[10px] text-slate-300 font-bold hover:underline mt-2 inline-block">
                Daily Register &rarr;
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* Visual Breakdowns Section */}
      {kpiData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expense Category Breakdown */}
          <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>Expenditure Category Distribution</span>
              <span className="text-xs font-normal text-slate-400">
                {kpiData.expenseCategoryBreakdown.length} Categories
              </span>
            </h3>

            {kpiData.expenseCategoryBreakdown.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No approved expenses recorded in this period.
              </div>
            ) : (
              <div className="space-y-3">
                {kpiData.expenseCategoryBreakdown.map((cat) => {
                  const maxAmt = Math.max(...kpiData.expenseCategoryBreakdown.map((c) => c.amountInr), 1);
                  const pct = Math.round((cat.amountInr / maxAmt) * 100);
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">{cat.label}</span>
                        <span className="text-slate-100 font-bold">{formatCurrencyINR(cat.amountInr)}</span>
                      </div>
                      <div className="w-full bg-[#1e293b] rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Method Distribution */}
          <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>Payment Channel Breakdown</span>
              <span className="text-xs font-normal text-slate-400">
                Inflows &amp; Outflows
              </span>
            </h3>

            {kpiData.paymentMethodBreakdown.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No payment transactions recorded in this period.
              </div>
            ) : (
              <div className="space-y-3">
                {kpiData.paymentMethodBreakdown.map((pm) => {
                  const maxAmt = Math.max(...kpiData.paymentMethodBreakdown.map((p) => p.amountInr), 1);
                  const pct = Math.round((pm.amountInr / maxAmt) * 100);
                  return (
                    <div key={pm.method} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">{pm.label}</span>
                        <span className="text-slate-100 font-bold">
                          {formatCurrencyINR(pm.amountInr)} ({pm.count} txns)
                        </span>
                      </div>
                      <div className="w-full bg-[#1e293b] rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
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

      {/* Central Financial Transaction Ledger */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 shadow-xl overflow-hidden space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-base font-extrabold uppercase tracking-wide text-white flex items-center gap-2">
              <span>Unified Financial Transaction Ledger</span>
              <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {ledgerData?.total || 0} Records
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Complete, chronological audit timeline across billing, collections, expenses, supplier payments, and payroll.
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <input
              type="text"
              placeholder="Search reference, vendor, party..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#1e293b] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500 w-48"
            />

            {/* Direction Filter */}
            <select
              value={directionFilter}
              onChange={(e) => {
                setDirectionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#1e293b] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500"
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
              className="bg-[#1e293b] border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500"
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider bg-[#0b1120]/50">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Reference #</th>
                <th className="py-3 px-3">Type &amp; Flow</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3 text-right">Amount (₹)</th>
                <th className="py-3 px-3">Method</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loadingLedger ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="py-3 px-3">
                      <div className="h-5 bg-[#1e293b] rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : !ledgerData || ledgerData.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No transactions match the selected filters or reporting period.
                  </td>
                </tr>
              ) : (
                ledgerData.items.map((item) => {
                  const dirBadge = getDirectionBadge(item.direction);
                  const statBadge = getStatusBadge(item.status);

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 whitespace-nowrap text-slate-300 font-mono">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">
                        {item.reference}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-extrabold border"
                          style={{
                            backgroundColor: dirBadge.bg,
                            color: dirBadge.color,
                            borderColor: dirBadge.border,
                          }}
                        >
                          {dirBadge.label}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.typeLabel}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{item.category}</td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={item.description}>
                        {item.description}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap font-bold">
                        <span
                          className={
                            item.direction === FinancialTransactionDirection.INFLOW
                              ? 'text-emerald-400'
                              : item.direction === FinancialTransactionDirection.OUTFLOW
                              ? 'text-rose-400'
                              : 'text-slate-200'
                          }
                        >
                          {item.direction === FinancialTransactionDirection.INFLOW ? '+ ' : ''}
                          {item.direction === FinancialTransactionDirection.OUTFLOW ? '- ' : ''}
                          {formatCurrencyINR(item.amountInr)}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                        {item.paymentMethod || '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{
                            backgroundColor: statBadge.bg,
                            color: statBadge.color,
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.sourceLink ? (
                          <Link
                            href={item.sourceLink}
                            className="px-2 py-1 rounded bg-[#1e293b] hover:bg-[#334155] text-slate-300 hover:text-white text-[11px] font-semibold border border-slate-700 transition"
                          >
                            View &rarr;
                          </Link>
                        ) : (
                          <span className="text-slate-600">—</span>
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
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
            <div>
              Showing page <span className="text-slate-200 font-bold">{ledgerData.page}</span> of{' '}
              <span className="text-slate-200 font-bold">{ledgerData.totalPages}</span> ({ledgerData.total} total items)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={ledgerData.page <= 1}
                className="px-3 py-1.5 rounded bg-[#1e293b] hover:bg-[#334155] text-slate-200 font-semibold disabled:opacity-40 transition"
              >
                &larr; Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(ledgerData.totalPages, p + 1))}
                disabled={ledgerData.page >= ledgerData.totalPages}
                className="px-3 py-1.5 rounded bg-[#1e293b] hover:bg-[#334155] text-slate-200 font-semibold disabled:opacity-40 transition"
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
