'use client';

import React, { useState, useEffect } from 'react';
import {
  BloodTesting,
  IndividualTestResult,
  TestResultStatus,
  TestMethod,
  TestingStatus,
  TestingDecision,
  updateIndividualTestResult,
  recordBloodGrouping,
  completeTestingRecord,
  authorizeTestingRelease,
  RecordBloodGroupingInput,
} from '@/lib/testing-api';
import { getStoredAdmin } from '@/lib/auth-api';

interface LabTestEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: BloodTesting | null;
  onSuccess: (updatedRecord: BloodTesting) => void;
}

const TTI_TEST_NAMES: Record<string, string> = {
  HIV: 'Human Immunodeficiency Virus (HIV-1/2)',
  HBV: 'Hepatitis B Surface Antigen (HBsAg)',
  HCV: 'Hepatitis C Virus Antibody (Anti-HCV)',
  SYPHILIS: 'Syphilis Serology (VDRL/RPR/TPHA)',
  MALARIA: 'Malaria Antigen / Blood Smear',
};

const AGGLUTINATION_GRADES = ['0', '1+', '2+', '3+', '4+'];

export default function LabTestEntryModal({
  isOpen,
  onClose,
  record,
  onSuccess,
}: LabTestEntryModalProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'grouping' | 'tti' | 'finalize'>('grouping');
  const [currentRecord, setCurrentRecord] = useState<BloodTesting | null>(record);

  // Sync currentRecord when prop changes
  useEffect(() => {
    setCurrentRecord(record);
  }, [record]);

  const activeRecord = currentRecord || record;

  // Blood Grouping state
  const [aboGroup, setAboGroup] = useState('O');
  const [rhFactor, setRhFactor] = useState('POSITIVE');
  const [groupingMethod, setGroupingMethod] = useState('GEL_CARD');
  const [antiA, setAntiA] = useState('0');
  const [antiB, setAntiB] = useState('0');
  const [antiD, setAntiD] = useState('4+');
  const [aCells, setACells] = useState('4+');
  const [bCells, setBCells] = useState('4+');
  const [oCells, setOCells] = useState('0');
  const [groupingLot, setGroupingLot] = useState('');
  const [groupingExpiry, setGroupingExpiry] = useState('');
  const [groupingRemarks, setGroupingRemarks] = useState('');
  const [savingGrouping, setSavingGrouping] = useState(false);
  const [groupingError, setGroupingError] = useState<string | null>(null);
  const [groupingSuccess, setGroupingSuccess] = useState<string | null>(null);

  // TTI Test results state
  const [ttiResults, setTtiResults] = useState<
    Record<
      string,
      {
        status: TestResultStatus;
        result: string;
        method: TestMethod;
        kitLotNumber: string;
        kitExpiryDate: string;
        isRepeatOrConfirmatory: boolean;
        repeatReason: string;
        remarks: string;
      }
    >
  >({});
  const [savingTestCode, setSavingTestCode] = useState<string | null>(null);
  const [savingAllTests, setSavingAllTests] = useState(false);
  const [testSaveError, setTestSaveError] = useState<string | null>(null);
  const [testSaveSuccess, setTestSaveSuccess] = useState<string | null>(null);

  // Finalization state
  const [finalizing, setFinalizing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [finalizeRemarks, setFinalizeRemarks] = useState('');
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // Supervisor release state
  const [authorizing, setAuthorizing] = useState(false);
  const [authRemarks, setAuthRemarks] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Populate state on record load
  useEffect(() => {
    const user = getStoredAdmin();
    setCurrentUser(user);

    if (!isOpen || !activeRecord) return;

    // Load grouping if present
    if (activeRecord.bloodGrouping) {
      setAboGroup(activeRecord.bloodGrouping.aboGroup || 'O');
      setRhFactor(activeRecord.bloodGrouping.rhFactor || 'POSITIVE');
      setGroupingMethod(activeRecord.bloodGrouping.groupingMethod || 'GEL_CARD');
      setAntiA(activeRecord.bloodGrouping.cellGroupingAntiA || '0');
      setAntiB(activeRecord.bloodGrouping.cellGroupingAntiB || '0');
      setAntiD(activeRecord.bloodGrouping.cellGroupingAntiD || '4+');
      setACells(activeRecord.bloodGrouping.serumGroupingACells || '4+');
      setBCells(activeRecord.bloodGrouping.serumGroupingBCells || '4+');
      setOCells(activeRecord.bloodGrouping.serumGroupingOCells || '0');
      setGroupingRemarks(activeRecord.bloodGrouping.remarks || '');
    } else {
      // Derive initial guess from blood unit if known
      const bg = activeRecord.bloodUnitId?.bloodGroup || '';
      if (bg.includes('AB')) setAboGroup('AB');
      else if (bg.includes('A')) setAboGroup('A');
      else if (bg.includes('B')) setAboGroup('B');
      else if (bg.includes('O')) setAboGroup('O');

      if (bg.includes('-')) setRhFactor('NEGATIVE');
      else setRhFactor('POSITIVE');
    }

    // Load TTI tests
    const initialMap: Record<string, any> = {};
    activeRecord.testResults.forEach((t) => {
      initialMap[t.testCode] = {
        status: t.status || TestResultStatus.PENDING,
        result: t.result || (t.status === TestResultStatus.PASS ? 'Non-Reactive' : ''),
        method: (t.method as TestMethod) || TestMethod.ELISA,
        kitLotNumber: t.kitLotNumber || '',
        kitExpiryDate: t.kitExpiryDate ? t.kitExpiryDate.slice(0, 10) : '',
        isRepeatOrConfirmatory: !!t.isRepeatOrConfirmatory,
        repeatReason: t.repeatReason || '',
        remarks: t.remarks || '',
      };
    });
    setTtiResults(initialMap);

    setGroupingError(null);
    setGroupingSuccess(null);
    setTestSaveError(null);
    setTestSaveSuccess(null);
    setFinalizeError(null);
    setAuthError(null);
  }, [isOpen, record]);

  if (!isOpen || !activeRecord) return null;

  const confirmedBloodGroup = `${aboGroup}${rhFactor === 'POSITIVE' ? '+' : '-'}`;
  const isSupervisor =
    !currentUser || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';

  // Handle Save Blood Grouping and advance to TTI Screening
  const handleSaveGrouping = async () => {
    setSavingGrouping(true);
    setGroupingError(null);
    setGroupingSuccess(null);

    try {
      const input: RecordBloodGroupingInput = {
        aboGroup,
        rhFactor,
        confirmedBloodGroup,
        groupingMethod,
        cellGroupingAntiA: antiA,
        cellGroupingAntiB: antiB,
        cellGroupingAntiD: antiD,
        serumGroupingACells: aCells,
        serumGroupingBCells: bCells,
        serumGroupingOCells: oCells,
        kitLotNumber: groupingLot.trim() || undefined,
        kitExpiryDate: groupingExpiry || undefined,
        remarks: groupingRemarks.trim() || undefined,
      };

      const updated = await recordBloodGrouping(activeRecord._id, input);
      setCurrentRecord(updated);
      setGroupingSuccess(`Blood Grouping confirmed as ${confirmedBloodGroup} and saved successfully.`);
      onSuccess(updated);

      // Automatically advance to TTI screening
      setActiveTab('tti');
    } catch (err: any) {
      setGroupingError(err.message || 'Failed to record blood grouping');
    } finally {
      setSavingGrouping(false);
    }
  };

  // Helper: auto fill all 5 markers as non-reactive PASS
  const handleMarkAllTtiPass = () => {
    const updatedMap = { ...ttiResults };
    activeRecord.testResults.forEach((t) => {
      const existing = updatedMap[t.testCode] || {};
      updatedMap[t.testCode] = {
        status: TestResultStatus.PASS,
        result:
          existing.result && existing.result !== 'Reactive' && existing.result !== 'Inconclusive'
            ? existing.result
            : 'Non-Reactive (Negative)',
        method: existing.method || TestMethod.ELISA,
        kitLotNumber: existing.kitLotNumber || groupingLot || 'LOT-2026-TTI',
        kitExpiryDate: existing.kitExpiryDate || groupingExpiry || '',
        isRepeatOrConfirmatory: false,
        repeatReason: '',
        remarks: existing.remarks || 'Standard initial screening negative',
      };
    });
    setTtiResults(updatedMap);
    setTestSaveSuccess('All 5 markers pre-filled as Non-Reactive (PASS). Click "Save All 5 Tests & Proceed to Finalize" to save.');
  };

  // Handle Save Single TTI Test Result
  const handleSaveTest = async (testCode: string) => {
    const item = ttiResults[testCode];
    if (!item) return;

    if (item.status === TestResultStatus.PENDING) {
      setTestSaveError(`Please select a conclusive status for ${testCode} (PASS, FAIL, or INDETERMINATE)`);
      return;
    }

    setSavingTestCode(testCode);
    setTestSaveError(null);
    setTestSaveSuccess(null);

    try {
      const updated = await updateIndividualTestResult(activeRecord._id, testCode, {
        status: item.status,
        result: item.result.trim() || undefined,
        method: item.method,
        kitLotNumber: item.kitLotNumber.trim() || undefined,
        kitExpiryDate: item.kitExpiryDate || undefined,
        isRepeatOrConfirmatory: item.isRepeatOrConfirmatory,
        repeatReason: item.repeatReason.trim() || undefined,
        remarks: item.remarks.trim() || undefined,
      });

      setCurrentRecord(updated);
      setTestSaveSuccess(`Result for ${testCode} saved successfully (${item.status}).`);
      onSuccess(updated);
    } catch (err: any) {
      setTestSaveError(err.message || `Failed to update ${testCode}`);
    } finally {
      setSavingTestCode(null);
    }
  };

  // Handle Save All 5 TTI Tests and advance to Finalize
  const handleSaveAllTestsAndProceed = async () => {
    // Check if any test is pending
    const pendingTests = activeRecord.testResults.filter(
      (t) => !ttiResults[t.testCode] || ttiResults[t.testCode].status === TestResultStatus.PENDING,
    );
    if (pendingTests.length > 0) {
      setTestSaveError(
        `Please record conclusive results for all 5 markers before proceeding (${pendingTests.map((t) => t.testCode).join(', ')} still PENDING). You can click "⚡ Auto-Fill All 5 Markers as Non-Reactive" if all tested negative.`,
      );
      return;
    }

    setSavingAllTests(true);
    setTestSaveError(null);
    setTestSaveSuccess(null);

    try {
      let latestRecord = activeRecord;
      for (const t of activeRecord.testResults) {
        const item = ttiResults[t.testCode];
        if (item) {
          latestRecord = await updateIndividualTestResult(activeRecord._id, t.testCode, {
            status: item.status,
            result: item.result.trim() || undefined,
            method: item.method,
            kitLotNumber: item.kitLotNumber.trim() || undefined,
            kitExpiryDate: item.kitExpiryDate || undefined,
            isRepeatOrConfirmatory: item.isRepeatOrConfirmatory,
            repeatReason: item.repeatReason.trim() || undefined,
            remarks: item.remarks.trim() || undefined,
          });
        }
      }

      setCurrentRecord(latestRecord);
      setTestSaveSuccess('All 5 TTI screening test results saved successfully.');
      onSuccess(latestRecord);

      // Automatically advance to finalize section
      setActiveTab('finalize');
    } catch (err: any) {
      setTestSaveError(err.message || 'Failed to save all test results');
    } finally {
      setSavingAllTests(false);
    }
  };

  // Check TTI completion status
  const pendingCount = activeRecord.testResults.filter(
    (t) => t.status === TestResultStatus.PENDING,
  ).length;
  const failOrIndeterminateCount = activeRecord.testResults.filter(
    (t) =>
      t.status === TestResultStatus.FAIL ||
      (t.status as any) === TestResultStatus.INDETERMINATE,
  ).length;

  // Handle Finalize Testing Workflow only
  const handleFinalize = async () => {
    setFinalizing(true);
    setFinalizeError(null);

    try {
      const updated = await completeTestingRecord(activeRecord._id, {
        performedBy: currentUser?.fullName || 'Lab Staff',
        rejectionReason:
          failOrIndeterminateCount > 0
            ? rejectionReason.trim() || 'Laboratory screening non-conclusive / reactive'
            : undefined,
        remarks: finalizeRemarks.trim() || undefined,
      });

      setCurrentRecord(updated);
      onSuccess(updated);
    } catch (err: any) {
      setFinalizeError(err.message || 'Failed to complete testing workflow');
    } finally {
      setFinalizing(false);
    }
  };

  // Handle Combined Finalize Testing & Direct Release to Available Inventory
  const handleFinalizeAndRelease = async () => {
    setFinalizing(true);
    setFinalizeError(null);

    try {
      // 1. Complete testing
      let latestRecord = await completeTestingRecord(activeRecord._id, {
        performedBy: currentUser?.fullName || 'Lab Staff',
        remarks: finalizeRemarks.trim() || undefined,
      });

      // 2. Authorize release directly into inventory
      if (isSupervisor) {
        latestRecord = await authorizeTestingRelease(activeRecord._id, {
          authorizationRemarks: authRemarks.trim() || 'Clinically verified and authorized directly to central inventory',
        });
      }

      setCurrentRecord(latestRecord);
      onSuccess(latestRecord);
    } catch (err: any) {
      setFinalizeError(err.message || 'Failed to finalize and release to inventory');
    } finally {
      setFinalizing(false);
    }
  };

  // Handle Supervisor Clinical Release for already-finalized records
  const handleAuthorizeRelease = async () => {
    setAuthorizing(true);
    setAuthError(null);

    try {
      const updated = await authorizeTestingRelease(activeRecord._id, {
        authorizationRemarks: authRemarks.trim() || 'Authorized for routine clinical issue',
      });
      setCurrentRecord(updated);
      onSuccess(updated);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to authorize laboratory release');
    } finally {
      setAuthorizing(false);
    }
  };
      setFinalizing(false);
    }
  };

  // Handle Supervisor Clinical Release
  const handleAuthorizeRelease = async () => {
    setAuthorizing(true);
    setAuthError(null);

    try {
      const updated = await authorizeTestingRelease(record._id, {
        authorizationRemarks: authRemarks.trim() || 'Authorized for routine clinical issue',
      });
      onSuccess(updated);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to authorize laboratory release');
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🔬</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Laboratory Testing & Release Authorization
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: '#334155',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontFamily: 'monospace',
                }}
              >
                {record.testingCode}
              </span>
            </div>
            <p
              style={{
                margin: '4px 0 0 30px',
                fontSize: '12px',
                color: '#94a3b8',
              }}
            >
              Blood Unit: <strong style={{ color: '#f8fafc' }}>{record.bloodUnitId?.unitCode}</strong> |
              Donor: {record.donorId?.donorCode || 'Anonymous'} | Bag Group: {record.bloodUnitId?.bloodGroup || 'Unverified'}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '24px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            padding: '0 24px',
          }}
        >
          <button
            onClick={() => setActiveTab('grouping')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              color: activeTab === 'grouping' ? '#dc2626' : '#64748b',
              borderBottom: activeTab === 'grouping' ? '3px solid #dc2626' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🩸</span> 1. ABO & Rh Typing
            {record.bloodGrouping?.confirmedBloodGroup && (
              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  padding: '1px 6px',
                  borderRadius: '999px',
                }}
              >
                {record.bloodGrouping.confirmedBloodGroup}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tti')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              color: activeTab === 'tti' ? '#dc2626' : '#64748b',
              borderBottom: activeTab === 'tti' ? '3px solid #dc2626' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🛡️</span> 2. TTI Infection Screening (5 Markers)
            {pendingCount > 0 ? (
              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  padding: '1px 6px',
                  borderRadius: '999px',
                }}
              >
                {pendingCount} Pending
              </span>
            ) : (
              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  padding: '1px 6px',
                  borderRadius: '999px',
                }}
              >
                All Done
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('finalize')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              color: activeTab === 'finalize' ? '#dc2626' : '#64748b',
              borderBottom: activeTab === 'finalize' ? '3px solid #dc2626' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>⚖️</span> 3. Finalize & Release Verification
            {record.decision === TestingDecision.APPROVED && (
              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  padding: '1px 6px',
                  borderRadius: '999px',
                }}
              >
                APPROVED
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: ABO & Rh Blood Grouping */}
          {activeTab === 'grouping' && (
            <div>
              <div
                style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  color: '#1e40af',
                }}
              >
                <strong>National Blood Transfusion Council (NBTC) Requirement:</strong> Mandatory forward
                (cell) and reverse (serum) grouping must be performed. Any discrepancy between cell and
                serum grouping must be resolved before releasing the unit.
              </div>

              {groupingError && (
                <div
                  style={{
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px',
                  }}
                >
                  ⚠️ {groupingError}
                </div>
              )}

              {groupingSuccess && (
                <div
                  style={{
                    backgroundColor: '#dcfce7',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px',
                  }}
                >
                  ✓ {groupingSuccess}
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: '6px',
                    }}
                  >
                    ABO Blood Group *
                  </label>
                  <select
                    value={aboGroup}
                    onChange={(e) => setAboGroup(e.target.value)}
                    disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    <option value="A">Group A</option>
                    <option value="B">Group B</option>
                    <option value="AB">Group AB</option>
                    <option value="O">Group O</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: '6px',
                    }}
                  >
                    Rh (D) Factor *
                  </label>
                  <select
                    value={rhFactor}
                    onChange={(e) => setRhFactor(e.target.value)}
                    disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    <option value="POSITIVE">Rh POSITIVE (D+)</option>
                    <option value="NEGATIVE">Rh NEGATIVE (D-)</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: '6px',
                    }}
                  >
                    Confirmed Result
                  </label>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#dc2626',
                      textAlign: 'center',
                    }}
                  >
                    {confirmedBloodGroup}
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: '6px',
                    }}
                  >
                    Grouping Method
                  </label>
                  <select
                    value={groupingMethod}
                    onChange={(e) => setGroupingMethod(e.target.value)}
                    disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                    }}
                  >
                    <option value="GEL_CARD">Gel Card Technology</option>
                    <option value="TUBE_METHOD">Standard Tube Agglutination</option>
                    <option value="MICROPLATE">Microplate Technique</option>
                  </select>
                </div>
              </div>

              {/* Cell & Serum Agglutination Detail Grid */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  backgroundColor: '#fafafa',
                  marginBottom: '20px',
                }}
              >
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#1e293b' }}>
                  Agglutination Grading Reaction Matrix (0 to 4+)
                </h4>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '12px',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                      Forward: Anti-A
                    </label>
                    <select
                      value={antiA}
                      onChange={(e) => setAntiA(e.target.value)}
                      disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {AGGLUTINATION_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                      Forward: Anti-B
                    </label>
                    <select
                      value={antiB}
                      onChange={(e) => setAntiB(e.target.value)}
                      disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {AGGLUTINATION_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                      Forward: Anti-D (Rh)
                    </label>
                    <select
                      value={antiD}
                      onChange={(e) => setAntiD(e.target.value)}
                      disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {AGGLUTINATION_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                      Reverse: A Cells
                    </label>
                    <select
                      value={aCells}
                      onChange={(e) => setACells(e.target.value)}
                      disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {AGGLUTINATION_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                      Reverse: B Cells
                    </label>
                    <select
                      value={bCells}
                      onChange={(e) => setBCells(e.target.value)}
                      disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {AGGLUTINATION_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                      Reverse: O Cells (Ctrl)
                    </label>
                    <select
                      value={oCells}
                      onChange={(e) => setOCells(e.target.value)}
                      disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {AGGLUTINATION_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Reagent Kit Lot and Remarks */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Reagent Kit Lot Number
                  </label>
                  <input
                    type="text"
                    value={groupingLot}
                    onChange={(e) => setGroupingLot(e.target.value)}
                    placeholder="e.g. GEL-LOT-2026-A1"
                    disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Reagent Kit Expiry Date
                  </label>
                  <input
                    type="date"
                    value={groupingExpiry}
                    onChange={(e) => setGroupingExpiry(e.target.value)}
                    disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Technician Remarks / Observations
                </label>
                <input
                  type="text"
                  value={groupingRemarks}
                  onChange={(e) => setGroupingRemarks(e.target.value)}
                  placeholder="e.g. Clean agglutination observed, no discrepancies detected"
                  disabled={record.status === TestingStatus.COMPLETED && !!record.authorizedBy}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '20px' }}>
                {!(activeRecord.status === TestingStatus.COMPLETED && !!activeRecord.authorizedBy) && (
                  <button
                    type="button"
                    onClick={handleSaveGrouping}
                    disabled={savingGrouping}
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '11px 22px',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: savingGrouping ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                    }}
                  >
                    {savingGrouping ? 'Saving Grouping...' : '💾 Save Blood Grouping & Proceed to TTI Screening ➔'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('tti')}
                  style={{
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '11px 18px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Proceed to TTI Screening &rarr;
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: TTI Infection Screening */}
          {activeTab === 'tti' && (
            <div>
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  color: '#991b1b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ flex: '1 1 300px' }}>
                  <strong>Drug Controller General of India (DCGI) Mandate:</strong> All 5 infectious markers
                  (HIV, HBV, HCV, Syphilis, Malaria) must be individually tested and documented. Missing,
                  pending, or inconclusive results cannot be treated as negative.
                </div>
                {activeRecord.status !== TestingStatus.COMPLETED && (
                  <button
                    type="button"
                    onClick={handleMarkAllTtiPass}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(22, 163, 74, 0.25)',
                    }}
                  >
                    ⚡ Auto-Fill All 5 Markers as Non-Reactive (PASS)
                  </button>
                )}
              </div>

              {testSaveError && (
                <div
                  style={{
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px',
                  }}
                >
                  ⚠️ {testSaveError}
                </div>
              )}

              {testSaveSuccess && (
                <div
                  style={{
                    backgroundColor: '#dcfce7',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px',
                  }}
                >
                  ✓ {testSaveSuccess}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeRecord.testResults.map((t) => {
                  const state = ttiResults[t.testCode] || {
                    status: t.status,
                    result: t.result || '',
                    method: (t.method as TestMethod) || TestMethod.ELISA,
                    kitLotNumber: t.kitLotNumber || '',
                    kitExpiryDate: t.kitExpiryDate ? t.kitExpiryDate.slice(0, 10) : '',
                    isRepeatOrConfirmatory: !!t.isRepeatOrConfirmatory,
                    repeatReason: t.repeatReason || '',
                    remarks: t.remarks || '',
                  };

                  const isPending = state.status === TestResultStatus.PENDING;
                  const isPass = state.status === TestResultStatus.PASS;
                  const isFail = state.status === TestResultStatus.FAIL;
                  const isIndeterminate =
                    (state.status as any) === TestResultStatus.INDETERMINATE;

                  return (
                    <div
                      key={t.testCode}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '16px',
                        backgroundColor: isPass ? '#f0fdf4' : isFail ? '#fef2f2' : isIndeterminate ? '#fffbeb' : '#ffffff',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '12px',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                            {t.testCode} — {TTI_TEST_NAMES[t.testCode] || t.testName}
                          </strong>
                          {t.testedAt && (
                            <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '10px' }}>
                              Tested: {new Date(t.testedAt).toLocaleDateString()} by {t.performedByName || 'Tech'}
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '999px',
                            backgroundColor: isPass
                              ? '#dcfce7'
                              : isFail
                              ? '#fee2e2'
                              : isIndeterminate
                              ? '#fef3c7'
                              : '#f1f5f9',
                            color: isPass
                              ? '#166534'
                              : isFail
                              ? '#991b1b'
                              : isIndeterminate
                              ? '#92400e'
                              : '#64748b',
                          }}
                        >
                          {state.status}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '12px',
                          marginBottom: '12px',
                        }}
                      >
                        <div>
                          <label style={{ fontSize: '11px', color: '#475569', display: 'block', fontWeight: 600 }}>
                            Screening Status *
                          </label>
                          <select
                            value={state.status}
                            onChange={(e) => {
                              const val = e.target.value as TestResultStatus;
                              setTtiResults({
                                ...ttiResults,
                                [t.testCode]: {
                                  ...state,
                                  status: val,
                                  result: val === TestResultStatus.PASS ? 'Non-Reactive' : val === TestResultStatus.FAIL ? 'Reactive' : 'Inconclusive',
                                },
                              });
                            }}
                            disabled={activeRecord.status === TestingStatus.COMPLETED}
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px',
                              fontWeight: 600,
                            }}
                          >
                            <option value={TestResultStatus.PENDING}>⏳ PENDING</option>
                            <option value={TestResultStatus.PASS}>✓ PASS (Non-Reactive)</option>
                            <option value={TestResultStatus.FAIL}>✕ FAIL (Reactive)</option>
                            <option value={TestResultStatus.INDETERMINATE}>⚠️ INDETERMINATE (Gray zone)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', color: '#475569', display: 'block', fontWeight: 600 }}>
                            Test Method
                          </label>
                          <select
                            value={state.method}
                            onChange={(e) =>
                              setTtiResults({
                                ...ttiResults,
                                [t.testCode]: { ...state, method: e.target.value as TestMethod },
                              })
                            }
                            disabled={activeRecord.status === TestingStatus.COMPLETED}
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px',
                            }}
                          >
                            <option value={TestMethod.ELISA}>ELISA 4th Gen</option>
                            <option value={TestMethod.CLIA}>CLIA Chemiluminescence</option>
                            <option value={TestMethod.NAT}>NAT Nucleic Acid</option>
                            <option value={TestMethod.RAPID}>Rapid Diagnostic Test (RDT)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', color: '#475569', display: 'block', fontWeight: 600 }}>
                            Quantitative / Signal (OD)
                          </label>
                          <input
                            type="text"
                            value={state.result}
                            onChange={(e) =>
                              setTtiResults({
                                ...ttiResults,
                                [t.testCode]: { ...state, result: e.target.value },
                              })
                            }
                            placeholder="e.g. Non-Reactive (0.12 S/CO)"
                            disabled={activeRecord.status === TestingStatus.COMPLETED}
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', color: '#475569', display: 'block', fontWeight: 600 }}>
                            Reagent Kit Lot
                          </label>
                          <input
                            type="text"
                            value={state.kitLotNumber}
                            onChange={(e) =>
                              setTtiResults({
                                ...ttiResults,
                                [t.testCode]: { ...state, kitLotNumber: e.target.value },
                              })
                            }
                            placeholder="e.g. LOT-2026-X"
                            disabled={activeRecord.status === TestingStatus.COMPLETED}
                            style={{
                              width: '100%',
                              padding: '8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px',
                            }}
                          />
                        </div>
                      </div>

                      {/* Repeat / Confirmatory Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          paddingTop: '8px',
                          borderTop: '1px dashed #e2e8f0',
                        }}
                      >
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                          <input
                            type="checkbox"
                            checked={state.isRepeatOrConfirmatory}
                            onChange={(e) =>
                              setTtiResults({
                                ...ttiResults,
                                [t.testCode]: { ...state, isRepeatOrConfirmatory: e.target.checked },
                              })
                            }
                            disabled={activeRecord.status === TestingStatus.COMPLETED}
                          />
                          Repeat / Confirmatory Testing
                        </label>

                        {state.isRepeatOrConfirmatory && (
                          <input
                            type="text"
                            value={state.repeatReason}
                            onChange={(e) =>
                              setTtiResults({
                                ...ttiResults,
                                [t.testCode]: { ...state, repeatReason: e.target.value },
                              })
                            }
                            placeholder="Reason for repeat (e.g. initial gray zone run)"
                            disabled={activeRecord.status === TestingStatus.COMPLETED}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                            }}
                          />
                        )}

                        {activeRecord.status === TestingStatus.IN_PROGRESS && (
                          <button
                            type="button"
                            onClick={() => handleSaveTest(t.testCode)}
                            disabled={savingTestCode === t.testCode}
                            style={{
                              marginLeft: 'auto',
                              padding: '6px 14px',
                              backgroundColor: '#0f172a',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: savingTestCode === t.testCode ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {savingTestCode === t.testCode ? 'Saving...' : `Save ${t.testCode}`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Action Bar for TTI Tab */}
              {!(activeRecord.status === TestingStatus.COMPLETED && !!activeRecord.authorizedBy) && (
                <div
                  style={{
                    marginTop: '24px',
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('grouping')}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    &larr; Back to ABO & Rh
                  </button>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={handleSaveAllTestsAndProceed}
                      disabled={savingAllTests}
                      style={{
                        backgroundColor: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 24px',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: savingAllTests ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                      }}
                    >
                      {savingAllTests ? 'Saving 5 Test Results...' : '💾 Save All 5 Tests & Proceed to Finalize ➔'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Finalize & Release Verification */}
          {activeTab === 'finalize' && (
            <div>
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  marginBottom: '20px',
                }}
              >
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#0f172a' }}>
                  Laboratory Clearance Summary
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>ABO & Rh Group</span>
                    <strong style={{ fontSize: '16px', color: '#dc2626' }}>
                      {activeRecord.bloodGrouping?.confirmedBloodGroup || 'Pending Typing'}
                    </strong>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>TTI Screening Status</span>
                    <strong
                      style={{
                        fontSize: '14px',
                        color: pendingCount > 0 ? '#d97706' : failOrIndeterminateCount > 0 ? '#dc2626' : '#16a34a',
                      }}
                    >
                      {pendingCount > 0
                        ? `${pendingCount} Tests Pending`
                        : failOrIndeterminateCount > 0
                        ? `${failOrIndeterminateCount} Reactive / Indeterminate`
                        : 'All 5 Tests Clear (PASS)'}
                    </strong>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Testing Workflow Status</span>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                      {activeRecord.status} ({activeRecord.decision})
                    </strong>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Supervisor Release</span>
                    <strong
                      style={{
                        fontSize: '13px',
                        color: activeRecord.authorizedBy ? '#16a34a' : '#ea580c',
                      }}
                    >
                      {activeRecord.authorizedBy ? `Authorized by ${activeRecord.authorizedByName}` : 'Awaiting Supervisor Gate'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Already Released to Central Inventory Success Card */}
              {activeRecord.authorizedBy ? (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '2px solid #10b981',
                    borderRadius: '12px',
                    padding: '24px',
                    marginTop: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎉</div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: '#065f46' }}>
                    Blood Unit Successfully Added to Available Inventory!
                  </h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#047857', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Unit <strong>{activeRecord.bloodUnitId?.unitCode}</strong> ({activeRecord.bloodGrouping?.confirmedBloodGroup || activeRecord.bloodUnitId?.bloodGroup}) has passed all 5 mandatory TTI markers and confirmed ABO/Rh grouping. It has been authorized and added to active inventory, ready for cross-matching and clinical issue.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a
                      href="/admin/inventory"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 20px',
                        backgroundColor: '#059669',
                        color: '#ffffff',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '13px',
                        textDecoration: 'none',
                        boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                      }}
                    >
                      📦 View in Central Blood Inventory &rarr;
                    </a>
                    <button
                      type="button"
                      onClick={onClose}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '13px',
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      Close Workspace
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Step A: Finalize Testing (Technician completion & Combined Release) */}
                  {activeRecord.status === TestingStatus.IN_PROGRESS && (
                    <div
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '20px',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#0f172a' }}>
                        Step 1: Laboratory Finalization & Inventory Release
                      </h4>

                      {finalizeError && (
                        <div
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            marginBottom: '14px',
                            fontSize: '13px',
                          }}
                        >
                          ⚠️ {finalizeError}
                        </div>
                      )}

                      {pendingCount > 0 ? (
                        <div>
                          <p style={{ fontSize: '13px', color: '#d97706', margin: '0 0 12px 0' }}>
                            ⚠️ All 5 TTI tests must have conclusive results before this testing record can be finalized. ({pendingCount} pending).
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('tti')}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            &larr; Complete Pending TTI Tests
                          </button>
                        </div>
                      ) : failOrIndeterminateCount > 0 ? (
                        <div>
                          <div
                            style={{
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              padding: '12px',
                              borderRadius: '8px',
                              fontSize: '13px',
                              marginBottom: '12px',
                            }}
                          >
                            ⚠️ One or more infectious markers are Reactive or Indeterminate. Finalizing will mark this
                            blood unit as <strong>REJECTED</strong> and permanently quarantine it. It will NOT be added to available inventory.
                          </div>

                          <div style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                              Mandatory Rejection Reason *
                            </label>
                            <input
                              type="text"
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="e.g. Reactive for HBV HBsAg screening"
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleFinalize}
                            disabled={finalizing || !rejectionReason.trim()}
                            style={{
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 20px',
                              fontWeight: 600,
                              fontSize: '13px',
                              cursor: finalizing || !rejectionReason.trim() ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {finalizing ? 'Finalizing...' : '✕ Finalize Testing as REJECTED (Biohazard Disposal)'}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div
                            style={{
                              backgroundColor: '#f0fdf4',
                              color: '#166534',
                              padding: '12px',
                              borderRadius: '8px',
                              fontSize: '13px',
                              marginBottom: '14px',
                            }}
                          >
                            ✓ All 5 TTI tests passed non-reactive and ABO/Rh grouping is confirmed. Ready to finalize and release to inventory.
                          </div>

                          <div style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                              Final Release Remarks (Optional)
                            </label>
                            <input
                              type="text"
                              value={finalizeRemarks}
                              onChange={(e) => setFinalizeRemarks(e.target.value)}
                              placeholder="e.g. All serology assays verified in duplicate; approved for routine stock"
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleFinalizeAndRelease}
                            disabled={finalizing}
                            style={{
                              backgroundColor: '#059669',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '12px 24px',
                              fontWeight: 700,
                              fontSize: '14px',
                              cursor: finalizing ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.25)',
                            }}
                          >
                            {finalizing
                              ? 'Authorizing & Adding to Inventory...'
                              : isSupervisor
                              ? '🚀 Finalize Testing & Add Blood Unit to Available Inventory'
                              : '✓ Complete Testing as APPROVED'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step B: Supervisor Clinical Release for already completed records */}
                  {activeRecord.status === TestingStatus.COMPLETED &&
                    activeRecord.decision === TestingDecision.APPROVED &&
                    !activeRecord.authorizedBy && (
                      <div
                        style={{
                          border: '2px solid #bbf7d0',
                          borderRadius: '12px',
                          padding: '20px',
                          backgroundColor: '#f0fdf4',
                        }}
                      >
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#166534' }}>
                          Step 2: Medical Supervisor Release Gate
                        </h4>

                        <div>
                          <p style={{ fontSize: '13px', color: '#334155', margin: '0 0 12px 0' }}>
                            As an authorized Supervisor, releasing this unit will make blood unit{' '}
                            <strong>{activeRecord.bloodUnitId?.unitCode}</strong> available in central inventory for cross-matching,
                            reservation, and routine clinical issue.
                          </p>

                          {authError && (
                            <div
                              style={{
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                marginBottom: '12px',
                                fontSize: '13px',
                              }}
                            >
                              ⚠️ {authError}
                            </div>
                          )}

                          <div style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                              Supervisor Authorization Remarks
                            </label>
                            <input
                              type="text"
                              value={authRemarks}
                              onChange={(e) => setAuthRemarks(e.target.value)}
                              placeholder="e.g. Clinically verified and cleared for routine issue"
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleAuthorizeRelease}
                            disabled={authorizing}
                            style={{
                              backgroundColor: '#059669',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '11px 24px',
                              fontWeight: 700,
                              fontSize: '13px',
                              cursor: authorizing ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                            }}
                          >
                            {authorizing ? 'Authorizing Release...' : '🛡️ Authorize Clinical Release to Available Inventory'}
                          </button>
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            {activeTab !== 'grouping' && (
              <button
                type="button"
                onClick={() =>
                  setActiveTab(activeTab === 'finalize' ? 'tti' : 'grouping')
                }
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                &larr; Back
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Close
            </button>

            {activeTab === 'grouping' && (
              <button
                type="button"
                onClick={handleSaveGrouping}
                disabled={savingGrouping}
                style={{
                  padding: '9px 20px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: savingGrouping ? 'not-allowed' : 'pointer',
                }}
              >
                {savingGrouping ? 'Saving...' : 'Save & Next (TTI) ➔'}
              </button>
            )}

            {activeTab === 'tti' && (
              <button
                type="button"
                onClick={handleSaveAllTestsAndProceed}
                disabled={savingAllTests}
                style={{
                  padding: '9px 20px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: savingAllTests ? 'not-allowed' : 'pointer',
                }}
              >
                {savingAllTests ? 'Saving...' : 'Save & Next (Finalize) ➔'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
      </div>
    </div>
  );
}
