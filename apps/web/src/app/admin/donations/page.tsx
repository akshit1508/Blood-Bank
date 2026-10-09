'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Donation,
  DonationStatus,
  DonationType,
  ALLOWED_DONATION_STATUS_TRANSITIONS,
  fetchDonations,
  createDonation,
  updateDonationStatus,
} from '@/lib/donation-api';
import { Donor, DonorStatus, BloodGroup, fetchDonors } from '@/lib/donor-api';
import {
  BloodUnit,
  BloodUnitComponent,
  BloodUnitStatus,
  createBloodUnit,
  fetchBloodUnitByDonationId,
} from '@/lib/blood-unit-api';
import { evaluateDonationInterval } from '@/lib/eligibility';

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

const STATUS_COLORS: Record<
  DonationStatus,
  { bg: string; text: string; border: string }
> = {
  [DonationStatus.RECORDED]: {
    bg: '#eff6ff',
    text: '#1d4ed8',
    border: '#bfdbfe',
  },
  [DonationStatus.PROCESSING]: {
    bg: '#fef3c7',
    text: '#b45309',
    border: '#fde68a',
  },
  [DonationStatus.COMPLETED]: {
    bg: '#dcfce7',
    text: '#15803d',
    border: '#bbf7d0',
  },
  [DonationStatus.CANCELLED]: {
    bg: '#f1f5f9',
    text: '#64748b',
    border: '#e2e8f0',
  },
};

export default function AdminDonationsPage() {
  // Donations list state
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(
    null,
  );

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterBloodGroup, setFilterBloodGroup] = useState<string>('');
  const [filterDonationType, setFilterDonationType] = useState<string>('');

  // Status mutation state
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(
    null,
  );

  // "Record Donation" Modal state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordErrorDetails, setRecordErrorDetails] = useState<any | null>(null);

  // Donor search inside modal
  const [modalDonorSearch, setModalDonorSearch] = useState('');
  const [searchedDonors, setSearchedDonors] = useState<Donor[]>([]);
  const [searchDonorsLoading, setSearchDonorsLoading] = useState(false);
  const [selectedDonorForDonation, setSelectedDonorForDonation] =
    useState<Donor | null>(null);

  // Active Donors Section state (Task ID 62481)
  const [activeDonors, setActiveDonors] = useState<Donor[]>([]);
  const [activeDonorsLoading, setActiveDonorsLoading] = useState(true);
  const [activeDonorsError, setActiveDonorsError] = useState<string | null>(null);
  const [donorSearchTerm, setDonorSearchTerm] = useState('');
  const [donorPage, setDonorPage] = useState(1);
  const [donorPageSize] = useState(5);
  // Map of donorId -> lastCompletedDonationDate string | null
  const [donorLastDonationMap, setDonorLastDonationMap] = useState<
    Record<string, string | null>
  >({});

  // Record donation form inputs
  const [donationDate, setDonationDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [donationType, setDonationType] = useState<DonationType>(
    DonationType.WHOLE_BLOOD,
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState('');

  // Downstream Blood Unit state
  const [associatedBloodUnit, setAssociatedBloodUnit] =
    useState<BloodUnit | null>(null);
  const [bloodUnitLoading, setBloodUnitLoading] = useState(false);
  const [showCreateUnitModal, setShowCreateUnitModal] = useState(false);
  const [createUnitComponent, setCreateUnitComponent] =
    useState<BloodUnitComponent>(BloodUnitComponent.WHOLE_BLOOD);
  const [createUnitVolume, setCreateUnitVolume] = useState<number>(450);
  const [createUnitStorageLocation, setCreateUnitStorageLocation] =
    useState<string>('');
  const [createUnitNotes, setCreateUnitNotes] = useState<string>('');
  const [createUnitExpiry, setCreateUnitExpiry] = useState<string>('');
  const [createUnitSubmitting, setCreateUnitSubmitting] = useState(false);
  const [createUnitError, setCreateUnitError] = useState<string | null>(null);
  const [createUnitSuccess, setCreateUnitSuccess] = useState<string | null>(
    null,
  );

  // Load associated Blood Unit for a completed donation
  const loadBloodUnitForDonation = useCallback(async (donationId: string) => {
    setBloodUnitLoading(true);
    setCreateUnitError(null);
    try {
      const unit = await fetchBloodUnitByDonationId(donationId);
      setAssociatedBloodUnit(unit);
    } catch {
      setAssociatedBloodUnit(null);
    } finally {
      setBloodUnitLoading(false);
    }
  }, []);

  useEffect(() => {
    if (
      selectedDonation &&
      selectedDonation.status === DonationStatus.COMPLETED
    ) {
      loadBloodUnitForDonation(selectedDonation._id);
    } else {
      setAssociatedBloodUnit(null);
    }
  }, [selectedDonation, loadBloodUnitForDonation]);

  const handleCreateBloodUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonation) return;

    setCreateUnitSubmitting(true);
    setCreateUnitError(null);
    setCreateUnitSuccess(null);

    try {
      const createdUnit = await createBloodUnit({
        donationId: selectedDonation._id,
        componentType: createUnitComponent,
        volume: Number(createUnitVolume) || 450,
        storageLocation: createUnitStorageLocation.trim() || undefined,
        expiryDate: createUnitExpiry
          ? new Date(createUnitExpiry).toISOString()
          : undefined,
        notes: createUnitNotes.trim() || undefined,
      });

      setAssociatedBloodUnit(createdUnit);
      setCreateUnitSuccess(
        `Blood Unit ${createdUnit.unitCode} created successfully and queued for testing.`,
      );
      setShowCreateUnitModal(false);
    } catch (err: any) {
      setCreateUnitError(err.message || 'Failed to create blood unit');
    } finally {
      setCreateUnitSubmitting(false);
    }
  };

  // Load donations with functional state updates to avoid infinite loops
  const loadDonations = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchDonations({
        search: searchTerm.trim() || undefined,
        status: filterStatus || undefined,
        bloodGroup: filterBloodGroup || undefined,
        donationType: filterDonationType || undefined,
        page,
        limit: 10,
      });

      setDonations(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.total);

      setSelectedDonation((prev) => {
        if (!prev) return null;
        return data.items.find((item) => item._id === prev._id) || null;
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load donations');
    } finally {
      setLoading(false);
    }
  }, [
    searchTerm,
    filterStatus,
    filterBloodGroup,
    filterDonationType,
    page,
  ]);

  useEffect(() => {
    loadDonations();
  }, [loadDonations]);

  // Load Active Donors automatically (Task ID 62481)
  const loadActiveDonors = useCallback(async () => {
    setActiveDonorsLoading(true);
    setActiveDonorsError(null);
    try {
      // Fetch only ACTIVE donors from backend
      const data = await fetchDonors({
        status: DonorStatus.ACTIVE,
      });
      setActiveDonors(data);

      // Concurrently fetch last completed donation for each active donor to evaluate interval
      const donationPromises = data.map(async (donor) => {
        try {
          const res = await fetchDonations({
            donorId: donor._id,
            status: DonationStatus.COMPLETED,
            donationType: DonationType.WHOLE_BLOOD,
            limit: 1,
          });
          const lastDate =
            res.items && res.items.length > 0
              ? res.items[0].donationDate
              : null;
          return { donorId: donor._id, lastDate };
        } catch {
          return { donorId: donor._id, lastDate: null };
        }
      });

      const results = await Promise.all(donationPromises);
      const map: Record<string, string | null> = {};
      for (const r of results) {
        map[r.donorId] = r.lastDate;
      }
      setDonorLastDonationMap(map);
    } catch (err: any) {
      setActiveDonorsError(err.message || 'Failed to load active donors');
    } finally {
      setActiveDonorsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActiveDonors();
  }, [loadActiveDonors]);

  // Preselect active donor and open Record Donation modal
  const handleSelectDonorForDonation = (donor: Donor) => {
    setSelectedDonorForDonation(donor);
    setRecordError(null);
    setRecordErrorDetails(null);
    setNotes('');
    setQuantity(1);
    setDonationDate(new Date().toISOString().slice(0, 16));
    setShowRecordModal(true);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadDonations();
  };

  // Donor search inside modal
  const handleSearchDonors = async () => {
    if (!modalDonorSearch.trim()) return;
    setSearchDonorsLoading(true);
    try {
      const results = await fetchDonors({
        search: modalDonorSearch.trim(),
      });
      setSearchedDonors(results);
    } catch {
      setSearchedDonors([]);
    } finally {
      setSearchDonorsLoading(false);
    }
  };

  // Handle status update
  const handleTransitionStatus = async (targetStatus: DonationStatus) => {
    if (!selectedDonation) return;
    setStatusUpdateLoading(true);
    setStatusUpdateError(null);

    try {
      const updated = await updateDonationStatus(
        selectedDonation._id,
        targetStatus,
      );
      setDonations((prev) =>
        prev.map((d) => (d._id === updated._id ? updated : d)),
      );
      setSelectedDonation(updated);
    } catch (err: any) {
      setStatusUpdateError(
        err.message || 'Failed to update donation status',
      );
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // Handle record donation submit
  const handleRecordDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonorForDonation) {
      setRecordError('Please select a registered donor first.');
      return;
    }

    if (selectedDonorForDonation.status !== DonorStatus.ACTIVE) {
      setRecordError(
        selectedDonorForDonation.status === DonorStatus.PENDING_REVIEW
          ? 'Donor requires review before a donation can be recorded.'
          : 'Donor is inactive.',
      );
      return;
    }

    setRecordLoading(true);
    setRecordError(null);
    setRecordErrorDetails(null);

    try {
      const created = await createDonation({
        donorId: selectedDonorForDonation._id,
        donationDate: new Date(donationDate).toISOString(),
        donationType,
        quantity: Number(quantity) || 1,
        notes: notes.trim() || undefined,
      });

      // Reset modal state
      setShowRecordModal(false);
      setSelectedDonorForDonation(null);
      setModalDonorSearch('');
      setSearchedDonors([]);
      setNotes('');
      setQuantity(1);
      setRecordErrorDetails(null);

      // Refresh donations list and active donors
      await Promise.all([loadDonations(), loadActiveDonors()]);
      setSelectedDonation(created);
    } catch (err: any) {
      setRecordError(err.message || 'Failed to record donation');
      if (err.details) {
        setRecordErrorDetails(err.details);
      }
    } finally {
      setRecordLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '100%',
        margin: '0 auto',
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
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '1rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Donations Management
          </h1>
          <p
            style={{
              margin: '0.25rem 0 0 0',
              color: '#64748b',
              fontSize: '0.9rem',
            }}
          >
            Select an active donor to record a donation, or view donation intake lifecycle history.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              loadDonations();
              loadActiveDonors();
            }}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            ↻ Refresh All
          </button>
          <button
            onClick={() => {
              setSelectedDonorForDonation(null);
              setShowRecordModal(true);
              setRecordError(null);
            }}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1.15rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
            }}
          >
            + Record Physical Donation
          </button>
        </div>
      </div>

      {/* Active Donors Section (Task ID 62481) */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1.25rem',
          marginBottom: '1.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                Active Donors Available for Donation
              </h2>
              <span
                style={{
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '9999px',
                  border: '1px solid #bbf7d0',
                }}
              >
                {activeDonors.length} Active
              </span>
            </div>
            <p
              style={{
                margin: '0.2rem 0 0 0',
                fontSize: '0.85rem',
                color: '#64748b',
              }}
            >
              Approved donors automatically appear here. Click <strong>Record Donation</strong> to start an intake immediately.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              value={donorSearchTerm}
              onChange={(e) => {
                setDonorSearchTerm(e.target.value);
                setDonorPage(1);
              }}
              placeholder="Filter active donors by name, code, blood group..."
              style={{
                padding: '0.45rem 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.85rem',
                width: '280px',
              }}
            />
            <button
              onClick={() => loadActiveDonors()}
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: '#475569',
              }}
              title="Refresh active donors list"
            >
              ↻
            </button>
          </div>
        </div>

        {activeDonorsError && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              color: '#991b1b',
              padding: '0.65rem 0.9rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.85rem',
            }}
          >
            {activeDonorsError}
          </div>
        )}

        {activeDonorsLoading ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.875rem',
            }}
          >
            Loading active donors from database...
          </div>
        ) : (() => {
          const filtered = activeDonors.filter((d) => {
            if (!donorSearchTerm.trim()) return true;
            const term = donorSearchTerm.toLowerCase();
            return (
              d.fullName.toLowerCase().includes(term) ||
              d.donorCode.toLowerCase().includes(term) ||
              d.bloodGroup.toLowerCase().includes(term) ||
              (d.phone && d.phone.toLowerCase().includes(term))
            );
          });

          if (filtered.length === 0) {
            return (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.875rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px dashed #cbd5e1',
                }}
              >
                {activeDonors.length === 0
                  ? 'No approved active donors found in the system. Donors approved from Pending Review will automatically appear here.'
                  : `No active donors match "${donorSearchTerm}".`}
              </div>
            );
          }

          const totalDonorPages = Math.ceil(filtered.length / donorPageSize);
          const paginatedDonors = filtered.slice(
            (donorPage - 1) * donorPageSize,
            donorPage * donorPageSize,
          );

          return (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.85rem',
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
                    <th style={{ padding: '0.65rem 0.9rem' }}>Donor Name</th>
                    <th style={{ padding: '0.65rem 0.9rem' }}>Donor Code</th>
                    <th style={{ padding: '0.65rem 0.9rem' }}>Blood Group</th>
                    <th style={{ padding: '0.65rem 0.9rem' }}>Donor Status</th>
                    <th style={{ padding: '0.65rem 0.9rem' }}>Last Completed Donation</th>
                    <th style={{ padding: '0.65rem 0.9rem' }}>Donation Eligibility</th>
                    <th style={{ padding: '0.65rem 0.9rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDonors.map((donor) => {
                    const lastDate = donorLastDonationMap[donor._id];
                    const eligibility = evaluateDonationInterval(lastDate, donor.gender);

                    return (
                      <tr
                        key={donor._id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <td style={{ padding: '0.65rem 0.9rem', fontWeight: 600, color: '#0f172a' }}>
                          <div>{donor.fullName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>
                            {donor.gender} &bull; {donor.phone || 'No phone'}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.9rem', fontFamily: 'monospace', color: '#334155' }}>
                          {donor.donorCode}
                        </td>
                        <td style={{ padding: '0.65rem 0.9rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                            }}
                          >
                            {donor.bloodGroup}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.9rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                            }}
                          >
                            ACTIVE
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.9rem', color: '#334155' }}>
                          {lastDate ? (
                            <div>
                              <div>{new Date(lastDate).toLocaleDateString()}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {new Date(lastDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#059669', fontWeight: 500 }}>
                              None / First-time
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.9rem' }}>
                          {eligibility.isEligible ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                              }}
                            >
                              ✓ Eligible
                            </span>
                          ) : (
                            <div>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  backgroundColor: '#fffbeb',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                }}
                              >
                                ⏳ Ineligible ({eligibility.remainingDays}d left)
                              </span>
                              {eligibility.nextEligibleDate && (
                                <div style={{ fontSize: '0.7rem', color: '#78350f', marginTop: '0.15rem' }}>
                                  Eligible: {new Date(eligibility.nextEligibleDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.9rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleSelectDonorForDonation(donor)}
                            style={{
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            + Record Donation
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Active Donors Pagination */}
              {totalDonorPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.9rem',
                    borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '0.8rem',
                    color: '#64748b',
                  }}
                >
                  <span>
                    Showing {paginatedDonors.length} of {filtered.length} active donors (Page {donorPage} of {totalDonorPages})
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      disabled={donorPage <= 1}
                      onClick={() => setDonorPage((p) => Math.max(1, p - 1))}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        cursor: donorPage <= 1 ? 'not-allowed' : 'pointer',
                        opacity: donorPage <= 1 ? 0.5 : 1,
                        fontSize: '0.75rem',
                      }}
                    >
                      &larr; Prev
                    </button>
                    <button
                      disabled={donorPage >= totalDonorPages}
                      onClick={() => setDonorPage((p) => Math.min(totalDonorPages, p + 1))}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        cursor: donorPage >= totalDonorPages ? 'not-allowed' : 'pointer',
                        opacity: donorPage >= totalPages ? 0.5 : 1,
                        fontSize: '0.75rem',
                      }}
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
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
            placeholder="Search by Donation Code, Donor Name, Code, Phone..."
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

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Blood group filter */}
          <select
            value={filterBloodGroup}
            onChange={(e) => {
              setFilterBloodGroup(e.target.value);
              setPage(1);
            }}
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

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
            }}
          >
            <option value="">All Statuses</option>
            <option value={DonationStatus.RECORDED}>RECORDED</option>
            <option value={DonationStatus.PROCESSING}>PROCESSING</option>
            <option value={DonationStatus.COMPLETED}>COMPLETED</option>
            <option value={DonationStatus.CANCELLED}>CANCELLED</option>
          </select>

          <button
            onClick={() => {
              setPage(1);
              loadDonations();
            }}
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

      {/* Error Banner */}
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
          gridTemplateColumns: selectedDonation ? '1fr 390px' : '1fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Donations Table */}
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
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              Loading donation events from database...
            </div>
          ) : donations.length === 0 ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: '#334155' }}>
                No blood donation events found.
              </p>
              <p style={{ margin: '0.5rem 0 1rem 0', fontSize: '0.875rem' }}>
                Record an in-person physical donation for any registered donor.
              </p>
              <button
                onClick={() => {
                  setShowRecordModal(true);
                  setRecordError(null);
                }}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                + Record First Donation
              </button>
            </div>
          ) : (
            <>
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
                    <th style={{ padding: '0.75rem 1rem' }}>Donation Code</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Donor</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Group</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Donation Date</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Type & Units</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((item) => {
                    const isSelected = selectedDonation?._id === item._id;
                    const statusStyle =
                      STATUS_COLORS[item.status] || {
                        bg: '#f1f5f9',
                        text: '#64748b',
                        border: '#e2e8f0',
                      };
                    const donorName =
                      item.donorId?.fullName || 'Unknown Donor';
                    const donorCode = item.donorId?.donorCode || '—';
                    const bloodGroup = item.donorId?.bloodGroup || '—';

                    return (
                      <tr
                        key={item._id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isSelected
                            ? '#fef2f2'
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
                          {item.donationCode}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              fontWeight: 500,
                              color: '#0f172a',
                              display: 'block',
                            }}
                          >
                            {donorName}
                          </span>
                          <span
                            style={{ color: '#64748b', fontSize: '0.75rem' }}
                          >
                            {donorCode}
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
                            {bloodGroup}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '0.75rem 1rem',
                            color: '#334155',
                            fontSize: '0.8rem',
                          }}
                        >
                          {new Date(item.donationDate).toLocaleDateString()}
                          <span
                            style={{
                              color: '#94a3b8',
                              display: 'block',
                              fontSize: '0.75rem',
                            }}
                          >
                            {new Date(item.donationDate).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                          <span>{item.donationType}</span>
                          <span
                            style={{
                              color: '#64748b',
                              fontSize: '0.75rem',
                              display: 'block',
                            }}
                          >
                            {item.quantity} unit{item.quantity > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: statusStyle.bg,
                              color: statusStyle.text,
                              border: `1px solid ${statusStyle.border}`,
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '0.75rem 1rem',
                            textAlign: 'right',
                          }}
                        >
                          <button
                            onClick={() => setSelectedDonation(item)}
                            style={{
                              background: isSelected ? '#b91c1c' : '#2563eb',
                              color: '#ffffff',
                              border: 'none',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                            }}
                          >
                            {isSelected ? 'Viewing' : 'View / Process'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '0.875rem',
                  color: '#64748b',
                }}
              >
                <span>
                  Showing page {page} of {totalPages} ({totalItems} total)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      opacity: page <= 1 ? 0.5 : 1,
                      fontSize: '0.8rem',
                    }}
                  >
                    &larr; Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                      opacity: page >= totalPages ? 0.5 : 1,
                      fontSize: '0.8rem',
                    }}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Selected Donation Details Drawer */}
        {selectedDonation && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '1.25rem',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
          >
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
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  color: '#0f172a',
                }}
              >
                Donation Details
              </h2>
              <button
                onClick={() => setSelectedDonation(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {statusUpdateError && (
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
                {statusUpdateError}
              </div>
            )}

            <div
              style={{
                fontSize: '0.875rem',
                lineHeight: 1.6,
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>Donation Code:</span>{' '}
                <strong style={{ color: '#0f172a' }}>
                  {selectedDonation.donationCode}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Status:</span>{' '}
                <span
                  style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor:
                      STATUS_COLORS[selectedDonation.status]?.bg || '#f1f5f9',
                    color:
                      STATUS_COLORS[selectedDonation.status]?.text || '#64748b',
                  }}
                >
                  {selectedDonation.status}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Donation Date:</span>{' '}
                <strong>
                  {new Date(
                    selectedDonation.donationDate,
                  ).toLocaleString()}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Recorded At:</span>{' '}
                <span>
                  {new Date(selectedDonation.createdAt).toLocaleString()}
                </span>
              </div>

              <hr
                style={{
                  border: 'none',
                  borderTop: '1px solid #f1f5f9',
                  margin: '0.75rem 0',
                }}
              />

              <strong
                style={{
                  color: '#0f172a',
                  display: 'block',
                  marginBottom: '0.25rem',
                }}
              >
                Donor Information:
              </strong>
              {selectedDonation.donorId ? (
                <>
                  <div>
                    <strong>Name:</strong> {selectedDonation.donorId.fullName}
                  </div>
                  <div>
                    <strong>Donor ID:</strong>{' '}
                    {selectedDonation.donorId.donorCode}
                  </div>
                  <div>
                    <strong>Blood Group:</strong>{' '}
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>
                      {selectedDonation.donorId.bloodGroup}
                    </span>
                  </div>
                  <div>
                    <strong>Phone:</strong> {selectedDonation.donorId.phone}
                  </div>
                  {selectedDonation.donorId.email && (
                    <div>
                      <strong>Email:</strong> {selectedDonation.donorId.email}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: '#94a3b8' }}>
                  Donor information unavailable
                </div>
              )}

              <hr
                style={{
                  border: 'none',
                  borderTop: '1px solid #f1f5f9',
                  margin: '0.75rem 0',
                }}
              />

              <strong
                style={{
                  color: '#0f172a',
                  display: 'block',
                  marginBottom: '0.25rem',
                }}
              >
                Collection Details:
              </strong>
              <div>
                <strong>Component:</strong> {selectedDonation.donationType}
              </div>
              <div>
                <strong>Quantity:</strong> {selectedDonation.quantity} unit(s)
              </div>
              {selectedDonation.notes && (
                <div style={{ marginTop: '0.25rem' }}>
                  <strong>Notes:</strong>
                  <p
                    style={{
                      margin: '0.25rem 0 0 0',
                      background: '#f8fafc',
                      padding: '0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      color: '#475569',
                    }}
                  >
                    {selectedDonation.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Lifecycle State Advancement Control */}
            <div
              style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: '1rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#475569',
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                Lifecycle Transition:
              </span>

              {ALLOWED_DONATION_STATUS_TRANSITIONS[selectedDonation.status]?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {ALLOWED_DONATION_STATUS_TRANSITIONS[selectedDonation.status].map(
                    (nextStatus) => {
                      const isCancel = nextStatus === DonationStatus.CANCELLED;
                      return (
                        <button
                          key={nextStatus}
                          onClick={() => handleTransitionStatus(nextStatus)}
                          disabled={statusUpdateLoading}
                          style={{
                            width: '100%',
                            backgroundColor: isCancel ? '#ef4444' : '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: statusUpdateLoading
                              ? 'not-allowed'
                              : 'pointer',
                          }}
                        >
                          {statusUpdateLoading
                            ? 'Processing...'
                            : `Advance to ${nextStatus}`}
                        </button>
                      );
                    },
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: '0.75rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    fontSize: '0.825rem',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ textAlign: 'center', marginBottom: selectedDonation.status === DonationStatus.COMPLETED ? '0.75rem' : 0 }}>
                    This donation is in terminal state ({selectedDonation.status}).
                  </div>

                  {selectedDonation.status === DonationStatus.COMPLETED && (
                    <div
                      style={{
                        borderTop: '1px solid #e2e8f0',
                        paddingTop: '0.75rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: '#475569',
                          display: 'block',
                          marginBottom: '0.4rem',
                        }}
                      >
                        Downstream Traceability:
                      </span>

                      {bloodUnitLoading ? (
                        <div style={{ textAlign: 'center', padding: '0.5rem', color: '#64748b', fontSize: '0.8rem' }}>
                          Checking associated Blood Unit...
                        </div>
                      ) : associatedBloodUnit ? (
                        <div
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0.65rem 0.75rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>
                              {associatedBloodUnit.unitCode}
                            </strong>
                            <span
                              style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: '9999px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                backgroundColor:
                                  associatedBloodUnit.status === BloodUnitStatus.APPROVED
                                    ? '#dcfce7'
                                    : associatedBloodUnit.status === BloodUnitStatus.REJECTED
                                      ? '#fee2e2'
                                      : '#fef3c7',
                                color:
                                  associatedBloodUnit.status === BloodUnitStatus.APPROVED
                                    ? '#166534'
                                    : associatedBloodUnit.status === BloodUnitStatus.REJECTED
                                      ? '#991b1b'
                                      : '#92400e',
                                border:
                                  associatedBloodUnit.status === BloodUnitStatus.APPROVED
                                    ? '1px solid #bbf7d0'
                                    : associatedBloodUnit.status === BloodUnitStatus.REJECTED
                                      ? '1px solid #fca5a5'
                                      : '1px solid #fde68a',
                              }}
                            >
                              {associatedBloodUnit.status}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4, marginBottom: '0.5rem' }}>
                            <div>Group: <strong style={{ color: '#dc2626' }}>{associatedBloodUnit.bloodGroup}</strong> &bull; {associatedBloodUnit.componentType}</div>
                            <div>Volume: {associatedBloodUnit.volume || 450} ml &bull; Storage: {associatedBloodUnit.storageLocation || 'Unassigned'}</div>
                          </div>

                          {associatedBloodUnit.status === BloodUnitStatus.APPROVED ? (
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <Link
                                href={`/admin/testing?bloodUnitId=${associatedBloodUnit._id}`}
                                style={{
                                  flex: 1,
                                  textAlign: 'center',
                                  backgroundColor: '#0f172a',
                                  color: '#ffffff',
                                  textDecoration: 'none',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.725rem',
                                  fontWeight: 600,
                                }}
                              >
                                View Testing &rarr;
                              </Link>
                              <Link
                                href={`/admin/inventory?search=${encodeURIComponent(associatedBloodUnit.unitCode)}`}
                                style={{
                                  flex: 1,
                                  textAlign: 'center',
                                  backgroundColor: '#16a34a',
                                  color: '#ffffff',
                                  textDecoration: 'none',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.725rem',
                                  fontWeight: 600,
                                }}
                              >
                                View Inventory &rarr;
                              </Link>
                            </div>
                          ) : (
                            <Link
                              href={`/admin/testing?bloodUnitId=${associatedBloodUnit._id}`}
                              style={{
                                display: 'block',
                                textAlign: 'center',
                                backgroundColor: '#0f172a',
                                color: '#ffffff',
                                textDecoration: 'none',
                                padding: '0.4rem 0.65rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {associatedBloodUnit.status === BloodUnitStatus.TESTING
                                ? 'Open Laboratory Testing →'
                                : 'View Testing Outcome →'}
                            </Link>
                          )}
                        </div>
                      ) : (
                        <div
                          style={{
                            backgroundColor: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: '6px',
                            padding: '0.65rem',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ color: '#92400e', fontSize: '0.775rem', marginBottom: '0.5rem' }}>
                            Blood Unit not yet generated for this completed donation.
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCreateUnitError(null);
                              setCreateUnitSuccess(null);
                              setShowCreateUnitModal(true);
                            }}
                            style={{
                              width: '100%',
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              padding: '0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.775rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            + Create Blood Unit from Donation
                          </button>
                        </div>
                      )}

                      {createUnitSuccess && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.4rem 0.6rem',
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '4px',
                            color: '#166534',
                            fontSize: '0.75rem',
                          }}
                        >
                          {createUnitSuccess}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Record Donation Modal */}
      {showRecordModal && (
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
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '0.75rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    color: '#0f172a',
                  }}
                >
                  Record Blood Donation Event
                </h2>
                <p
                  style={{
                    margin: '0.2rem 0 0 0',
                    fontSize: '0.8rem',
                    color: '#64748b',
                  }}
                >
                  Select registered donor and record physical collection details.
                </p>
              </div>
              <button
                onClick={() => setShowRecordModal(false)}
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

            <form onSubmit={handleRecordDonationSubmit}>
              {/* Step 1: Donor Selection */}
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
                  Step 1: Select Registered Donor *
                </label>

                {selectedDonorForDonation ? (
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#15803d', display: 'block' }}>
                        {selectedDonorForDonation.fullName} ({selectedDonorForDonation.donorCode})
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: '#166534' }}>
                        Blood Group: <strong>{selectedDonorForDonation.bloodGroup}</strong> &bull; Phone: {selectedDonorForDonation.phone}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDonorForDonation(null)}
                      style={{
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        value={modalDonorSearch}
                        onChange={(e) => setModalDonorSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearchDonors();
                          }
                        }}
                        placeholder="Search donor by name, phone, code..."
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.75rem',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSearchDonors}
                        disabled={searchDonorsLoading}
                        style={{
                          backgroundColor: '#0f172a',
                          color: '#fff',
                          border: 'none',
                          padding: '0.45rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        {searchDonorsLoading ? 'Searching...' : 'Search'}
                      </button>
                    </div>

                    {searchedDonors.length > 0 && (
                      <div
                        style={{
                          maxHeight: '140px',
                          overflowY: 'auto',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          background: '#f8fafc',
                        }}
                      >
                        {searchedDonors.map((d) => {
                          const isActive = d.status === DonorStatus.ACTIVE;
                          return (
                            <div
                              key={d._id}
                              onClick={() => {
                                if (!isActive) {
                                  setRecordError(
                                    d.status === DonorStatus.PENDING_REVIEW
                                      ? `Donor ${d.fullName} requires review in Donors Management before a donation can be recorded.`
                                      : `Donor ${d.fullName} is inactive.`,
                                  );
                                  return;
                                }
                                setRecordError(null);
                                setSelectedDonorForDonation(d);
                              }}
                              style={{
                                padding: '0.5rem 0.75rem',
                                borderBottom: '1px solid #f1f5f9',
                                cursor: isActive ? 'pointer' : 'not-allowed',
                                opacity: isActive ? 1 : 0.65,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.8rem',
                              }}
                            >
                              <div>
                                <strong>{d.fullName}</strong> ({d.donorCode})
                                <div style={{ color: '#64748b' }}>
                                  {d.phone} &bull; {d.city || 'No city'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                    backgroundColor:
                                      d.status === DonorStatus.ACTIVE
                                        ? '#dcfce7'
                                        : d.status === DonorStatus.PENDING_REVIEW
                                        ? '#fef3c7'
                                        : '#f1f5f9',
                                    color:
                                      d.status === DonorStatus.ACTIVE
                                        ? '#15803d'
                                        : d.status === DonorStatus.PENDING_REVIEW
                                        ? '#92400e'
                                        : '#64748b',
                                  }}
                                >
                                  {d.status}
                                </span>
                                <span
                                  style={{
                                    color: '#dc2626',
                                    fontWeight: 700,
                                    background: '#fee2e2',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {d.bloodGroup}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                      Not registered yet?{' '}
                      <Link
                        href="/donate-blood"
                        target="_blank"
                        style={{ color: '#dc2626', textDecoration: 'underline' }}
                      >
                        Register new donor in new tab
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Donation Details */}
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
                    Donation Component *
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
                  Clinical Staff Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Completed without complications, 450ml bag collected at main centre"
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

              {/* Modal Actions */}
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
                  onClick={() => setShowRecordModal(false)}
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
                  disabled={recordLoading || !selectedDonorForDonation}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor:
                      recordLoading || !selectedDonorForDonation
                        ? 'not-allowed'
                        : 'pointer',
                    opacity: !selectedDonorForDonation ? 0.6 : 1,
                  }}
                >
                  {recordLoading ? 'Recording...' : 'Confirm & Record Donation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Blood Unit Modal */}
      {showCreateUnitModal && selectedDonation && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '540px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
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
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                  Create Blood Unit
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Generate physical blood unit from completed donation
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateUnitModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                &times;
              </button>
            </div>

            {createUnitError && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                {createUnitError}
              </div>
            )}

            {/* Authoritative Donation Info Box */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.825rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Donation:</span>
                <strong style={{ color: '#0f172a' }}>{selectedDonation.donationCode}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Donor:</span>
                <strong style={{ color: '#0f172a' }}>{selectedDonation.donorId?.fullName}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Blood Group:</span>
                <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                  {selectedDonation.donorId?.bloodGroup}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Collection Date:</span>
                <span style={{ color: '#0f172a' }}>
                  {new Date(selectedDonation.donationDate).toLocaleDateString()}
                </span>
              </div>
            </div>

            <form onSubmit={handleCreateBloodUnitSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.35rem',
                  }}
                >
                  Component Type:
                </label>
                <select
                  value={createUnitComponent}
                  onChange={(e) => setCreateUnitComponent(e.target.value as BloodUnitComponent)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value={BloodUnitComponent.WHOLE_BLOOD}>WHOLE_BLOOD</option>
                  <option value={BloodUnitComponent.PRBC}>PRBC</option>
                  <option value={BloodUnitComponent.FFP}>FFP</option>
                  <option value={BloodUnitComponent.PLATELETS}>PLATELETS</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Volume (ml):
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="1000"
                    value={createUnitVolume}
                    onChange={(e) => setCreateUnitVolume(Number(e.target.value))}
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

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Storage Location:
                  </label>
                  <input
                    type="text"
                    value={createUnitStorageLocation}
                    onChange={(e) => setCreateUnitStorageLocation(e.target.value)}
                    placeholder="e.g. Shelf A-1"
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

              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.35rem',
                  }}
                >
                  Unit Notes (optional):
                </label>
                <input
                  type="text"
                  value={createUnitNotes}
                  onChange={(e) => setCreateUnitNotes(e.target.value)}
                  placeholder="e.g. Standard collection, bag inspected"
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
                  onClick={() => setShowCreateUnitModal(false)}
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
                  disabled={createUnitSubmitting}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: createUnitSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {createUnitSubmitting ? 'Creating Unit...' : 'Create Blood Unit & Queue for Testing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
