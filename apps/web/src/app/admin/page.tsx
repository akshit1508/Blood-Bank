'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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
import { fetchDonations, PaginatedDonations } from '@/lib/donation-api';
import {
  fetchBloodRequests,
  BloodRequest,
  BloodRequestStatus,
} from '@/lib/blood-request-api';
import { fetchTestingRecords, BloodTesting } from '@/lib/testing-api';

export type DateFilterPreset = 'all' | 'today' | '7days' | '15days' | '30days' | 'custom';

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Real backend metrics (Raw dataset from server)
  const [rawSummary, setRawSummary] = useState<InventorySummary | null>(null);
  const [rawDonors, setRawDonors] = useState<Donor[]>([]);
  const [rawDonations, setRawDonations] = useState<any[]>([]);
  const [rawRequests, setRawRequests] = useState<BloodRequest[]>([]);
  const [rawTestingRecords, setRawTestingRecords] = useState<BloodTesting[]>([]);
  const [rawInventoryItems, setRawInventoryItems] = useState<InventoryItem[]>([]);
  const [expiringUnits, setExpiringUnits] = useState<InventoryItem[]>([]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        summaryRes,
        donorsRes,
        donationsRes,
        requestsRes,
        testingRes,
        expiringRes,
        allInvRes,
      ] = await Promise.all([
        fetchInventorySummary().catch(() => null),
        fetchDonors().catch(() => []),
        fetchDonations({ limit: 1000 }).catch(() => ({ total: 0, items: [] } as any)),
        fetchBloodRequests().catch(() => []),
        fetchTestingRecords({ limit: 1000 }).catch(() => ({ total: 0, items: [] } as any)),
        fetchInventory({ expiringSoon: true }).catch(() => ({ items: [] } as any)),
        fetchInventory({ limit: 1000 }).catch(() => ({ items: [] } as any)),
      ]);

      setRawSummary(summaryRes);
      setRawDonors(Array.isArray(donorsRes) ? donorsRes : []);
      setRawDonations(donationsRes?.items || []);
      setRawRequests(Array.isArray(requestsRes) ? requestsRes : []);
      setRawTestingRecords(testingRes?.items || []);
      setExpiringUnits(expiringRes?.items || []);
      setRawInventoryItems(allInvRes?.items || []);
    } catch (err: any) {
      setError(
        err?.message || 'Failed to aggregate real operational dashboard metrics from server.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Compute active date boundaries [startMs, endMs]
  const dateRangeBounds = React.useMemo(() => {
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
    [dateRangeBounds],
  );

  // Filtered operational datasets according to selected date span
  const filteredDonations = React.useMemo(() => {
    return rawDonations.filter((d) => isDateInRange(d.donationDate || d.createdAt));
  }, [rawDonations, isDateInRange]);

  const filteredDonors = React.useMemo(() => {
    return rawDonors.filter((d) => isDateInRange(d.createdAt));
  }, [rawDonors, isDateInRange]);

  const filteredRequests = React.useMemo(() => {
    return rawRequests.filter((r) => isDateInRange(r.createdAt));
  }, [rawRequests, isDateInRange]);

  const filteredTestingRecords = React.useMemo(() => {
    return rawTestingRecords.filter((t) => isDateInRange(t.startedAt || t.createdAt));
  }, [rawTestingRecords, isDateInRange]);

  const filteredInventoryItems = React.useMemo(() => {
    return rawInventoryItems.filter((i) => isDateInRange(i.createdAt || i.updatedAt));
  }, [rawInventoryItems, isDateInRange]);

  // Derived metric calculations from filtered operational datasets
  const activeRequestsCount = filteredRequests.filter((r) =>
    [
      BloodRequestStatus.REQUESTED,
      BloodRequestStatus.VERIFIED,
      BloodRequestStatus.APPROVED,
      BloodRequestStatus.RESERVED,
    ].includes(r.status),
  ).length;

  const requestStatusCounts = filteredRequests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const recentRequests = filteredRequests.slice(0, 5);

  const pendingTestingCount = filteredTestingRecords.filter(
    (t: BloodTesting) => t.status === 'IN_PROGRESS',
  ).length;

  const reservedCount = dateRangeBounds
    ? filteredInventoryItems.filter((i) => i.status === 'RESERVED').length
    : rawInventoryItems.filter((i) => i.status === 'RESERVED').length;

  const issuedCount = dateRangeBounds
    ? filteredInventoryItems.filter((i) => i.status === 'ISSUED').length
    : rawInventoryItems.filter((i) => i.status === 'ISSUED').length;

  const totalDonationsCount = filteredDonations.length;
  const totalDonorsCount = filteredDonors.length;

  // Dynamic inventory summary metrics (filtered vs lifetime stock)
  const availableInventoryCount = dateRangeBounds
    ? filteredInventoryItems.filter((i) => i.status === 'AVAILABLE').length
    : (rawSummary?.totalAvailable ?? rawInventoryItems.filter((i) => i.status === 'AVAILABLE').length);

  const inventoryByBloodGroup = React.useMemo(() => {
    if (!dateRangeBounds) {
      return rawSummary?.byBloodGroup || {};
    }
    const counts: Record<string, number> = {
      'A+': 0, 'A-': 0, 'B+': 0, 'B-': 0, 'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0,
    };
    filteredInventoryItems
      .filter((i) => i.status === 'AVAILABLE')
      .forEach((i) => {
        const bg = i.bloodUnit?.bloodGroup;
        if (bg && counts[bg] !== undefined) {
          counts[bg] = (counts[bg] || 0) + 1;
        }
      });
    return counts;
  }, [dateRangeBounds, rawSummary, filteredInventoryItems]);

  const recentInventoryActivity = filteredInventoryItems.slice(0, 8);

  const dateSpanLabel = React.useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return 'Today';
      case '7days':
        return 'Last 7 Days';
      case '15days':
        return 'Last 15 Days';
      case '30days':
        return 'Last 30 Days';
      case 'custom':
        if (customStartDate && customEndDate) return `${customStartDate} to ${customEndDate}`;
        if (customStartDate) return `Since ${customStartDate}`;
        if (customEndDate) return `Until ${customEndDate}`;
        return 'Custom Date Range';
      default:
        return 'All Time';
    }
  }, [dateFilter, customStartDate, customEndDate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* 1. Header Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#ffffff',
          padding: '1.25rem 1.5rem',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '1.6rem',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              Operations Dashboard
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: '#f1f5f9',
                color: '#475569',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
              }}
            >
              Single Center
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Comprehensive overview of blood collection, laboratory clearance, physical inventory, and patient fulfillment.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }} className="admin-header-actions">
          {/* Refresh Action */}
          <button
            onClick={loadDashboardData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              padding: '0.5rem 0.95rem',
              borderRadius: '8px',
              fontSize: '0.825rem',
              fontWeight: 600,
              color: '#334155',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
            title="Refresh operational data"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s ease' }}
            >
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Direct CTA */}
          <Link
            href="/admin/blood-requests"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.825rem',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
              transition: 'background 0.15s ease',
            }}
          >
            <span>Process Requests</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>

      {/* 1.1 Dedicated Filter Toolbar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '0.875rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.875rem',
          }}
        >
          {/* Left: Timeframe Label & Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#475569' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#1e293b' }}>
                Time Period:
              </span>
            </div>

            {/* Segmented Control / Tabs */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                padding: '3px',
                border: '1px solid #e2e8f0',
                gap: '2px',
                flexWrap: 'wrap',
              }}
            >
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: '7days', label: 'Last 7 Days' },
                { id: '15days', label: 'Last 15 Days' },
                { id: '30days', label: 'Last 30 Days' },
                { id: 'custom', label: 'Custom Range' },
              ].map((preset) => {
                const active = dateFilter === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setDateFilter(preset.id as DateFilterPreset)}
                    style={{
                      border: 'none',
                      backgroundColor: active ? '#ffffff' : 'transparent',
                      color: active ? '#dc2626' : '#64748b',
                      fontWeight: active ? 700 : 500,
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Active Span Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.775rem',
              color: '#475569',
            }}
          >
            <span style={{ color: '#94a3b8' }}>Filtering:</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{dateSpanLabel}</span>
          </div>
        </div>

        {/* Custom Range Expansion Bar */}
        {dateFilter === 'custom' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px dashed #e2e8f0',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                From Date:
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.825rem',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                To Date:
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.825rem',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                }}
              />
            </div>

            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                style={{
                  border: '1px solid #fecaca',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                Reset Dates
              </button>
            )}

            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
              Select start and end dates to filter operations within that span.
            </span>
          </div>
        )}
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '1rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={loadDashboardData}
            style={{
              backgroundColor: '#991b1b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Operational KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
        className="admin-dashboard-kpis"
      >
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
          subtitle={`Committed units (${dateSpanLabel})`}
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
          subtitle={`Dispatched units (${dateSpanLabel})`}
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
          subtitle={`Hospital requests (${dateSpanLabel})`}
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
          subtitle={`Units in lab (${dateSpanLabel})`}
          accentColor="#8b5cf6"
          badge="Laboratory"
          badgeType="info"
          href="/admin/testing"
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

      {/* 3. Core Visualizations Grid (Row 2) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: '1.25rem',
        }}
        className="admin-dashboard-two-col"
      >
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

      {/* 4. Operational Lifecycle Flow & Urgent Alerts (Row 3) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: '1.25rem',
        }}
        className="admin-dashboard-two-col"
      >
        {/* Blood Lifecycle Pipeline */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 600 }}>
              Operational Blood Lifecycle
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Pipeline metrics for {dateSpanLabel}
            </p>
          </div>

          {/* Linear Stage Flow */}
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
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: stage.color, lineHeight: 1 }}>
                    {stage.count}
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569', marginTop: '0.25rem' }}>
                    {stage.label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <span style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 700 }}>
                    →
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
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '0.775rem',
              color: '#475569',
              lineHeight: 1.4,
            }}
          >
            <strong>Strict Traceability Notice:</strong> Every physical blood unit requires laboratory approval before entering available inventory. Units cannot be issued without first being reserved against an approved clinical request.
          </div>
        </div>

        {/* Expiring Soon Section */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 600 }}>
                Expiring Soon (Next 7 Days)
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Inventory approaching medical expiration date
              </p>
            </div>
            <Link
              href="/admin/inventory"
              style={{
                fontSize: '0.75rem',
                color: '#dc2626',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              View Inventory →
            </Link>
          </div>

          {expiringUnits.length === 0 ? (
            <EmptyState
              icon="🛡️"
              title="No Units Expiring Soon"
              description="All current inventory units are well within their safe laboratory shelf-life window."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {expiringUnits.map((item) => (
                <div
                  key={item._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#fff7ed',
                    border: '1px solid #ffedd5',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: '#ffedd5',
                        color: '#c2410c',
                        padding: '0.2rem 0.45rem',
                        borderRadius: '4px',
                        border: '1px solid #fed7aa',
                      }}
                    >
                      {item.bloodUnit?.bloodGroup}
                    </span>
                    <div>
                      <strong style={{ fontSize: '0.825rem', color: '#0f172a' }}>
                        {item.bloodUnit?.unitCode}
                      </strong>
                      <span style={{ fontSize: '0.725rem', color: '#64748b', display: 'block' }}>
                        {item.bloodUnit?.componentType}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626' }}>
                      Expires: {item.bloodUnit?.expiryDate ? new Date(item.bloodUnit.expiryDate).toLocaleDateString() : 'N/A'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>
                      {item.bloodUnit?.storageLocation || 'Main Cold Storage'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Recent Requests & Operational Activity (Row 4) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: '1.25rem',
        }}
        className="admin-dashboard-two-col"
      >
        {/* Recent Blood Requests */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 600 }}>
                Recent Blood Requests
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Latest clinical hospital intake requests
              </p>
            </div>
            <Link
              href="/admin/blood-requests"
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#dc2626',
                textDecoration: 'none',
              }}
            >
              View All Requests ({filteredRequests.length}) →
            </Link>
          </div>

          {loading ? (
            <TableSkeleton rows={4} />
          ) : recentRequests.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No Blood Requests Found"
              description="There are currently no blood requests registered in the database."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.825rem',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.725rem' }}>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>CODE</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>PATIENT / HOSPITAL</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>GROUP</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>UNITS</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>STATUS</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, textAlign: 'right' }}>DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((req) => (
                    <tr
                      key={req._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                        <Link
                          href={`/admin/blood-requests`}
                          style={{ color: '#0f172a', textDecoration: 'none' }}
                        >
                          {req.requestCode}
                        </Link>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <div style={{ fontWeight: 500, color: '#0f172a' }}>{req.patient?.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{req.hospitalName}</div>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: '#dc2626',
                            backgroundColor: '#fef2f2',
                            padding: '0.15rem 0.35rem',
                            borderRadius: '4px',
                            border: '1px solid #fecaca',
                            fontSize: '0.75rem',
                          }}
                        >
                          {req.bloodGroup}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                        {req.unitsRequested}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <StatusBadge status={req.status} size="sm" />
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#64748b', fontSize: '0.725rem' }}>
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Inventory & Operations Activity */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 600 }}>
                Recent Operational Activity
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Inventory state audit log & physical unit tracking
              </p>
            </div>
            <Link
              href="/admin/inventory"
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#dc2626',
                textDecoration: 'none',
              }}
            >
              All Inventory →
            </Link>
          </div>

          {recentInventoryActivity.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No Activity Yet"
              description="No physical inventory events recorded in the system yet."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {recentInventoryActivity.slice(0, 5).map((item) => (
                <div
                  key={item._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.75rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9rem',
                      }}
                    >
                      🩸
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
                        {item.bloodUnit?.unitCode} ({item.bloodUnit?.bloodGroup})
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {item.bloodUnit?.componentType?.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <StatusBadge status={item.status} size="sm" />
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                      {new Date(item.updatedAt || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
