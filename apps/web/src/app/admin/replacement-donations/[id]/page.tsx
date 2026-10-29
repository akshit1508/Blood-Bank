'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ReplacementDonation,
  ReplacementTrackingStatus,
  ReplacementWorkflowTrace,
  fetchReplacementDonationById,
  fetchReplacementWorkflowTrace,
  syncReplacementStatus,
  cancelReplacementCase,
  updateReplacementNotes,
  linkDonationToReplacement,
} from '@/lib/replacement-donations-api';
import { fetchDonations, Donation, DonationStatus } from '@/lib/donation-api';
import { getStoredAdmin, AdminUser, AdminRole } from '@/lib/auth-api';

const STATUS_CONFIG: Record<
  ReplacementTrackingStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  [ReplacementTrackingStatus.DONOR_ASSOCIATED]: {
    bg: '#eff6ff',
    text: '#1d4ed8',
    border: '#bfdbfe',
    label: 'Donor Associated',
  },
  [ReplacementTrackingStatus.DONATION_SCHEDULED]: {
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#bbf7d0',
    label: 'Donation Scheduled',
  },
  [ReplacementTrackingStatus.DONATION_IN_PROGRESS]: {
    bg: '#fef3c7',
    text: '#b45309',
    border: '#fde68a',
    label: 'Donation In Progress',
  },
  [ReplacementTrackingStatus.DONATION_COLLECTED]: {
    bg: '#ede9fe',
    text: '#6d28d9',
    border: '#ddd6fe',
    label: 'Donation Collected',
  },
  [ReplacementTrackingStatus.TESTING_PENDING]: {
    bg: '#e0e7ff',
    text: '#4338ca',
    border: '#c7d2fe',
    label: 'Testing & Intake Pending',
  },
  [ReplacementTrackingStatus.RELEASED_TO_INVENTORY]: {
    bg: '#dcfce7',
    text: '#166534',
    border: '#86efac',
    label: 'Released to Inventory',
  },
  [ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED]: {
    bg: '#fee2e2',
    text: '#b91c1c',
    border: '#fca5a5',
    label: 'Deferred / Rejected',
  },
  [ReplacementTrackingStatus.CANCELLED]: {
    bg: '#f3f4f6',
    text: '#4b5563',
    border: '#d1d5db',
    label: 'Case Cancelled',
  },
};

type ProgressStatus = 'Completed' | 'In Progress' | 'Pending' | 'Blocked' | 'Rejected / Deferred' | 'Not Applicable';

interface CompactWorkflowStage {
  number: number;
  title: string;
  status: ProgressStatus;
  statusColor: { bg: string; text: string; border: string };
  explanation: string;
  actionLabel?: string;
  actionHref?: string;
  onActionClick?: () => void;
  canAct?: boolean;
}

interface OtherWorkflowAction {
  label: string;
  href: string;
  note?: string;
}

export default function ReplacementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [record, setRecord] = useState<ReplacementDonation | null>(null);
  const [trace, setTrace] = useState<ReplacementWorkflowTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Expandable sections toggle state (Section D)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    donatedUnit: false,
    issuedUnit: false,
    billing: false,
    notes: false,
    timeline: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Notes editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Link physical donation modal state (Phase 3 user-friendly selector)
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [donorDonations, setDonorDonations] = useState<Donation[]>([]);
  const [loadingDonations, setLoadingDonations] = useState(false);
  const [donationFetchError, setDonationFetchError] = useState<string | null>(null);
  const [selectedDonationId, setSelectedDonationId] = useState<string>('');
  const [donationSearchQuery, setDonationSearchQuery] = useState('');
  const [linkingDonation, setLinkingDonation] = useState(false);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    setAdminUser(getStoredAdmin());
  }, []);

  const loadRecord = useCallback(
    async (showSpinner = true) => {
      if (!id) return;
      try {
        if (showSpinner) setLoading(true);
        setError(null);
        const [data, traceData] = await Promise.all([
          fetchReplacementDonationById(id),
          fetchReplacementWorkflowTrace(id).catch(() => null),
        ]);
        setRecord(data);
        setTrace(traceData);
        setNotesValue(data.notes || '');
      } catch (err: any) {
        setError(err.message || 'Failed to load replacement tracking case');
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    loadRecord(true);
  }, [loadRecord]);

  // Window Focus & Visibility Change: Auto-refresh data on return from other modules
  useEffect(() => {
    const handleRefresh = () => {
      loadRecord(false);
    };

    window.addEventListener('focus', handleRefresh);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadRecord]);

  // Load eligible donations when link modal opens
  const loadEligibleDonations = useCallback(async () => {
    if (!record?.donorId) return;
    try {
      setLoadingDonations(true);
      setDonationFetchError(null);
      setSelectedDonationId('');
      setDonationSearchQuery('');
      const res = await fetchDonations({ donorId: record.donorId, limit: 50 });
      setDonorDonations(res.items || []);
    } catch (err: any) {
      setDonationFetchError(err.message || 'Failed to retrieve donor donation records');
    } finally {
      setLoadingDonations(false);
    }
  }, [record?.donorId]);

  useEffect(() => {
    if (showLinkModal) {
      loadEligibleDonations();
    }
  }, [showLinkModal, loadEligibleDonations]);

  const handleSync = async () => {
    if (!id) return;
    try {
      setSyncing(true);
      const updated = await syncReplacementStatus(id);
      setRecord(updated);
      const traceData = await fetchReplacementWorkflowTrace(id).catch(() => null);
      setTrace(traceData);
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    try {
      setSavingNotes(true);
      const updated = await updateReplacementNotes(id, notesValue);
      setRecord(updated);
      setIsEditingNotes(false);
    } catch (err: any) {
      alert(`Failed to save notes: ${err.message}`);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleConfirmLinkDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedDonationId) return;
    try {
      setLinkingDonation(true);
      const updated = await linkDonationToReplacement(id, {
        donationId: selectedDonationId,
      });
      setRecord(updated);
      setShowLinkModal(false);
      setSelectedDonationId('');
      const traceData = await fetchReplacementWorkflowTrace(id).catch(() => null);
      setTrace(traceData);
    } catch (err: any) {
      alert(`Failed to link donation: ${err.message}`);
    } finally {
      setLinkingDonation(false);
    }
  };

  const handleCancelCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !cancelReason.trim()) return;
    try {
      setCancelling(true);
      const updated = await cancelReplacementCase(id, {
        cancellationReason: cancelReason.trim(),
      });
      setRecord(updated);
      setShowCancelModal(false);
      const traceData = await fetchReplacementWorkflowTrace(id).catch(() => null);
      setTrace(traceData);
    } catch (err: any) {
      alert(`Failed to cancel case: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  // Role permissions
  const userRole = adminUser?.role as AdminRole | undefined;
  const isSuperAdminOrAdmin = userRole === AdminRole.SUPER_ADMIN || userRole === AdminRole.ADMIN;
  const isLabStaff = isSuperAdminOrAdmin || userRole === AdminRole.LAB_TECHNICIAN;
  const isFinanceStaff = isSuperAdminOrAdmin || userRole === AdminRole.FINANCE_RECEPTIONIST;

  // Filtered donor donations inside link modal
  const filteredDonations = useMemo(() => {
    if (!donationSearchQuery.trim()) return donorDonations;
    const q = donationSearchQuery.toLowerCase().trim();
    return donorDonations.filter(
      (d) =>
        d.donationCode?.toLowerCase().includes(q) ||
        d.donationType?.toLowerCase().includes(q) ||
        d.status?.toLowerCase().includes(q),
    );
  }, [donorDonations, donationSearchQuery]);

  // Return query parameter to preserve replacement case context across modules
  const returnToParam = record ? `&returnTo=/admin/replacement-donations/${record._id}` : '';

  // Core status resolutions across all sections
  const unitStatus = trace?.relativeDonation?.unitStatus || (record as any)?.unitStatus;
  const testingDecision = (trace?.relativeDonation as any)?.testingDecision;
  const isTestingPassed = testingDecision === 'APPROVED' || unitStatus === 'APPROVED';
  const isTestingRejected = testingDecision === 'REJECTED' || unitStatus === 'REJECTED';
  const isReleased =
    Boolean(trace?.relativeDonation?.isReleasedToInventory) ||
    record?.status === ReplacementTrackingStatus.RELEASED_TO_INVENTORY;

  // -------------------------------------------------------------
  // SECTION C: COMPACT FIVE-STAGE PROGRESS LIST
  // -------------------------------------------------------------
  const workflowStages = useMemo<CompactWorkflowStage[]>(() => {
    if (!record) return [];

    const isCancelled = record.status === ReplacementTrackingStatus.CANCELLED;
    const isDeferred = record.status === ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED;

    const cmStatus = trace?.crossmatching?.status || record.crossmatchStatus;
    const isAuthorized = Boolean(trace?.crossmatching?.isAuthorized);
    const hasIssue = Boolean(record.issueCode || trace?.bloodIssue?.issueCode || record.issuedUnitCode);
    const paymentStatus = trace?.payment?.status || record.paymentStatus;
    const hasInvoice = Boolean(record.invoiceNumber || trace?.payment?.invoiceNumber);
    const isPaid = paymentStatus === 'PAID' || paymentStatus === 'WAIVED';

    // Strict sequential prerequisites
    const s1IsCompleted = Boolean(record.donationCode);
    const s2IsCompleted = isReleased;
    const s3IsCompleted = isAuthorized || cmStatus === 'RESERVED' || cmStatus === 'ISSUED';
    const s4IsCompleted = hasIssue;
    const s5IsCompleted = isPaid;

    // 1. Donor & Physical Donation
    let s1Status: ProgressStatus = 'Pending';
    let s1Color = { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    let s1Explanation = 'Awaiting physical blood collection in phlebotomy room.';
    let s1ActionLabel: string | undefined = undefined;
    let s1ActionHref: string | undefined = undefined;
    let s1OnClick: (() => void) | undefined = undefined;

    if (isCancelled && !s1IsCompleted) {
      s1Status = 'Not Applicable';
      s1Explanation = 'Case cancelled before donation took place.';
    } else if (isDeferred && !s1IsCompleted) {
      s1Status = 'Rejected / Deferred';
      s1Color = { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
      s1Explanation = 'Relative donor deferred during health screening.';
    } else if (s1IsCompleted) {
      s1Status = 'Completed';
      s1Color = { bg: '#dcfce7', text: '#166534', border: '#86efac' };
      s1Explanation = `Donation ${record.donationCode} recorded.`;
      s1ActionLabel = 'View Donation';
      s1ActionHref = `/admin/donations?search=${encodeURIComponent(record.donorCode)}${returnToParam}`;
    } else {
      s1Status = 'In Progress';
      s1Color = { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      s1Explanation = 'Donor linked. Awaiting blood draw recording.';
      s1ActionLabel = '+ Link Physical Donation';
      s1OnClick = () => setShowLinkModal(true);
    }

    // 2. Laboratory Testing & Inventory Release
    let s2Status: ProgressStatus = 'Pending';
    let s2Color = { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    let s2Explanation = 'Waiting for Step 1: Donor blood collection must be completed first.';
    let s2ActionLabel: string | undefined = undefined;
    let s2ActionHref: string | undefined = undefined;

    if (isCancelled && !s2IsCompleted) {
      s2Status = 'Not Applicable';
      s2Explanation = 'Not reached before case cancellation.';
    } else if (!s1IsCompleted) {
      s2Status = 'Pending';
      s2Explanation = 'Waiting for Step 1: Donor blood collection must be recorded first.';
    } else if (s2IsCompleted) {
      s2Status = 'Completed';
      s2Color = { bg: '#dcfce7', text: '#166534', border: '#86efac' };
      s2Explanation = `Unit ${record.unitCode || ''} tested (PASS / APPROVED) and released to active hospital inventory.`;
      s2ActionLabel = 'View Inventory';
      s2ActionHref = `/admin/inventory?returnTo=/admin/replacement-donations/${record._id}`;
    } else if (isTestingPassed) {
      s2Status = 'In Progress';
      s2Color = { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
      s2Explanation = 'Testing PASSED (All safety tests negative). Awaiting supervisor approval for inventory release.';
      if (isSuperAdminOrAdmin) {
        s2ActionLabel = 'Review & Authorize Release';
        s2ActionHref = `/admin/testing?bloodUnitId=${encodeURIComponent(record.bloodUnitId || '')}${returnToParam}`;
      }
    } else if (isTestingRejected || isDeferred) {
      s2Status = 'Rejected / Deferred';
      s2Color = { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
      s2Explanation = 'Unit tested reactive or failed lab criteria. Quarantined for safe disposal.';
    } else {
      s2Status = 'In Progress';
      s2Color = { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      s2Explanation = 'Mandatory infectious marker and ABO/Rh screening underway in laboratory.';
      if (isLabStaff) {
        s2ActionLabel = 'Open Laboratory Testing';
        s2ActionHref = userRole === AdminRole.LAB_TECHNICIAN
          ? `/lab/testing?unitId=${encodeURIComponent(record.bloodUnitId || '')}${returnToParam}`
          : `/admin/testing?bloodUnitId=${encodeURIComponent(record.bloodUnitId || '')}&donationId=${encodeURIComponent(record.donationCode || '')}${returnToParam}`;
      }
    }

    // 3. Patient Crossmatching
    let s3Status: ProgressStatus = 'Pending';
    let s3Color = { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    let s3Explanation = 'Waiting for Step 2: Relative donation testing & inventory release must be completed first.';
    let s3ActionLabel: string | undefined = undefined;
    let s3ActionHref: string | undefined = undefined;

    if (isCancelled && !s3IsCompleted) {
      s3Status = 'Not Applicable';
      s3Explanation = 'Not reached before case cancellation.';
    } else if (!s2IsCompleted) {
      s3Status = 'Pending';
      s3Explanation = 'Waiting for Step 2: Relative donation testing & inventory release must be completed first.';
    } else if (s3IsCompleted) {
      s3Status = 'Completed';
      s3Color = { bg: '#dcfce7', text: '#166534', border: '#86efac' };
      s3Explanation = `Compatible unit (${trace?.crossmatching?.selectedInventoryUnit || 'assigned'}) authorized for patient.`;
      if (record.crossmatchId || trace?.crossmatching?.crossmatchId) {
        s3ActionLabel = 'Open Crossmatch Record';
        s3ActionHref = `/admin/crossmatching/${record.crossmatchId || trace?.crossmatching?.crossmatchId}?returnTo=/admin/replacement-donations/${record._id}`;
      }
    } else if (trace?.crossmatching?.compatibilityResult === 'INCOMPATIBLE') {
      s3Status = 'Blocked';
      s3Color = { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
      s3Explanation = 'Selected unit test was incompatible with patient. Another unit must be selected.';
      if (isLabStaff) {
        s3ActionLabel = 'Open Crossmatch Order';
        s3ActionHref = `/admin/crossmatching/${record.crossmatchId || trace?.crossmatching?.crossmatchId}?returnTo=/admin/replacement-donations/${record._id}`;
      }
    } else if (cmStatus && cmStatus !== 'NOT_STARTED') {
      s3Status = 'In Progress';
      s3Color = { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      s3Explanation = `Crossmatch order status: ${cmStatus}. Compatibility testing underway.`;
      if (isLabStaff && (record.crossmatchId || trace?.crossmatching?.crossmatchId)) {
        s3ActionLabel = 'Open Crossmatch Order';
        s3ActionHref = `/admin/crossmatching/${record.crossmatchId || trace?.crossmatching?.crossmatchId}?returnTo=/admin/replacement-donations/${record._id}`;
      }
    } else {
      s3Status = 'In Progress';
      s3Color = { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      s3Explanation = 'Ready for patient compatibility crossmatch.';
      if (isLabStaff) {
        s3ActionLabel = 'Initiate Crossmatch';
        s3ActionHref = `/admin/crossmatching?search=${encodeURIComponent(record.requestCode)}${returnToParam}`;
      }
    }

    // 4. Patient Blood Issue
    let s4Status: ProgressStatus = 'Pending';
    let s4Color = { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    let s4Explanation = 'Waiting for Step 3: Patient crossmatching & authorization must be completed first.';
    let s4ActionLabel: string | undefined = undefined;
    let s4ActionHref: string | undefined = undefined;

    if (isCancelled && !s4IsCompleted) {
      s4Status = 'Not Applicable';
      s4Explanation = 'Not reached before case cancellation.';
    } else if (!s3IsCompleted) {
      s4Status = 'Pending';
      s4Explanation = 'Waiting for Step 3: Patient crossmatching & authorization must be completed first.';
    } else if (s4IsCompleted) {
      s4Status = 'Completed';
      s4Color = { bg: '#dcfce7', text: '#166534', border: '#86efac' };
      s4Explanation = `Unit ${record.issuedUnitCode || trace?.bloodIssue?.issuedUnits?.[0]?.unitCode || ''} issued under ${record.issueCode || trace?.bloodIssue?.issueCode || ''}. Inventory deducted.`;
      s4ActionLabel = 'View Blood Request';
      s4ActionHref = `/admin/blood-requests?requestId=${encodeURIComponent(record.bloodRequestId)}&requestCode=${encodeURIComponent(record.requestCode)}${returnToParam}`;
    } else {
      s4Status = 'In Progress';
      s4Color = { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      s4Explanation = 'Compatible unit is reserved & authorized. Ready for physical dispensing.';
      if (isSuperAdminOrAdmin) {
        s4ActionLabel = 'Open Blood Issue';
        s4ActionHref = record.crossmatchId
          ? `/admin/crossmatching/${record.crossmatchId}?returnTo=/admin/replacement-donations/${record._id}`
          : `/admin/blood-requests?requestId=${encodeURIComponent(record.bloodRequestId)}&requestCode=${encodeURIComponent(record.requestCode)}${returnToParam}`;
      }
    }

    // 5. Billing & Payment
    let s5Status: ProgressStatus = 'Pending';
    let s5Color = { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    let s5Explanation = 'Waiting for Step 4: Blood must be issued to patient before final billing.';
    let s5ActionLabel: string | undefined = undefined;
    let s5ActionHref: string | undefined = undefined;

    if (isCancelled && !s5IsCompleted) {
      s5Status = 'Not Applicable';
      s5Explanation = 'Not reached before case cancellation.';
    } else if (!s4IsCompleted) {
      s5Status = 'Pending';
      s5Explanation = 'Waiting for Step 4: Blood must be issued to patient before final billing.';
    } else if (paymentStatus === 'PAID') {
      s5Status = 'Completed';
      s5Color = { bg: '#dcfce7', text: '#166534', border: '#86efac' };
      s5Explanation = 'Invoice settled in full. Official receipt recorded.';
      if (isFinanceStaff) {
        s5ActionLabel = 'Open Billing Desk';
        s5ActionHref = `/admin/finance/billing?search=${encodeURIComponent(record.invoiceNumber || record.issueCode || '')}${returnToParam}`;
      }
    } else if (paymentStatus === 'WAIVED') {
      s5Status = 'Completed';
      s5Color = { bg: '#dcfce7', text: '#166534', border: '#86efac' };
      s5Explanation = '100% concession/waiver approved by medical administration.';
      if (isFinanceStaff) {
        s5ActionLabel = 'Open Billing Desk';
        s5ActionHref = `/admin/finance/billing?search=${encodeURIComponent(record.invoiceNumber || record.issueCode || '')}${returnToParam}`;
      }
    } else if (hasInvoice) {
      s5Status = 'In Progress';
      s5Color = { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      s5Explanation = `Invoice generated; outstanding balance: ₹${record.invoiceBalanceDue ?? trace?.payment?.balanceDue ?? 0}.`;
      if (isFinanceStaff) {
        s5ActionLabel = 'Open Billing Desk';
        s5ActionHref = `/admin/finance/billing?search=${encodeURIComponent(record.invoiceNumber || record.issueCode || '')}${returnToParam}`;
      }
    } else if (hasIssue) {
      s5Status = 'In Progress';
      s5Color = { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      s5Explanation = 'Blood issued; invoice pending generation at finance cashier.';
      if (isFinanceStaff) {
        s5ActionLabel = 'Open Billing Desk';
        s5ActionHref = `/admin/finance/billing?search=${encodeURIComponent(record.issueCode || '')}${returnToParam}`;
      }
    }

    return [
      {
        number: 1,
        title: 'Donor & Physical Donation',
        status: s1Status,
        statusColor: s1Color,
        explanation: s1Explanation,
        actionLabel: s1ActionLabel,
        actionHref: s1ActionHref,
        onActionClick: s1OnClick,
        canAct: isSuperAdminOrAdmin,
      },
      {
        number: 2,
        title: 'Laboratory Testing & Inventory Release',
        status: s2Status,
        statusColor: s2Color,
        explanation: s2Explanation,
        actionLabel: s2ActionLabel,
        actionHref: s2ActionHref,
        canAct: isLabStaff,
      },
      {
        number: 3,
        title: 'Patient Crossmatching',
        status: s3Status,
        statusColor: s3Color,
        explanation: s3Explanation,
        actionLabel: s3ActionLabel,
        actionHref: s3ActionHref,
        canAct: isLabStaff,
      },
      {
        number: 4,
        title: 'Patient Blood Issue',
        status: s4Status,
        statusColor: s4Color,
        explanation: s4Explanation,
        actionLabel: s4ActionLabel,
        actionHref: s4ActionHref,
        canAct: isSuperAdminOrAdmin,
      },
      {
        number: 5,
        title: 'Billing & Payment',
        status: s5Status,
        statusColor: s5Color,
        explanation: s5Explanation,
        actionLabel: s5ActionLabel,
        actionHref: s5ActionHref,
        canAct: isFinanceStaff,
      },
    ];
  }, [record, trace, userRole, isSuperAdminOrAdmin, isLabStaff, isFinanceStaff, returnToParam, isReleased, isTestingPassed, isTestingRejected]);

  // -------------------------------------------------------------
  // SECTION B: WHAT NEEDS TO HAPPEN NEXT? (MOST PROMINENT)
  // -------------------------------------------------------------
  const nextPendingAction = useMemo(() => {
    if (!record) return null;

    const emptyOtherActions: OtherWorkflowAction[] = [];

    if (record.status === ReplacementTrackingStatus.CANCELLED) {
      return {
        title: 'Tracking Cancelled',
        explanation: `This replacement case was cancelled (${record.cancellationReason || 'No reason provided'}). The original patient requisition remains active and independent.`,
        responsibleRole: undefined,
        primaryButton: {
          label: 'View Case Audit',
          type: 'EXPAND_AUDIT' as const,
        },
        otherActions: emptyOtherActions,
      };
    }

    const cmStatus = trace?.crossmatching?.status || record.crossmatchStatus;
    const isAuthorized = Boolean(trace?.crossmatching?.isAuthorized);
    const hasIssue = Boolean(record.issueCode || trace?.bloodIssue?.issueCode || record.issuedUnitCode);
    const paymentStatus = trace?.payment?.status || record.paymentStatus;
    const isPaid = paymentStatus === 'PAID' || paymentStatus === 'WAIVED';

    const s1IsCompleted = Boolean(record.donationCode);
    const s2IsCompleted = isReleased;
    const s3IsCompleted = isAuthorized || cmStatus === 'RESERVED' || cmStatus === 'ISSUED';
    const s4IsCompleted = hasIssue;
    const s5IsCompleted = isPaid;

    // Strict sequential evaluation (Stage 1 -> 2 -> 3 -> 4 -> 5)
    // 1. Step 1: Physical donation missing
    if (!s1IsCompleted) {
      return {
        title: 'Step 1: Link Physical Donation',
        explanation: `Relative donor ${record.donorName} (${record.donorCode}) is registered. Select and link their completed donation record to start laboratory processing.`,
        responsibleRole: 'Phlebotomy / Reception Staff',
        primaryButton: {
          label: 'Link Physical Donation',
          type: 'MODAL' as const,
          canAct: isSuperAdminOrAdmin,
          reason: 'Receptionist or Administrator role required.',
        },
        otherActions: emptyOtherActions,
      };
    }

    // 2. Step 2: Donation linked but testing or inventory release pending
    if (!s2IsCompleted) {
      if (!isTestingPassed) {
        return {
          title: 'Step 2: Complete Laboratory Testing',
          explanation: `Physical donation ${record.donationCode} was recorded. Complete mandatory infectious disease screening (HIV, HBsAg, HCV, Syphilis, Malaria) and ABO confirmation.`,
          responsibleRole: 'Laboratory Technician',
          primaryButton: {
            label: 'Open Laboratory Testing',
            type: 'NAVIGATE' as const,
            href: userRole === AdminRole.LAB_TECHNICIAN
              ? `/lab/testing?unitId=${encodeURIComponent(record.bloodUnitId || '')}${returnToParam}`
              : `/admin/testing?bloodUnitId=${encodeURIComponent(record.bloodUnitId || '')}&donationId=${encodeURIComponent(record.donationCode || '')}${returnToParam}`,
            canAct: isLabStaff,
            reason: 'Lab Technician or Administrator role required.',
          },
          otherActions: emptyOtherActions,
        };
      } else {
        return {
          title: 'Step 2: Review & Authorize Release',
          explanation: `Testing PASSED (Approved). Awaiting supervisor authorization to release blood unit ${record.unitCode || ''} to available hospital inventory.`,
          responsibleRole: 'Laboratory Supervisor / Quality Manager',
          primaryButton: {
            label: 'Review & Authorize Release',
            type: 'NAVIGATE' as const,
            href: `/admin/testing?bloodUnitId=${encodeURIComponent(record.bloodUnitId || '')}${returnToParam}`,
            canAct: isSuperAdminOrAdmin,
            reason: 'You are signed in as Lab Technician. Only a Supervisor or Admin can authorize release to inventory.',
          },
          otherActions: emptyOtherActions,
        };
      }
    }

    // 3. Step 3: Donation released, complete patient crossmatch
    if (!s3IsCompleted) {
      return {
        title: 'Step 3: Complete Patient Crossmatching',
        explanation: `Relative donation is released to stock. Complete compatibility crossmatching for patient ${record.patientName} (${record.patientBloodGroup.replace('_', ' ')}).`,
        responsibleRole: 'Transfusion Officer / Lab Technician',
        primaryButton: {
          label: 'Open Crossmatching',
          type: 'NAVIGATE' as const,
          href: record.crossmatchId
            ? `/admin/crossmatching/${record.crossmatchId}?returnTo=/admin/replacement-donations/${record._id}`
            : `/admin/crossmatching?search=${encodeURIComponent(record.requestCode)}${returnToParam}`,
          canAct: isLabStaff,
          reason: 'Transfusion Officer or Lab Technician role required.',
        },
        otherActions: emptyOtherActions,
      };
    }

    // 4. Step 4: Crossmatch authorized and reservation valid -> Blood issue
    if (!s4IsCompleted) {
      return {
        title: 'Step 4: Dispense & Issue Blood to Patient',
        explanation: `Compatible unit is authorized and reserved for patient ${record.patientName}. Proceed to dispense the unit and deduct inventory.`,
        responsibleRole: 'Blood Bank Issuing Officer',
        primaryButton: {
          label: 'Open Blood Issue',
          type: 'NAVIGATE' as const,
          href: record.crossmatchId
            ? `/admin/crossmatching/${record.crossmatchId}?returnTo=/admin/replacement-donations/${record._id}`
            : `/admin/blood-requests?requestId=${encodeURIComponent(record.bloodRequestId)}&requestCode=${encodeURIComponent(record.requestCode)}${returnToParam}`,
          canAct: isSuperAdminOrAdmin,
          reason: 'Issuing Officer or Administrator role required.',
        },
        otherActions: emptyOtherActions,
      };
    }

    // 5. Step 5: Patient unit issued and invoice payment outstanding
    if (!s5IsCompleted) {
      return {
        title: 'Step 5: Finalize Billing & Payment',
        explanation: `Blood unit was dispensed under issue ${record.issueCode || ''}. Collect payment or record authorized fee waiver at the billing desk.`,
        responsibleRole: 'Finance Cashier / Receptionist',
        primaryButton: {
          label: 'Open Billing Desk',
          type: 'NAVIGATE' as const,
          href: `/admin/finance/billing?search=${encodeURIComponent(record.invoiceNumber || record.issueCode || '')}${returnToParam}`,
          canAct: isFinanceStaff,
          reason: 'Finance Cashier, Receptionist, or Administrator role required.',
        },
        otherActions: emptyOtherActions,
      };
    }

    // 6. All steps complete
    return {
      title: 'Workflow Completed',
      explanation: 'All five stages (Donation, Lab Testing, Inventory Release, Patient Crossmatch, Blood Issue, and Billing) have been successfully completed.',
      responsibleRole: undefined,
      primaryButton: {
        label: 'View Completed Case Details',
        type: 'EXPAND_ALL' as const,
        canAct: true,
      },
      otherActions: emptyOtherActions,
    };
  }, [record, trace, userRole, isSuperAdminOrAdmin, isLabStaff, isFinanceStaff, returnToParam, isReleased, isTestingPassed]);

  if (loading) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '16px' }} />
        <p style={{ fontSize: '15px', fontWeight: '500' }}>Loading replacement case details...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ padding: '24px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '12px', border: '1px solid #fecaca' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 8px 0' }}>Case Not Found</h2>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>{error || 'Unable to retrieve tracking record.'}</p>
          <Link
            href="/admin/replacement-donations"
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '13px',
              display: 'inline-block',
            }}
          >
            &larr; Back to Replacement Tracking
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[record.status] || {
    bg: '#f1f5f9',
    text: '#475569',
    border: '#cbd5e1',
    label: record.status,
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1080px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
        <Link href="/admin/replacement-donations" style={{ color: '#64748b', textDecoration: 'none' }}>
          Replacement Donations
        </Link>
        <span>/</span>
        <span style={{ color: '#0f172a', fontWeight: '600', fontFamily: 'monospace' }}>{record.trackingCode}</span>
      </div>

      {/* ========================================================= */}
      {/* SECTION A: CASE SUMMARY (CLEAN & CONCISE)                */}
      {/* ========================================================= */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          padding: '20px 24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                Case ID: <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#0f172a' }}>{record.trackingCode}</span>
              </span>
              <span style={{ color: '#cbd5e1' }}>&bull;</span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: '700',
                  backgroundColor: statusInfo.bg,
                  color: statusInfo.text,
                  border: `1px solid ${statusInfo.border}`,
                }}
              >
                {statusInfo.label}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                Patient: {record.patientName}{' '}
                <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: '4px', fontSize: '13px', fontWeight: '800' }}>
                  {record.patientBloodGroup.replace('_', ' ')}
                </span>
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b', marginLeft: '6px' }}>
                  (Req: {record.requestCode} &bull; {(trace?.patientRequest?.requestedComponent || 'WHOLE_BLOOD').replace(/_/g, ' ')})
                </span>
              </div>
            </div>

            <div style={{ fontSize: '14px', color: '#475569', marginTop: '4px' }}>
              Relative Donor: <strong style={{ color: '#0f172a' }}>{record.donorName}</strong>{' '}
              <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: '800' }}>
                {record.donorBloodGroup.replace('_', ' ')}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>
                ({record.relationshipToPatient})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {record.donationCode && (
                <span style={{ fontSize: '12px', color: '#475569', fontWeight: '500' }}>
                  Donation: <strong style={{ fontFamily: 'monospace' }}>{record.donationCode}</strong>
                  {record.unitCode && (
                    <span> (Unit: <strong style={{ fontFamily: 'monospace', color: '#166534' }}>{record.unitCode}</strong>)</span>
                  )}
                </span>
              )}

              {isTestingPassed ? (
                <span style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                  Testing: PASSED ✓
                </span>
              ) : isTestingRejected ? (
                <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                  Testing: REJECTED ✗
                </span>
              ) : record.donationCode ? (
                <span style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                  Testing: IN PROGRESS
                </span>
              ) : null}

              {isReleased && (
                <span style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                  Stock: RELEASED ✓
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleSync}
              disabled={syncing || record.status === ReplacementTrackingStatus.CANCELLED}
              title="Synchronize status from hospital records"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#334155',
                cursor: syncing ? 'not-allowed' : 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: syncing ? 'spin 0.8s linear infinite' : 'none' }}>
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              {syncing ? 'Syncing...' : 'Refresh'}
            </button>

            {record.status !== ReplacementTrackingStatus.CANCELLED && (
              <button
                onClick={() => setShowCancelModal(true)}
                style={{
                  padding: '7px 12px',
                  backgroundColor: '#ffffff',
                  color: '#b91c1c',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel Tracking
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION B: WHAT NEEDS TO HAPPEN NEXT? (MOST PROMINENT)    */}
      {/* ========================================================= */}
      {nextPendingAction && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '2px solid #2563eb',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(37,99,235,0.08)',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ flex: '1 1 540px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    padding: '3px 8px',
                    borderRadius: '4px',
                  }}
                >
                  What Needs to Happen Next?
                </span>
                {nextPendingAction.responsibleRole && (
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                    Responsible: <strong style={{ color: '#0f172a' }}>{nextPendingAction.responsibleRole}</strong>
                  </span>
                )}
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
                {nextPendingAction.title}
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>
                {nextPendingAction.explanation}
              </p>

              {/* Role restriction explanation if current user cannot act */}
              {nextPendingAction.primaryButton.canAct === false && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#92400e',
                  }}
                >
                  <strong>Role Requirement:</strong> {nextPendingAction.primaryButton.reason}
                </div>
              )}

              {/* Parallel actions notice */}
              {nextPendingAction.otherActions.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Also Available:</span>
                  {nextPendingAction.otherActions.map((oa, idx) => (
                    <Link
                      key={idx}
                      href={oa.href}
                      title={oa.note}
                      style={{
                        fontSize: '12px',
                        color: '#2563eb',
                        fontWeight: '600',
                        textDecoration: 'none',
                        backgroundColor: '#f8fafc',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                      }}
                    >
                      {oa.label} &rarr;
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Prominent Primary Action Button */}
            <div style={{ flexShrink: 0, alignSelf: 'center' }}>
              {nextPendingAction.primaryButton.type === 'MODAL' ? (
                <button
                  onClick={() => setShowLinkModal(true)}
                  disabled={nextPendingAction.primaryButton.canAct === false}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: nextPendingAction.primaryButton.canAct !== false ? '#dc2626' : '#cbd5e1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: nextPendingAction.primaryButton.canAct !== false ? 'pointer' : 'not-allowed',
                    boxShadow: nextPendingAction.primaryButton.canAct !== false ? '0 2px 6px rgba(220,38,38,0.25)' : 'none',
                  }}
                >
                  {nextPendingAction.primaryButton.label}
                </button>
              ) : nextPendingAction.primaryButton.type === 'NAVIGATE' && nextPendingAction.primaryButton.href ? (
                nextPendingAction.primaryButton.canAct !== false ? (
                  <Link
                    href={nextPendingAction.primaryButton.href}
                    style={{
                      display: 'inline-block',
                      padding: '12px 24px',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '700',
                      textDecoration: 'none',
                      boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                    }}
                  >
                    {nextPendingAction.primaryButton.label} &rarr;
                  </Link>
                ) : (
                  <button
                    disabled
                    title={nextPendingAction.primaryButton.reason}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#f1f5f9',
                      color: '#94a3b8',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'not-allowed',
                    }}
                  >
                    {nextPendingAction.primaryButton.label}
                  </button>
                )
              ) : (
                <button
                  onClick={() => {
                    setExpandedSections({
                      donatedUnit: true,
                      issuedUnit: true,
                      billing: true,
                      notes: true,
                      timeline: true,
                    });
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  {nextPendingAction.primaryButton.label}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION C: COMPACT FIVE-STAGE WORKFLOW PROGRESS           */}
      {/* ========================================================= */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          padding: '20px 24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          marginBottom: '24px',
        }}
      >
        <div style={{ marginBottom: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 2px 0' }}>
            Workflow Progress
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
            Five-stage lifecycle from relative donor intake to patient blood issue and billing.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {workflowStages.map((stage) => {
            const isCompleted = stage.status === 'Completed';

            return (
              <div
                key={stage.number}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 400px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: isCompleted ? '#16a34a' : '#cbd5e1',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: '800',
                      flexShrink: 0,
                    }}
                  >
                    {isCompleted ? '✓' : stage.number}
                  </span>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{stage.title}</strong>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: stage.statusColor.bg,
                          color: stage.statusColor.text,
                          border: `1px solid ${stage.statusColor.border}`,
                        }}
                      >
                        {stage.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                      {stage.explanation}
                    </div>
                  </div>
                </div>

                {stage.actionLabel && (
                  <div>
                    {stage.actionHref ? (
                      <Link
                        href={stage.actionHref}
                        style={{
                          fontSize: '12px',
                          color: '#2563eb',
                          fontWeight: '600',
                          textDecoration: 'none',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {stage.actionLabel} &rarr;
                      </Link>
                    ) : stage.onActionClick ? (
                      <button
                        onClick={stage.onActionClick}
                        style={{
                          fontSize: '12px',
                          color: '#dc2626',
                          fontWeight: '600',
                          background: '#ffffff',
                          border: '1px solid #fca5a5',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {stage.actionLabel}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION D: ADDITIONAL DETAILS (EXPANDABLE SECTIONS)        */}
      {/* ========================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Additional Details & Technical History
        </div>

        {/* 1. Donated Blood Unit Details */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <button
            onClick={() => toggleSection('donatedUnit')}
            style={{
              width: '100%',
              padding: '14px 18px',
              backgroundColor: '#f8fafc',
              border: 'none',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              color: '#0f172a',
            }}
          >
            <span>Donated Blood Unit Details (Relative Contribution)</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{expandedSections.donatedUnit ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {expandedSections.donatedUnit && (
            <div style={{ padding: '16px 18px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Donor:</span>
                  <strong>{record.donorName}</strong> ({record.donorCode})
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Donation Code:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{record.donationCode || 'Not collected'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Donated Blood Unit:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '600', color: record.unitCode ? '#166534' : '#64748b' }}>
                    {record.unitCode || 'Pending lab processing'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Laboratory Testing:</span>
                  <strong style={{ color: isTestingPassed ? '#166534' : isTestingRejected ? '#991b1b' : '#0f172a' }}>
                    {isTestingPassed ? 'PASS / APPROVED ✓' : isTestingRejected ? 'REJECTED ✗' : (record.unitCode ? 'Screening In Progress' : 'Pending')}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Supervisor Release:</span>
                  <strong style={{ color: isReleased ? '#166534' : '#0f172a' }}>
                    {isReleased ? 'Authorized & Released to Inventory ✓' : (isTestingPassed ? 'Testing Passed — Awaiting Supervisor Sign-off' : 'Awaiting Test Clearance')}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Stock Destination:</span>
                  <span>General Hospital Stock (For any compatible recipient)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Patient-Issued Blood Unit Details */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <button
            onClick={() => toggleSection('issuedUnit')}
            style={{
              width: '100%',
              padding: '14px 18px',
              backgroundColor: '#f8fafc',
              border: 'none',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              color: '#0f172a',
            }}
          >
            <span>Patient-Issued Blood Unit Details (Clinical Fulfillment)</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{expandedSections.issuedUnit ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {expandedSections.issuedUnit && (
            <div style={{ padding: '16px 18px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Recipient Patient:</span>
                  <strong>{record.patientName}</strong> (Req: {record.requestCode})
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Crossmatch Order ID:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{record.crossmatchId || trace?.crossmatching?.crossmatchId || 'Pending'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Compatibility Result:</span>
                  <strong>{trace?.crossmatching?.compatibilityResult || 'PENDING'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Issued Unit Code:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '600', color: record.issuedUnitCode ? '#166534' : '#64748b' }}>
                    {record.issuedUnitCode || trace?.bloodIssue?.issuedUnits?.[0]?.unitCode || 'Pending Match'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Blood Issue Code:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{record.issueCode || trace?.bloodIssue?.issueCode || 'Not Issued Yet'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Dispensing Source:</span>
                  <span>Verified Compatible Inventory (Strictly Independent from relative unit)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Invoice & Payment Details */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <button
            onClick={() => toggleSection('billing')}
            style={{
              width: '100%',
              padding: '14px 18px',
              backgroundColor: '#f8fafc',
              border: 'none',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              color: '#0f172a',
            }}
          >
            <span>Invoice & Payment Details</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{expandedSections.billing ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {expandedSections.billing && (
            <div style={{ padding: '16px 18px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Invoice Number:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{record.invoiceNumber || trace?.payment?.invoiceNumber || 'Unbilled'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Payment Status:</span>
                  <strong>{record.paymentStatus || trace?.payment?.status || 'NOT_INVOICED'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Tariff Subtotal:</span>
                  <strong>₹{record.invoiceTotalAmount ?? trace?.payment?.subtotal ?? 0}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Authorized Waiver:</span>
                  <strong style={{ color: '#16a34a' }}>- ₹{record.invoiceWaiverAmount ?? trace?.payment?.waiverTotal ?? 0}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Amount Paid:</span>
                  <strong>₹{record.invoicePaidAmount ?? trace?.payment?.paidAmount ?? 0}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Balance Outstanding:</span>
                  <strong style={{ color: (record.invoiceBalanceDue ?? trace?.payment?.balanceDue ?? 0) > 0 ? '#b91c1c' : '#16a34a' }}>
                    ₹{record.invoiceBalanceDue ?? trace?.payment?.balanceDue ?? 0}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Case Notes */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <button
            onClick={() => toggleSection('notes')}
            style={{
              width: '100%',
              padding: '14px 18px',
              backgroundColor: '#f8fafc',
              border: 'none',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              color: '#0f172a',
            }}
          >
            <span>Operational Case Notes</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{expandedSections.notes ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {expandedSections.notes && (
            <div style={{ padding: '16px 18px', borderTop: '1px solid #e2e8f0' }}>
              {isEditingNotes ? (
                <div>
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    rows={3}
                    placeholder="Enter operational notes..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '13px',
                      marginBottom: '8px',
                      fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setIsEditingNotes(false)}
                      style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      style={{ padding: '6px 14px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      {savingNotes ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: record.notes ? '#334155' : '#94a3b8', fontStyle: record.notes ? 'normal' : 'italic' }}>
                    {record.notes || 'No case notes recorded.'}
                  </p>
                  <button
                    onClick={() => setIsEditingNotes(true)}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Edit Notes
                  </button>
                </div>
              )}

              {record.cancellationReason && (
                <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: '#fee2e2', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '12px', color: '#b91c1c' }}>
                  <strong>Cancellation Reason:</strong> {record.cancellationReason}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. Case Audit Timeline */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <button
            onClick={() => toggleSection('timeline')}
            style={{
              width: '100%',
              padding: '14px 18px',
              backgroundColor: '#f8fafc',
              border: 'none',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              color: '#0f172a',
            }}
          >
            <span>Case Audit Timeline ({record.timeline?.length || 0} events)</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{expandedSections.timeline ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {expandedSections.timeline && (
            <div style={{ padding: '16px 18px', borderTop: '1px solid #e2e8f0' }}>
              {record.timeline?.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>No audit timeline events.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {record.timeline.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '4px', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#0f172a' }}>{item.event.replace(/_/g, ' ')}</strong>
                          <span style={{ color: '#64748b' }}>
                            {new Date(item.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                          <span style={{ color: '#94a3b8' }}>&bull; by {item.actorName} ({item.actorRole})</span>
                        </div>
                        <div style={{ color: '#475569', marginTop: '2px' }}>{item.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* PHASE 3: USER-FRIENDLY PHYSICAL DONATION SELECTOR MODAL   */}
      {/* ========================================================= */}
      {showLinkModal && (
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
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Link Physical Donation Record
              </h2>
              <button
                onClick={() => setShowLinkModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#64748b', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
              Select an eligible physical donation collected from donor{' '}
              <strong style={{ color: '#0f172a' }}>{record.donorName}</strong> ({record.donorCode}).
            </p>

            {/* Search Filter inside modal */}
            <div style={{ marginBottom: '14px' }}>
              <input
                type="text"
                placeholder="Search donation code or type..."
                value={donationSearchQuery}
                onChange={(e) => setDonationSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
            </div>

            {/* Donations List Container */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', minHeight: '180px', maxHeight: '320px' }}>
              {loadingDonations ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
                  <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '2px solid #e2e8f0', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '8px' }} />
                  <div style={{ fontSize: '13px' }}>Loading eligible donations...</div>
                </div>
              ) : donationFetchError ? (
                <div style={{ padding: '16px', backgroundColor: '#fee2e2', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                  {donationFetchError}
                  <button
                    onClick={loadEligibleDonations}
                    style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: '#b91c1c', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Retry
                  </button>
                </div>
              ) : filteredDonations.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#64748b' }}>
                    No donation records found for donor <strong>{record.donorName}</strong>.
                  </p>
                  <Link
                    href={`/admin/donations?search=${encodeURIComponent(record.donorCode)}${returnToParam}`}
                    style={{
                      display: 'inline-block',
                      padding: '7px 14px',
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textDecoration: 'none',
                    }}
                  >
                    + Register Physical Donation in Donations Desk &rarr;
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredDonations.map((donation) => {
                    const isSelected = selectedDonationId === donation._id;
                    const isCancelled = donation.status === DonationStatus.CANCELLED;

                    return (
                      <div
                        key={donation._id}
                        onClick={() => {
                          if (!isCancelled) setSelectedDonationId(donation._id);
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: `1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                          backgroundColor: isSelected ? '#eff6ff' : isCancelled ? '#f8fafc' : '#ffffff',
                          cursor: isCancelled ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          opacity: isCancelled ? 0.6 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="radio"
                            name="donationSelect"
                            checked={isSelected}
                            disabled={isCancelled}
                            onChange={() => setSelectedDonationId(donation._id)}
                            style={{ cursor: isCancelled ? 'not-allowed' : 'pointer' }}
                          />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                                {donation.donationCode}
                              </span>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: donation.status === DonationStatus.COMPLETED ? '#dcfce7' : '#fef3c7',
                                  color: donation.status === DonationStatus.COMPLETED ? '#166534' : '#92400e',
                                }}
                              >
                                {donation.status}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                              Date: {new Date(donation.donationDate).toLocaleDateString()} &bull; Type: {donation.donationType}
                              {donation.collectedVolumeMl ? ` (${donation.collectedVolumeMl} ml)` : ''}
                            </div>
                          </div>
                        </div>

                        {isCancelled && (
                          <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '600' }}>
                            Cancelled
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                disabled={linkingDonation}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLinkDonation}
                disabled={!selectedDonationId || linkingDonation}
                style={{
                  padding: '8px 18px',
                  backgroundColor: selectedDonationId && !linkingDonation ? '#dc2626' : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: selectedDonationId && !linkingDonation ? 'pointer' : 'not-allowed',
                }}
              >
                {linkingDonation ? 'Linking...' : 'Confirm & Link Donation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancel Replacement Tracking */}
      {showCancelModal && (
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
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#b91c1c', margin: '0 0 6px 0' }}>
              Cancel Replacement Tracking
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
              Provide an operational reason for stopping tracking. The patient&apos;s blood requisition will remain unaffected.
            </p>

            <form onSubmit={handleCancelCase}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Donor deferred, family requested cancellation, donor unavailable..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Keep Case Active
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: cancelling ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
