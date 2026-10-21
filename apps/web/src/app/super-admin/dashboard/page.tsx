'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Users,
  ShieldCheck,
  Droplet,
  Boxes,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Calendar,
  RefreshCw,
  ArrowRight,
  Lock,
  PackageCheck,
  AlertCircle,
  Syringe,
  FlaskConical,
  CreditCard,
  Building,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import StatCard from '@/components/admin/StatCard';
import InventoryBarChart from '@/components/admin/InventoryBarChart';
import RequestStatusDonut from '@/components/admin/RequestStatusDonut';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { TableSkeleton } from '@/components/admin/LoadingSkeleton';

import {
  fetchInventorySummary,
  fetchInventory,
  InventorySummary,
  InventoryItem,
} from '@/lib/inventory-api';
import { fetchDonors, Donor } from '@/lib/donor-api';
import { fetchDonations } from '@/lib/donation-api';
import {
  fetchBloodRequests,
  BloodRequest,
  BloodRequestStatus,
} from '@/lib/blood-request-api';
import { fetchTestingRecords, BloodTesting } from '@/lib/testing-api';
import { fetchExpenseSummary, ExpenseSummaryStats } from '@/lib/expense-api';
import { fetchOutstandingDues, OutstandingDuesReport } from '@/lib/payment-api';
import { fetchRevenueSummary, RevenueSummaryData } from '@/lib/billing-api';
import {
  fetchFinancialKpiSummary,
  FinancialKpiData,
  FinancialPeriodPreset,
} from '@/lib/financial-control-center-api';
import UnifiedDateFilterBar from '@/components/admin/UnifiedDateFilterBar';

export type DateFilterPreset = 'all' | 'today' | '7days' | '15days' | '30days' | 'this_month' | 'custom';

const formatINR = (amount: number | undefined | null) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
};

export default function SuperAdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const horizonScrollRef = useRef<HTMLDivElement>(null);

  const scrollHorizon = (direction: 'left' | 'right') => {
    if (horizonScrollRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      horizonScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Operational metrics datasets
  const [rawSummary, setRawSummary] = useState<InventorySummary | null>(null);
  const [rawDonors, setRawDonors] = useState<Donor[]>([]);
  const [rawDonations, setRawDonations] = useState<any[]>([]);
  const [rawRequests, setRawRequests] = useState<BloodRequest[]>([]);
  const [rawTestingRecords, setRawTestingRecords] = useState<BloodTesting[]>([]);
  const [rawInventoryItems, setRawInventoryItems] = useState<InventoryItem[]>([]);
  const [expiringUnits, setExpiringUnits] = useState<InventoryItem[]>([]);

  // Financial summary metrics
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummaryStats | null>(null);
  const [duesSummary, setDuesSummary] = useState<OutstandingDuesReport | null>(null);
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummaryData | null>(null);
  const [financialKpiData, setFinancialKpiData] = useState<FinancialKpiData | null>(null);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let periodPreset: FinancialPeriodPreset = FinancialPeriodPreset.THIS_MONTH;
      if (dateFilter === 'today') periodPreset = FinancialPeriodPreset.TODAY;
      else if (dateFilter === '7days') periodPreset = FinancialPeriodPreset.LAST_7_DAYS;
      else if (dateFilter === '15days') periodPreset = FinancialPeriodPreset.LAST_15_DAYS;
      else if (dateFilter === '30days') periodPreset = FinancialPeriodPreset.THIS_MONTH;
      else if (dateFilter === 'this_month') periodPreset = FinancialPeriodPreset.THIS_MONTH;
      else if (dateFilter === 'custom' && customStartDate && customEndDate) periodPreset = FinancialPeriodPreset.CUSTOM;
      else if (dateFilter === 'all') periodPreset = FinancialPeriodPreset.THIS_FINANCIAL_YEAR;

      const sDate = dateFilter === 'custom' ? customStartDate : undefined;
      const eDate = dateFilter === 'custom' ? customEndDate : undefined;

      const [
        summaryRes,
        donorsRes,
        donationsRes,
        requestsRes,
        testingRes,
        expiringRes,
        allInvRes,
        expenseRes,
        duesRes,
        revenueRes,
        kpiRes,
      ] = await Promise.all([
        fetchInventorySummary().catch(() => null),
        fetchDonors().catch(() => []),
        fetchDonations({ limit: 1000 }).catch(() => ({ total: 0, items: [] } as any)),
        fetchBloodRequests().catch(() => []),
        fetchTestingRecords({ limit: 1000 }).catch(() => ({ total: 0, items: [] } as any)),
        fetchInventory({ expiringSoon: true }).catch(() => ({ items: [] } as any)),
        fetchInventory({ limit: 1000 }).catch(() => ({ items: [] } as any)),
        fetchExpenseSummary(sDate, eDate).catch(() => null),
        fetchOutstandingDues().catch(() => null),
        fetchRevenueSummary().catch(() => null),
        fetchFinancialKpiSummary(periodPreset, sDate, eDate).catch(() => null),
      ]);

      setRawSummary(summaryRes);
      setRawDonors(Array.isArray(donorsRes) ? donorsRes : []);
      setRawDonations(donationsRes?.items || []);
      setRawRequests(Array.isArray(requestsRes) ? requestsRes : []);
      setRawTestingRecords(testingRes?.items || []);
      setExpiringUnits(expiringRes?.items || []);
      setRawInventoryItems(allInvRes?.items || []);
      setExpenseSummary(expenseRes);
      setDuesSummary(duesRes);
      setRevenueSummary(revenueRes);
      setFinancialKpiData(kpiRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to aggregate system, operational, and financial metrics.');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Compute active date boundaries [startMs, endMs]
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    if (dateFilter === 'all') return null;

    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start: start.getTime(), end: end.getTime() };
    }

    if (dateFilter === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { start: start.getTime(), end: now.getTime() };
    }

    if (dateFilter === '15days') {
      const start = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { start: start.getTime(), end: now.getTime() };
    }

    if (dateFilter === '30days') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { start: start.getTime(), end: now.getTime() };
    }

    if (dateFilter === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start: start.getTime(), end: now.getTime() };
    }

    if (dateFilter === 'custom') {
      const startMs = customStartDate
        ? new Date(`${customStartDate}T00:00:00`).getTime()
        : 0;
      const endMs = customEndDate
        ? new Date(`${customEndDate}T23:59:59.999`).getTime()
        : Number.MAX_SAFE_INTEGER;
      return { start: startMs, end: endMs };
    }

    return null;
  }, [dateFilter, customStartDate, customEndDate]);

  // Generic date filter predicate
  const isDateInRange = useCallback(
    (dateStr?: string | null) => {
      if (!dateRangeBounds) return true;
      if (!dateStr) return false;
      const t = new Date(dateStr).getTime();
      return !isNaN(t) && t >= dateRangeBounds.start && t <= dateRangeBounds.end;
    },
    [dateRangeBounds]
  );

  // Filtered operational datasets according to selected date span
  const filteredDonations = useMemo(() => {
    return rawDonations.filter((d) => isDateInRange(d.donationDate || d.createdAt));
  }, [rawDonations, isDateInRange]);

  const filteredDonors = useMemo(() => {
    return rawDonors.filter((d) => isDateInRange(d.createdAt));
  }, [rawDonors, isDateInRange]);

  const filteredRequests = useMemo(() => {
    return rawRequests.filter((r) => isDateInRange(r.requiredDate || (r as any).createdAt));
  }, [rawRequests, isDateInRange]);

  const filteredTestingRecords = useMemo(() => {
    return rawTestingRecords.filter((t) => isDateInRange(t.startedAt || (t as any).createdAt));
  }, [rawTestingRecords, isDateInRange]);

  const filteredInventoryItems = useMemo(() => {
    return rawInventoryItems.filter((i) =>
      isDateInRange(i.createdAt || i.bloodUnit?.expiryDate || (i as any).expirationDate)
    );
  }, [rawInventoryItems, isDateInRange]);

  // Derived KPI Counts
  const availableInventoryCount = useMemo(() => {
    if (!dateRangeBounds && rawSummary?.totalAvailable !== undefined) {
      return rawSummary.totalAvailable;
    }
    return filteredInventoryItems.filter((item) => item.status === 'AVAILABLE').length;
  }, [dateRangeBounds, rawSummary, filteredInventoryItems]);

  const reservedCount = useMemo(() => {
    return filteredInventoryItems.filter((item) => item.status === 'RESERVED').length;
  }, [filteredInventoryItems]);

  const issuedCount = useMemo(() => {
    return filteredInventoryItems.filter((item) => item.status === 'ISSUED').length;
  }, [filteredInventoryItems]);

  const activeRequestsCount = useMemo(() => {
    return filteredRequests.filter(
      (r) =>
        r.status === BloodRequestStatus.REQUESTED ||
        r.status === BloodRequestStatus.APPROVED ||
        r.status === BloodRequestStatus.RESERVED
    ).length;
  }, [filteredRequests]);

  const pendingTestingCount = useMemo(() => {
    return filteredTestingRecords.filter((t) => t.status === 'IN_PROGRESS').length;
  }, [filteredTestingRecords]);

  const totalDonorsCount = filteredDonors.length;
  const totalDonationsCount = filteredDonations.length;

  // Chart 1: Inventory by Blood Group
  const inventoryByBloodGroup = useMemo(() => {
    if (!dateRangeBounds && rawSummary?.byBloodGroup) {
      return rawSummary.byBloodGroup;
    }
    const counts: Record<string, number> = {
      'A+': 0, 'A-': 0, 'B+': 0, 'B-': 0,
      'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0,
    };
    filteredInventoryItems
      .filter((i) => i.status === 'AVAILABLE')
      .forEach((item) => {
        const bg = (item as any).bloodGroup || (item as any).bloodUnitId?.bloodGroup;
        if (bg && counts[bg] !== undefined) {
          counts[bg] += 1;
        }
      });
    return counts;
  }, [dateRangeBounds, rawSummary, filteredInventoryItems]);

  // Chart 2: Request Status Breakdown
  const requestStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      REQUESTED: 0,
      APPROVED: 0,
      RESERVED: 0,
      ISSUED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };
    filteredRequests.forEach((r) => {
      if (counts[r.status] !== undefined) {
        counts[r.status] += 1;
      }
    });
    return counts;
  }, [filteredRequests]);

  // Financial Overview Aggregates
  const totalExpenses = useMemo(() => {
    return (
      financialKpiData?.kpis?.recognizedExpenditure?.inr ??
      expenseSummary?.approvedAmount ??
      0
    );
  }, [financialKpiData, expenseSummary]);

  const totalMoneyReceived = useMemo(() => {
    return (
      financialKpiData?.kpis?.actualMoneyReceived?.inr ??
      revenueSummary?.totalCollectedAmount ??
      0
    );
  }, [financialKpiData, revenueSummary]);

  const totalOutstanding = useMemo(() => {
    if (financialKpiData?.kpis?.outstandingPayables?.inr !== undefined) {
      return (
        (financialKpiData.kpis.outstandingPayables.inr || 0) +
        (financialKpiData.kpis.outstandingReceivables?.inr || 0)
      );
    }
    return (
      (duesSummary?.summary?.totalOutstandingInr ?? 0) +
      (revenueSummary?.totalOutstandingAmount ?? 0)
    );
  }, [financialKpiData, duesSummary, revenueSummary]);

  const dateSpanLabel = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return 'Today (1 Day)';
      case '7days':
        return 'Last 7 Days';
      case '15days':
        return 'Last 15 Days';
      case '30days':
        return 'Last 30 Days (1 Month)';
      case 'this_month':
        return 'This Month';
      case 'custom':
        if (customStartDate && customEndDate) return `${customStartDate} to ${customEndDate}`;
        if (customStartDate) return `Since ${customStartDate}`;
        if (customEndDate) return `Until ${customEndDate}`;
        return 'Custom Date Range';
      default:
        return 'All Time';
    }
  }, [dateFilter, customStartDate, customEndDate]);

  const recentInventoryActivity = filteredInventoryItems.slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Scoped Responsive Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .super-header-wrap {
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 1rem;
            }
            .super-charts-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
              gap: 1.25rem;
            }
            .super-lifecycle-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
              gap: 1.25rem;
            }
            .super-kpis-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 1rem;
            }
            .super-financial-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 1rem;
            }
            .super-governance-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 1rem;
            }

            .super-header-actions {
              display: flex;
              align-items: stretch;
              gap: 0.65rem;
            }
            .super-header-btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 0.45rem;
              padding: 0.55rem 1rem;
              border-radius: 8px;
              font-size: 0.825rem;
              font-weight: 700;
              text-decoration: none;
              box-sizing: border-box;
              min-height: 42px;
              line-height: 1.25;
              text-align: center;
              white-space: nowrap;
              transition: all 0.15s ease;
            }
            .super-btn-refresh {
              background-color: #ffffff;
              border: 1px solid #fde68a;
              color: #92400e;
              box-shadow: 0 1px 2px rgba(217, 119, 6, 0.05);
              cursor: pointer;
            }
            .super-btn-refresh:hover:not(:disabled) {
              background-color: #fef3c7;
              border-color: #d97706;
            }
            .super-btn-finance {
              background-color: #d97706;
              border: 1px solid #d97706;
              color: #ffffff;
              box-shadow: 0 2px 4px rgba(217, 119, 6, 0.25);
            }
            .super-btn-finance:hover {
              background-color: #b45309;
              border-color: #b45309;
            }

            .super-horizon-bar {
              margin-top: 1.25rem;
              padding-top: 1rem;
              border-top: 1px solid #fef3c7;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 0.75rem;
              width: 100%;
              max-width: 100%;
              box-sizing: border-box;
            }
            .super-horizon-scroll-wrapper {
              display: flex;
              align-items: center;
              gap: 0.45rem;
              flex: 1 1 auto;
              min-width: 0;
              max-width: 100%;
              position: relative;
            }
            .super-horizon-buttons {
              display: flex;
              align-items: center;
              gap: 3px;
              background-color: #fef3c7;
              border-radius: 8px;
              padding: 3px;
              border: 1px solid #fde68a;
              overflow-x: auto;
              overflow-y: hidden;
              flex-wrap: nowrap !important;
              max-width: 100%;
              min-width: 0;
              flex: 1 1 auto;
              -webkit-overflow-scrolling: touch;
              scrollbar-width: thin;
              scrollbar-color: #d97706 transparent;
              scroll-behavior: smooth;
            }
            .super-horizon-buttons::-webkit-scrollbar {
              height: 4px;
            }
            .super-horizon-buttons::-webkit-scrollbar-track {
              background: rgba(254, 243, 199, 0.6);
              border-radius: 9999px;
            }
            .super-horizon-buttons::-webkit-scrollbar-thumb {
              background: #fde68a;
              border-radius: 9999px;
            }
            .super-horizon-buttons::-webkit-scrollbar-thumb:hover {
              background: #d97706;
            }
            .super-horizon-buttons button {
              flex-shrink: 0 !important;
              white-space: nowrap !important;
            }
            .super-horizon-scroll-arrow {
              background-color: #ffffff;
              border: 1px solid #fde68a;
              color: #92400e;
              border-radius: 6px;
              width: 26px;
              height: 26px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              flex-shrink: 0;
              transition: all 0.15s ease;
            }
            .super-horizon-scroll-arrow:hover {
              background-color: #fef3c7;
              border-color: #d97706;
            }

            .super-custom-range-wrap {
              width: 100%;
              display: flex;
              align-items: center;
              gap: 0.45rem;
              padding-top: 0.65rem;
              border-top: 1px dashed #e2e8f0;
              flex-wrap: nowrap !important;
              box-sizing: border-box;
            }
            .super-custom-field {
              display: flex;
              align-items: center;
              gap: 0.35rem;
              flex: 1 1 0;
              min-width: 0;
            }
            .super-custom-field input {
              width: 100%;
              min-width: 0;
              box-sizing: border-box;
              padding: 0.35rem 0.4rem;
              font-size: 0.75rem;
              background-color: #ffffff;
              color: #0f172a;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              outline: none;
            }

            @media (max-width: 1200px) {
              .super-kpis-grid {
                grid-template-columns: repeat(2, 1fr);
              }
              .super-governance-grid {
                grid-template-columns: repeat(3, 1fr);
              }
            }

            @media (max-width: 1024px) {
              .super-charts-grid {
                grid-template-columns: 1fr;
              }
              .super-lifecycle-grid {
                grid-template-columns: 1fr;
              }
              .super-financial-grid {
                grid-template-columns: repeat(2, 1fr);
              }
            }

            @media (max-width: 768px) {
              .super-header-wrap {
                flex-direction: column;
                align-items: stretch;
              }
              .super-header-actions {
                width: 100% !important;
                margin-top: 0.75rem !important;
                display: flex !important;
                flex-direction: row !important;
                gap: 0.5rem !important;
              }
              .super-header-btn {
                flex: 1 1 50% !important;
                min-width: 0 !important;
                white-space: normal !important;
                padding: 0.55rem 0.5rem !important;
                font-size: 0.775rem !important;
                min-height: 44px !important;
                text-align: center !important;
                line-height: 1.2 !important;
              }
              .super-horizon-bar {
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 0.75rem !important;
              }
              .super-governance-grid {
                grid-template-columns: repeat(2, 1fr);
              }
              .super-kpis-grid {
                grid-template-columns: 1fr;
              }
              .super-financial-grid {
                grid-template-columns: 1fr;
              }
            }

            @media (max-width: 480px) {
              .super-governance-grid {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />

      {/* 1. Executive Top Header */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #fde68a',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 3px rgba(217, 119, 6, 0.06)',
        }}
      >
        <div className="super-header-wrap">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(217, 119, 6, 0.2)',
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                    Dashboard
                  </h1>
                  <span
                    style={{
                      padding: '0.15rem 0.6rem',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      borderRadius: '999px',
                      fontSize: '0.725rem',
                      fontWeight: 800,
                      border: '1px solid #fde68a',
                    }}
                  >
                    👑 SUPER ADMIN
                  </span>
                </div>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.825rem' }}>
                  Regional Blood Transfusion Center &bull; NABH Accredited &bull; Unified Clinical, Operational &amp; Financial Analytics
                </p>
              </div>
            </div>
          </div>

          <div className="super-header-actions">
            <button
              onClick={loadAllData}
              disabled={loading}
              className="super-header-btn super-btn-refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Refreshing...' : 'Refresh Live Data'}</span>
            </button>

            <Link
              href="/super-admin/finance/control-center"
              className="super-header-btn super-btn-finance"
            >
              <DollarSign size={15} />
              <span>Financial Control Center &rarr;</span>
            </Link>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="super-horizon-bar">
          <UnifiedDateFilterBar
            label=""
            activePreset={dateFilter}
            onSelectPreset={(p) => setDateFilter(p as DateFilterPreset)}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
            accentColor="#d97706"
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', color: '#991b1b', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Executive Financial Overview (Expenses, How Much Money Came, Outstanding) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Financial Overview
          </span>
          <Link href="/super-admin/finance/control-center" style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 700, textDecoration: 'none' }}>
            Financial Control Center &rarr;
          </Link>
        </div>
        <div className="super-financial-grid">
          {/* Card 1: Expenses */}
          <StatCard
            title="Expenses"
            value={loading ? '...' : formatINR(totalExpenses)}
            subtitle={expenseSummary?.approvedCount ? `${expenseSummary.approvedCount} approved vouchers` : 'Approved operational liabilities'}
            accentColor="#dc2626"
            badge="Expenses"
            badgeType="danger"
            href="/super-admin/finance/expenses"
            loading={loading}
            icon={<TrendingDown size={19} color="#dc2626" />}
          />

          {/* Card 2: How Much Money Came (Inflow) */}
          <StatCard
            title="How Much Money Came (Inflow)"
            value={loading ? '...' : formatINR(totalMoneyReceived)}
            subtitle={revenueSummary?.totalInvoicesCount ? `${revenueSummary.paidCount ?? 0} settled invoices • Confirmed receipts` : 'Confirmed receipts & collections'}
            accentColor="#10b981"
            badge="Inflow"
            badgeType="success"
            href="/super-admin/finance/billing"
            loading={loading}
            icon={<TrendingUp size={19} color="#10b981" />}
          />

          {/* Card 3: Outstanding */}
          <StatCard
            title="Outstanding"
            value={loading ? '...' : formatINR(totalOutstanding)}
            subtitle={duesSummary?.summary?.pendingExpensesCount ? `${duesSummary.summary.pendingExpensesCount} bills awaiting disbursement` : 'Pending supplier payables & dues'}
            accentColor="#f59e0b"
            badge="Dues"
            badgeType="warning"
            href="/super-admin/finance/dues"
            loading={loading}
            icon={<Clock size={19} color="#d97706" />}
          />
        </div>
      </div>

      {/* 4. Live Operational Blood Supply Chain KPIs (8 Cards) */}
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
          Clinical Operations Pulse ({dateSpanLabel})
        </div>
        <div className="super-kpis-grid">
          <StatCard
            title="Available Inventory"
            value={availableInventoryCount}
            subtitle={`Cleared & ready (${dateSpanLabel})`}
            accentColor="#dc2626"
            badge="Ready"
            badgeType="success"
            href="/admin/inventory"
            loading={loading}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                <path d="m3.3 7 8.7 5 8.7-5" />
                <path d="M12 22V12" />
              </svg>
            }
          />

          <StatCard
            title="Reserved Units"
            value={reservedCount}
            subtitle={`Allocated to hospital requests`}
            accentColor="#2563eb"
            badge="Allocated"
            badgeType="info"
            href="/admin/blood-requests"
            loading={loading}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
          />

          <StatCard
            title="Issued Units"
            value={issuedCount}
            subtitle={`Successfully transfused / released`}
            accentColor="#ea580c"
            badge="Completed"
            badgeType="warning"
            href="/admin/blood-requests"
            loading={loading}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 16l5-5-5-5" />
                <path d="M21 11H9a4 4 0 0 0-4 4v5" />
              </svg>
            }
          />

          <StatCard
            title="Expiring Soon"
            value={rawSummary?.expiringSoon ?? 0}
            subtitle="Shelf-life expires within 7 days"
            accentColor={rawSummary?.expiringSoon ? '#dc2626' : '#64748b'}
            badge={rawSummary?.expiringSoon ? 'Urgent' : 'Safe'}
            badgeType={rawSummary?.expiringSoon ? 'danger' : 'success'}
            href="/admin/inventory"
            loading={loading}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />

          <StatCard
            title="Active Requests"
            value={activeRequestsCount}
            subtitle={`Hospital requests in queue`}
            accentColor="#d97706"
            badge="In Queue"
            badgeType="warning"
            href="/admin/blood-requests"
            loading={loading}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
              </svg>
            }
          />

          <StatCard
            title="Pending Testing"
            value={pendingTestingCount}
            subtitle={`Units currently in laboratory`}
            accentColor="#8b5cf6"
            badge="Laboratory"
            badgeType="info"
            href="/lab/testing"
            loading={loading}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 3v4" />
                <path d="M15 3v4" />
                <path d="M6 7h12" />
                <path d="M6 7v10a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V7" />
                <circle cx="12" cy="15" r="2" />
              </svg>
            }
          />

          <StatCard
            title="Registered Donors"
            value={totalDonorsCount}
            subtitle={`Donors registered (${dateSpanLabel})`}
            accentColor="#059669"
            badge="Registry"
            badgeType="success"
            href="/admin/donors"
            loading={loading}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              </svg>
            }
          />

          <StatCard
            title="Total Donations"
            value={totalDonationsCount}
            subtitle={`Collection events (${dateSpanLabel})`}
            accentColor="#475569"
            badge="Collections"
            badgeType="info"
            href="/admin/donations"
            loading={loading}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m19 11-4-4-2 2-2-2-4 4" />
                <path d="M5 21v-6" />
                <path d="M19 21v-6" />
                <circle cx="12" cy="7" r="3" />
              </svg>
            }
          />
        </div>
      </div>

      {/* 5. Core Visualizations Grid (Interactive Charts) */}
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
          Visual Analytics &amp; Inventory Distribution Charts
        </div>
        <div className="super-charts-grid">
          {/* Inventory Bar Chart */}
          <InventoryBarChart
            data={inventoryByBloodGroup}
            componentCounts={rawSummary?.byComponentType || {}}
            loading={loading}
          />

          {/* Request Status Donut Chart */}
          <RequestStatusDonut
            statusCounts={requestStatusCounts}
            loading={loading}
          />
        </div>
      </div>

      {/* 6. Operational Blood Lifecycle Pipeline & Expirations */}
      <div className="super-lifecycle-grid">
        {/* Blood Lifecycle Pipeline */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
              Operational Blood Lifecycle Pipeline
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Real-time progression throughput for {dateSpanLabel}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginTop: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            {[
              { label: 'Donations', count: totalDonationsCount, color: '#475569', icon: '💉' },
              { label: 'Testing', count: pendingTestingCount, color: '#8b5cf6', icon: '🧪' },
              { label: 'Available', count: availableInventoryCount, color: '#16a34a', icon: '🩸' },
              { label: 'Reserved', count: reservedCount, color: '#2563eb', icon: '🔒' },
              { label: 'Issued', count: issuedCount, color: '#ea580c', icon: '📦' },
            ].map((stage, idx, arr) => (
              <React.Fragment key={stage.label}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '0.75rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    flex: '1 1 80px',
                    minWidth: '80px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{stage.icon}</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: stage.color, lineHeight: 1 }}>
                    {stage.count}
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginTop: '0.25rem' }}>
                    {stage.label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <span style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 800 }}>
                    &rarr;
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>

          <div
            style={{
              marginTop: 'auto',
              padding: '0.75rem 1rem',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.775rem',
              color: '#475569',
              lineHeight: 1.5,
            }}
          >
            <strong>Strict Traceability &amp; Biovigilance:</strong> Every physical unit undergoes mandatory 5-panel infectious screening before entering ready inventory. Units are locked under strict reservation prior to clinical release.
          </div>
        </div>

        {/* Expiring Soon Section */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <AlertCircle size={18} color="#dc2626" />
                <span>Expiring Soon (&lt; 7 Days)</span>
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Units reaching shelf-life deadline requiring priority dispatch
              </p>
            </div>
            <Link
              href="/admin/inventory"
              style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 700, textDecoration: 'none' }}
            >
              Manage &rarr;
            </Link>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '220px' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                Loading expiration telemetry...
              </div>
            ) : expiringUnits.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#166534', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', marginTop: '0.5rem' }}>
                <CheckCircle2 size={24} color="#166534" style={{ margin: '0 auto 0.5rem auto' }} />
                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Zero Urgent Expirations</div>
                <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.2rem' }}>All active inventory is within safe shelf-life thresholds.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {expiringUnits.slice(0, 5).map((unit) => {
                  const bg = (unit as any).bloodGroup || (unit as any).bloodUnitId?.bloodGroup;
                  const comp = (unit as any).componentType || (unit as any).bloodUnitId?.componentType;
                  const code = (unit as any).unitCode || (unit as any).bloodUnitId?.unitCode;
                  return (
                    <div
                      key={unit._id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.65rem 0.85rem',
                        backgroundColor: '#fff5f5',
                        border: '1px solid #fed7d7',
                        borderRadius: '6px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{code}</span>
                          <span style={{ fontSize: '0.725rem', padding: '0.1rem 0.45rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontWeight: 800 }}>
                            {bg}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                          {comp?.replace(/_/g, ' ')} &bull; Expires:{' '}
                          {unit.bloodUnit?.expiryDate
                            ? new Date(unit.bloodUnit.expiryDate).toLocaleDateString()
                            : (unit as any).expirationDate
                            ? new Date((unit as any).expirationDate).toLocaleDateString()
                            : 'N/A'}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', backgroundColor: '#dc2626', color: '#ffffff', borderRadius: '4px', fontWeight: 700 }}>
                        Priority
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7. Recent Clinical Inventory Activity & Traceability Audit Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
              Recent Inventory &amp; Specimen Activity
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Latest blood unit registrations, releases and status transitions ({dateSpanLabel})
            </p>
          </div>
          <Link href="/admin/inventory" style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: 700, textDecoration: 'none' }}>
            View Full Inventory &rarr;
          </Link>
        </div>

        {loading ? (
          <TableSkeleton rows={4} />
        ) : recentInventoryActivity.length === 0 ? (
          <EmptyState title="No recent activity" description="No blood units were registered or transitioned in this reporting period." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Unit Code</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Blood Group</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Component</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {recentInventoryActivity.map((item) => {
                  const bg = (item as any).bloodGroup || item.bloodUnit?.bloodGroup || (item as any).bloodUnitId?.bloodGroup;
                  const comp = (item as any).componentType || item.bloodUnit?.componentType || (item as any).bloodUnitId?.componentType;
                  const code = (item as any).unitCode || item.bloodUnit?.unitCode || (item as any).bloodUnitId?.unitCode;

                  return (
                    <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{code}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ padding: '0.15rem 0.5rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontWeight: 800, fontSize: '0.75rem' }}>
                          {bg}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{comp?.replace(/_/g, ' ')}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <StatusBadge status={item.status} />
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {item.bloodUnit?.expiryDate
                          ? new Date(item.bloodUnit.expiryDate).toLocaleDateString()
                          : (item as any).expirationDate
                          ? new Date((item as any).expirationDate).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 8. Executive Operations Navigation Shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <Link
          href="/super-admin/admins"
          style={{
            padding: '1.15rem 1.25rem',
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            textDecoration: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(217, 119, 6, 0.05)',
            transition: 'transform 0.15s ease, border-color 0.15s ease',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.925rem', color: '#0f172a' }}>🛡️ Staff &amp; Access Controls</div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem' }}>Provision &amp; govern system accounts</div>
          </div>
          <ArrowRight size={16} color="#d97706" />
        </Link>

        <Link
          href="/admin/inventory"
          style={{
            padding: '1.15rem 1.25rem',
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            textDecoration: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(217, 119, 6, 0.05)',
            transition: 'transform 0.15s ease, border-color 0.15s ease',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.925rem', color: '#0f172a' }}>🩸 Inventory &amp; Stock Levels</div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem' }}>Manage quarantine &amp; storage bins</div>
          </div>
          <ArrowRight size={16} color="#d97706" />
        </Link>

        <Link
          href="/super-admin/finance/control-center"
          style={{
            padding: '1.15rem 1.25rem',
            backgroundColor: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            textDecoration: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(217, 119, 6, 0.05)',
            transition: 'transform 0.15s ease, border-color 0.15s ease',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.925rem', color: '#0f172a' }}>📊 Financial Control Center</div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem' }}>Cashbook, P&amp;L, audit trail &amp; dues</div>
          </div>
          <ArrowRight size={16} color="#d97706" />
        </Link>
      </div>
    </div>
  );
}