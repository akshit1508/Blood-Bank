'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FlaskConical,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Droplet,
  Save,
  Check,
  ShieldCheck,
  FileText,
  ChevronUp,
  ChevronDown,
  X,
  Calendar,
  Filter,
} from 'lucide-react';
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

type DateFilterPreset = 'all' | 'today' | '7days' | '30days' | 'custom';

// Reusable Specimen Testing Panel (matching user screenshot)
interface InlineSpecimenPanelProps {
  selectedTesting: BloodTesting;
  detailLoading: boolean;
  activeTestCode: string | null;
  setActiveTestCode: (code: string | null) => void;
  testResultStatus: TestResultStatus;
  setTestResultStatus: (st: TestResultStatus) => void;
  testRemarks: string;
  setTestRemarks: (rem: string) => void;
  updatingTest: boolean;
  handleUpdateTest: (testCode: string) => Promise<void>;
  completingRecord: boolean;
  canComplete: boolean;
  handleCompleteRecord: () => Promise<void>;
  onClose: () => void;
}

function InlineSpecimenPanel({
  selectedTesting,
  detailLoading,
  activeTestCode,
  setActiveTestCode,
  testResultStatus,
  setTestResultStatus,
  testRemarks,
  setTestRemarks,
  updatingTest,
  handleUpdateTest,
  completingRecord,
  canComplete,
  handleCompleteRecord,
  onClose,
}: InlineSpecimenPanelProps) {
  if (detailLoading) {
    return (
      <div
        style={{
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '2px solid #7c3aed',
          margin: '0.75rem 0',
          boxShadow: '0 4px 12px rgba(124, 58, 237, 0.08)',
        }}
      >
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', color: '#7c3aed' }} />
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
          Loading 5-panel testing specimen workstation...
        </div>
      </div>
    );
  }

  const unitCode = selectedTesting.bloodUnitId?.unitCode || 'Blood Unit';
  const bloodGroup = selectedTesting.bloodUnitId?.bloodGroup || 'N/A';
  const recordIdShort = selectedTesting._id.slice(-8).toUpperCase();
  const initDate = new Date(selectedTesting.createdAt).toLocaleDateString();

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '2px solid #7c3aed',
        borderRadius: '12px',
        margin: '0.75rem 0 1rem 0',
        overflow: 'hidden',
        boxShadow: '0 8px 24px -4px rgba(124, 58, 237, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Top Bar with "Back to Testing Queue / Collapse" Button */}
      <div
        style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#faf5ff',
          borderBottom: '1px solid #f3e8ff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '0.4rem 0.85rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#334155',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to Testing Queue</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          title="Close panel"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '0.35rem',
            borderRadius: '4px',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Header Container matching screenshot */}
      <div style={{ padding: '1.25rem 1.25rem 0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
            Unit {unitCode}
          </h2>
          <span
            style={{
              padding: '0.15rem 0.55rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '6px',
              fontWeight: 800,
              fontSize: '0.8rem',
              border: '1px solid #fecaca',
            }}
          >
            {bloodGroup}
          </span>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
          Record ID: {recordIdShort} &bull; Initialized: {initDate}
        </div>

        {/* Badges Row */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '4px',
              backgroundColor: STATUS_BADGES[selectedTesting.status].bg,
              color: STATUS_BADGES[selectedTesting.status].text,
              border: `1px solid ${STATUS_BADGES[selectedTesting.status].border}`,
              fontWeight: 800,
            }}
          >
            {STATUS_BADGES[selectedTesting.status].label}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '4px',
              backgroundColor: DECISION_BADGES[selectedTesting.decision].bg,
              color: DECISION_BADGES[selectedTesting.decision].text,
              border: `1px solid ${DECISION_BADGES[selectedTesting.decision].border}`,
              fontWeight: 800,
            }}
          >
            {DECISION_BADGES[selectedTesting.decision].label}
          </span>
        </div>
      </div>

      {/* Section Title */}
      <div style={{ padding: '0 1.25rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0.85rem 0 0.85rem 0' }}>
          Mandatory Transfusion Diagnostic Panel (5 Tests)
        </h3>
      </div>

      {/* 5 Test Cards (matching screenshot) */}
      <div style={{ padding: '0 1.25rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {selectedTesting.testResults?.map((test) => {
          const badge = RESULT_STATUS_BADGES[test.status];
          const isCompleted = selectedTesting.status === TestingStatus.COMPLETED;
          const isEditing = activeTestCode === test.testCode;

          return (
            <div
              key={test.testCode}
              style={{
                border: isEditing ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                backgroundColor: isEditing ? '#faf5ff' : '#ffffff',
                boxShadow: isEditing ? '0 2px 8px rgba(124, 58, 237, 0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#0f172a', lineHeight: 1.3 }}>
                  {test.testName}{' '}
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                    ({test.testCode})
                  </span>
                </div>

                {test.remarks && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Remarks: {test.remarks}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.725rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      backgroundColor: badge.bg,
                      color: badge.text,
                      border: '1px solid ' + badge.border,
                      fontWeight: 800,
                    }}
                  >
                    {badge.label}
                  </span>

                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          setActiveTestCode(null);
                        } else {
                          setActiveTestCode(test.testCode);
                          setTestResultStatus(
                            test.status === TestResultStatus.PENDING ? TestResultStatus.PASS : test.status
                          );
                          setTestRemarks(test.remarks || '');
                        }
                      }}
                      style={{
                        padding: '0.4rem 0.8rem',
                        backgroundColor: isEditing ? '#e2e8f0' : '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.775rem',
                        fontWeight: 700,
                        color: '#334155',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isEditing ? 'Cancel' : 'Enter Result'}
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Edit Form */}
              {isEditing && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                        Outcome
                      </label>
                      <select
                        value={testResultStatus}
                        onChange={(e) => setTestResultStatus(e.target.value as TestResultStatus)}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.825rem',
                          fontWeight: 700,
                          backgroundColor: '#ffffff',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value={TestResultStatus.PASS}>PASS ✓</option>
                        <option value={TestResultStatus.FAIL}>FAIL ✕</option>
                        <option value={TestResultStatus.PENDING}>PENDING</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                        Technician Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        value={testRemarks}
                        onChange={(e) => setTestRemarks(e.target.value)}
                        placeholder="e.g. Non-reactive assay confirmed"
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.825rem',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUpdateTest(test.testCode)}
                      disabled={updatingTest}
                      style={{
                        width: '100%',
                        padding: '0.65rem',
                        backgroundColor: '#7c3aed',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.825rem',
                        fontWeight: 700,
                        cursor: updatingTest ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        boxShadow: '0 1px 2px rgba(124, 58, 237, 0.25)',
                      }}
                    >
                      <Save size={14} />
                      <span>{updatingTest ? 'Saving...' : 'Save Result'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Finalize Section */}
      <div style={{ padding: '0 1.25rem 1.25rem 1.25rem' }}>
        {selectedTesting.status === TestingStatus.COMPLETED ? (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              color: '#475569',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldCheck size={18} color="#10b981" />
            <span>
              <strong>Testing record finalized & immutable.</strong> Clinical clearance completed.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              padding: '1rem',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: '0.825rem', color: '#64748b', lineHeight: 1.4 }}>
              {canComplete ? (
                <span style={{ color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={16} color="#166534" />
                  <span>All 5 tests conclusive. Ready for final release signoff.</span>
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b45309' }}>
                  <AlertTriangle size={16} color="#d97706" />
                  <span>All 5 tests must be marked PASS or FAIL before finalization.</span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleCompleteRecord}
              disabled={!canComplete || completingRecord}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: canComplete ? '#10b981' : '#94a3b8',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: canComplete ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                boxShadow: canComplete ? '0 2px 4px rgba(16, 185, 129, 0.25)' : 'none',
              }}
            >
              <Check size={16} />
              <span>{completingRecord ? 'Finalizing Testing...' : 'Finalize Testing'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LabTestingWorkstationContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter'); // 'in_progress' | 'completed' | null

  // Main navigation tab: 'awaiting' vs 'records'
  const [mainTab, setMainTab] = useState<'awaiting' | 'records'>('awaiting');

  // Date Filter Range: 'all' | 'today' | '7days' | '30days' | 'custom'
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [records, setRecords] = useState<BloodTesting[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active testing record and the ID of the unit/record currently expanded inline
  const [selectedTesting, setSelectedTesting] = useState<BloodTesting | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sub-filter tabs for Records
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    if (filterParam === 'in_progress') {
      setActiveTabFilter('in_progress');
      setMainTab('records');
    } else if (filterParam === 'completed') {
      setActiveTabFilter('completed');
      setMainTab('records');
    }
  }, [filterParam]);

  // Awaiting testing units
  const [awaitingUnits, setAwaitingUnits] = useState<BloodUnitSummary[]>([]);
  const [awaitingLoading, setAwaitingLoading] = useState(false);
  const [creatingRecordForUnitId, setCreatingRecordForUnitId] = useState<string | null>(null);

  // Updating individual test state
  const [activeTestCode, setActiveTestCode] = useState<string | null>(null);
  const [testResultStatus, setTestResultStatus] = useState<TestResultStatus>(TestResultStatus.PASS);
  const [testRemarks, setTestRemarks] = useState('');
  const [updatingTest, setUpdatingTest] = useState(false);

  // Complete action
  const [completingRecord, setCompletingRecord] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setAwaitingLoading(true);
    setErrorMessage(null);
    try {
      const [recs, unitsRes] = await Promise.all([
        fetchTestingRecords({ limit: 100 }),
        fetchUnitsAwaitingTesting(100),
      ]);
      setRecords(recs.items);
      setAwaitingUnits(unitsRes.items);
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
      setAwaitingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Date Filtering helper
  const matchesDateFilter = useCallback(
    (dateString?: string) => {
      if (dateFilter === 'all') return true;
      if (!dateString) return false;

      const itemTime = new Date(dateString).getTime();
      if (isNaN(itemTime)) return true;

      const now = new Date();
      if (dateFilter === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        return itemTime >= startOfToday;
      }
      if (dateFilter === '7days') {
        const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        return itemTime >= sevenDaysAgo;
      }
      if (dateFilter === '30days') {
        const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
        return itemTime >= thirtyDaysAgo;
      }
      if (dateFilter === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate).getTime();
          if (itemTime < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
          if (itemTime > end) return false;
        }
        return true;
      }
      return true;
    },
    [dateFilter, customStartDate, customEndDate]
  );

  // Filtered Awaiting Units by Date
  const filteredAwaitingUnits = useMemo(() => {
    return awaitingUnits.filter((u) => matchesDateFilter(u.collectionDate || (u as any).createdAt));
  }, [awaitingUnits, matchesDateFilter]);

  // Filtered Records by Sub-tab & Date
  const filteredRecords = useMemo(() => {
    let subset = records;
    if (activeTabFilter === 'in_progress') {
      subset = records.filter((r) => r.status === TestingStatus.IN_PROGRESS);
    } else if (activeTabFilter === 'completed') {
      subset = records.filter((r) => r.status === TestingStatus.COMPLETED);
    }
    return subset.filter((r) => matchesDateFilter(r.startedAt || (r as any).createdAt));
  }, [records, activeTabFilter, matchesDateFilter]);

  // INLINE EXPANSION: When clicking "Start Panel" on an awaiting unit
  const handleInitiateTesting = async (unit: BloodUnitSummary) => {
    // If this unit is already open, clicking again toggles it closed
    if (expandedItemId === unit._id) {
      setExpandedItemId(null);
      return;
    }

    try {
      setCreatingRecordForUnitId(unit._id);
      setErrorMessage(null);
      setDetailLoading(true);
      setExpandedItemId(unit._id);

      // Check if a record already exists for this unit
      const existing = records.find(
        (r) =>
          (typeof r.bloodUnitId === 'object' && r.bloodUnitId?._id === unit._id) ||
          (r.bloodUnitId as any) === unit._id
      );

      let recordToUse: BloodTesting;
      if (existing) {
        recordToUse = await fetchTestingRecordById(existing._id);
      } else {
        recordToUse = await createTestingRecord({ bloodUnitId: unit._id });
        await loadAll();
      }

      setSelectedTesting(recordToUse);
      setActiveTestCode(null);
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
      setExpandedItemId(null);
    } finally {
      setCreatingRecordForUnitId(null);
      setDetailLoading(false);
    }
  };

  // INLINE EXPANSION: When clicking a record in the testing records queue
  const selectRecord = async (recordId: string) => {
    // If already expanded, toggle collapse
    if (expandedItemId === recordId) {
      setExpandedItemId(null);
      return;
    }

    setDetailLoading(true);
    setExpandedItemId(recordId);
    try {
      const full = await fetchTestingRecordById(recordId);
      setSelectedTesting(full);
      setActiveTestCode(null);
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
      setExpandedItemId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateTest = async (testCode: string) => {
    if (!selectedTesting) return;
    try {
      setUpdatingTest(true);
      setErrorMessage(null);
      const updated = await updateIndividualTestResult(selectedTesting._id, testCode, {
        status: testResultStatus,
        remarks: testRemarks.trim() || undefined,
      });
      setSelectedTesting(updated);
      setActiveTestCode(null);
      setTestRemarks('');
      setRecords((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setUpdatingTest(false);
    }
  };

  const handleCompleteRecord = async () => {
    if (!selectedTesting) return;
    try {
      setCompletingRecord(true);
      setErrorMessage(null);
      const finalized = await completeTestingRecord(selectedTesting._id, {});
      setSelectedTesting(finalized);
      setRecords((prev) => prev.map((r) => (r._id === finalized._id ? finalized : r)));
      await loadAll();
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setCompletingRecord(false);
    }
  };

  const canComplete = useMemo(() => {
    if (!selectedTesting || selectedTesting.status === TestingStatus.COMPLETED) return false;
    return (
      selectedTesting.testResults.length === 5 &&
      selectedTesting.testResults.every((t) => t.status !== TestResultStatus.PENDING)
    );
  }, [selectedTesting]);

  const dateSpanLabel = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return 'Today (1 Day)';
      case '7days':
        return 'Last 7 Days';
      case '30days':
        return 'Last 30 Days (1 Month)';
      case 'custom':
        if (customStartDate && customEndDate) return `${customStartDate} to ${customEndDate}`;
        if (customStartDate) return `Since ${customStartDate}`;
        if (customEndDate) return `Until ${customEndDate}`;
        return 'Custom Range';
      default:
        return 'All Time';
    }
  }, [dateFilter, customStartDate, customEndDate]);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
      {/* Top Workstation Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.2rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#ede9fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7c3aed',
                flexShrink: 0,
              }}
            >
              <FlaskConical size={18} />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              Screening &amp; Laboratory Workstation
            </h1>
          </div>
          <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.825rem' }}>
            5-Panel Mandatory Transfusion-Transmissible Infection (TTI) Diagnostics &amp; Clearance
          </p>
        </div>

        <button
          onClick={loadAll}
          disabled={loading}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            color: '#475569',
            fontSize: '0.825rem',
            padding: '0.5rem 0.9rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            color: '#991b1b',
            marginBottom: '1rem',
            fontSize: '0.825rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertTriangle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DATE RANGE FILTER BAR: 1 Day, 7 Day, 1 Month, Custom Range                */}
      {/* ========================================================================= */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.65rem',
          }}
        >
          {/* Preset Buttons */}
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
              { id: 'today', label: 'Today (1 Day)' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: '1 Month' },
              { id: 'custom', label: 'Custom Range' },
            ].map((preset) => {
              const active = dateFilter === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDateFilter(preset.id as DateFilterPreset)}
                  style={{
                    border: 'none',
                    backgroundColor: active ? '#7c3aed' : 'transparent',
                    color: active ? '#ffffff' : '#475569',
                    fontWeight: active ? 700 : 500,
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? '0 1px 3px rgba(124, 58, 237, 0.25)' : 'none',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Active Span Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '0.3rem 0.65rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#475569',
            }}
          >
            <Calendar size={13} color="#7c3aed" />
            <span style={{ color: '#94a3b8' }}>Range:</span>
            <strong style={{ color: '#0f172a' }}>{dateSpanLabel}</strong>
          </div>
        </div>

        {/* Custom Date Pickers (visible only when dateFilter === 'custom') */}
        {dateFilter === 'custom' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px dashed #e2e8f0',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.775rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.775rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                }}
              />
            </div>

            {(customStartDate || customEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                style={{
                  padding: '0.35rem 0.65rem',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear Dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TWO PRIMARY TABS (Below Refresh & Date Filter): Awaiting vs Records       */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '2px',
        }}
      >
        {/* Tab 1: Quarantined Units Awaiting Test */}
        <button
          type="button"
          onClick={() => {
            setMainTab('awaiting');
            setExpandedItemId(null);
          }}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            backgroundColor: mainTab === 'awaiting' ? '#ffffff' : '#f8fafc',
            border: mainTab === 'awaiting' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
            borderBottom: mainTab === 'awaiting' ? '3px solid #7c3aed' : '1px solid #e2e8f0',
            borderRadius: '10px 10px 0 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            fontWeight: 800,
            fontSize: '0.85rem',
            color: mainTab === 'awaiting' ? '#7c3aed' : '#64748b',
            boxShadow: mainTab === 'awaiting' ? '0 -2px 6px rgba(124, 58, 237, 0.08)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Clock size={16} color={mainTab === 'awaiting' ? '#7c3aed' : '#d97706'} />
          <span>Quarantined Units Awaiting Test</span>
          <span
            style={{
              padding: '0.15rem 0.55rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 800,
              backgroundColor: mainTab === 'awaiting' ? '#ede9fe' : '#fef3c7',
              color: mainTab === 'awaiting' ? '#7c3aed' : '#92400e',
              border: mainTab === 'awaiting' ? '1px solid #ddd6fe' : '1px solid #fde68a',
            }}
          >
            {filteredAwaitingUnits.length}
          </span>
        </button>

        {/* Tab 2: Testing Records Queue */}
        <button
          type="button"
          onClick={() => {
            setMainTab('records');
            setExpandedItemId(null);
          }}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            backgroundColor: mainTab === 'records' ? '#ffffff' : '#f8fafc',
            border: mainTab === 'records' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
            borderBottom: mainTab === 'records' ? '3px solid #7c3aed' : '1px solid #e2e8f0',
            borderRadius: '10px 10px 0 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            fontWeight: 800,
            fontSize: '0.85rem',
            color: mainTab === 'records' ? '#7c3aed' : '#64748b',
            boxShadow: mainTab === 'records' ? '0 -2px 6px rgba(124, 58, 237, 0.08)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <FileText size={16} color={mainTab === 'records' ? '#7c3aed' : '#64748b'} />
          <span>Testing Records Queue</span>
          <span
            style={{
              padding: '0.15rem 0.55rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 800,
              backgroundColor: mainTab === 'records' ? '#ede9fe' : '#e2e8f0',
              color: mainTab === 'records' ? '#7c3aed' : '#475569',
              border: mainTab === 'records' ? '1px solid #ddd6fe' : '1px solid #cbd5e1',
            }}
          >
            {filteredRecords.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1 CONTENT: Quarantined Blood Units Awaiting Testing                    */}
      {/* ========================================================================= */}
      {mainTab === 'awaiting' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            padding: '1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} color="#d97706" />
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                  Quarantined Units Awaiting Testing
                </span>
                <span
                  style={{
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '999px',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                  }}
                >
                  {filteredAwaitingUnits.length}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                Click &ldquo;Start Panel&rdquo; to open diagnostic testing inline
              </div>
            </div>
          </div>

          {awaitingLoading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', color: '#7c3aed' }} />
              <div>Loading awaiting units...</div>
            </div>
          ) : filteredAwaitingUnits.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
              No blood units awaiting testing for the selected range ({dateSpanLabel}).
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredAwaitingUnits.map((u) => {
                const isExpanded = expandedItemId === u._id;
                const isCreating = creatingRecordForUnitId === u._id;

                return (
                  <div key={u._id} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Blood Sample Unit Card (matching screenshot) */}
                    <div
                      style={{
                        backgroundColor: isExpanded ? '#faf5ff' : '#ffffff',
                        border: isExpanded ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '1rem',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Top row: Unit Code & Blood Group */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Droplet size={18} color="#dc2626" />
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                            {u.unitCode}
                          </span>
                        </div>
                        <span
                          style={{
                            padding: '0.15rem 0.55rem',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            border: '1px solid #fecaca',
                          }}
                        >
                          {u.bloodGroup}
                        </span>
                      </div>

                      {/* Middle row: Component & Status */}
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {u.componentType.replace(/_/g, ' ')} &bull; Status:{' '}
                        <strong style={{ color: '#d97706' }}>{u.status}</strong>
                      </div>

                      {/* Action Button: Start Panel */}
                      <div>
                        <button
                          type="button"
                          onClick={() => handleInitiateTesting(u)}
                          disabled={isCreating}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: isExpanded ? '#f1f5f9' : '#7c3aed',
                            color: isExpanded ? '#334155' : '#ffffff',
                            border: isExpanded ? '1px solid #cbd5e1' : 'none',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: isCreating ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: isExpanded ? 'none' : '0 2px 4px rgba(124, 58, 237, 0.25)',
                          }}
                        >
                          {isCreating ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Opening...</span>
                            </>
                          ) : isExpanded ? (
                            <>
                              <ChevronUp size={14} />
                              <span>Close Panel</span>
                            </>
                          ) : (
                            <>
                              <FlaskConical size={14} />
                              <span>Start Panel</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* INLINE SPECIMEN TESTING PANEL: Opens directly below THIS card! */}
                    {isExpanded && selectedTesting && (
                      <InlineSpecimenPanel
                        selectedTesting={selectedTesting}
                        detailLoading={detailLoading}
                        activeTestCode={activeTestCode}
                        setActiveTestCode={setActiveTestCode}
                        testResultStatus={testResultStatus}
                        setTestResultStatus={setTestResultStatus}
                        testRemarks={testRemarks}
                        setTestRemarks={setTestRemarks}
                        updatingTest={updatingTest}
                        handleUpdateTest={handleUpdateTest}
                        completingRecord={completingRecord}
                        canComplete={canComplete}
                        handleCompleteRecord={handleCompleteRecord}
                        onClose={() => setExpandedItemId(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2 CONTENT: Testing Records Queue                                      */}
      {/* ========================================================================= */}
      {mainTab === 'records' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            padding: '1rem',
          }}
        >
          {/* Header & Sub-filter pills */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} color="#7c3aed" />
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                  Testing Records Queue
                </span>
                <span
                  style={{
                    backgroundColor: '#ede9fe',
                    color: '#6d28d9',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '999px',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                  }}
                >
                  {filteredRecords.length}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                Select any record to view or continue test outcome recording inline
              </div>
            </div>

            {/* Sub-tabs: All, In Progress, Completed */}
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.15rem' }}>
              {[
                { id: 'all', label: 'All Records' },
                { id: 'in_progress', label: 'In Progress' },
                { id: 'completed', label: 'Completed' },
              ].map((tab) => {
                const active = activeTabFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabFilter(tab.id as any)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: active ? 700 : 500,
                      backgroundColor: active ? '#7c3aed' : '#ffffff',
                      color: active ? '#ffffff' : '#475569',
                      border: `1px solid ${active ? '#7c3aed' : '#cbd5e1'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', color: '#7c3aed' }} />
              <div>Loading records...</div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
              No testing records found for the selected filter and range ({dateSpanLabel}).
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredRecords.map((r) => {
                const isExpanded = expandedItemId === r._id;
                const st = STATUS_BADGES[r.status];
                const dec = DECISION_BADGES[r.decision];
                const completedTestsCount =
                  r.testResults?.filter((t) => t.status !== TestResultStatus.PENDING).length || 0;

                return (
                  <div key={r._id} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Record Card / Row */}
                    <div
                      onClick={() => selectRecord(r._id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        backgroundColor: isExpanded ? '#faf5ff' : '#ffffff',
                        border: isExpanded ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '200px' }}>
                        <Droplet size={18} color="#dc2626" />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.925rem', color: '#0f172a' }}>
                              {r.bloodUnitId?.unitCode || 'Unit'}
                            </span>
                            <span
                              style={{
                                padding: '0.12rem 0.5rem',
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                borderRadius: '4px',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                border: '1px solid #fecaca',
                              }}
                            >
                              {r.bloodUnitId?.bloodGroup || 'N/A'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                            Tests Done: <strong style={{ color: completedTestsCount === 5 ? '#166534' : '#64748b' }}>{completedTestsCount}/5</strong> &bull; Initialized: {new Date(r.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <span
                            style={{
                              fontSize: '0.675rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: st.bg,
                              color: st.text,
                              fontWeight: 700,
                              border: `1px solid ${st.border}`,
                            }}
                          >
                            {st.label}
                          </span>
                          <span
                            style={{
                              fontSize: '0.675rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: dec.bg,
                              color: dec.text,
                              fontWeight: 700,
                              border: `1px solid ${dec.border}`,
                            }}
                          >
                            {dec.label}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectRecord(r._id);
                          }}
                          style={{
                            padding: '0.45rem 0.85rem',
                            backgroundColor: isExpanded ? '#f1f5f9' : '#7c3aed',
                            color: isExpanded ? '#334155' : '#ffffff',
                            border: isExpanded ? '1px solid #cbd5e1' : 'none',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={13} />
                              <span>Close</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown size={13} />
                              <span>View Panel</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* INLINE SPECIMEN TESTING PANEL: Opens directly below THIS record! */}
                    {isExpanded && selectedTesting && selectedTesting._id === r._id && (
                      <InlineSpecimenPanel
                        selectedTesting={selectedTesting}
                        detailLoading={detailLoading}
                        activeTestCode={activeTestCode}
                        setActiveTestCode={setActiveTestCode}
                        testResultStatus={testResultStatus}
                        setTestResultStatus={setTestResultStatus}
                        testRemarks={testRemarks}
                        setTestRemarks={setTestRemarks}
                        updatingTest={updatingTest}
                        handleUpdateTest={handleUpdateTest}
                        completingRecord={completingRecord}
                        canComplete={canComplete}
                        handleCompleteRecord={handleCompleteRecord}
                        onClose={() => setExpandedItemId(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LabTestingWorkstationPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: '#7c3aed' }} />
          <div>Loading Laboratory Workstation...</div>
        </div>
      }
    >
      <LabTestingWorkstationContent />
    </Suspense>
  );
}