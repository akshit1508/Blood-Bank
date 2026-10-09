'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Donor,
  DonorStatus,
  BloodGroup,
  fetchDonors,
  updateDonorStatus,
  buildDonorWhatsAppUrl,
} from '@/lib/donor-api';
import {
  Donation,
  DonationType,
  DonationStatus,
  fetchDonations,
  createDonation,
} from '@/lib/donation-api';
import { BloodUnit, fetchBloodUnits } from '@/lib/blood-unit-api';
import {
  calculateCompletedAge,
  evaluateDonationInterval,
  IntervalEligibilityResult,
} from '@/lib/eligibility';

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

const BLOOD_GROUPS = [
  BloodGroup.A_POSITIVE,
  BloodGroup.A_NEGATIVE,
  BloodGroup.B_POSITIVE,
  BloodGroup.B_NEGATIVE,
  BloodGroup.AB_POSITIVE,
  BloodGroup.AB_NEGATIVE,
  BloodGroup.O_POSITIVE,
  BloodGroup.O_NEGATIVE,
];

const DONOR_STATUS_STYLES: Record<
  DonorStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  [DonorStatus.PENDING_REVIEW]: {
    bg: '#fef3c7',
    text: '#92400e',
    border: '#fcd34d',
    label: 'PENDING REVIEW',
  },
  [DonorStatus.ACTIVE]: {
    bg: '#dcfce7',
    text: '#15803d',
    border: '#86efac',
    label: 'ACTIVE',
  },
  [DonorStatus.INACTIVE]: {
    bg: '#f1f5f9',
    text: '#64748b',
    border: '#e2e8f0',
    label: 'INACTIVE',
  },
};

const DONATION_STATUS_STYLES: Record<
  DonationStatus,
  { bg: string; text: string }
> = {
  [DonationStatus.RECORDED]: { bg: '#eff6ff', text: '#1d4ed8' },
  [DonationStatus.PROCESSING]: { bg: '#fef3c7', text: '#b45309' },
  [DonationStatus.COMPLETED]: { bg: '#dcfce7', text: '#15803d' },
  [DonationStatus.CANCELLED]: { bg: '#f1f5f9', text: '#64748b' },
};

export default function AdminDonorsPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBloodGroup, setFilterBloodGroup] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Status mutation state
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  // Donation history state for selected donor
  const [donationHistory, setDonationHistory] = useState<Donation[]>([]);
  const [donorBloodUnits, setDonorBloodUnits] = useState<Record<string, BloodUnit>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Preselected Record Donation Modal state
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [donationDate, setDonationDate] = useState(() => {
    return new Date().toISOString().slice(0, 16);
  });
  const [donationType, setDonationType] = useState<DonationType>(
    DonationType.WHOLE_BLOOD,
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordErrorDetails, setRecordErrorDetails] = useState<any | null>(null);
  const [recordSuccessReceipt, setRecordSuccessReceipt] =
    useState<Donation | null>(null);

  // Evaluate donation interval status for selected donor
  const intervalStatus: IntervalEligibilityResult | null = React.useMemo(() => {
    if (!selectedDonor) return null;
    const lastCompleted = donationHistory
      .filter(
        (d) =>
          d.status === DonationStatus.COMPLETED &&
          d.donationType === DonationType.WHOLE_BLOOD,
      )
      .sort(
        (a, b) =>
          new Date(b.donationDate).getTime() -
          new Date(a.donationDate).getTime(),
      )[0];

    return evaluateDonationInterval(
      lastCompleted ? lastCompleted.donationDate : null,
      selectedDonor.gender,
    );
  }, [selectedDonor, donationHistory]);

  // Load donors list
  const loadDonors = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchDonors({
        search: searchTerm.trim() || undefined,
        bloodGroup: filterBloodGroup || undefined,
        status: filterStatus || undefined,
      });
      setDonors(data);
      setSelectedDonor((prev) => {
        if (!prev) return null;
        return data.find((d) => d._id === prev._id) || null;
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch donors');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterBloodGroup, filterStatus]);

  useEffect(() => {
    loadDonors();
  }, [loadDonors]);

  // Load donation history whenever selectedDonor changes
  const loadDonationHistory = useCallback(async (donorId: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const [res, unitsRes] = await Promise.all([
        fetchDonations({ donorId, limit: 50 }),
        fetchBloodUnits({ donorId }).catch(() => ({
          items: [] as BloodUnit[],
          total: 0,
          page: 1,
          totalPages: 0,
        })),
      ]);
      setDonationHistory(res.items);
      const unitMap: Record<string, BloodUnit> = {};
      for (const u of unitsRes.items) {
        const dId =
          typeof u.donationId === 'object' && u.donationId !== null
            ? (u.donationId as any)._id
            : (u.donationId as string);
        if (dId) {
          unitMap[dId] = u;
        }
      }
      setDonorBloodUnits(unitMap);
    } catch (err: any) {
      setHistoryError(err.message || 'Failed to load donation history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDonor?._id) {
      loadDonationHistory(selectedDonor._id);
    } else {
      setDonationHistory([]);
      setDonorBloodUnits({});
    }
  }, [selectedDonor?._id, loadDonationHistory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDonors();
  };

  // Administrative status transitions
  const handleSetStatus = async (targetStatus: DonorStatus) => {
    if (!selectedDonor) return;
    setUpdateLoading(true);
    setUpdateError(null);
    setUpdateSuccess(null);

    try {
      const updated = await updateDonorStatus(selectedDonor._id, targetStatus);
      setDonors((prev) =>
        prev.map((d) => (d._id === updated._id ? updated : d)),
      );
      setSelectedDonor(updated);
      setUpdateSuccess(
        targetStatus === DonorStatus.ACTIVE
          ? '✓ Donor approved successfully.'
          : `Donor status updated to ${updated.status} successfully.`,
      );
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update donor status');
    } finally {
      setUpdateLoading(false);
    }
  };

  // Handle Record Donation submission from donor profile
  const handleRecordDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonor) return;

    if (selectedDonor.status !== DonorStatus.ACTIVE) {
      setRecordError('Donation can only be recorded for ACTIVE donors.');
      return;
    }

    setRecordLoading(true);
    setRecordError(null);
    setRecordErrorDetails(null);

    try {
      const newDonation = await createDonation({
        donorId: selectedDonor._id,
        donationDate: new Date(donationDate).toISOString(),
        donationType,
        quantity: Number(quantity) || 1,
        notes: notes.trim() || undefined,
      });

      setRecordSuccessReceipt(newDonation);
      // Refresh donation history for this donor
      await loadDonationHistory(selectedDonor._id);
    } catch (err: any) {
      setRecordError(err.message || 'Failed to record donation');
      if (err.details) {
        setRecordErrorDetails(err.details);
      }
    } finally {
      setRecordLoading(false);
    }
  };

  const handleCloseDonationModal = () => {
    setShowDonationModal(false);
    setRecordSuccessReceipt(null);
    setRecordError(null);
    setRecordErrorDetails(null);
    setNotes('');
    setQuantity(1);
    setDonationDate(new Date().toISOString().slice(0, 16));
  };

  return (
    <div
      style={{
        maxWidth: '100%',
        margin: '0',
        padding: '0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          backgroundColor: '#ffffff',
          padding: '1.25rem 1.5rem',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
              Donor Management
            </h1>
            <span
              style={{
                backgroundColor: '#f1f5f9',
                color: '#475569',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
              }}
            >
              Donor-Centric Roster
            </span>
          </div>
          <p
            style={{
              margin: '0.25rem 0 0 0',
              color: '#64748b',
              fontSize: '0.85rem',
            }}
          >
            Review donor registrations, approve active donors, and record physical blood donations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={loadDonors}
            disabled={loading}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            ↻ Refresh Roster
          </button>
          <Link
            href="/donate-blood"
            target="_blank"
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.825rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
            }}
          >
            + Register New Donor
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '280px' }}
        >
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Donor Code, Name, Phone, City..."
            style={{
              flex: 1,
              padding: '0.45rem 0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          />
          <button
            type="submit"
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              border: 'none',
              padding: '0.45rem 1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Blood group filter */}
          <select
            value={filterBloodGroup}
            onChange={(e) => setFilterBloodGroup(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
            }}
          >
            <option value="">All Blood Groups</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>

          {/* Status filter: All, Pending Review, Active, Inactive */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <option value="">All Statuses</option>
            <option value={DonorStatus.PENDING_REVIEW}>Pending Review</option>
            <option value={DonorStatus.ACTIVE}>Active</option>
            <option value={DonorStatus.INACTIVE}>Inactive</option>
          </select>

          <button
            onClick={loadDonors}
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Error Banners */}
      {errorMessage && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.9rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Main Grid: Table & Details Drawer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedDonor ? '1fr 420px' : '1fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Donors Table */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              Loading registered donors from database...
            </div>
          ) : donors.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              No registered donors found matching the current filters.
              <div style={{ marginTop: '0.5rem' }}>
                <Link
                  href="/donate-blood"
                  style={{ color: '#dc2626', fontWeight: 500 }}
                >
                  Register a donor via the public form &rarr;
                </Link>
              </div>
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    color: '#475569',
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem' }}>Donor Code</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Group</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Phone</th>
                  <th style={{ padding: '0.75rem 1rem' }}>City</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Registered</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {donors.map((donor) => {
                  const isSelected = selectedDonor?._id === donor._id;
                  const statusStyle =
                    DONOR_STATUS_STYLES[donor.status] ||
                    DONOR_STATUS_STYLES[DonorStatus.PENDING_REVIEW];

                  return (
                    <tr
                      key={donor._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isSelected
                          ? '#f0fdf4'
                          : donor.status === DonorStatus.PENDING_REVIEW
                          ? '#fffbeb'
                          : 'transparent',
                      }}
                    >
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          fontWeight: 600,
                          color: '#0f172a',
                        }}
                      >
                        {donor.donorCode}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontWeight: 500,
                            color: '#0f172a',
                            display: 'block',
                          }}
                        >
                          {donor.fullName}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                          {donor.gender}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: '#dc2626',
                            backgroundColor: '#fee2e2',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                          }}
                        >
                          {donor.bloodGroup}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span>{donor.phone}</span>
                          <a
                            href={buildDonorWhatsAppUrl(donor.phone, donor.fullName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Chat on WhatsApp with ${donor.fullName}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#25D366',
                              color: '#ffffff',
                              borderRadius: '50%',
                              width: '22px',
                              height: '22px',
                              textDecoration: 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                              flexShrink: 0,
                            }}
                          >
                            <WhatsAppIcon size={13} />
                          </a>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {donor.city || '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.text,
                            border: `1px solid ${statusStyle.border}`,
                            letterSpacing: '0.03em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          {donor.status === DonorStatus.PENDING_REVIEW && '⚠️ '}
                          {statusStyle.label}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          color: '#64748b',
                          fontSize: '0.8rem',
                        }}
                      >
                        {new Date(donor.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setSelectedDonor(donor);
                            setUpdateError(null);
                            setUpdateSuccess(null);
                          }}
                          style={{
                            background: isSelected ? '#15803d' : '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                          }}
                        >
                          {isSelected ? 'Viewing' : 'Open Profile'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Selected Donor Profile Drawer */}
        {selectedDonor && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '1.25rem',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '0.5rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
                    {selectedDonor.fullName}
                  </h2>
                  {selectedDonor.status === DonorStatus.PENDING_REVIEW && (
                    <span style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                      ⚠️ Donor Registration Pending Review
                    </span>
                  )}
                  {selectedDonor.status === DonorStatus.ACTIVE && (
                    <span style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                      ✓ Verified Donor
                    </span>
                  )}
                  {selectedDonor.status === DonorStatus.INACTIVE && (
                    <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                      Inactive
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedDonor(null);
                  setUpdateError(null);
                  setUpdateSuccess(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '1.4rem',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Status alerts */}
            {updateError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  marginBottom: '0.75rem',
                }}
              >
                {updateError}
              </div>
            )}
            {updateSuccess && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  marginBottom: '0.75rem',
                }}
              >
                {updateSuccess}
              </div>
            )}

            {/* Quick Identifier Card */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.75rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                  Registration Code
                </span>
                <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                  {selectedDonor.donorCode}
                </strong>
              </div>
              <span
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  fontWeight: 800,
                  fontSize: '1rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  border: '1px solid #fecaca',
                }}
              >
                {selectedDonor.bloodGroup}
              </span>
            </div>

            <div style={{ fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              {/* Section 1: Personal Information */}
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', marginBottom: '0.25rem' }}>
                  1. Personal Information
                </strong>
                <div><strong>Gender:</strong> {selectedDonor.gender}</div>
                <div>
                  <strong>Date of Birth:</strong>{' '}
                  {selectedDonor.dateOfBirth
                    ? `${new Date(selectedDonor.dateOfBirth).toLocaleDateString()} (Age: ${calculateCompletedAge(selectedDonor.dateOfBirth)} years)`
                    : 'Not provided'}
                </div>
              </div>

              {/* Section 2: Contact Information */}
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', marginBottom: '0.25rem' }}>
                  2. Contact Information
                </strong>
                <div><strong>Phone:</strong> {selectedDonor.phone}</div>
                {selectedDonor.email && <div><strong>Email:</strong> {selectedDonor.email}</div>}
                {selectedDonor.city && <div><strong>City:</strong> {selectedDonor.city}</div>}
                {selectedDonor.address && <div><strong>Address:</strong> {selectedDonor.address}</div>}
                {(selectedDonor.emergencyContact?.name || selectedDonor.emergencyContact?.phone) && (
                  <div style={{ marginTop: '0.25rem', color: '#475569', fontSize: '0.8rem' }}>
                    Emergency Contact: {selectedDonor.emergencyContact.name || '—'} ({selectedDonor.emergencyContact.phone || '—'})
                  </div>
                )}
              </div>

              {/* Section 3: Registration Status */}
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', marginBottom: '0.25rem' }}>
                  3. Registration Status
                </strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span
                    style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: DONOR_STATUS_STYLES[selectedDonor.status]?.bg,
                      color: DONOR_STATUS_STYLES[selectedDonor.status]?.text,
                      border: `1px solid ${DONOR_STATUS_STYLES[selectedDonor.status]?.border}`,
                    }}
                  >
                    {DONOR_STATUS_STYLES[selectedDonor.status]?.label}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Registered on {new Date(selectedDonor.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Section 4: Administrative Review Actions */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <strong style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569', marginBottom: '0.4rem' }}>
                  4. Administrative Actions
                </strong>

                {selectedDonor.status === DonorStatus.PENDING_REVIEW && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '0.5rem', fontSize: '0.8rem', color: '#92400e' }}>
                      <strong>Status: PENDING REVIEW</strong>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>
                        Review registration details above. Approving the donor marks them as an Active Donor (ACTIVE). After approval, you can notify them directly on WhatsApp with pre-filled verification details.
                      </p>
                    </div>
                    <button
                      onClick={() => handleSetStatus(DonorStatus.ACTIVE)}
                      disabled={updateLoading}
                      style={{
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.6rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: updateLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      {updateLoading ? 'Processing Approval...' : '✓ Approve Donor'}
                    </button>
                    <button
                      onClick={() => handleSetStatus(DonorStatus.INACTIVE)}
                      disabled={updateLoading}
                      style={{
                        backgroundColor: '#64748b',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.45rem',
                        borderRadius: '4px',
                        fontWeight: 500,
                        fontSize: '0.8rem',
                        cursor: updateLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Mark Inactive
                    </button>
                  </div>
                )}

                {selectedDonor.status === DonorStatus.ACTIVE && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>
                        ✓ Verified Donor (ACTIVE)
                      </span>
                      <button
                        onClick={() => handleSetStatus(DonorStatus.INACTIVE)}
                        disabled={updateLoading}
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          border: '1px solid #cbd5e1',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '4px',
                          fontWeight: 500,
                          fontSize: '0.75rem',
                          cursor: updateLoading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Deactivate Donor
                      </button>
                    </div>

                    {/* Direct WhatsApp Click-to-Chat (Opens WhatsApp Web / Mobile app directly with pre-filled message) */}
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                        <WhatsAppIcon size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                          WhatsApp Notification
                        </span>
                      </div>
                      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#475569', lineHeight: 1.4 }}>
                        Send the official registration verification message directly to <strong>{selectedDonor.phone}</strong> via WhatsApp.
                      </p>
                      <a
                        href={buildDonorWhatsAppUrl(
                          selectedDonor.phone,
                          selectedDonor.fullName,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          backgroundColor: '#25D366',
                          color: '#ffffff',
                          padding: '0.5rem 0.85rem',
                          borderRadius: '5px',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        }}
                      >
                        <WhatsAppIcon size={16} /> Open in WhatsApp &amp; Send Message
                      </a>
                    </div>
                  </div>
                )}

                {selectedDonor.status === DonorStatus.INACTIVE && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                      Donor record is currently inactive.
                    </span>
                    <button
                      onClick={() => handleSetStatus(DonorStatus.ACTIVE)}
                      disabled={updateLoading}
                      style={{
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.45rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: updateLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {updateLoading ? 'Processing...' : 'Activate Donor'}
                    </button>
                  </div>
                )}

                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                  <em>Note: Approval is administrative only; clinical eligibility is evaluated per SOP at collection.</em>
                </p>
              </div>

              {/* Section 5: Donation History & Record Action */}
              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <strong style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                    5. Donation History ({donationHistory.length})
                  </strong>
                  {selectedDonor.status === DonorStatus.ACTIVE && (
                    <button
                      onClick={() => {
                        setShowDonationModal(true);
                        setRecordSuccessReceipt(null);
                        setRecordError(null);
                        setRecordErrorDetails(null);
                      }}
                      disabled={intervalStatus ? !intervalStatus.isEligible : false}
                      style={{
                        backgroundColor:
                          intervalStatus && !intervalStatus.isEligible
                            ? '#94a3b8'
                            : '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor:
                          intervalStatus && !intervalStatus.isEligible
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                      title={
                        intervalStatus && !intervalStatus.isEligible
                          ? `Waiting period active: ${intervalStatus.remainingDays} days remaining until ${intervalStatus.nextEligibleDate}`
                          : undefined
                      }
                    >
                      + Record Donation
                    </button>
                  )}
                </div>

                {/* Donation Interval Status Card */}
                {intervalStatus && (
                  <div
                    style={{
                      backgroundColor: !intervalStatus.isEligible
                        ? '#fffbeb'
                        : intervalStatus.hasPreviousDonation
                        ? '#f0fdf4'
                        : '#f8fafc',
                      border: `1px solid ${
                        !intervalStatus.isEligible
                          ? '#fde68a'
                          : intervalStatus.hasPreviousDonation
                          ? '#bbf7d0'
                          : '#e2e8f0'
                      }`,
                      borderRadius: '6px',
                      padding: '0.65rem 0.75rem',
                      marginBottom: '0.75rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#334155' }}>
                        Donation Interval Status:
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          backgroundColor: !intervalStatus.isEligible
                            ? '#fef3c7'
                            : intervalStatus.hasPreviousDonation
                            ? '#dcfce7'
                            : '#e2e8f0',
                          color: !intervalStatus.isEligible
                            ? '#92400e'
                            : intervalStatus.hasPreviousDonation
                            ? '#15803d'
                            : '#475569',
                          border: `1px solid ${
                            !intervalStatus.isEligible
                              ? '#fcd34d'
                              : intervalStatus.hasPreviousDonation
                              ? '#86efac'
                              : '#cbd5e1'
                          }`,
                        }}
                      >
                        {!intervalStatus.isEligible
                          ? 'WAITING PERIOD'
                          : intervalStatus.hasPreviousDonation
                          ? 'ELIGIBLE'
                          : 'NO PREVIOUS DONATION'}
                      </span>
                    </div>

                    {!intervalStatus.isEligible ? (
                      <div style={{ color: '#92400e', lineHeight: 1.4 }}>
                        <div>
                          ⚠️ <strong>Whole-blood interval waiting period active:</strong>{' '}
                          {selectedDonor.gender === 'MALE' ? '90' : '120'} days required for {selectedDonor.gender}.
                        </div>
                        <div style={{ marginTop: '0.2rem' }}>
                          Last Completed: <strong>{intervalStatus.lastDonationDate}</strong> &bull; Next Eligible: <strong>{intervalStatus.nextEligibleDate}</strong>
                        </div>
                        <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                          Remaining waiting period: {intervalStatus.remainingDays} day(s)
                        </div>
                      </div>
                    ) : intervalStatus.hasPreviousDonation ? (
                      <div style={{ color: '#166534', lineHeight: 1.4 }}>
                        ✓ Required interval completed. Last completed whole-blood donation was on {intervalStatus.lastDonationDate}. Eligible for new collection.
                      </div>
                    ) : (
                      <div style={{ color: '#475569', lineHeight: 1.4 }}>
                        ℹ️ No previous completed whole-blood donation on record. First whole-blood collection eligible.
                      </div>
                    )}
                  </div>
                )}

                {/* Status Notice if not ACTIVE */}
                {selectedDonor.status === DonorStatus.PENDING_REVIEW && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#92400e',
                      padding: '0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    ⚠️ Donor registration pending review. Approve donor before recording a donation.
                  </div>
                )}

                {selectedDonor.status === DonorStatus.INACTIVE && (
                  <div
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      color: '#64748b',
                      padding: '0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    Donor is inactive. Activate donor to record donations.
                  </div>
                )}

                {/* History List */}
                {historyLoading ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                    Loading past donations...
                  </div>
                ) : historyError ? (
                  <div style={{ color: '#991b1b', fontSize: '0.8rem' }}>{historyError}</div>
                ) : donationHistory.length === 0 ? (
                  <div
                    style={{
                      padding: '1rem',
                      textAlign: 'center',
                      background: '#f8fafc',
                      borderRadius: '4px',
                      color: '#64748b',
                      fontSize: '0.8rem',
                    }}
                  >
                    No donations recorded for this donor.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                    {donationHistory.map((item) => {
                      const unit = donorBloodUnits[item._id];
                      return (
                        <div
                          key={item._id}
                          style={{
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            padding: '0.5rem 0.65rem',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <strong style={{ color: '#0f172a', display: 'block' }}>
                                {item.donationCode}
                              </strong>
                              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                {new Date(item.donationDate).toLocaleDateString()} &bull; {item.donationType} ({item.quantity} unit)
                              </span>
                            </div>
                            <span
                              style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: '9999px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                backgroundColor: DONATION_STATUS_STYLES[item.status]?.bg || '#f1f5f9',
                                color: DONATION_STATUS_STYLES[item.status]?.text || '#64748b',
                              }}
                            >
                              {item.status}
                            </span>
                          </div>

                          {item.status === DonationStatus.COMPLETED && (
                            <div
                              style={{
                                marginTop: '0.4rem',
                                paddingTop: '0.4rem',
                                borderTop: '1px dashed #cbd5e1',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.72rem',
                              }}
                            >
                              {unit ? (
                                <span style={{ color: '#0369a1', fontWeight: 500 }}>
                                  🩸 Unit: <strong>{unit.unitCode}</strong> ({unit.status})
                                </span>
                              ) : (
                                <span style={{ color: '#b45309', fontWeight: 500 }}>
                                  ⚠️ Blood Unit: Not Created
                                </span>
                              )}
                              {unit ? (
                                <Link
                                  href={`/admin/testing?bloodUnitId=${unit._id}`}
                                  style={{
                                    color: '#2563eb',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                  }}
                                >
                                  View Testing &rarr;
                                </Link>
                              ) : (
                                <Link
                                  href={`/admin/donations?search=${encodeURIComponent(item.donationCode)}`}
                                  style={{
                                    color: '#dc2626',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                  }}
                                >
                                  + Create Unit &rarr;
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preselected Record Donation Modal */}
      {showDonationModal && selectedDonor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
                  Record Blood Donation
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Donor is preselected from donor profile
                </span>
              </div>
              <button
                onClick={handleCloseDonationModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  lineHeight: 1,
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            {/* Success Receipt State */}
            {recordSuccessReceipt ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '2.5rem', color: '#16a34a', marginBottom: '0.5rem' }}>✓</div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#15803d', fontSize: '1.2rem' }}>
                  Donation Recorded Successfully
                </h3>
                <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.85rem' }}>
                  Physical collection logged. Donation is in RECORDED status.
                </p>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '6px',
                    padding: '1rem',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div><span style={{ color: '#64748b' }}>Donation Code:</span> <strong>{recordSuccessReceipt.donationCode}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Donor:</span> <strong>{selectedDonor.fullName}</strong> ({selectedDonor.donorCode})</div>
                  <div><span style={{ color: '#64748b' }}>Blood Group:</span> <strong style={{ color: '#dc2626' }}>{selectedDonor.bloodGroup}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Donation Date:</span> {new Date(recordSuccessReceipt.donationDate).toLocaleString()}</div>
                  <div><span style={{ color: '#64748b' }}>Status:</span> <strong style={{ color: '#1d4ed8' }}>{recordSuccessReceipt.status}</strong></div>
                </div>

                <button
                  onClick={handleCloseDonationModal}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Done & Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleRecordDonationSubmit}>
                {recordError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fca5a5',
                      color: '#991b1b',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      marginBottom: '1rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{recordError}</div>
                    {recordErrorDetails?.code === 'DONATION_INTERVAL_NOT_COMPLETED' && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid #fecaca',
                          fontSize: '0.8rem',
                          lineHeight: 1.5,
                        }}
                      >
                        <div>
                          &bull; <strong>Last Completed Donation:</strong>{' '}
                          {recordErrorDetails.lastDonationDate}
                        </div>
                        <div>
                          &bull; <strong>Next Eligible Date:</strong>{' '}
                          {recordErrorDetails.nextEligibleDate}
                        </div>
                        <div>
                          &bull; <strong>Remaining Days:</strong>{' '}
                          {recordErrorDetails.remainingDays} day(s)
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Preselected & Locked Donor Card */}
                <div
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                        DONOR (PRESELECTED)
                      </span>
                      <strong style={{ display: 'block', fontSize: '1rem', color: '#14532d' }}>
                        {selectedDonor.fullName}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: '#166534' }}>
                        {selectedDonor.donorCode} &bull; Phone: {selectedDonor.phone}
                      </span>
                    </div>
                    <span
                      style={{
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        fontWeight: 800,
                        fontSize: '1rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid #fecaca',
                      }}
                    >
                      {selectedDonor.bloodGroup}
                    </span>
                  </div>
                  <span
                    style={{
                      display: 'block',
                      marginTop: '0.4rem',
                      fontSize: '0.75rem',
                      color: '#15803d',
                      fontStyle: 'italic',
                    }}
                  >
                    [Donor cannot be changed here]
                  </span>
                </div>

                {/* Donation Date */}
                <div style={{ marginBottom: '1rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Donation Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={donationDate}
                    onChange={(e) => setDonationDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Component Type & Quantity */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '0.35rem',
                      }}
                    >
                      Component *
                    </label>
                    <select
                      value={donationType}
                      onChange={(e) =>
                        setDonationType(e.target.value as DonationType)
                      }
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                      }}
                    >
                      <option value={DonationType.WHOLE_BLOOD}>
                        WHOLE_BLOOD
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '0.35rem',
                      }}
                    >
                      Quantity (Units) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Clinical Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Standard phlebotomy completed, 450ml bag"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '1rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCloseDonationModal}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recordLoading}
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#dc2626',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: recordLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {recordLoading ? 'Recording...' : 'Record Donation'}
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
