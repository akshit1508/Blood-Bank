'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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

function LabTestingWorkstationContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter'); // 'in_progress' | 'completed' | null

  const [records, setRecords] = useState<BloodTesting[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTesting, setSelectedTesting] = useState<BloodTesting | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'in_progress' | 'completed'>('all');

  // Sync active tab filter with URL query param if present
  useEffect(() => {
    if (filterParam === 'in_progress') {
      setActiveTabFilter('in_progress');
    } else if (filterParam === 'completed') {
      setActiveTabFilter('completed');
    } else {
      setActiveTabFilter('all');
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

  // Complete modal / action
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

  // Filter records by tab
  const displayedRecords = useMemo(() => {
    if (activeTabFilter === 'in_progress') {
      return records.filter((r) => r.status === TestingStatus.IN_PROGRESS);
    }
    if (activeTabFilter === 'completed') {
      return records.filter((r) => r.status === TestingStatus.COMPLETED);
    }
    return records;
  }, [records, activeTabFilter]);

  const selectRecord = async (recordId: string) => {
    setDetailLoading(true);
    try {
      const full = await fetchTestingRecordById(recordId);
      setSelectedTesting(full);
      setActiveTestCode(null);
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleInitiateTesting = async (unit: BloodUnitSummary) => {
    try {
      setCreatingRecordForUnitId(unit._id);
      setErrorMessage(null);
      const newRec = await createTestingRecord({ bloodUnitId: unit._id });
      await loadAll();
      setSelectedTesting(newRec);
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setCreatingRecordForUnitId(null);
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

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Blood Screening & Laboratory Workstation
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
            5-Panel Mandatory Transfusion-Transmissible Infection (TTI) Diagnostics & Clearance
          </p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            color: '#475569',
            fontSize: '0.8rem',
            padding: '0.45rem 0.85rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {errorMessage && (
        <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 460px) 1fr', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                Awaiting Testing ({awaitingUnits.length})
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Quarantined Units</span>
            </div>
            <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '0.5rem' }}>
              {awaitingLoading ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>Loading...</div>
              ) : awaitingUnits.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>No units awaiting testing initiation.</div>
              ) : (
                awaitingUnits.map((u) => (
                  <div key={u._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{u.unitCode}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.bloodGroup} &bull; {u.componentType.replace(/_/g, ' ')}</div>
                    </div>
                    <button
                      onClick={() => handleInitiateTesting(u)}
                      disabled={creatingRecordForUnitId === u._id}
                      style={{
                        padding: '0.35rem 0.65rem',
                        backgroundColor: '#7c3aed',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {creatingRecordForUnitId === u._id ? 'Starting...' : 'Start Test Panel'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                  Testing Records ({displayedRecords.length})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'in_progress', label: 'Pending / In Progress' },
                  { id: 'completed', label: 'Completed History' },
                ].map((tab) => {
                  const active = activeTabFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTabFilter(tab.id as any)}
                      style={{
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.725rem',
                        fontWeight: active ? 700 : 500,
                        backgroundColor: active ? '#7c3aed' : '#ffffff',
                        color: active ? '#ffffff' : '#64748b',
                        border: `1px solid ${active ? '#7c3aed' : '#cbd5e1'}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>Loading records...</div>
              ) : displayedRecords.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>No records match this filter.</div>
              ) : (
                displayedRecords.map((r) => {
                  const isSelected = selectedTesting?._id === r._id;
                  const st = STATUS_BADGES[r.status];
                  const dec = DECISION_BADGES[r.decision];
                  return (
                    <div
                      key={r._id}
                      onClick={() => selectRecord(r._id)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#f5f3ff' : 'transparent',
                        borderLeft: isSelected ? '4px solid #7c3aed' : '4px solid transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                          {r.bloodUnitId?.unitCode || 'Unit'}
                        </span>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: st.bg, color: st.text, fontWeight: 700 }}>
                            {st.label}
                          </span>
                          <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: dec.bg, color: dec.text, fontWeight: 700 }}>
                            {dec.label}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Group: {r.bloodUnitId?.bloodGroup || 'N/A'} &bull; Tests Done: {r.testResults?.filter((t) => t.status !== TestResultStatus.PENDING).length || 0}/5
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div>
          {detailLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              Loading testing specimen panel...
            </div>
          ) : !selectedTesting ? (
            <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', color: '#94a3b8' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔬</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>Select a testing record</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Select a record from the list or start a new panel from awaiting units.
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      Unit {selectedTesting.bloodUnitId?.unitCode}
                    </h2>
                    <span style={{ padding: '0.15rem 0.5rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
                      {selectedTesting.bloodUnitId?.bloodGroup}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Record ID: {selectedTesting._id} &bull; Initialized: {new Date(selectedTesting.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: STATUS_BADGES[selectedTesting.status].bg, color: STATUS_BADGES[selectedTesting.status].text, fontWeight: 700 }}>
                      {STATUS_BADGES[selectedTesting.status].label}
                    </span>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: DECISION_BADGES[selectedTesting.decision].bg, color: DECISION_BADGES[selectedTesting.decision].text, fontWeight: 700 }}>
                      {DECISION_BADGES[selectedTesting.decision].label}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem 0' }}>
                  Mandatory Transfusion Diagnostic Panel (5 Tests)
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
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
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                              {test.testName} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({test.testCode})</span>
                            </div>
                            {test.remarks && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                Remarks: {test.remarks}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '4px',
                                backgroundColor: badge.bg,
                                color: badge.text,
                                border: '1px solid ' + badge.border,
                                fontWeight: 700,
                              }}
                            >
                              {badge.label}
                            </span>

                            {!isCompleted && (
                              <button
                                onClick={() => {
                                  if (isEditing) {
                                    setActiveTestCode(null);
                                  } else {
                                    setActiveTestCode(test.testCode);
                                    setTestResultStatus(test.status === TestResultStatus.PENDING ? TestResultStatus.PASS : test.status);
                                    setTestRemarks(test.remarks || '');
                                  }
                                }}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  backgroundColor: isEditing ? '#e2e8f0' : '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: '#334155',
                                  cursor: 'pointer',
                                }}
                              >
                                {isEditing ? 'Cancel' : 'Enter Result'}
                              </button>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                              <div style={{ width: '140px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                                  Outcome
                                </label>
                                <select
                                  value={testResultStatus}
                                  onChange={(e) => setTestResultStatus(e.target.value as TestResultStatus)}
                                  style={{
                                    width: '100%',
                                    padding: '0.45rem',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  <option value={TestResultStatus.PASS}>PASS ✓</option>
                                  <option value={TestResultStatus.FAIL}>FAIL ✕</option>
                                  <option value={TestResultStatus.PENDING}>PENDING</option>
                                </select>
                              </div>

                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                                  Technician Remarks (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={testRemarks}
                                  onChange={(e) => setTestRemarks(e.target.value)}
                                  placeholder="e.g. Non-reactive assay confirmed"
                                  style={{
                                    width: '100%',
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.8rem',
                                    boxSizing: 'border-box',
                                  }}
                                />
                              </div>

                              <button
                                onClick={() => handleUpdateTest(test.testCode)}
                                disabled={updatingTest}
                                style={{
                                  padding: '0.45rem 1rem',
                                  backgroundColor: '#7c3aed',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {updatingTest ? 'Saving...' : 'Save Result'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedTesting.status === TestingStatus.COMPLETED ? (
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    🔒 <strong>Testing record is immutable and finalized.</strong> Clinical decisions cannot be modified.
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {canComplete ? (
                        <span style={{ color: '#166534', fontWeight: 600 }}>
                          ✓ All 5 tests are conclusive. Record is ready for clinical finalization.
                        </span>
                      ) : (
                        <span>
                          ⚠️ All 5 tests must have conclusive (PASS or FAIL) results before finalization.
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleCompleteRecord}
                      disabled={!canComplete || completingRecord}
                      style={{
                        padding: '0.65rem 1.25rem',
                        backgroundColor: canComplete ? '#10b981' : '#94a3b8',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: canComplete ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {completingRecord ? 'Finalizing...' : 'Finalize Testing'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LabTestingWorkstationPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
          Loading Laboratory Workstation...
        </div>
      }
    >
      <LabTestingWorkstationContent />
    </Suspense>
  );
}