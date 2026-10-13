'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchAdminAccounts, AdminAccountSummary } from '@/lib/auth-api';
import StatCard from '@/components/admin/StatCard';
import InventoryBarChart from '@/components/admin/InventoryBarChart';
import RequestStatusDonut from '@/components/admin/RequestStatusDonut';
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

export type DateFilterPreset = 'all' | 'today' | '7days' | '15days' | '30days' | 'custom';

export default function SuperAdminDashboardPage() {
  const [admins, setAdmins] = useState<AdminAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Operational metrics datasets
  const [rawSummary, setRawSummary] = useState<InventorySummary | null>(null);
  const [rawDonors, setRawDonors] = useState<Donor[]>([]);
  const [rawDonations, setRawDonations] = useState<any[]>([]);
  const [rawRequests, setRawRequests] = useState<BloodRequest[]>([]);
  const [rawTestingRecords, setRawTestingRecords] = useState<BloodTesting[]>([]);
  const [rawInventoryItems, setRawInventoryItems] = useState<InventoryItem[]>([]);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [
        accountsData,
        summaryRes,
        donorsRes,
        donationsRes,
        requestsRes,
        testingRes,
        allInvRes,
      ] = await Promise.all([
        fetchAdminAccounts().catch(() => []),
        fetchInventorySummary().catch(() => null),
        fetchDonors().catch(() => []),
        fetchDonations({ limit: 1000 }).catch(() => ({ total: 0, items: [] } as any)),
        fetchBloodRequests().catch(() => []),
        fetchTestingRecords({ limit: 1000 }).catch(() => ({ total: 0, items: [] } as any)),
        fetchInventory({ limit: 1000 }).catch(() => ({ items: [] } as any)),
      ]);

      setAdmins(Array.isArray(accountsData) ? accountsData : []);
      setRawSummary(summaryRes);
      setRawDonors(Array.isArray(donorsRes) ? donorsRes : []);
      setRawDonations(donationsRes?.items || []);
      setRawRequests(Array.isArray(requestsRes) ? requestsRes : []);
      setRawTestingRecords(testingRes?.items || []);
      setRawInventoryItems(allInvRes?.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to aggregate system and operational metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

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

  // Staff accounts metrics
  const totalAccounts = admins.length;
  const superAdminsCount = admins.filter((a) => a.role === 'SUPER_ADMIN').length;
  const adminsCount = admins.filter((a) => a.role === 'ADMIN').length;
  const labTechCount = admins.filter((a) => a.role === 'LAB_TECHNICIAN').length;
  const activeCount = admins.filter((a) => a.isActive).length;

  // Operational metrics
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

  const pendingTestingCount = filteredTestingRecords.filter(
    (t: BloodTesting) => t.status === 'IN_PROGRESS',
  ).length;

  const totalDonationsCount = filteredDonations.length;
  const totalDonorsCount = filteredDonors.length;

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
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* 1. Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
              System Governance & Platform Analytics
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: '#1e293b',
                color: '#f59e0b',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #334155',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Super Admin Level
            </span>
          </div>
          <p style={{ color: '#94a3b8', margin: '0.35rem 0 0 0', fontSize: '0.875rem' }}>
            Privileged overview of role governance, operational inventory bar chart, and blood request lifecycle distribution.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={loadAllData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              padding: '0.6rem 0.9rem',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '0.85rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            <span>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <Link
            href="/super-admin/admins"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
              textDecoration: 'none',
              boxShadow: '0 1px 3px rgba(220,38,38,0.3)',
            }}
          >
            <span>+ Manage Staff Accounts</span>
          </Link>
          <Link
            href="/admin/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
              textDecoration: 'none',
            }}
          >
            <span>Launch Operations Console &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          backgroundColor: '#0f172a',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          border: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#94a3b8' }}>
            <span style={{ fontSize: '0.85rem' }}>📅</span>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#f8fafc' }}>
              Time Period:
            </span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#1e293b',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid #334155',
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
                    backgroundColor: active ? '#dc2626' : 'transparent',
                    color: active ? '#ffffff' : '#94a3b8',
                    fontWeight: active ? 700 : 500,
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.775rem',
            color: '#94a3b8',
          }}
        >
          <span>Filtering:</span>
          <strong style={{ color: '#f8fafc' }}>{dateSpanLabel}</strong>
        </div>

        {dateFilter === 'custom' && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              paddingTop: '0.5rem',
              marginTop: '0.25rem',
              borderTop: '1px dashed #334155',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.775rem', color: '#94a3b8' }}>From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.775rem',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.775rem', color: '#94a3b8' }}>To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.775rem',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
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
                  border: '1px solid #991b1b',
                  backgroundColor: '#450a0a',
                  color: '#fca5a5',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Reset Dates
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#450a0a', border: '1px solid #991b1b', borderRadius: '8px', color: '#fca5a5', fontSize: '0.875rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* 2. Staff Governance Counters Grid */}
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Staff Account Governance
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Accounts</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.5rem' }}>
              {loading ? '...' : totalAccounts}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
              {loading ? '' : `${activeCount} active in system`}
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Super Admins</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.5rem' }}>
              {loading ? '...' : superAdminsCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Full platform governance</div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Operational Admins</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.5rem' }}>
              {loading ? '...' : adminsCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Donor & Inventory Ops</div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lab Technicians</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#a855f7', marginTop: '0.5rem' }}>
              {loading ? '...' : labTechCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Testing workstation scoped</div>
          </div>
        </div>
      </div>

      {/* 3. Operational Analytics KPI Cards Grid */}
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Live Operational Metrics ({dateSpanLabel})
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
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
            title="Expiring Soon"
            value={rawSummary?.expiringSoon ?? 0}
            subtitle="Within next 7 days"
            accentColor="#ef4444"
            badge={rawSummary?.expiringSoon ? 'Urgent' : 'Nominal'}
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
      </div>

      {/* 4. Core Visualizations Grid (Inventory Bar Chart & Request Status Donut) */}
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Operational Charts & Visualizations
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
            gap: '1.25rem',
          }}
          className="super-admin-dashboard-two-col"
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
      </div>

      {/* 5. Active Security Policies & Quick Navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
            Active Security Policies (Phase 2)
          </h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.8' }}>
            <li><strong>Fail-Closed RBAC:</strong> Every protected endpoint without explicit role metadata denies access with HTTP 403 Forbidden.</li>
            <li><strong>Role Separation:</strong> Standard Admins cannot access staff account endpoints or create/modify staff credentials.</li>
            <li><strong>Data Minimization:</strong> Lab Technicians receive strictly sanitized testing records; donor phone numbers and full names are stripped at the backend layer.</li>
            <li><strong>Immutable Testing:</strong> Screened blood testing records are locked once completed. No status reversions or mutations permitted.</li>
            <li><strong>Single Center Model:</strong> All sessions are signed via cryptographic HMAC tokens without remote third-party token leaks.</li>
          </ul>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
            Quick Navigation
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link
              href="/super-admin/admins"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1rem',
                backgroundColor: '#1e293b',
                borderRadius: '8px',
                color: '#f8fafc',
                textDecoration: 'none',
                fontSize: '0.875rem',
                border: '1px solid #334155',
              }}
            >
              <span>Manage Staff & Lab Technician Accounts</span>
              <span>&rarr;</span>
            </Link>
            <Link
              href="/admin/donors"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1rem',
                backgroundColor: '#1e293b',
                borderRadius: '8px',
                color: '#f8fafc',
                textDecoration: 'none',
                fontSize: '0.875rem',
                border: '1px solid #334155',
              }}
            >
              <span>Donor Directory & Status Approvals</span>
              <span>&rarr;</span>
            </Link>
            <Link
              href="/admin/inventory"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1rem',
                backgroundColor: '#1e293b',
                borderRadius: '8px',
                color: '#f8fafc',
                textDecoration: 'none',
                fontSize: '0.875rem',
                border: '1px solid #334155',
              }}
            >
              <span>Blood Inventory & Critical Stock Levels</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}