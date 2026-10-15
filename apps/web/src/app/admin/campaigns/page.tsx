'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { AdminRole } from '@/lib/auth-api';
import {
  CampaignItem,
  CampaignStatus,
  ExpenseCategory,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_BADGE_COLORS,
  EXPENSE_CATEGORY_LABELS,
  fetchCampaigns,
  createCampaign,
  updateCampaign,
  createCampaignExpenditure,
  CreateCampaignPayload,
} from '@/lib/campaign-api';

export default function AdminCampaignsPage() {
  const { admin } = useAdminAuth();
  const isSuperAdmin = admin?.role === AdminRole.SUPER_ADMIN;

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Schedule Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateCampaignPayload>({
    name: '',
    venue: '',
    city: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    targetDonations: 100,
    initialBudget: 50000,
    description: '',
  });

  // Quick Add Expense Modal State
  const [selectedCampaignForExpense, setSelectedCampaignForExpense] = useState<CampaignItem | null>(null);
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

  // Quick Status Updating
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCampaigns({
        status: statusFilter || undefined,
        city: cityFilter || undefined,
        search: searchQuery || undefined,
        limit: 100,
      });
      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, cityFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived KPI ribbon metrics
  const kpis = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter((c) => c.status === CampaignStatus.ACTIVE).length;
    const planned = campaigns.filter((c) => c.status === CampaignStatus.PLANNED).length;
    const completed = campaigns.filter((c) => c.status === CampaignStatus.COMPLETED).length;

    const totalBudget = campaigns.reduce((acc, c) => acc + (c.approvedBudget || 0), 0);
    const totalExp = campaigns.reduce((acc, c) => acc + (c.actualExpenditure || 0), 0);
    const totalUnits = campaigns.reduce((acc, c) => acc + (c.completedDonationsCount || 0), 0);

    const avgCostPerUnit = totalUnits > 0 ? Math.round(totalExp / totalUnits) : null;
    const overallUtilization = totalBudget > 0 ? Math.round((totalExp / totalBudget) * 1000) / 10 : 0;

    return {
      total,
      active,
      planned,
      completed,
      totalBudget,
      totalExp,
      totalUnits,
      avgCostPerUnit,
      overallUtilization,
    };
  }, [campaigns]);

  // Available unique cities for filter dropdown
  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((c) => {
      if (c.city) set.add(c.city);
    });
    return Array.from(set).sort();
  }, [campaigns]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.venue.trim() || !formData.city.trim()) {
      setModalError('Campaign Name, Venue, and City are required.');
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setModalError('End date cannot precede start date.');
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);
      await createCampaign({
        ...formData,
        targetDonations: Number(formData.targetDonations) || 0,
        initialBudget: Number(formData.initialBudget) || 0,
      });
      setIsModalOpen(false);
      setFormData({
        name: '',
        venue: '',
        city: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        targetDonations: 100,
        initialBudget: 50000,
        description: '',
      });
      loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignForExpense) return;

    if (!expenseFormData.title.trim()) {
      setAddExpenseError('Expenditure title / item is required.');
      return;
    }
    const numAmount = Number(expenseFormData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setAddExpenseError('Amount must be greater than zero.');
      return;
    }
    if (!expenseFormData.invoiceNumber.trim()) {
      setAddExpenseError('Invoice / Bill Number is required.');
      return;
    }
    if (!expenseFormData.vendorName.trim()) {
      setAddExpenseError('Vendor / Merchant Name is required.');
      return;
    }

    try {
      setAddingExpense(true);
      setAddExpenseError(null);
      await createCampaignExpenditure(selectedCampaignForExpense._id, {
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
      const campName = selectedCampaignForExpense.name;
      const invNum = expenseFormData.invoiceNumber.trim();
      setSelectedCampaignForExpense(null);
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
      setSuccessMessage(
        `Expenditure of ₹${numAmount.toLocaleString('en-IN')} for "${campName}" (Invoice #${invNum}) recorded successfully and queued for Super Admin approval.`
      );
      await loadData();
    } catch (err: any) {
      setAddExpenseError(err.message || 'Failed to record campaign expenditure.');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleQuickStatusChange = async (campaign: CampaignItem, nextStatus: CampaignStatus) => {
    if (campaign.status === nextStatus) return;
    try {
      setUpdatingStatusId(campaign._id);
      await updateCampaign(campaign._id, { status: nextStatus });
      await loadData();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b1120', color: '#f8fafc', padding: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🎪</span>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, letterSpacing: '-0.025em', color: '#f8fafc' }}>
              Campaigns & Mobile Drives
            </h1>
            <span
              style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                padding: '0.2rem 0.55rem',
                borderRadius: '9999px',
                backgroundColor: '#1e293b',
                color: '#38bdf8',
                border: '1px solid #334155',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Phase 7 Budget Management
            </span>
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', maxWidth: '720px', lineHeight: 1.5 }}>
            Authoritative mobile donation drive operations with integer-paise budget controls, audit revision history, and linked expense cost tracking.
          </p>
        </div>

        {isSuperAdmin ? (
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#b91c1c')}
            onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#dc2626')}
          >
            <span>+</span> Schedule Campaign & Add Budget
          </button>
        ) : (
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.65rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              maxWidth: '440px',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>🛡️</span>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                Admin Operations Portal
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.3 }}>
                Campaigns scheduled by Super Admin. Click <strong>+ Add Expense</strong> on any campaign below to log field bills.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div
          style={{
            backgroundColor: '#064e3b',
            border: '1px solid #059669',
            color: '#a7f3d0',
            borderRadius: '8px',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.9rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
          }}
        >
          <span>✅ {successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.775rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
            Total Campaigns
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>{kpis.total}</div>
          <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            {kpis.active} active • {kpis.planned} planned
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.775rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
            Total Approved Budget
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8' }}>
            {formatCurrency(kpis.totalBudget)}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Baseline & revisions
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.775rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
            Actual Expenditure
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>
            {formatCurrency(kpis.totalExp)}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            {kpis.overallUtilization}% overall utilization
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.775rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
            Completed Donations
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
            {kpis.totalUnits}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Physical collected units
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.775rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
            Avg Cost / Donation
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#c084fc' }}>
            {kpis.avgCostPerUnit !== null ? formatCurrency(kpis.avgCostPerUnit) : 'N/A'}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Approved expenses / unit
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.85rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search campaign, code, venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '0.5rem 0.85rem',
                fontSize: '0.875rem',
                minWidth: '240px',
                outline: 'none',
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '0.5rem 0.85rem',
              fontSize: '0.875rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">All Statuses</option>
            {Object.values(CampaignStatus).map((st) => (
              <option key={st} value={st}>
                {CAMPAIGN_STATUS_LABELS[st]}
              </option>
            ))}
          </select>

          {/* City Filter */}
          {uniqueCities.length > 0 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '0.5rem 0.85rem',
                fontSize: '0.875rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">All Cities</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          )}

          {(statusFilter || cityFilter || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setCityFilter('');
                setSearchQuery('');
              }}
              style={{
                backgroundColor: 'transparent',
                color: '#94a3b8',
                border: '1px dashed #475569',
                borderRadius: '6px',
                padding: '0.45rem 0.75rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
          Showing <strong>{campaigns.length}</strong> campaigns
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            color: '#fecaca',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Newly Scheduled Campaigns Banner & Cards for Admin Field Operations */}
      {campaigns.filter((c) => c.status === CampaignStatus.PLANNED).length > 0 && (
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #d97706',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.75rem',
            boxShadow: '0 4px 12px rgba(217, 119, 6, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📢</span>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fbbf24', margin: 0 }}>
                  Newly Scheduled Campaigns Awaiting Field Execution & Expense Logging ({campaigns.filter((c) => c.status === CampaignStatus.PLANNED).length})
                </h2>
                <span style={{ fontSize: '0.775rem', color: '#94a3b8' }}>
                  Campaigns scheduled and budgeted by Super Admin. Field officers can record all operational bills & invoices below.
                </span>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                backgroundColor: '#78350f',
                color: '#fef3c7',
                border: '1px solid #b45309',
              }}
            >
              Action Required: Record Incurred Expenses
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {campaigns
              .filter((c) => c.status === CampaignStatus.PLANNED)
              .map((camp) => (
                <div
                  key={camp._id}
                  style={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.85rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                        {camp.campaignCode}
                      </span>
                      <span
                        style={{
                          fontSize: '0.675rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          backgroundColor: '#78350f',
                          color: '#fef3c7',
                          border: '1px solid #b45309',
                        }}
                      >
                        Planned & Scheduled
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.4rem 0' }}>
                      {camp.name}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div>📍 <strong>Venue:</strong> {camp.venue}, {camp.city}</div>
                      <div>📅 <strong>Dates:</strong> {new Date(camp.startDate).toLocaleDateString()} &ndash; {new Date(camp.endDate).toLocaleDateString()}</div>
                      <div>🎯 <strong>Target:</strong> {camp.targetDonations || 0} Donation Units</div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #334155', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.675rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                        Approved Budget
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                        ₹{(camp.approvedBudget || 0).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={() => {
                          setSelectedCampaignForExpense(camp);
                          setAddExpenseError(null);
                          setIsAddExpenseModalOpen(true);
                        }}
                        style={{
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.5rem 0.95rem',
                          borderRadius: '6px',
                          fontSize: '0.825rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                          transition: 'all 0.15s',
                        }}
                        onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#059669')}
                        onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#10b981')}
                      >
                        <span>+</span> Add Expense
                      </button>

                      <Link
                        href={`/admin/campaigns/${camp._id}`}
                        style={{
                          backgroundColor: '#334155',
                          color: '#38bdf8',
                          textDecoration: 'none',
                          padding: '0.5rem 0.85rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          transition: 'all 0.15s',
                        }}
                        onMouseOver={(e) => ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#475569')}
                        onMouseOut={(e) => ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#334155')}
                      >
                        Details →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Campaigns Table */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>Campaign</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Location & Dates</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Donations Progress</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Approved Budget</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Expenditure & Utilization</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Cost / Unit</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Loading campaigns...</div>
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎪</div>
                    <strong style={{ display: 'block', color: '#94a3b8', fontSize: '1rem', marginBottom: '0.25rem' }}>
                      No campaigns found
                    </strong>
                    <span>Schedule your first blood donation campaign to begin tracking budgets.</span>
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => {
                  const badge = CAMPAIGN_STATUS_BADGE_COLORS[camp.status] || CAMPAIGN_STATUS_BADGE_COLORS[CampaignStatus.PLANNED];
                  const actual = camp.actualExpenditure || 0;
                  const budget = camp.approvedBudget || 0;
                  const util = budget > 0 ? Math.round((actual / budget) * 100) : 0;
                  const isOver = actual > budget;
                  const completed = camp.completedDonationsCount || 0;
                  const target = camp.targetDonations || 0;
                  const donationProgress = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;

                  return (
                    <tr
                      key={camp._id}
                      style={{
                        borderBottom: '1px solid #1e293b',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseOver={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#131d31')}
                      onMouseOut={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent')}
                    >
                      {/* Campaign Code & Name */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              color: '#38bdf8',
                              backgroundColor: '#0369a120',
                              border: '1px solid #0284c740',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                            }}
                          >
                            {camp.campaignCode}
                          </span>
                        </div>
                        <strong style={{ color: '#f8fafc', fontSize: '0.925rem', display: 'block' }}>
                          {camp.name}
                        </strong>
                      </td>

                      {/* Location & Dates */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ color: '#e2e8f0', fontWeight: 500 }}>
                          {camp.venue}, {camp.city}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                          {formatDate(camp.startDate)} – {formatDate(camp.endDate)}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                              borderRadius: '9999px',
                              padding: '0.2rem 0.6rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {CAMPAIGN_STATUS_LABELS[camp.status]}
                          </span>

                          {/* Quick status selector */}
                          <select
                            disabled={updatingStatusId === camp._id}
                            value={camp.status}
                            onChange={(e) => handleQuickStatusChange(camp, e.target.value as CampaignStatus)}
                            style={{
                              backgroundColor: '#1e293b',
                              color: '#94a3b8',
                              border: '1px solid #334155',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              padding: '0.15rem 0.35rem',
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option value={camp.status}>Change...</option>
                            {Object.values(CampaignStatus).map((s) => (
                              <option key={s} value={s} disabled={s === camp.status}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Donations Progress */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.775rem', marginBottom: '0.3rem' }}>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>{completed} done</span>
                          <span style={{ color: '#64748b' }}>Target: {target}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${donationProgress}%`,
                              height: '100%',
                              backgroundColor: '#10b981',
                              borderRadius: '9999px',
                            }}
                          />
                        </div>
                      </td>

                      {/* Approved Budget */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.925rem' }}>
                          {formatCurrency(budget)}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                          Rev #{camp.budgetRevisionCount || 0} (v{camp.budgetVersion || 1})
                        </div>
                      </td>

                      {/* Expenditure & Utilization */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 600, color: isOver ? '#ef4444' : '#f59e0b' }}>
                            {formatCurrency(actual)}
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: isOver ? '#ef4444' : util > 80 ? '#f59e0b' : '#10b981',
                            }}
                          >
                            {util}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, util)}%`,
                              height: '100%',
                              backgroundColor: isOver ? '#ef4444' : util > 80 ? '#f59e0b' : '#10b981',
                              borderRadius: '9999px',
                            }}
                          />
                        </div>
                      </td>

                      {/* Cost / Unit */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ fontWeight: 600, color: camp.costPerCompletedDonation ? '#c084fc' : '#64748b' }}>
                          {camp.costPerCompletedDonation !== null && camp.costPerCompletedDonation !== undefined
                            ? formatCurrency(camp.costPerCompletedDonation)
                            : 'N/A'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              setSelectedCampaignForExpense(camp);
                              setAddExpenseError(null);
                              setIsAddExpenseModalOpen(true);
                            }}
                            style={{
                              backgroundColor: '#064e3b',
                              color: '#34d399',
                              border: '1px solid #059669',
                              padding: '0.45rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              transition: 'all 0.15s',
                            }}
                            onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#047857')}
                            onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#064e3b')}
                          >
                            <span>+</span> Add Expense
                          </button>

                          <Link
                            href={`/admin/campaigns/${camp._id}`}
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#1e293b',
                              color: '#38bdf8',
                              border: '1px solid #334155',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              transition: 'all 0.15s',
                            }}
                            onMouseOver={(e) => {
                              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#0284c7';
                              (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff';
                            }}
                            onMouseOut={(e) => {
                              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#1e293b';
                              (e.currentTarget as HTMLAnchorElement).style.color = '#38bdf8';
                            }}
                          >
                            Command Center →
                          </Link>
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

      {/* Schedule Campaign Modal */}
      {isModalOpen && (
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
              maxWidth: '560px',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#f8fafc' }}>
                  Schedule Campaign & Allocate Budget
                </h2>
                <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                  🛡️ Super Admin Exclusive Authority
                </span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                ✕
              </button>
            </div>

            {modalError && (
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
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. City Pride Mega Donation Drive"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Venue *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Town Hall Auditorium"
                      value={formData.venue}
                      onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
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
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mumbai"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
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
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Target Donations (Units) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={formData.targetDonations}
                      onChange={(e) => setFormData({ ...formData, targetDonations: Number(e.target.value) })}
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
                      Approved Initial Budget (₹) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={formData.initialBudget}
                      onChange={(e) => setFormData({ ...formData, initialBudget: Number(e.target.value) })}
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
                    <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>
                      Super Admin allocated baseline budget (stored in integer paise)
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Description & Objectives
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of outreach objectives, venue setup details, or sponsoring partners..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                  onClick={() => setIsModalOpen(false)}
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
                  disabled={submitting}
                  style={{
                    backgroundColor: '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Scheduling...' : 'Schedule Campaign & Allocate Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Campaign Expenditure Modal */}
      {isAddExpenseModalOpen && selectedCampaignForExpense && (
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
                  Campaign: <strong>{selectedCampaignForExpense.name}</strong> ({selectedCampaignForExpense.campaignCode})
                </span>
              </div>
              <button
                onClick={() => {
                  setIsAddExpenseModalOpen(false);
                  setSelectedCampaignForExpense(null);
                }}
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Expenditure Title / Item *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Refreshments for Donors, Sound Setup, Mobile Van Fuel"
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
                    Upload bill/invoice (PDF, PNG, JPG). Required for Super Admin audit.
                  </span>
                </div>

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
                  onClick={() => {
                    setIsAddExpenseModalOpen(false);
                    setSelectedCampaignForExpense(null);
                  }}
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
    </div>
  );
}
