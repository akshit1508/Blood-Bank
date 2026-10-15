'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Volunteer,
  VolunteerStatus,
  VolunteerRole,
  VOLUNTEER_ROLE_LABELS,
  fetchVolunteers,
  fetchVolunteerById,
  verifyVolunteer,
  adminCreateVolunteer,
  buildCampaignWhatsAppMessage,
  buildWhatsAppLink,
  AdminCreateVolunteerPayload,
} from '@/lib/volunteer-api';
import { fetchCampaigns, CampaignItem } from '@/lib/campaign-api';

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
  PENDING: { bg: '#451a03', text: '#fde68a', border: '#b45309', label: '⏳ PENDING REVIEW' },
  APPROVED: { bg: '#064e3b', text: '#6ee7b7', border: '#059669', label: '✓ ACTIVE / APPROVED' },
  REJECTED: { bg: '#450a0a', text: '#fca5a5', border: '#dc2626', label: '✕ REJECTED' },
  INACTIVE: { bg: '#1e293b', text: '#94a3b8', border: '#334155', label: 'INACTIVE' },
};

export default function AdminVolunteersPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'ALL'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('ALL');

  // Campaigns for WhatsApp broadcast
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Verification modal state
  const [verifyingVolunteer, setVerifyingVolunteer] = useState<Volunteer | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  // Direct Create Volunteer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AdminCreateVolunteerPayload>({
    fullName: '',
    phone: '',
    email: '',
    bloodGroup: 'O+',
    gender: 'MALE',
    city: '',
    address: '',
    occupation: '',
    preferredRole: 'GENERAL',
    adminNotes: '',
  });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Volunteer Detailed View Modal
  const [selectedVolunteerDetail, setSelectedVolunteerDetail] = useState<Volunteer | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const handleOpenVolunteerDetail = async (volunteerId: string) => {
    try {
      setLoadingDetail(true);
      const detail = await fetchVolunteerById(volunteerId);
      setSelectedVolunteerDetail(detail);
    } catch (err: any) {
      alert(`Failed to load volunteer details: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const statusParam = activeTab === 'ALL' ? undefined : activeTab;
      const [volRes, campRes] = await Promise.all([
        fetchVolunteers({
          status: statusParam,
          search: searchTerm.trim() || undefined,
          city: cityFilter.trim() || undefined,
          bloodGroup: bloodGroupFilter !== 'ALL' ? bloodGroupFilter : undefined,
          limit: 100,
        }),
        fetchCampaigns({ limit: 20 }),
      ]);

      setVolunteers(volRes.volunteers);
      setCounts(volRes.counts);
      setCampaigns(campRes.campaigns || []);
      if (campRes.campaigns?.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(campRes.campaigns[0]._id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load volunteers.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm, cityFilter, bloodGroupFilter, selectedCampaignId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedCampaign = useMemo(() => {
    return campaigns.find((c) => c._id === selectedCampaignId) || campaigns[0];
  }, [campaigns, selectedCampaignId]);

  const broadcastMessageText = useMemo(() => {
    if (!selectedCampaign) return '';
    return buildCampaignWhatsAppMessage({
      name: selectedCampaign.name,
      campaignCode: selectedCampaign.campaignCode,
      venue: selectedCampaign.venue,
      city: selectedCampaign.city,
      startDate: selectedCampaign.startDate,
      endDate: selectedCampaign.endDate,
      targetDonations: selectedCampaign.targetDonations,
    });
  }, [selectedCampaign]);

  const handleCopyBroadcast = () => {
    if (broadcastMessageText) {
      navigator.clipboard.writeText(broadcastMessageText);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingVolunteer) return;

    try {
      setVerifySubmitting(true);
      await verifyVolunteer(verifyingVolunteer._id, {
        status: verifyStatus,
        adminNotes: verifyNotes.trim() || undefined,
        rejectionReason: verifyStatus === 'REJECTED' ? verifyNotes.trim() : undefined,
      });

      setVerifyingVolunteer(null);
      setVerifyNotes('');
      await loadData();
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifySubmitting(false);
    }
  };

  const handleAddVolunteerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.fullName.trim()) {
      setAddError('Full name is required.');
      return;
    }
    if (!addForm.phone.trim()) {
      setAddError('Phone number is required.');
      return;
    }
    if (!addForm.city.trim()) {
      setAddError('City is required.');
      return;
    }

    try {
      setAddSubmitting(true);
      setAddError(null);
      await adminCreateVolunteer({
        ...addForm,
        fullName: addForm.fullName.trim(),
        phone: addForm.phone.trim(),
        email: addForm.email?.trim() || undefined,
        city: addForm.city.trim(),
        address: addForm.address?.trim() || undefined,
        occupation: addForm.occupation?.trim() || undefined,
        adminNotes: addForm.adminNotes?.trim() || undefined,
      });

      setIsAddModalOpen(false);
      setAddForm({
        fullName: '',
        phone: '',
        email: '',
        bloodGroup: 'O+',
        gender: 'MALE',
        city: '',
        address: '',
        occupation: '',
        preferredRole: 'GENERAL',
        adminNotes: '',
      });
      await loadData();
    } catch (err: any) {
      setAddError(err.message || 'Failed to register volunteer.');
    } finally {
      setAddSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: '#f8fafc' }}>
            🤝 Volunteer Management & Verification
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            Review candidate applications, manage verified volunteers, coordinate campaign rosters, and send WhatsApp alerts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {selectedCampaign && (
            <button
              type="button"
              onClick={() => setIsBroadcastModalOpen(true)}
              style={{
                backgroundColor: '#25D366',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
              }}
            >
              <WhatsAppIcon size={18} />
              <span>Broadcast Campaign Alert</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsAddModalOpen(true);
              setAddError(null);
            }}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.15rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
            }}
          >
            <span>+</span>
            <span>Register Volunteer</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Broadcast Banner (Above Volunteer List) */}
      {selectedCampaign && (
        <div
          style={{
            backgroundColor: '#052e16',
            border: '1px solid #16a34a',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                backgroundColor: '#25D366',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <WhatsAppIcon size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#86efac', letterSpacing: '0.05em' }}>
                Active Campaign Volunteer Broadcast
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f0fdf4' }}>
                {selectedCampaign.name} ({selectedCampaign.campaignCode}) • {selectedCampaign.venue}, {selectedCampaign.city}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {campaigns.length > 1 && (
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.8rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {campaigns.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.campaignCode} — {c.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setIsBroadcastModalOpen(true)}
              style={{
                backgroundColor: '#22c55e',
                color: '#052e16',
                border: 'none',
                borderRadius: '6px',
                padding: '0.45rem 0.95rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <WhatsAppIcon size={14} /> Send WhatsApp Alert to Team
            </button>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
            Pending Verification
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: counts.pending > 0 ? '#fbbf24' : '#f8fafc', margin: '0.35rem 0 0.15rem 0' }}>
            {counts.pending}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
            {counts.pending > 0 ? '⚠️ Candidate applications waiting review' : 'All applications reviewed'}
          </span>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
            Approved Active Roster
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', margin: '0.35rem 0 0.15rem 0' }}>
            {counts.approved}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ready for campaign deployment</span>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
            Total Volunteers Registered
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', margin: '0.35rem 0 0.15rem 0' }}>
            {counts.total}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Across all categories</span>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('PENDING')}
              style={{
                backgroundColor: activeTab === 'PENDING' ? '#854d0e' : '#1e293b',
                color: activeTab === 'PENDING' ? '#fef08a' : '#94a3b8',
                border: activeTab === 'PENDING' ? '1px solid #ca8a04' : '1px solid #334155',
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>⏳ Pending Verification</span>
              {counts.pending > 0 && (
                <span style={{ backgroundColor: '#ef4444', color: '#ffffff', borderRadius: '9999px', padding: '0.1rem 0.45rem', fontSize: '0.7rem' }}>
                  {counts.pending}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('APPROVED')}
              style={{
                backgroundColor: activeTab === 'APPROVED' ? '#065f46' : '#1e293b',
                color: activeTab === 'APPROVED' ? '#a7f3d0' : '#94a3b8',
                border: activeTab === 'APPROVED' ? '1px solid #059669' : '1px solid #334155',
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ✓ Active / Approved Roster ({counts.approved})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              style={{
                backgroundColor: activeTab === 'ALL' ? '#1e40af' : '#1e293b',
                color: activeTab === 'ALL' ? '#bfdbfe' : '#94a3b8',
                border: activeTab === 'ALL' ? '1px solid #2563eb' : '1px solid #334155',
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              All Records ({counts.total})
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div>
            <input
              type="text"
              placeholder="Search by name, code, phone, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '0.45rem 0.75rem',
                color: '#f8fafc',
                fontSize: '0.825rem',
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
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '0.45rem 0.75rem',
                color: '#f8fafc',
                fontSize: '0.825rem',
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
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '0.45rem 0.75rem',
                color: '#f8fafc',
                fontSize: '0.825rem',
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              <option value="ALL">All Blood Groups</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
          </div>
        </div>
      </div>

      {/* Volunteer Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          Loading volunteers...
        </div>
      ) : error ? (
        <div style={{ backgroundColor: '#450a0a', border: '1px solid #dc2626', color: '#fecaca', padding: '1rem', borderRadius: '8px' }}>
          {error}
        </div>
      ) : volunteers.length === 0 ? (
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '10px',
            padding: '3rem',
            textAlign: 'center',
            color: '#94a3b8',
          }}
        >
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🤝</span>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
            No volunteers found matching current criteria.
          </div>
          <span style={{ fontSize: '0.825rem', color: '#64748b' }}>
            {activeTab === 'PENDING' ? 'No pending applications waiting review.' : 'Try adjusting filters or register a volunteer.'}
          </span>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '10px',
            overflowX: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b', backgroundColor: '#131e33', color: '#94a3b8' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Code & Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Contact</th>
                <th style={{ padding: '0.75rem 1rem' }}>Location & Blood</th>
                <th style={{ padding: '0.75rem 1rem' }}>Role & Availability</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Campaigns</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {volunteers.map((v) => {
                const badge = STATUS_BADGES[v.status] || STATUS_BADGES.PENDING;
                return (
                  <tr
                    key={v._id}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* Code & Name */}
                    <td
                      style={{ padding: '0.75rem 1rem', cursor: 'pointer' }}
                      onClick={() => handleOpenVolunteerDetail(v._id)}
                      title="Click to view full volunteer profile & campaign attendance history"
                    >
                      <div style={{ fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{v.fullName}</span>
                        <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>↗</span>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#38bdf8' }}>
                        {v.volunteerCode}
                      </div>
                    </td>

                    {/* Contact */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: '#e2e8f0' }}>{v.phone}</div>
                      {v.email && <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{v.email}</div>}
                    </td>

                    {/* Location & Blood */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: '#e2e8f0' }}>{v.city}</div>
                      {v.bloodGroup && (
                        <span
                          style={{
                            display: 'inline-block',
                            backgroundColor: '#881337',
                            color: '#fecdd3',
                            border: '1px solid #be123c',
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
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>
                        {VOLUNTEER_ROLE_LABELS[v.preferredRole || 'GENERAL'] || v.preferredRole}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                        {v.availability || 'Weekends'}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          backgroundColor: badge.bg,
                          color: badge.text,
                          border: `1px solid ${badge.border}`,
                          borderRadius: '9999px',
                          padding: '0.2rem 0.6rem',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {badge.label}
                      </span>
                      {v.registeredVia === 'PUBLIC_PORTAL' && (
                        <span style={{ display: 'block', fontSize: '0.675rem', color: '#64748b', marginTop: '0.25rem' }}>
                          via Public Website
                        </span>
                      )}
                    </td>

                    {/* Campaigns */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: '#f8fafc', fontWeight: 600 }}>
                        {v.attendedCampaignsCount} / {v.assignedCampaignsCount}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>attended</span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* View Complete Profile & Attendance Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenVolunteerDetail(v._id)}
                          title="View Profile & Campaign Attendance History"
                          style={{
                            backgroundColor: '#0284c725',
                            color: '#38bdf8',
                            border: '1px solid #0284c750',
                            borderRadius: '6px',
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <span>👁️</span>
                          <span>Details</span>
                        </button>

                        {/* WhatsApp Direct Chat Button */}
                        <a
                          href={buildWhatsAppLink(
                            v.phone,
                            selectedCampaign
                              ? broadcastMessageText
                              : `Hello ${v.fullName}, this is the Blood Bank Volunteer Coordination Team.`,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Chat / Invite via WhatsApp"
                          style={{
                            backgroundColor: '#25D36620',
                            color: '#22c55e',
                            border: '1px solid #22c55e40',
                            borderRadius: '6px',
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <WhatsAppIcon size={14} />
                          <span>WhatsApp</span>
                        </a>

                        {/* Verification Action (If Pending) */}
                        {v.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => {
                              setVerifyingVolunteer(v);
                              setVerifyStatus('APPROVED');
                              setVerifyNotes('');
                            }}
                            style={{
                              backgroundColor: '#059669',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Verify & Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Broadcast WhatsApp Modal */}
      {isBroadcastModalOpen && selectedCampaign && (
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
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              maxWidth: '620px',
              width: '100%',
              padding: '1.5rem',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#86efac' }}>
                <WhatsAppIcon size={20} />
                <span>WhatsApp Broadcast for Campaign</span>
              </h3>
              <button
                onClick={() => setIsBroadcastModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>
              Send details of date, venue, target collections, and reporting instructions to your volunteer network.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                Select Campaign Drive:
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                {campaigns.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.campaignCode} — {c.name} ({c.venue}, {c.city})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                Formatted Broadcast Message:
              </label>
              <textarea
                rows={10}
                readOnly
                value={broadcastMessageText}
                style={{
                  width: '100%',
                  backgroundColor: '#022c22',
                  border: '1px solid #059669',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: '#a7f3d0',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  lineHeight: 1.45,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleCopyBroadcast}
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copiedMessage ? '✓ Copied to Clipboard!' : '📋 Copy Message'}
              </button>

              <a
                href={buildWhatsAppLink(undefined, broadcastMessageText)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  backgroundColor: '#25D366',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.4)',
                }}
              >
                <WhatsAppIcon size={16} />
                <span>Open in WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Verify Volunteer Modal */}
      {verifyingVolunteer && (
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
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Verify Volunteer Application
              </h3>
              <button
                onClick={() => setVerifyingVolunteer(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                {verifyingVolunteer.fullName} ({verifyingVolunteer.volunteerCode})
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Phone: {verifyingVolunteer.phone} • City: {verifyingVolunteer.city} • Blood: {verifyingVolunteer.bloodGroup || 'N/A'}
              </div>
              {verifyingVolunteer.skills && (
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.35rem' }}>
                  Skills: {verifyingVolunteer.skills}
                </div>
              )}
            </div>

            <form onSubmit={handleVerifySubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Verification Decision *
                </label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setVerifyStatus('APPROVED')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: verifyStatus === 'APPROVED' ? '#064e3b' : '#1e293b',
                      color: verifyStatus === 'APPROVED' ? '#6ee7b7' : '#94a3b8',
                      border: verifyStatus === 'APPROVED' ? '1px solid #059669' : '1px solid #334155',
                    }}
                  >
                    ✓ Approve & Add to Active Roster
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyStatus('REJECTED')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: verifyStatus === 'REJECTED' ? '#450a0a' : '#1e293b',
                      color: verifyStatus === 'REJECTED' ? '#fca5a5' : '#94a3b8',
                      border: verifyStatus === 'REJECTED' ? '1px solid #dc2626' : '1px solid #334155',
                    }}
                  >
                    ✕ Reject Application
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  {verifyStatus === 'REJECTED' ? 'Rejection Reason *' : 'Admin Notes / Remarks (Optional)'}
                </label>
                <textarea
                  rows={3}
                  required={verifyStatus === 'REJECTED'}
                  placeholder={
                    verifyStatus === 'REJECTED'
                      ? 'State why this application was rejected...'
                      : 'e.g. Phone verified, assigned to weekend emergency team.'
                  }
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setVerifyingVolunteer(null)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifySubmitting}
                  style={{
                    backgroundColor: verifyStatus === 'APPROVED' ? '#059669' : '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: verifySubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {verifySubmitting
                    ? 'Updating...'
                    : verifyStatus === 'APPROVED'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Volunteer Modal */}
      {isAddModalOpen && (
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
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              maxWidth: '600px',
              width: '100%',
              padding: '1.5rem',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span>+</span> Register Active Volunteer
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {addError && (
              <div style={{ backgroundColor: '#450a0a', border: '1px solid #dc2626', color: '#fecaca', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                {addError}
              </div>
            )}

            <form onSubmit={handleAddVolunteerSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.45rem 0.65rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.45rem 0.65rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                    Blood Group
                  </label>
                  <select
                    value={addForm.bloodGroup}
                    onChange={(e) => setAddForm({ ...addForm, bloodGroup: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.45rem 0.65rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="O+">O Positive (O+)</option>
                    <option value="O-">O Negative (O-)</option>
                    <option value="A+">A Positive (A+)</option>
                    <option value="A-">A Negative (A-)</option>
                    <option value="B+">B Positive (B+)</option>
                    <option value="B-">B Negative (B-)</option>
                    <option value="AB+">AB Positive (AB+)</option>
                    <option value="AB-">AB Negative (AB-)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pune"
                    value={addForm.city}
                    onChange={(e) => setAddForm({ ...addForm, city: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.45rem 0.65rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                  Preferred Role
                </label>
                <select
                  value={addForm.preferredRole}
                  onChange={(e) => setAddForm({ ...addForm, preferredRole: e.target.value as VolunteerRole })}
                  style={{
                    width: '100%',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '0.45rem 0.65rem',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  {Object.entries(VOLUNTEER_ROLE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                  Admin Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Registered in-person at Camp Drive"
                  value={addForm.adminNotes}
                  onChange={(e) => setAddForm({ ...addForm, adminNotes: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '0.45rem 0.65rem',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  style={{
                    backgroundColor: '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: addSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {addSubmitting ? 'Saving...' : 'Save Volunteer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Complete Volunteer Profile & Campaign Attendance History Modal */}
      {selectedVolunteerDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              maxWidth: '840px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                    {selectedVolunteerDetail.fullName}
                  </h3>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      color: '#38bdf8',
                      backgroundColor: '#0284c720',
                      border: '1px solid #0284c750',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    {selectedVolunteerDetail.volunteerCode}
                  </span>
                  {(() => {
                    const b = STATUS_BADGES[selectedVolunteerDetail.status] || STATUS_BADGES.PENDING;
                    return (
                      <span
                        style={{
                          backgroundColor: b.bg,
                          color: b.text,
                          border: `1px solid ${b.border}`,
                          borderRadius: '9999px',
                          padding: '0.15rem 0.6rem',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                        }}
                      >
                        {b.label}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Registered on {new Date(selectedVolunteerDetail.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • via {selectedVolunteerDetail.registeredVia || 'Public Portal'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedVolunteerDetail(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Attendance & Campaign Service Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ backgroundColor: '#1e293b', border: '1px solid #059669', borderRadius: '10px', padding: '1rem' }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Campaigns Attended
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#34d399', margin: '0.25rem 0 0.15rem 0' }}>
                  {selectedVolunteerDetail.attendedCampaignsCount}
                </div>
                <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Marked present on-site</span>
              </div>

              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '1rem' }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Campaigns Assigned
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f8fafc', margin: '0.25rem 0 0.15rem 0' }}>
                  {selectedVolunteerDetail.assignedCampaignsCount}
                </div>
                <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Total deployment calls</span>
              </div>

              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '1rem' }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Attendance Rate
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#38bdf8', margin: '0.25rem 0 0.15rem 0' }}>
                  {selectedVolunteerDetail.assignedCampaignsCount > 0
                    ? `${Math.round((selectedVolunteerDetail.attendedCampaignsCount / selectedVolunteerDetail.assignedCampaignsCount) * 100)}%`
                    : '100%'}
                </div>
                <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Reliability ratio</span>
              </div>

              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '1rem' }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Preferred Role
                </span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: '0.4rem 0 0.15rem 0' }}>
                  {VOLUNTEER_ROLE_LABELS[selectedVolunteerDetail.preferredRole || 'GENERAL'] || selectedVolunteerDetail.preferredRole}
                </div>
                <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                  {selectedVolunteerDetail.availability || 'Weekends'}
                </span>
              </div>
            </div>

            {/* Profile & Contact Details Grid */}
            <div style={{ backgroundColor: '#131e33', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span>👤</span> Personal & Contact Information
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.825rem' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600 }}>Phone / Mobile</div>
                  <div style={{ color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <span>{selectedVolunteerDetail.phone}</span>
                    <a
                      href={buildWhatsAppLink(selectedVolunteerDetail.phone, `Hello ${selectedVolunteerDetail.fullName}, contacting from Blood Bank Volunteer Coordination.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        backgroundColor: '#25D36625',
                        color: '#22c55e',
                        border: '1px solid #22c55e50',
                        borderRadius: '4px',
                        padding: '0.15rem 0.45rem',
                        fontSize: '0.7rem',
                        textDecoration: 'none',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <WhatsAppIcon size={12} /> Chat
                    </a>
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600 }}>Email Address</div>
                  <div style={{ color: '#f8fafc', marginTop: '0.2rem' }}>{selectedVolunteerDetail.email || 'Not provided'}</div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600 }}>Blood Group</div>
                  <div style={{ marginTop: '0.2rem' }}>
                    {selectedVolunteerDetail.bloodGroup ? (
                      <span style={{ backgroundColor: '#881337', color: '#fecdd3', border: '1px solid #be123c', borderRadius: '4px', padding: '0.1rem 0.45rem', fontSize: '0.75rem', fontWeight: 700 }}>
                        {selectedVolunteerDetail.bloodGroup}
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>Unknown</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600 }}>Gender</div>
                  <div style={{ color: '#f8fafc', marginTop: '0.2rem' }}>{selectedVolunteerDetail.gender || 'OTHER'}</div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600 }}>City & Location</div>
                  <div style={{ color: '#f8fafc', marginTop: '0.2rem' }}>
                    {selectedVolunteerDetail.city}
                    {selectedVolunteerDetail.address && ` • ${selectedVolunteerDetail.address}`}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600 }}>Occupation</div>
                  <div style={{ color: '#f8fafc', marginTop: '0.2rem' }}>{selectedVolunteerDetail.occupation || 'Not specified'}</div>
                </div>

                {selectedVolunteerDetail.skills && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600 }}>Skills / Experience</div>
                    <div style={{ color: '#e2e8f0', marginTop: '0.2rem' }}>{selectedVolunteerDetail.skills}</div>
                  </div>
                )}

                {selectedVolunteerDetail.adminNotes && (
                  <div style={{ gridColumn: '1 / -1', backgroundColor: '#1e293b', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #334155' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.725rem', fontWeight: 600 }}>Verification / Admin Notes:</div>
                    <div style={{ color: '#f8fafc', marginTop: '0.2rem' }}>{selectedVolunteerDetail.adminNotes}</div>
                    {selectedVolunteerDetail.verifiedBy && (
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>
                        Verified by {selectedVolunteerDetail.verifiedBy} on {new Date(selectedVolunteerDetail.verifiedAt || '').toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Campaign Participation & Attendance History */}
            <div>
              <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🩸</span> Campaign Participation & Attendance History
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', backgroundColor: '#0284c720', border: '1px solid #0284c740', padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>
                  {selectedVolunteerDetail.participations?.length || 0} drives
                </span>
              </h4>

              {!selectedVolunteerDetail.participations || selectedVolunteerDetail.participations.length === 0 ? (
                <div style={{ backgroundColor: '#131e33', border: '1px solid #1e293b', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No campaign drive participations recorded yet for this volunteer.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #1e293b', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#131e33', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
                        <th style={{ padding: '0.7rem 0.85rem' }}>Campaign</th>
                        <th style={{ padding: '0.7rem 0.85rem' }}>Venue / City</th>
                        <th style={{ padding: '0.7rem 0.85rem' }}>Assigned Role</th>
                        <th style={{ padding: '0.7rem 0.85rem' }}>Attendance Status</th>
                        <th style={{ padding: '0.7rem 0.85rem' }}>Check-In Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVolunteerDetail.participations.map((part) => {
                        const campObj = typeof part.campaignId === 'object' && part.campaignId !== null ? part.campaignId : null;
                        const campName = campObj?.name || part.campaignCode || 'Blood Drive';
                        const venue = campObj?.venue || 'Camp Site';
                        const city = campObj?.city || '';
                        const isPresent = part.attendanceStatus === 'PRESENT';
                        const isAbsent = part.attendanceStatus === 'ABSENT';

                        return (
                          <tr key={part._id} style={{ borderBottom: '1px solid #1e293b' }}>
                            {/* Campaign */}
                            <td style={{ padding: '0.7rem 0.85rem' }}>
                              <div style={{ fontWeight: 700, color: '#f8fafc' }}>{campName}</div>
                              <div style={{ fontSize: '0.725rem', fontFamily: 'monospace', color: '#38bdf8' }}>
                                {part.campaignCode}
                              </div>
                            </td>

                            {/* Venue / City */}
                            <td style={{ padding: '0.7rem 0.85rem' }}>
                              <div style={{ color: '#e2e8f0' }}>{venue}</div>
                              {city && <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{city}</div>}
                            </td>

                            {/* Role */}
                            <td style={{ padding: '0.7rem 0.85rem', color: '#e2e8f0' }}>
                              {VOLUNTEER_ROLE_LABELS[part.role] || part.role}
                            </td>

                            {/* Attendance Status */}
                            <td style={{ padding: '0.7rem 0.85rem' }}>
                              <span
                                style={{
                                  backgroundColor: isPresent ? '#064e3b' : isAbsent ? '#450a0a' : '#451a03',
                                  color: isPresent ? '#6ee7b7' : isAbsent ? '#fca5a5' : '#fde68a',
                                  border: `1px solid ${isPresent ? '#059669' : isAbsent ? '#dc2626' : '#b45309'}`,
                                  borderRadius: '9999px',
                                  padding: '0.2rem 0.6rem',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                }}
                              >
                                {isPresent ? '✓ PRESENT' : isAbsent ? '✕ ABSENT' : '⏳ PENDING'}
                              </span>
                            </td>

                            {/* Check-In Details */}
                            <td style={{ padding: '0.7rem 0.85rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                              {part.attendanceMarkedAt ? (
                                <div>
                                  <div style={{ color: '#e2e8f0' }}>
                                    {new Date(part.attendanceMarkedAt).toLocaleString('en-IN', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })}
                                  </div>
                                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                    by {part.attendanceMarkedBy || 'Staff'}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: '#64748b' }}>No check-in record</span>
                              )}
                              {part.notes && (
                                <div style={{ fontSize: '0.7rem', color: '#cbd5e1', fontStyle: 'italic', marginTop: '0.2rem' }}>
                                  &quot;{part.notes}&quot;
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid #1e293b', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setSelectedVolunteerDetail(null)}
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  padding: '0.55rem 1.35rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
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
