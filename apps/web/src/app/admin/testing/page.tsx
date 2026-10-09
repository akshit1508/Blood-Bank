'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  BloodTesting,
  IndividualTestResult,
  TestingStatus,
  TestingDecision,
  TestResultStatus,
  BloodUnitSummary,
  fetchTestingRecords,
  fetchTestingRecordById,
  createTestingRecord,
  updateIndividualTestResult,
  completeTestingRecord,
  fetchUnitsAwaitingTesting,
  getFriendlyErrorMessage,
} from '@/lib/testing-api';
import {
  InventoryItem,
  fetchInventoryByBloodUnitId,
  createInventoryFromBloodUnit,
  getFriendlyInventoryErrorMessage,
} from '@/lib/inventory-api';

const STATUS_BADGES: Record<
  TestingStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  [TestingStatus.IN_PROGRESS]: {
    bg: '#fef3c7',
    text: '#92400e',
    border: '#fde68a',
    label: 'IN PROGRESS',
  },
  [TestingStatus.COMPLETED]: {
    bg: '#f1f5f9',
    text: '#334155',
    border: '#cbd5e1',
    label: 'COMPLETED',
  },
};

const DECISION_BADGES: Record<
  TestingDecision,
  { bg: string; text: string; border: string; label: string }
> = {
  [TestingDecision.PENDING]: {
    bg: '#eff6ff',
    text: '#1e40af',
    border: '#bfdbfe',
    label: 'PENDING',
  },
  [TestingDecision.APPROVED]: {
    bg: '#dcfce7',
    text: '#166534',
    border: '#bbf7d0',
    label: 'APPROVED ✓',
  },
  [TestingDecision.REJECTED]: {
    bg: '#fee2e2',
    text: '#991b1b',
    border: '#fca5a5',
    label: 'REJECTED ✕',
  },
};

const RESULT_STATUS_BADGES: Record<
  TestResultStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  [TestResultStatus.PENDING]: {
    bg: '#f8fafc',
    text: '#64748b',
    border: '#e2e8f0',
    label: 'PENDING',
  },
  [TestResultStatus.PASS]: {
    bg: '#dcfce7',
    text: '#166534',
    border: '#bbf7d0',
    label: 'PASS ✓',
  },
  [TestResultStatus.FAIL]: {
    bg: '#fee2e2',
    text: '#991b1b',
    border: '#fca5a5',
    label: 'FAIL ✕',
  },
};

export default function AdminTestingPage() {
  // Testing records state
  const [records, setRecords] = useState<BloodTesting[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTesting, setSelectedTesting] = useState<BloodTesting | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDecision, setFilterDecision] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Start Testing Modal state
  const [showStartModal, setShowStartModal] = useState(false);
  const [candidateUnits, setCandidateUnits] = useState<BloodUnitSummary[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [startPerformedBy, setStartPerformedBy] = useState('');
  const [startRemarks, setStartRemarks] = useState('');
  const [startSubmitting, setStartSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Individual test edits state (indexed by testCode)
  const [testFormValues, setTestFormValues] = useState<
    Record<
      string,
      {
        status: TestResultStatus;
        result: string;
        testedAt: string;
        remarks: string;
      }
    >
  >({});
  const [testSavingCode, setTestSavingCode] = useState<string | null>(null);
  const [testSaveFeedback, setTestSaveFeedback] = useState<{
    code: string;
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Complete Testing Confirmation Modal
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] =
    useState(false);
  const [completeSignoffName, setCompleteSignoffName] = useState('');
  const [completeRemarks, setCompleteRemarks] = useState('');
  const [completeRejectionReason, setCompleteRejectionReason] = useState('');
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Operational Inventory state for selected unit
  const [inventoryRecord, setInventoryRecord] = useState<InventoryItem | null>(null);
  const [inventoryChecking, setInventoryChecking] = useState(false);
  const [inventoryAdding, setInventoryAdding] = useState(false);
  const [inventoryActionFeedback, setInventoryActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Check inventory status when selectedTesting changes
  useEffect(() => {
    const unitId = selectedTesting?.bloodUnitId?._id;
    if (
      unitId &&
      selectedTesting?.decision === TestingDecision.APPROVED &&
      selectedTesting?.bloodUnitId?.status === 'APPROVED'
    ) {
      setInventoryChecking(true);
      setInventoryActionFeedback(null);
      fetchInventoryByBloodUnitId(unitId)
        .then((inv) => setInventoryRecord(inv))
        .catch(() => setInventoryRecord(null))
        .finally(() => setInventoryChecking(false));
    } else {
      setInventoryRecord(null);
      setInventoryChecking(false);
      setInventoryActionFeedback(null);
    }
  }, [selectedTesting]);

  const handleAddToInventory = async () => {
    const unitId = selectedTesting?.bloodUnitId?._id;
    if (!unitId) return;

    setInventoryAdding(true);
    setInventoryActionFeedback(null);
    try {
      const created = await createInventoryFromBloodUnit(unitId);
      setInventoryRecord(created);
      setInventoryActionFeedback({
        type: 'success',
        message: `Blood Unit ${selectedTesting.bloodUnitId?.unitCode} successfully added to available inventory.`,
      });
    } catch (err: any) {
      setInventoryActionFeedback({
        type: 'error',
        message: getFriendlyInventoryErrorMessage(err),
      });
    } finally {
      setInventoryAdding(false);
    }
  };

  // Load testing queue
  const loadTestingQueue = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchTestingRecords({
        status: filterStatus || undefined,
        decision: filterDecision || undefined,
        page,
        limit: 10,
      });
      setRecords(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.total);

      // Keep selectedTesting in sync if open
      setSelectedTesting((prev) => {
        if (!prev) return null;
        const found = data.items.find((item) => item._id === prev._id);
        return found || prev;
      });
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDecision, page]);

  useEffect(() => {
    loadTestingQueue();
  }, [loadTestingQueue]);

  // Sync individual test form inputs when selectedTesting changes
  useEffect(() => {
    if (selectedTesting) {
      const initialMap: Record<
        string,
        {
          status: TestResultStatus;
          result: string;
          testedAt: string;
          remarks: string;
        }
      > = {};

      selectedTesting.testResults.forEach((t) => {
        let testedAtStr = '';
        if (t.testedAt) {
          try {
            testedAtStr = new Date(t.testedAt).toISOString().slice(0, 16);
          } catch {
            testedAtStr = '';
          }
        } else {
          testedAtStr = new Date().toISOString().slice(0, 16);
        }

        initialMap[t.testCode] = {
          status: t.status,
          result: t.result || '',
          testedAt: testedAtStr,
          remarks: t.remarks || '',
        };
      });

      setTestFormValues(initialMap);
      setTestSaveFeedback(null);
      setCompleteSignoffName(selectedTesting.performedBy || '');
      setCompleteRemarks(selectedTesting.remarks || '');
      setCompleteRejectionReason(selectedTesting.rejectionReason || '');
    }
  }, [selectedTesting]);

  // Fetch full testing record details
  const handleSelectRecord = useCallback(async (record: BloodTesting) => {
    setDetailLoading(true);
    setTestSaveFeedback(null);
    try {
      const full = await fetchTestingRecordById(record._id);
      setSelectedTesting(full);
    } catch {
      setSelectedTesting(record);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Open "Start Testing" candidate modal
  const handleOpenStartModal = useCallback(
    async (preselectedUnitId?: string) => {
      setShowStartModal(true);
      setCandidateLoading(true);
      setStartError(null);
      setSelectedUnitId(preselectedUnitId || '');
      setStartPerformedBy('');
      setStartRemarks('');

      try {
        const res = await fetchUnitsAwaitingTesting(50);
        setCandidateUnits(res.items);
        if (
          preselectedUnitId &&
          res.items.some((u) => u._id === preselectedUnitId)
        ) {
          setSelectedUnitId(preselectedUnitId);
        } else if (res.items.length > 0) {
          setSelectedUnitId(res.items[0]._id);
        }
      } catch (err: any) {
        setStartError(getFriendlyErrorMessage(err));
      } finally {
        setCandidateLoading(false);
      }
    },
    [],
  );

  // Read and handle URL search parameters (bloodUnitId, donationId, testingCode)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const bloodUnitIdParam = params.get('bloodUnitId');
    const donationIdParam = params.get('donationId');
    const testingCodeParam = params.get('testingCode');

    if (!bloodUnitIdParam && !donationIdParam && !testingCodeParam) return;

    let isMounted = true;
    const resolveParams = async () => {
      try {
        const queueRes = await fetchTestingRecords({ limit: 100 });
        if (!isMounted) return;

        let matched = null;
        if (bloodUnitIdParam) {
          matched = queueRes.items.find(
            (r) =>
              (typeof r.bloodUnitId === 'object' &&
                r.bloodUnitId?._id === bloodUnitIdParam) ||
              (r.bloodUnitId as any) === bloodUnitIdParam,
          );
        }
        if (!matched && donationIdParam) {
          matched = queueRes.items.find(
            (r) =>
              (typeof r.donationId === 'object' &&
                (r.donationId?._id === donationIdParam ||
                  r.donationId?.donationCode === donationIdParam)) ||
              (r.donationId as any) === donationIdParam,
          );
        }
        if (!matched && testingCodeParam) {
          matched = queueRes.items.find(
            (r) => r.testingCode === testingCodeParam,
          );
        }

        if (matched) {
          handleSelectRecord(matched);
        } else if (bloodUnitIdParam) {
          // If blood unit exists in TESTING but no BloodTesting record exists yet, open Start Testing modal with it
          handleOpenStartModal(bloodUnitIdParam);
        }
      } catch {
        // Silently tolerate search param lookup error
      }
    };

    resolveParams();
    return () => {
      isMounted = false;
    };
  }, [handleSelectRecord, handleOpenStartModal]);

  // Submit "Start Testing"
  const handleStartTestingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId) {
      setStartError('Please select a Blood Unit to initiate laboratory testing.');
      return;
    }

    setStartSubmitting(true);
    setStartError(null);

    try {
      const created = await createTestingRecord({
        bloodUnitId: selectedUnitId,
        performedBy: startPerformedBy.trim() || undefined,
        remarks: startRemarks.trim() || undefined,
      });

      setShowStartModal(false);
      await loadTestingQueue();
      setSelectedTesting(created);
    } catch (err: any) {
      setStartError(getFriendlyErrorMessage(err));
    } finally {
      setStartSubmitting(false);
    }
  };

  // Save individual test result
  const handleSaveIndividualTest = async (testCode: string) => {
    if (!selectedTesting) return;
    const formVal = testFormValues[testCode];
    if (!formVal) return;

    // Check future date
    if (formVal.testedAt) {
      const parsed = new Date(formVal.testedAt);
      if (parsed.getTime() > Date.now() + 120 * 1000) {
        setTestSaveFeedback({
          code: testCode,
          type: 'error',
          message: 'Test execution date cannot be in the future.',
        });
        return;
      }
    }

    setTestSavingCode(testCode);
    setTestSaveFeedback(null);

    try {
      const updated = await updateIndividualTestResult(
        selectedTesting._id,
        testCode,
        {
          status: formVal.status,
          result: formVal.result.trim() || undefined,
          testedAt: formVal.testedAt
            ? new Date(formVal.testedAt).toISOString()
            : undefined,
          remarks: formVal.remarks.trim() || undefined,
        },
      );

      setSelectedTesting(updated);
      setTestSaveFeedback({
        code: testCode,
        type: 'success',
        message: `Outcome for ${testCode} saved successfully.`,
      });

      // Update in queue list
      setRecords((prev) =>
        prev.map((r) => (r._id === updated._id ? updated : r)),
      );
    } catch (err: any) {
      setTestSaveFeedback({
        code: testCode,
        type: 'error',
        message: getFriendlyErrorMessage(err),
      });
    } finally {
      setTestSavingCode(null);
    }
  };

  // Check if testing can be completed
  const pendingTestsList = useMemo(() => {
    if (!selectedTesting) return [];
    return selectedTesting.testResults.filter(
      (t) => t.status === TestResultStatus.PENDING,
    );
  }, [selectedTesting]);

  const hasFailedTests = useMemo(() => {
    if (!selectedTesting) return false;
    return selectedTesting.testResults.some(
      (t) => t.status === TestResultStatus.FAIL,
    );
  }, [selectedTesting]);

  // Submit complete testing
  const handleCompleteTestingSubmit = async () => {
    if (!selectedTesting) return;

    if (pendingTestsList.length > 0) {
      setCompleteError(
        `All required tests must be completed before finalizing testing. (${pendingTestsList.map((t) => t.testCode).join(', ')} still PENDING).`,
      );
      return;
    }

    setCompleteSubmitting(true);
    setCompleteError(null);

    try {
      const finalized = await completeTestingRecord(selectedTesting._id, {
        performedBy: completeSignoffName.trim() || undefined,
        remarks: completeRemarks.trim() || undefined,
        rejectionReason: hasFailedTests
          ? completeRejectionReason.trim() || undefined
          : undefined,
      });

      setSelectedTesting(finalized);
      setShowCompleteConfirmModal(false);
      await loadTestingQueue();
    } catch (err: any) {
      setCompleteError(getFriendlyErrorMessage(err));
    } finally {
      setCompleteSubmitting(false);
    }
  };

  // Client search filter
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase().trim();
    return records.filter((r) => {
      const tCode = (r.testingCode || '').toLowerCase();
      const uCode = (r.bloodUnitId?.unitCode || '').toLowerCase();
      const bg = (r.bloodUnitId?.bloodGroup || '').toLowerCase();
      const dCode = (r.donorId?.donorCode || '').toLowerCase();
      const dName = (r.donorId?.fullName || '').toLowerCase();
      return (
        tCode.includes(term) ||
        uCode.includes(term) ||
        bg.includes(term) ||
        dCode.includes(term) ||
        dName.includes(term)
      );
    });
  }, [records, searchTerm]);

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
            Laboratory Blood Testing
          </h1>
          <p
            style={{
              margin: '0.25rem 0 0 0',
              color: '#64748b',
              fontSize: '0.9rem',
            }}
          >
            Pre-transfusion infectious disease screening, test outcome recording &amp; safety clearance gate. Internal laboratory portal.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => loadTestingQueue()}
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
            ↻ Refresh Queue
          </button>
          <button
            onClick={() => handleOpenStartModal()}
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
            + Start Testing
          </button>
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
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Testing Code, Unit Code, Donor Code, Name..."
            style={{
              flex: 1,
              padding: '0.45rem 0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 500 }}>
              Status:
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Statuses</option>
              <option value={TestingStatus.IN_PROGRESS}>IN_PROGRESS</option>
              <option value={TestingStatus.COMPLETED}>COMPLETED</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 500 }}>
              Decision:
            </label>
            <select
              value={filterDecision}
              onChange={(e) => {
                setFilterDecision(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.45rem 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Decisions</option>
              <option value={TestingDecision.PENDING}>PENDING</option>
              <option value={TestingDecision.APPROVED}>APPROVED</option>
              <option value={TestingDecision.REJECTED}>REJECTED</option>
            </select>
          </div>

          <button
            onClick={() => loadTestingQueue()}
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            ↻ Refresh Queue
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMessage}</span>
          <button
            onClick={() => loadTestingQueue()}
            style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              padding: '0.25rem 0.65rem',
              borderRadius: '4px',
              color: '#991b1b',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Split Layout: Table (left) & Detail Panel (right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedTesting ? '1fr 520px' : '1fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
        className="admin-split-grid"
      >
        {/* Table Container */}
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
              Loading laboratory testing records from database...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: '#334155',
                }}
              >
                No laboratory testing records found.
              </p>
              <p style={{ margin: '0.5rem 0 1.25rem 0', fontSize: '0.875rem' }}>
                Initiate pre-transfusion safety testing on a Blood Unit in TESTING status.
              </p>
              <button
                onClick={() => handleOpenStartModal()}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 1.15rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                + Start Testing on a Blood Unit
              </button>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }} className="admin-table-scroll">
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
                      <th style={{ padding: '0.75rem 1rem' }}>Testing Code</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Blood Unit</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Donation</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Donor</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Decision</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Started</th>
                      <th
                        style={{
                          padding: '0.75rem 1rem',
                          textAlign: 'right',
                        }}
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((item) => {
                      const isSelected = selectedTesting?._id === item._id;
                      const statusBadge =
                        STATUS_BADGES[item.status] || STATUS_BADGES.IN_PROGRESS;
                      const decisionBadge =
                        DECISION_BADGES[item.decision] ||
                        DECISION_BADGES.PENDING;

                      return (
                        <tr
                          key={item._id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isSelected ? '#f8fafc' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {item.testingCode}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                              {item.testResults?.length || 0} screening tests
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {item.bloodUnitId?.unitCode || 'Unit N/A'}
                            </div>
                            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.15rem' }}>
                              <span
                                style={{
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                }}
                              >
                                {item.bloodUnitId?.bloodGroup || 'N/A'}
                              </span>
                              <span
                                style={{
                                  color: '#64748b',
                                  fontSize: '0.75rem',
                                  alignSelf: 'center',
                                }}
                              >
                                {item.bloodUnitId?.componentType || 'WHOLE_BLOOD'}
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {item.donationId?.donationCode ||
                                (typeof item.bloodUnitId?.donationId === 'object'
                                  ? (item.bloodUnitId.donationId as any).donationCode
                                  : '—')}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                              {item.donationId?.donationDate
                                ? new Date(item.donationId.donationDate).toLocaleDateString()
                                : item.bloodUnitId?.collectionDate
                                ? new Date(item.bloodUnitId.collectionDate).toLocaleDateString()
                                : ''}
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ color: '#0f172a', fontWeight: 500 }}>
                              {item.donorId?.fullName || 'Donor N/A'}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                              {item.donorId?.donorCode || ''}
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: statusBadge.bg,
                                color: statusBadge.text,
                                border: `1px solid ${statusBadge.border}`,
                              }}
                            >
                              {statusBadge.label}
                            </span>
                          </td>

                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor: decisionBadge.bg,
                                color: decisionBadge.text,
                                border: `1px solid ${decisionBadge.border}`,
                              }}
                            >
                              {decisionBadge.label}
                            </span>
                          </td>

                          <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                            {item.startedAt
                              ? new Date(item.startedAt).toLocaleDateString()
                              : 'N/A'}
                          </td>

                          <td
                            style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'right',
                            }}
                          >
                            <button
                              onClick={() => handleSelectRecord(item)}
                              style={{
                                backgroundColor: isSelected
                                  ? '#0f172a'
                                  : '#ffffff',
                                border: '1px solid #cbd5e1',
                                color: isSelected ? '#ffffff' : '#334155',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '4px',
                                fontSize: '0.775rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {isSelected ? 'Inspecting' : 'View Testing'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer / Pagination */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '0.825rem',
                  color: '#64748b',
                }}
              >
                <span>
                  Showing {filteredRecords.length} of {totalItems} record(s)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '0.3rem 0.65rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      background: page <= 1 ? '#f1f5f9' : '#ffffff',
                      color: page <= 1 ? '#94a3b8' : '#334155',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    &larr; Prev
                  </button>
                  <span>
                    Page {page} of {totalPages || 1}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    style={{
                      padding: '0.3rem 0.65rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      background: page >= totalPages ? '#f1f5f9' : '#ffffff',
                      color: page >= totalPages ? '#94a3b8' : '#334155',
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Detail Panel */}
        {selectedTesting && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '1.25rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            {/* Detail Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  Testing Record
                </div>
                <h2
                  style={{
                    margin: '0.2rem 0',
                    fontSize: '1.25rem',
                    color: '#0f172a',
                  }}
                >
                  {selectedTesting.testingCode}
                </h2>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      backgroundColor:
                        STATUS_BADGES[selectedTesting.status]?.bg || '#f1f5f9',
                      color:
                        STATUS_BADGES[selectedTesting.status]?.text || '#334155',
                      border: `1px solid ${STATUS_BADGES[selectedTesting.status]?.border || '#cbd5e1'}`,
                    }}
                  >
                    {selectedTesting.status}
                  </span>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      backgroundColor:
                        DECISION_BADGES[selectedTesting.decision]?.bg || '#eff6ff',
                      color:
                        DECISION_BADGES[selectedTesting.decision]?.text || '#1e40af',
                      border: `1px solid ${DECISION_BADGES[selectedTesting.decision]?.border || '#bfdbfe'}`,
                    }}
                  >
                    DECISION: {selectedTesting.decision}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedTesting(null)}
                aria-label="Close detail panel"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {detailLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                Refreshing record details...
              </div>
            ) : (
              <>
                {/* Status Notice Banner */}
                {selectedTesting.status === TestingStatus.COMPLETED ? (
                  <div
                    style={{
                      marginBottom: '1rem',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.825rem',
                      lineHeight: 1.4,
                      backgroundColor:
                        selectedTesting.decision === TestingDecision.APPROVED
                          ? '#f0fdf4'
                          : '#fef2f2',
                      border:
                        selectedTesting.decision === TestingDecision.APPROVED
                          ? '1px solid #bbf7d0'
                          : '1px solid #fecaca',
                      color:
                        selectedTesting.decision === TestingDecision.APPROVED
                          ? '#166534'
                          : '#991b1b',
                    }}
                  >
                    {selectedTesting.decision === TestingDecision.APPROVED ? (
                      <div>
                        <strong>✓ Laboratory Testing Cleared this Blood Unit.</strong>
                        <div>
                          All configured screening tests passed. Blood Unit status updated to APPROVED.
                        </div>
                      </div>
                    ) : (
                      <div>
                        <strong>✕ Laboratory Testing REJECTED this Blood Unit.</strong>
                        <div>
                          Blood Unit status updated to REJECTED. Biological safety quarantine in effect.
                        </div>
                        {selectedTesting.rejectionReason && (
                          <div style={{ marginTop: '0.25rem', fontStyle: 'italic' }}>
                            Reason: {selectedTesting.rejectionReason}
                          </div>
                        )}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>🔒</span>
                      <span>Finalized / Read-Only &bull; Record is permanently locked against edits.</span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      marginBottom: '1rem',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#92400e',
                    }}
                  >
                    Screening in progress. Enter outcomes for all configured tests before completing testing.
                  </div>
                )}

                {/* Traceability Metadata Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {/* Card A: Blood Unit */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                        🩸 Physical Blood Unit
                      </strong>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.45rem',
                          borderRadius: '9999px',
                          backgroundColor:
                            selectedTesting.bloodUnitId?.status === 'APPROVED'
                              ? '#dcfce7'
                              : selectedTesting.bloodUnitId?.status === 'REJECTED'
                              ? '#fee2e2'
                              : '#fef3c7',
                          color:
                            selectedTesting.bloodUnitId?.status === 'APPROVED'
                              ? '#166534'
                              : selectedTesting.bloodUnitId?.status === 'REJECTED'
                              ? '#991b1b'
                              : '#92400e',
                        }}
                      >
                        {selectedTesting.bloodUnitId?.status || 'TESTING'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Unit Code:</span>
                        <strong style={{ color: '#0f172a' }}>{selectedTesting.bloodUnitId?.unitCode}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Blood Group:</span>
                        <span
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '3px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          {selectedTesting.bloodUnitId?.bloodGroup}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Component / Volume:</span>
                        <span style={{ color: '#334155' }}>
                          {selectedTesting.bloodUnitId?.componentType || 'WHOLE_BLOOD'} &bull; {selectedTesting.bloodUnitId?.volume || 450} mL
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Storage Location:</span>
                        <span style={{ color: '#334155' }}>
                          {selectedTesting.bloodUnitId?.storageLocation || 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Collected Date:</span>
                        <span style={{ color: '#334155' }}>
                          {selectedTesting.bloodUnitId?.collectionDate
                            ? new Date(selectedTesting.bloodUnitId.collectionDate).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card: Operational Inventory */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                        📦 Operational Inventory
                      </strong>
                      {inventoryRecord ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.45rem',
                            borderRadius: '9999px',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                          }}
                        >
                          AVAILABLE
                        </span>
                      ) : selectedTesting.decision === TestingDecision.APPROVED &&
                        selectedTesting.bloodUnitId?.status === 'APPROVED' ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.45rem',
                            borderRadius: '9999px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                          }}
                        >
                          ELIGIBLE &bull; NOT IN INVENTORY
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.1rem 0.45rem',
                            borderRadius: '9999px',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                          }}
                        >
                          NOT ELIGIBLE
                        </span>
                      )}
                    </div>

                    {inventoryChecking ? (
                      <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Checking inventory record...</div>
                    ) : inventoryRecord ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ color: '#166534', fontWeight: 600, display: 'block' }}>
                            ✓ Active in Available Inventory
                          </span>
                          <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                            Added: {new Date(inventoryRecord.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <Link
                          href={`/admin/inventory?search=${encodeURIComponent(selectedTesting.bloodUnitId?.unitCode || '')}`}
                          style={{
                            fontSize: '0.75rem',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          View Inventory &rarr;
                        </Link>
                      </div>
                    ) : selectedTesting.decision === TestingDecision.APPROVED &&
                      selectedTesting.bloodUnitId?.status === 'APPROVED' ? (
                      <div>
                        <p style={{ margin: '0 0 0.5rem 0', color: '#475569', fontSize: '0.75rem', lineHeight: 1.4 }}>
                          This unit has completed laboratory safety screening and is approved. Add it to available inventory to permit future operational release.
                        </p>
                        {inventoryActionFeedback && (
                          <div
                            style={{
                              marginBottom: '0.5rem',
                              padding: '0.4rem 0.6rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              backgroundColor:
                                inventoryActionFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                              color:
                                inventoryActionFeedback.type === 'success' ? '#166534' : '#991b1b',
                              border:
                                inventoryActionFeedback.type === 'success'
                                  ? '1px solid #bbf7d0'
                                  : '1px solid #fecaca',
                            }}
                          >
                            {inventoryActionFeedback.message}
                          </div>
                        )}
                        <button
                          onClick={handleAddToInventory}
                          disabled={inventoryAdding}
                          style={{
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.4rem 0.85rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            cursor: inventoryAdding ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {inventoryAdding ? 'Adding to Inventory...' : '+ Add to Inventory'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                        Unit is not approved for inventory. Only units with confirmed laboratory approval may enter inventory.
                      </div>
                    )}
                  </div>

                  {/* Card B: Source Donation */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                        📋 Source Donation
                      </strong>
                      {selectedTesting.donationId?.donationCode && (
                        <Link
                          href={`/admin/donations?search=${encodeURIComponent(selectedTesting.donationId.donationCode)}`}
                          style={{
                            fontSize: '0.72rem',
                            color: '#2563eb',
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          View in Donations &rarr;
                        </Link>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Donation Code:</span>
                        <strong style={{ color: '#0f172a' }}>
                          {selectedTesting.donationId?.donationCode ||
                            (typeof selectedTesting.bloodUnitId?.donationId === 'object'
                              ? (selectedTesting.bloodUnitId.donationId as any).donationCode
                              : 'N/A')}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Donation Date:</span>
                        <span style={{ color: '#334155' }}>
                          {selectedTesting.donationId?.donationDate
                            ? new Date(selectedTesting.donationId.donationDate).toLocaleString()
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Type & Quantity:</span>
                        <span style={{ color: '#334155' }}>
                          {selectedTesting.donationId?.donationType || 'WHOLE_BLOOD'} ({selectedTesting.donationId?.quantity || 1} unit)
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Donation Status:</span>
                        <span style={{ color: '#15803d', fontWeight: 600 }}>
                          {selectedTesting.donationId?.status || 'COMPLETED'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card C: Registered Donor */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                        👤 Registered Donor
                      </strong>
                      {selectedTesting.donorId?.donorCode && (
                        <Link
                          href={`/admin/donors?search=${encodeURIComponent(selectedTesting.donorId.donorCode)}`}
                          style={{
                            fontSize: '0.72rem',
                            color: '#2563eb',
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          View Donor Profile &rarr;
                        </Link>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Full Name:</span>
                        <strong style={{ color: '#0f172a' }}>{selectedTesting.donorId?.fullName || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Donor Code:</span>
                        <span style={{ color: '#334155', fontWeight: 500 }}>{selectedTesting.donorId?.donorCode || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Gender & Phone:</span>
                        <span style={{ color: '#334155' }}>
                          {selectedTesting.donorId?.gender || '—'} &bull; {selectedTesting.donorId?.phone || '—'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Donor Status:</span>
                        <span style={{ color: '#334155', fontWeight: 600 }}>
                          {selectedTesting.donorId?.status || 'ACTIVE'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card D: Testing Session Info */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.8rem',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Started At:</span>
                      <span style={{ color: '#0f172a' }}>
                        {selectedTesting.startedAt
                          ? new Date(selectedTesting.startedAt).toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Completed At:</span>
                      <span style={{ color: '#0f172a' }}>
                        {selectedTesting.completedAt
                          ? new Date(selectedTesting.completedAt).toLocaleString()
                          : 'In progress'}
                      </span>
                    </div>
                    {selectedTesting.performedBy && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Technician / Pathologist:</span>
                        <span style={{ color: '#0f172a', fontWeight: 500 }}>
                          {selectedTesting.performedBy}
                        </span>
                      </div>
                    )}
                    {selectedTesting.remarks && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Session Remarks:</span>
                        <span style={{ color: '#0f172a' }}>
                          {selectedTesting.remarks}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Individual Test Results List */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.65rem',
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: '#0f172a',
                      }}
                    >
                      Screening Test Results ({selectedTesting.testResults?.length || 0})
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Authorized laboratory outcomes
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selectedTesting.testResults.map((test) => {
                      const currentForm = testFormValues[test.testCode] || {
                        status: test.status,
                        result: test.result || '',
                        testedAt: '',
                        remarks: test.remarks || '',
                      };
                      const isCompletedRecord =
                        selectedTesting.status === TestingStatus.COMPLETED;
                      const isSavingThis = testSavingCode === test.testCode;
                      const feedback =
                        testSaveFeedback?.code === test.testCode
                          ? testSaveFeedback
                          : null;

                      return (
                        <div
                          key={test.testCode}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '0.75rem',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          {/* Test Title & Status Badge */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <div>
                              <strong
                                style={{
                                  fontSize: '0.85rem',
                                  color: '#0f172a',
                                  marginRight: '0.4rem',
                                }}
                              >
                                {test.testName}
                              </strong>
                              <span
                                style={{
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '3px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                }}
                              >
                                {test.testCode}
                              </span>
                            </div>

                            <span
                              style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor:
                                  RESULT_STATUS_BADGES[test.status]?.bg ||
                                  '#f8fafc',
                                color:
                                  RESULT_STATUS_BADGES[test.status]?.text ||
                                  '#64748b',
                                border: `1px solid ${RESULT_STATUS_BADGES[test.status]?.border || '#e2e8f0'}`,
                              }}
                            >
                              {RESULT_STATUS_BADGES[test.status]?.label ||
                                test.status}
                            </span>
                          </div>

                          {/* Editable / Read-only Fields */}
                          {isCompletedRecord ? (
                            <div
                              style={{
                                fontSize: '0.8rem',
                                color: '#475569',
                                backgroundColor: '#f8fafc',
                                padding: '0.5rem',
                                borderRadius: '4px',
                              }}
                            >
                              <div>
                                <strong>Outcome:</strong>{' '}
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color:
                                      test.status === TestResultStatus.PASS
                                        ? '#166534'
                                        : test.status === TestResultStatus.FAIL
                                          ? '#991b1b'
                                          : '#64748b',
                                  }}
                                >
                                  {test.status}
                                </span>{' '}
                                {test.result && `(${test.result})`}
                              </div>
                              {test.testedAt && (
                                <div style={{ marginTop: '0.2rem' }}>
                                  Tested At:{' '}
                                  {new Date(test.testedAt).toLocaleString()}
                                </div>
                              )}
                              {test.remarks && (
                                <div style={{ marginTop: '0.2rem' }}>
                                  Remarks: {test.remarks}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {/* Status Buttons */}
                              <div>
                                <label
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: '#475569',
                                    display: 'block',
                                    marginBottom: '0.25rem',
                                  }}
                                >
                                  Outcome:
                                </label>
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTestFormValues((prev) => ({
                                        ...prev,
                                        [test.testCode]: {
                                          ...currentForm,
                                          status: TestResultStatus.PASS,
                                        },
                                      }))
                                    }
                                    style={{
                                      flex: 1,
                                      padding: '0.35rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      borderRadius: '4px',
                                      border:
                                        currentForm.status ===
                                        TestResultStatus.PASS
                                          ? '2px solid #16a34a'
                                          : '1px solid #cbd5e1',
                                      backgroundColor:
                                        currentForm.status ===
                                        TestResultStatus.PASS
                                          ? '#dcfce7'
                                          : '#ffffff',
                                      color:
                                        currentForm.status ===
                                        TestResultStatus.PASS
                                          ? '#15803d'
                                          : '#475569',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    PASS ✓
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTestFormValues((prev) => ({
                                        ...prev,
                                        [test.testCode]: {
                                          ...currentForm,
                                          status: TestResultStatus.FAIL,
                                        },
                                      }))
                                    }
                                    style={{
                                      flex: 1,
                                      padding: '0.35rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      borderRadius: '4px',
                                      border:
                                        currentForm.status ===
                                        TestResultStatus.FAIL
                                          ? '2px solid #dc2626'
                                          : '1px solid #cbd5e1',
                                      backgroundColor:
                                        currentForm.status ===
                                        TestResultStatus.FAIL
                                          ? '#fee2e2'
                                          : '#ffffff',
                                      color:
                                        currentForm.status ===
                                        TestResultStatus.FAIL
                                          ? '#b91c1c'
                                          : '#475569',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    FAIL ✕
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTestFormValues((prev) => ({
                                        ...prev,
                                        [test.testCode]: {
                                          ...currentForm,
                                          status: TestResultStatus.PENDING,
                                        },
                                      }))
                                    }
                                    style={{
                                      flex: 1,
                                      padding: '0.35rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      borderRadius: '4px',
                                      border:
                                        currentForm.status ===
                                        TestResultStatus.PENDING
                                          ? '2px solid #64748b'
                                          : '1px solid #cbd5e1',
                                      backgroundColor:
                                        currentForm.status ===
                                        TestResultStatus.PENDING
                                          ? '#f1f5f9'
                                          : '#ffffff',
                                      color:
                                        currentForm.status ===
                                        TestResultStatus.PENDING
                                          ? '#334155'
                                          : '#475569',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    PENDING
                                  </button>
                                </div>
                              </div>

                              {/* Result & Date Inputs */}
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: '0.5rem',
                                }}
                              >
                                <div>
                                  <label
                                    style={{
                                      fontSize: '0.7rem',
                                      color: '#64748b',
                                      display: 'block',
                                    }}
                                  >
                                    Lab Value / Result:
                                  </label>
                                  <input
                                    type="text"
                                    value={currentForm.result}
                                    onChange={(e) =>
                                      setTestFormValues((prev) => ({
                                        ...prev,
                                        [test.testCode]: {
                                          ...currentForm,
                                          result: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="e.g. NON_REACTIVE"
                                    style={{
                                      width: '100%',
                                      padding: '0.3rem 0.5rem',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      fontSize: '0.775rem',
                                      boxSizing: 'border-box',
                                    }}
                                  />
                                </div>

                                <div>
                                  <label
                                    style={{
                                      fontSize: '0.7rem',
                                      color: '#64748b',
                                      display: 'block',
                                    }}
                                  >
                                    Tested At:
                                  </label>
                                  <input
                                    type="datetime-local"
                                    value={currentForm.testedAt}
                                    onChange={(e) =>
                                      setTestFormValues((prev) => ({
                                        ...prev,
                                        [test.testCode]: {
                                          ...currentForm,
                                          testedAt: e.target.value,
                                        },
                                      }))
                                    }
                                    style={{
                                      width: '100%',
                                      padding: '0.3rem 0.5rem',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      fontSize: '0.775rem',
                                      boxSizing: 'border-box',
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Remarks */}
                              <div>
                                <label
                                  style={{
                                    fontSize: '0.7rem',
                                    color: '#64748b',
                                    display: 'block',
                                  }}
                                >
                                  Remarks (optional):
                                </label>
                                <input
                                  type="text"
                                  value={currentForm.remarks}
                                  onChange={(e) =>
                                    setTestFormValues((prev) => ({
                                      ...prev,
                                      [test.testCode]: {
                                        ...currentForm,
                                        remarks: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Technician observation"
                                  style={{
                                    width: '100%',
                                    padding: '0.3rem 0.5rem',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    fontSize: '0.775rem',
                                    boxSizing: 'border-box',
                                  }}
                                />
                              </div>

                              {/* Feedback banner */}
                              {feedback && (
                                <div
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: '4px',
                                    backgroundColor:
                                      feedback.type === 'success'
                                        ? '#dcfce7'
                                        : '#fee2e2',
                                    color:
                                      feedback.type === 'success'
                                        ? '#166534'
                                        : '#991b1b',
                                  }}
                                >
                                  {feedback.message}
                                </div>
                              )}

                              {/* Save Result Button */}
                              <div style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  disabled={isSavingThis}
                                  onClick={() =>
                                    handleSaveIndividualTest(test.testCode)
                                  }
                                  style={{
                                    backgroundColor: '#0f172a',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '4px',
                                    fontSize: '0.775rem',
                                    fontWeight: 600,
                                    cursor: isSavingThis ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  {isSavingThis
                                    ? 'Saving...'
                                    : 'Save Test Result'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Finalize / Complete Testing Section */}
                {selectedTesting.status === TestingStatus.IN_PROGRESS && (
                  <div
                    style={{
                      borderTop: '1px solid #e2e8f0',
                      paddingTop: '1rem',
                      marginTop: '1rem',
                    }}
                  >
                    {pendingTestsList.length > 0 ? (
                      <div
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '0.75rem',
                          fontSize: '0.8rem',
                          color: '#64748b',
                        }}
                      >
                        <strong style={{ color: '#0f172a', display: 'block' }}>
                          Completion Gate:
                        </strong>
                        All required tests must be completed before finalizing testing.
                        <div style={{ marginTop: '0.25rem', color: '#b45309' }}>
                          Pending ({pendingTestsList.length}):{' '}
                          {pendingTestsList.map((t) => t.testCode).join(', ')}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          backgroundColor: hasFailedTests ? '#fff1f2' : '#f0fdf4',
                          border: hasFailedTests
                            ? '1px solid #fecdd3'
                            : '1px solid #bbf7d0',
                          borderRadius: '6px',
                          padding: '0.75rem',
                          marginBottom: '0.75rem',
                          fontSize: '0.8rem',
                        }}
                      >
                        {hasFailedTests ? (
                          <div style={{ color: '#9f1239' }}>
                            <strong>Outcome Preview: REJECTED</strong>
                            <div>
                              At least one test has failed. Completing testing will mark this record REJECTED and synchronize the Blood Unit status to REJECTED.
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: '#166534' }}>
                            <strong>Outcome Preview: APPROVED</strong>
                            <div>
                              All required tests passed. Completing testing will mark this record APPROVED and synchronize the Blood Unit status to APPROVED.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        disabled={pendingTestsList.length > 0}
                        onClick={() => {
                          setCompleteError(null);
                          setShowCompleteConfirmModal(true);
                        }}
                        style={{
                          width: '100%',
                          backgroundColor:
                            pendingTestsList.length > 0 ? '#94a3b8' : '#0f172a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor:
                            pendingTestsList.length > 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Complete Testing &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: Start Testing on Blood Unit */}
      {showStartModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '560px',
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
                  Start Laboratory Testing
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Select a collected Blood Unit currently in TESTING status
                </span>
              </div>
              <button
                onClick={() => setShowStartModal(false)}
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

            {startError && (
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
                {startError}
              </div>
            )}

            {candidateLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                Fetching blood units awaiting testing...
              </div>
            ) : candidateUnits.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                <p style={{ margin: 0, fontWeight: 500, color: '#334155' }}>
                  No Blood Units in TESTING status found.
                </p>
                <p style={{ margin: '0.5rem 0 1rem 0', fontSize: '0.85rem' }}>
                  Blood Units are produced when physical blood donations are marked COMPLETED.
                </p>
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  style={{
                    padding: '0.45rem 1rem',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleStartTestingSubmit}>
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
                    Select Blood Unit: *
                  </label>
                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {candidateUnits.map((u) => {
                      const donationCode =
                        typeof u.donationId === 'object' && u.donationId
                          ? (u.donationId as any).donationCode
                          : '';
                      const donorName =
                        typeof u.donorId === 'object' && u.donorId
                          ? (u.donorId as any).fullName
                          : '';
                      return (
                        <option key={u._id} value={u._id}>
                          {u.unitCode} — {u.bloodGroup} ({u.componentType})
                          {donationCode ? ` • Donation: ${donationCode}` : ''}
                          {donorName ? ` • Donor: ${donorName}` : ''}
                        </option>
                      );
                    })}
                  </select>

                  {/* Selected Candidate Traceability Preview */}
                  {(() => {
                    const selectedCandidate = candidateUnits.find(
                      (u) => u._id === selectedUnitId,
                    );
                    if (!selectedCandidate) return null;
                    const cDonationCode =
                      typeof selectedCandidate.donationId === 'object' &&
                      selectedCandidate.donationId
                        ? (selectedCandidate.donationId as any).donationCode
                        : null;
                    const cDonorName =
                      typeof selectedCandidate.donorId === 'object' &&
                      selectedCandidate.donorId
                        ? (selectedCandidate.donorId as any).fullName
                        : null;
                    const cDonorCode =
                      typeof selectedCandidate.donorId === 'object' &&
                      selectedCandidate.donorId
                        ? (selectedCandidate.donorId as any).donorCode
                        : null;

                    return (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.65rem 0.75rem',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ color: '#64748b' }}>Unit / Group:</span>
                          <strong style={{ color: '#0f172a' }}>
                            {selectedCandidate.unitCode} &bull;{' '}
                            {selectedCandidate.bloodGroup} (
                            {selectedCandidate.componentType})
                          </strong>
                        </div>
                        {cDonationCode && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span style={{ color: '#64748b' }}>
                              Source Donation:
                            </span>
                            <span style={{ color: '#0f172a', fontWeight: 500 }}>
                              {cDonationCode}
                            </span>
                          </div>
                        )}
                        {cDonorName && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span style={{ color: '#64748b' }}>Donor:</span>
                            <span style={{ color: '#0f172a', fontWeight: 500 }}>
                              {cDonorName}{' '}
                              {cDonorCode ? `(${cDonorCode})` : ''}
                            </span>
                          </div>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ color: '#64748b' }}>Collected:</span>
                          <span style={{ color: '#334155' }}>
                            {selectedCandidate.collectionDate
                              ? new Date(
                                  selectedCandidate.collectionDate,
                                ).toLocaleDateString()
                              : 'N/A'}{' '}
                            &bull; {selectedCandidate.volume || 450} mL
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

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
                    Assigned Technician / Pathologist (optional):
                  </label>
                  <input
                    type="text"
                    value={startPerformedBy}
                    onChange={(e) => setStartPerformedBy(e.target.value)}
                    placeholder="e.g. Lab Tech Alice"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                    }}
                  />
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
                    Intake Remarks (optional):
                  </label>
                  <input
                    type="text"
                    value={startRemarks}
                    onChange={(e) => setStartRemarks(e.target.value)}
                    placeholder="e.g. Pre-transfusion infectious screening intake"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowStartModal(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={startSubmitting}
                    style={{
                      padding: '0.5rem 1.25rem',
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: startSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {startSubmitting ? 'Initiating...' : 'Initiate Testing'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Complete Testing Confirmation */}
      {showCompleteConfirmModal && selectedTesting && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 55,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                Complete Laboratory Testing?
              </h3>
              <p
                style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '0.825rem',
                  color: '#64748b',
                }}
              >
                Finalize screening decision for {selectedTesting.testingCode}
              </p>
            </div>

            {completeError && (
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
                {completeError}
              </div>
            )}

            {/* Explanation box */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.85rem',
                marginBottom: '1rem',
                fontSize: '0.825rem',
                lineHeight: 1.5,
                color: '#334155',
              }}
            >
              <div><strong>Safety Workflow Rules:</strong></div>
              <ul style={{ margin: '0.35rem 0 0 1.25rem', padding: 0 }}>
                <li>If all required tests are PASS, the Blood Unit will be <strong>APPROVED</strong>.</li>
                <li>If any required test is FAIL, the Blood Unit will be <strong>REJECTED</strong>.</li>
                <li>Finalized testing records become permanently immutable and cannot be edited.</li>
              </ul>
            </div>

            {hasFailedTests && (
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: '#991b1b',
                    marginBottom: '0.35rem',
                  }}
                >
                  Rejection Reason (optional override):
                </label>
                <input
                  type="text"
                  value={completeRejectionReason}
                  onChange={(e) => setCompleteRejectionReason(e.target.value)}
                  placeholder="e.g. Confirmed reactive for Hepatitis B marker"
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

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
                Sign-off Technician / Pathologist:
              </label>
              <input
                type="text"
                value={completeSignoffName}
                onChange={(e) => setCompleteSignoffName(e.target.value)}
                placeholder="Name of approving laboratory officer"
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
                Final Remarks:
              </label>
              <input
                type="text"
                value={completeRemarks}
                onChange={(e) => setCompleteRemarks(e.target.value)}
                placeholder="Final laboratory sign-off notes"
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
              }}
            >
              <button
                type="button"
                onClick={() => setShowCompleteConfirmModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completeSubmitting}
                onClick={handleCompleteTestingSubmit}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: completeSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {completeSubmitting ? 'Finalizing...' : 'Complete Testing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
