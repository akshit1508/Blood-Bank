'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Volunteer,
  VolunteerStatus,
  VolunteerRole,
  VOLUNTEER_ROLE_LABELS,
  fetchVolunteers,
  fetchVolunteerById,
  buildWhatsAppLink,
} from '@/lib/volunteer-api';

const WhatsAppIcon = ({ size = 15 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
  >
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

const STATUS_BADGES: Record<
  VolunteerStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  PENDING: { bg: '#fef3c7', text: '#92400e', border: '#fde68a', label: '⏳ PENDING REVIEW' },
  APPROVED: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', label: '✓ ACTIVE / APPROVED' },
  REJECTED: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', label: '✕ REJECTED' },
  INACTIVE: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', label: 'INACTIVE' },
};

export default function SuperAdminVolunteersPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Detail Modal state
  const [selectedVolunteerDetail, setSelectedVolunteerDetail] = useState<Volunteer | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = { limit: 200 };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      if (cityFilter.trim()) {
        params.city = cityFilter.trim();
      }
      if (bloodGroupFilter !== 'ALL') {
        params.bloodGroup = bloodGroupFilter;
      }

      const res = await fetchVolunteers(params);
      setVolunteers(res.volunteers);
      setCounts(res.counts);
    } catch (err: any) {
      setError(err.message || 'Failed to load volunteers.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, cityFilter, bloodGroupFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open detail modal with full campaign attendance history
  const handleOpenVolunteerDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      const data = await fetchVolunteerById(id);
      setSelectedVolunteerDetail(data);
    } catch (err: any) {
      alert(`Failed to load volunteer details: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedVolunteerDetail) {
        setSelectedVolunteerDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedVolunteerDetail]);

  // Filter in-memory for preferredRole if selected
  const displayedVolunteers = useMemo(() => {
    if (roleFilter === 'ALL') return volunteers;
    return volunteers.filter((v) => v.preferredRole === roleFilter);
  }, [volunteers, roleFilter]);

  // Calculate total campaigns attended across all loaded volunteers
  const totalAttendedCount = useMemo(() => {
    return volunteers.reduce((acc, v) => acc + (v.attendedCampaignsCount || 0), 0);
  }, [volunteers]);

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Volunteer Directory &amp; Attendance Roster
            </h1>
            <span
              style={{
                backgroundColor: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              👑 Super Admin View
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.35rem 0 0 0' }}>
            Comprehensive directory of all volunteers with verified contact information, active roles, and campaign attendance history.
          </p>
        </div>

        {/* Quick Refresh */}
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          style={{
            backgroundColor: '#ffffff',
            color: '#92400e',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontSize: '0.825rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 1px 2px rgba(217, 119, 6, 0.05)',
            transition: 'all 0.15s ease',
          }}
          title="Refresh volunteer list"
        >
          <span style={{ display: 'inline-block', transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
            🔄
          </span>
          <span>Refresh List</span>
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(217, 119, 6, 0.05)' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Volunteers Registered
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7', margin: '0.35rem 0 0.15rem 0' }}>
            {counts.total}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Platform wide registered volunteers</span>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(217, 119, 6, 0.05)' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active / Approved Volunteers
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', margin: '0.35rem 0 0.15rem 0' }}>
            {counts.approved}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ready for campaign deployment</span>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(217, 119, 6, 0.05)' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending Verification
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: counts.pending > 0 ? '#d97706' : '#64748b', margin: '0.35rem 0 0.15rem 0' }}>
            {counts.pending}
          </div>
          <span style={{ fontSize: '0.75rem', color: counts.pending > 0 ? '#d97706' : '#64748b' }}>
            {counts.pending > 0 ? 'Awaiting admin verification' : 'Zero pending reviews'}
          </span>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(217, 119, 6, 0.05)' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Campaigns Attended
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#b45309', margin: '0.35rem 0 0.15rem 0' }}>
            {totalAttendedCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cumulative campaign participations</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.25rem',
          boxShadow: '0 1px 3px rgba(217, 119, 6, 0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          {/* Status Quick Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              style={{
                backgroundColor: statusFilter === 'ALL' ? '#d97706' : '#fef3c7',
                color: statusFilter === 'ALL' ? '#ffffff' : '#92400e',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              All Volunteers ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('APPROVED')}
              style={{
                backgroundColor: statusFilter === 'APPROVED' ? '#059669' : '#ecfdf5',
                color: statusFilter === 'APPROVED' ? '#ffffff' : '#065f46',
                border: '1px solid #a7f3d0',
                borderRadius: '6px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Approved Active ({counts.approved})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PENDING')}
              style={{
                backgroundColor: statusFilter === 'PENDING' ? '#d97706' : '#fef3c7',
                color: statusFilter === 'PENDING' ? '#ffffff' : '#92400e',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Pending ({counts.pending})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('REJECTED')}
              style={{
                backgroundColor: statusFilter === 'REJECTED' ? '#dc2626' : '#fee2e2',
                color: statusFilter === 'REJECTED' ? '#ffffff' : '#991b1b',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Rejected ({counts.rejected})
            </button>
          </div>

          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Showing <strong>{displayedVolunteers.length}</strong> volunteers
          </span>
        </div>

        {/* Detailed Filters Input Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div>
            <input
              type="text"
              placeholder="Search by name, code, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                color: '#0f172a',
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <input
              type="text"
              placeholder="Filter by city..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                color: '#0f172a',
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <select
              value={bloodGroupFilter}
              onChange={(e) => setBloodGroupFilter(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                color: '#0f172a',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              <option value="ALL">All Blood Groups</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                color: '#0f172a',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              <option value="ALL">All Volunteer Roles</option>
              {Object.entries(VOLUNTEER_ROLE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            padding: '1rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Main Volunteers Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(217, 119, 6, 0.05)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #fde68a', backgroundColor: '#fef3c7', color: '#92400e' }}>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Code &amp; Name</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Contact</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Location &amp; Blood</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Role &amp; Availability</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Campaign Attendance</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#92400e' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: '3px solid #fde68a',
                        borderTopColor: '#d97706',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto 0.75rem auto',
                      }}
                    />
                    <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
                    Loading volunteer directory...
                  </td>
                </tr>
              ) : displayedVolunteers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    No volunteers found matching current filter criteria.
                  </td>
                </tr>
              ) : (
                displayedVolunteers.map((v) => {
                  const badge = STATUS_BADGES[v.status] || STATUS_BADGES.PENDING;
                  return (
                    <tr
                      key={v._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fffbeb')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Code & Name (Clickable) */}
                      <td
                        style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                        onClick={() => handleOpenVolunteerDetail(v._id)}
                        title="Click to view complete details and campaign attendance"
                      >
                        <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ textDecoration: 'underline', textDecorationColor: '#d97706' }}>{v.fullName}</span>
                          <span style={{ fontSize: '0.7rem', color: '#d97706' }}>↗</span>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>
                          {v.volunteerCode}
                        </div>
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ color: '#0f172a', fontWeight: 600 }}>{v.phone}</div>
                        {v.email && <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{v.email}</div>}
                      </td>

                      {/* Location & Blood */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ color: '#334155', fontWeight: 500 }}>{v.city}</div>
                        {v.bloodGroup && (
                          <span
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              border: '1px solid #fca5a5',
                              borderRadius: '4px',
                              padding: '0.1rem 0.4rem',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              marginTop: '0.2rem',
                            }}
                          >
                            {v.bloodGroup}
                          </span>
                        )}
                      </td>

                      {/* Role & Availability */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ color: '#334155', fontWeight: 600, fontSize: '0.8rem' }}>
                          {v.preferredRole ? VOLUNTEER_ROLE_LABELS[v.preferredRole] || v.preferredRole : 'General Volunteer'}
                        </div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.15rem' }}>
                          Availability: {v.availability || 'Weekends'}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            backgroundColor: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                            borderRadius: '9999px',
                            padding: '0.2rem 0.6rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: '0.03em',
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Campaign Attendance Metrics */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span
                            style={{
                              backgroundColor: v.attendedCampaignsCount > 0 ? '#ecfdf5' : '#f8fafc',
                              color: v.attendedCampaignsCount > 0 ? '#065f46' : '#64748b',
                              border: `1px solid ${v.attendedCampaignsCount > 0 ? '#a7f3d0' : '#e2e8f0'}`,
                              borderRadius: '6px',
                              padding: '0.15rem 0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {v.attendedCampaignsCount || 0} Attended
                          </span>
                          <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                            ({v.assignedCampaignsCount || 0} Assigned)
                          </span>
                        </div>
                      </td>

                      {/* Action: View Details */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenVolunteerDetail(v._id)}
                          style={{
                            backgroundColor: '#fef3c7',
                            border: '1px solid #fde68a',
                            color: '#92400e',
                            borderRadius: '6px',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.775rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#fde68a';
                            e.currentTarget.style.color = '#78350f';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#fef3c7';
                            e.currentTarget.style.color = '#92400e';
                          }}
                          title="Open volunteer profile & campaign participation history"
                        >
                          <span>👁️</span>
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complete Volunteer Profile & Campaign Attendance History Modal */}
      {selectedVolunteerDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedVolunteerDetail(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '14px',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              color: '#0f172a',
              boxShadow: '0 20px 45px rgba(217, 119, 6, 0.15)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid #fde68a',
                paddingBottom: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    {selectedVolunteerDetail.fullName}
                  </h2>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #fde68a',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {selectedVolunteerDetail.volunteerCode}
                  </span>
                  <span
                    style={{
                      backgroundColor: STATUS_BADGES[selectedVolunteerDetail.status]?.bg || '#fef3c7',
                      color: STATUS_BADGES[selectedVolunteerDetail.status]?.text || '#92400e',
                      border: `1px solid ${STATUS_BADGES[selectedVolunteerDetail.status]?.border || '#fde68a'}`,
                      borderRadius: '9999px',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {STATUS_BADGES[selectedVolunteerDetail.status]?.label || selectedVolunteerDetail.status}
                  </span>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.35rem 0 0 0' }}>
                  Registered via{' '}
                  <strong style={{ color: '#0f172a' }}>{selectedVolunteerDetail.registeredVia}</strong> on{' '}
                  {new Date(selectedVolunteerDetail.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedVolunteerDetail(null)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '1.35rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  lineHeight: 1,
                }}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Attendance Performance Metrics Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>
                  Campaigns Attended
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#059669', margin: '0.2rem 0' }}>
                  {selectedVolunteerDetail.attendedCampaignsCount || 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#047857' }}>✓ Verified present on ground</div>
              </div>

              <div
                style={{
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                  Campaigns Assigned
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#d97706', margin: '0.2rem 0' }}>
                  {selectedVolunteerDetail.assignedCampaignsCount || 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#b45309' }}>Total roster deployments</div>
              </div>

              <div
                style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  Attendance Reliability
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#2563eb', margin: '0.2rem 0' }}>
                  {selectedVolunteerDetail.assignedCampaignsCount > 0
                    ? `${Math.round(
                        ((selectedVolunteerDetail.attendedCampaignsCount || 0) /
                          selectedVolunteerDetail.assignedCampaignsCount) *
                          100
                      )}%`
                    : '100%'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#1d4ed8' }}>Completion track record</div>
              </div>
            </div>

            {/* Volunteer Personal & Contact Details Grid */}
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Profile &amp; Contact Information
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '0.825rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Phone Number</span>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>{selectedVolunteerDetail.phone}</div>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Email Address</span>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>{selectedVolunteerDetail.email || '—'}</div>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Blood Group</span>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>{selectedVolunteerDetail.bloodGroup || 'Not specified'}</div>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>City / Location</span>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>{selectedVolunteerDetail.city}</div>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Preferred Role</span>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>
                    {selectedVolunteerDetail.preferredRole
                      ? VOLUNTEER_ROLE_LABELS[selectedVolunteerDetail.preferredRole] || selectedVolunteerDetail.preferredRole
                      : 'General Support'}
                  </div>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Availability</span>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>{selectedVolunteerDetail.availability || 'Weekends'}</div>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Occupation</span>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>{selectedVolunteerDetail.occupation || '—'}</div>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Skills / Interests</span>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>{selectedVolunteerDetail.skills || '—'}</div>
                </div>
              </div>

              {selectedVolunteerDetail.address && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid #fde68a', paddingTop: '0.5rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#64748b', fontSize: '0.725rem' }}>Full Address: </span>
                  <span style={{ color: '#334155' }}>{selectedVolunteerDetail.address}</span>
                </div>
              )}

              {/* Direct WhatsApp Action Link */}
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                <a
                  href={buildWhatsAppLink(selectedVolunteerDetail.phone, `Hello ${selectedVolunteerDetail.fullName}, contacting from Blood Bank Volunteer Administration.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    backgroundColor: '#15803d',
                    color: '#ffffff',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <WhatsAppIcon size={14} /> Contact on WhatsApp
                </a>
              </div>
            </div>

            {/* Campaign Participation History Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Campaign Participation &amp; Attendance History ({selectedVolunteerDetail.participations?.length || 0})
                </h3>
                <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                  Chronological record of all assigned blood donation drives
                </span>
              </div>

              {!selectedVolunteerDetail.participations || selectedVolunteerDetail.participations.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#fefce8',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '2rem',
                    textAlign: 'center',
                    color: '#92400e',
                    fontSize: '0.825rem',
                  }}
                >
                  No campaigns have been assigned to this volunteer yet.
                </div>
              ) : (
                <div style={{ border: '1px solid #fde68a', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fef3c7', color: '#92400e', borderBottom: '1px solid #fde68a' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Campaign</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Venue &amp; City</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Assigned Role</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Dates</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Attendance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVolunteerDetail.participations.map((part) => {
                        const camp = typeof part.campaignId === 'object' ? part.campaignId : null;
                        const campName = camp?.name || part.campaignCode || 'Campaign Drive';
                        const campCode = camp?.campaignCode || part.campaignCode;
                        const venue = camp?.venue || 'Venue TBD';
                        const city = camp?.city || '—';
                        const isPresent = part.attendanceStatus === 'PRESENT';
                        const isAbsent = part.attendanceStatus === 'ABSENT';

                        return (
                          <tr key={part._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{campName}</div>
                              <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#b45309' }}>
                                {campCode}
                              </div>
                            </td>

                            <td style={{ padding: '0.65rem 0.85rem', color: '#334155' }}>
                              <div>{venue}</div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{city}</div>
                            </td>

                            <td style={{ padding: '0.65rem 0.85rem', color: '#334155' }}>
                              {part.role ? VOLUNTEER_ROLE_LABELS[part.role] || part.role : 'Volunteer Support'}
                            </td>

                            <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.75rem' }}>
                              {camp?.startDate
                                ? new Date(camp.startDate).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </td>

                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  backgroundColor: isPresent ? '#ecfdf5' : isAbsent ? '#fee2e2' : '#fef3c7',
                                  color: isPresent ? '#065f46' : isAbsent ? '#991b1b' : '#92400e',
                                  border: `1px solid ${isPresent ? '#a7f3d0' : isAbsent ? '#fca5a5' : '#fde68a'}`,
                                  borderRadius: '9999px',
                                  padding: '0.15rem 0.55rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                }}
                              >
                                {isPresent ? '✓ PRESENT' : isAbsent ? '✕ ABSENT' : '⏳ PENDING'}
                              </span>
                              {part.attendanceMarkedAt && (
                                <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '0.15rem' }}>
                                  Check-in:{' '}
                                  {new Date(part.attendanceMarkedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid #fde68a', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setSelectedVolunteerDetail(null)}
                style={{
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  borderRadius: '6px',
                  padding: '0.55rem 1.35rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
