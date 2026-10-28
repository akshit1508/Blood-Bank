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
import { getStoredAdmin, AdminUser, AdminRole } from '@/lib/auth-api';

const STATUS_CONFIG: Record<
  ReplacementTrackingStatus,
  { bg: string; text: string; border: string; label: string; description: string }
> = {
  [ReplacementTrackingStatus.DONOR_ASSOCIATED]: {
    bg: '#eff6ff',
    text: '#1d4ed8',
    border: '#bfdbfe',
    label: 'Donor Associated',
    description: 'Relative registered and linked to patient request. Awaiting physical blood collection.',
  },
  [ReplacementTrackingStatus.DONATION_SCHEDULED]: {
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#bbf7d0',
    label: 'Donation Scheduled',
    description: 'Donation appointment is booked with donor.',
  },
  [ReplacementTrackingStatus.DONATION_IN_PROGRESS]: {
    bg: '#fef3c7',
    text: '#b45309',
    border: '#fde68a',
    label: 'Donation In Progress',
    description: 'Donor is currently undergoing medical screening or blood draw.',
  },
  [ReplacementTrackingStatus.DONATION_COLLECTED]: {
    bg: '#ede9fe',
    text: '#6d28d9',
    border: '#ddd6fe',
    label: 'Donation Collected',
    description: 'Blood unit collected from donor. Received at laboratory intake.',
  },
  [ReplacementTrackingStatus.TESTING_PENDING]: {
    bg: '#e0e7ff',
    text: '#4338ca',
    border: '#c7d2fe',
    label: 'Testing & Intake Pending',
    description: 'Undergoing mandatory laboratory testing or awaiting supervisor release to active inventory.',
  },
  [ReplacementTrackingStatus.RELEASED_TO_INVENTORY]: {
    bg: '#dcfce7',
    text: '#166534',
    border: '#86efac',
    label: 'Released to Inventory',
    description: 'Testing passed and supervisor authorized intake. Donated unit is available in active inventory.',
  },
  [ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED]: {
    bg: '#fee2e2',
    text: '#b91c1c',
    border: '#fca5a5',
    label: 'Deferred / Rejected',
    description: 'Donor is deferred or donated unit failed laboratory testing.',
  },
  [ReplacementTrackingStatus.CANCELLED]: {
    bg: '#f3f4f6',
    text: '#4b5563',
    border: '#d1d5db',
    label: 'Case Cancelled',
    description: 'Replacement tracking was stopped by operational staff.',
  },
};

type StepState = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'REJECTED' | 'NOT_APPLICABLE' | 'BLOCKED';

interface WorkflowReference {
  label: string;
  value: string;
  isCode?: boolean;
}

interface WorkflowStep {
  number: number;
  title: string;
  shortDesc: string;
  status: StepState;
  statusBadge: string;
  summary: string;
  responsibleRole: string;
  allowedRoles: AdminRole[];
  canUserAct: boolean;
  permissionReason?: string;
  references: WorkflowReference[];
  primaryAction: {
    label: string;
    type: 'MODAL' | 'NAVIGATE' | 'DISABLED';
    href?: string;
    disabledReason?: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  clinicalNotice?: string;
}

interface NextOperationalAction {
  stepNumber: number;
  stageName: string;
  responsibleRole: string;
  headline: string;
  explanation: string;
  actionLabel: string;
  actionType: 'MODAL' | 'NAVIGATE';
  actionHref?: string;
  canUserAct: boolean;
  permissionReason?: string;
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

  // Notes editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Link donation modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [manualDonationId, setManualDonationId] = useState('');
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

  // Window Focus & Visibility Change Auto-Refresh
  // Automatically re-syncs state when staff returns from another module/tab
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

  const handleLinkDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !manualDonationId.trim()) return;
    try {
      setLinkingDonation(true);
      const updated = await linkDonationToReplacement(id, {
        donationId: manualDonationId.trim(),
      });
      setRecord(updated);
      setShowLinkModal(false);
      setManualDonationId('');
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

  // Role permissions checking
  const userRole = adminUser?.role as AdminRole | undefined;
  const isSuperAdminOrAdmin = userRole === AdminRole.SUPER_ADMIN || userRole === AdminRole.ADMIN;
  const isLabStaff = isSuperAdminOrAdmin || userRole === AdminRole.LAB_TECHNICIAN;
  const isFinanceStaff = isSuperAdminOrAdmin || userRole === AdminRole.FINANCE_RECEPTIONIST;

  // 6-Stage Workflow Calculation
  const workflowSteps = useMemo<WorkflowStep[]>(() => {
    if (!record) return [];

    const isCancelled = record.status === ReplacementTrackingStatus.CANCELLED;
    const isDeferredOrRejected =
      record.status === ReplacementTrackingStatus.DONATION_DEFERRED_OR_REJECTED;

    // Return URL for passing to external modules
    const returnToCaseParam = `&returnTo=/admin/replacement-donations/${record._id}`;

    // Stage 1: Relative Donor & Donation
    let s1Status: StepState = 'PENDING';
    let s1Badge = 'Pending';
    let s1Summary = 'Donor associated; physical blood draw pending.';
    if (isCancelled && !record.donationCode) {
      s1Status = 'NOT_APPLICABLE';
      s1Badge = 'Cancelled';
      s1Summary = 'Case was cancelled before donation took place.';
    } else if (isDeferredOrRejected && !record.donationCode) {
      s1Status = 'REJECTED';
      s1Badge = 'Deferred';
      s1Summary = 'Relative donor deferred during health screening.';
    } else if (record.donationCode) {
      s1Status = 'COMPLETED';
      s1Badge = 'Completed';
      s1Summary = `Physical blood collected under donation ${record.donationCode}. Received at lab intake.`;
    } else if (
      record.status === ReplacementTrackingStatus.DONATION_SCHEDULED ||
      record.status === ReplacementTrackingStatus.DONATION_IN_PROGRESS
    ) {
      s1Status = 'IN_PROGRESS';
      s1Badge = 'In Progress';
      s1Summary = 'Donor screening or donation draw currently in progress.';
    } else {
      s1Status = 'IN_PROGRESS';
      s1Badge = 'Awaiting Draw';
      s1Summary = 'Relative donor linked. Awaiting phlebotomy collection in donation room.';
    }

    const s1References: WorkflowReference[] = [
      { label: 'Relative Donor', value: `${record.donorName} (${record.donorCode})` },
      { label: 'Donor Blood Group', value: record.donorBloodGroup.replace('_', ' ') },
      { label: 'Relationship', value: record.relationshipToPatient },
      { label: 'Donation Code', value: record.donationCode || 'Awaiting Collection', isCode: true },
    ];

    const s1CanAct = isSuperAdminOrAdmin;
    const s1Step: WorkflowStep = {
      number: 1,
      title: 'Donor & Physical Donation',
      shortDesc: 'Screening & Draw',
      status: s1Status,
      statusBadge: s1Badge,
      summary: s1Summary,
      responsibleRole: 'Phlebotomist / Receptionist / Admin',
      allowedRoles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN],
      canUserAct: s1CanAct,
      permissionReason: s1CanAct ? undefined : 'Only Administrators and Reception staff can link or record physical donations.',
      references: s1References,
      primaryAction: record.donationCode
        ? {
            label: 'View in Donations Desk',
            type: 'NAVIGATE',
            href: `/admin/donations?search=${encodeURIComponent(record.donorCode)}${returnToCaseParam}`,
          }
        : isCancelled
        ? {
            label: 'Case Cancelled',
            type: 'DISABLED',
            disabledReason: 'Case tracking was cancelled.',
          }
        : {
            label: '+ Link Physical Donation',
            type: 'MODAL',
          },
      secondaryAction: {
        label: 'Open Donations Desk',
        href: `/admin/donations?search=${encodeURIComponent(record.donorCode)}${returnToCaseParam}`,
      },
    };

    // Stage 2: Laboratory Testing
    let s2Status: StepState = 'PENDING';
    let s2Badge = 'Pending';
    let s2Summary = 'Mandatory TTI and ABO serology pending donation intake.';
    const unitStatus = trace?.relativeDonation?.unitStatus;
    if (isCancelled && !record.unitCode) {
      s2Status = 'NOT_APPLICABLE';
      s2Badge = 'N/A';
      s2Summary = 'Not reached before case cancellation.';
    } else if (unitStatus === 'APPROVED' || trace?.relativeDonation?.isReleasedToInventory) {
      s2Status = 'COMPLETED';
      s2Badge = 'Passed';
      s2Summary = 'All infectious markers (HIV, HBsAg, HCV, Syphilis, Malaria) non-reactive; ABO/Rh confirmed.';
    } else if (unitStatus === 'REJECTED' || isDeferredOrRejected) {
      s2Status = 'REJECTED';
      s2Badge = 'Failed / Quarantined';
      s2Summary = 'Unit tested reactive or failed lab criteria. Quarantined for safe disposal.';
    } else if (record.unitCode || record.donationCode) {
      s2Status = 'IN_PROGRESS';
      s2Badge = 'In Testing';
      s2Summary = 'Blood samples currently undergoing mandatory serological and TTI testing.';
    }

    const s2References: WorkflowReference[] = [
      { label: 'Donated Unit Code', value: record.unitCode || 'Awaiting Tube Registration', isCode: true },
      { label: 'Screening Result', value: unitStatus || (record.donationCode ? 'Testing in progress' : 'Pending Intake') },
      { label: 'Screened Blood Group', value: record.donorBloodGroup.replace('_', ' ') },
      { label: 'Test Origin', value: `Replacement (${record.donorName})` },
    ];

    const s2CanAct = isLabStaff;
    const s2Step: WorkflowStep = {
      number: 2,
      title: 'Laboratory Testing',
      shortDesc: 'TTI & Serology',
      status: s2Status,
      statusBadge: s2Badge,
      summary: s2Summary,
      responsibleRole: 'Lab Technician / Supervisor',
      allowedRoles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN],
      canUserAct: s2CanAct,
      permissionReason: s2CanAct ? undefined : 'Requires Laboratory Technician or Admin role to record or review test findings.',
      references: s2References,
      primaryAction: !record.donationCode && s1Status !== 'COMPLETED'
        ? {
            label: 'Awaiting Blood Collection',
            type: 'DISABLED',
            disabledReason: 'Physical blood donation must be recorded before laboratory testing can begin.',
          }
        : {
            label: s2Status === 'COMPLETED' ? 'View Test Results in Lab' : 'Perform / Review Lab Testing',
            type: 'NAVIGATE',
            href: userRole === AdminRole.LAB_TECHNICIAN
              ? `/lab/testing?unitId=${encodeURIComponent(record.bloodUnitId || '')}${returnToCaseParam}`
              : `/admin/testing?bloodUnitId=${encodeURIComponent(record.bloodUnitId || '')}&donationId=${encodeURIComponent(record.donationCode || '')}${returnToCaseParam}`,
          },
      secondaryAction: {
        label: 'Open Lab Console',
        href: `/admin/testing?bloodUnitId=${encodeURIComponent(record.bloodUnitId || '')}${returnToCaseParam}`,
      },
    };

    // Stage 3: Supervisor Approval & Inventory Release
    let s3Status: StepState = 'PENDING';
    let s3Badge = 'Pending';
    let s3Summary = 'Requires testing clearance before supervisor authorization.';
    if (isCancelled && !trace?.relativeDonation?.isReleasedToInventory) {
      s3Status = 'NOT_APPLICABLE';
      s3Badge = 'N/A';
      s3Summary = 'Not reached before case cancellation.';
    } else if (trace?.relativeDonation?.isReleasedToInventory) {
      s3Status = 'COMPLETED';
      s3Badge = 'Released';
      s3Summary = 'Authorized by supervisor and added to active inventory stock for general patient pool.';
    } else if (unitStatus === 'APPROVED') {
      s3Status = 'IN_PROGRESS';
      s3Badge = 'Awaiting Sign-off';
      s3Summary = 'Testing approved; awaiting supervisor release sign-off in the lab desk.';
    } else if (s2Status === 'REJECTED') {
      s3Status = 'REJECTED';
      s3Badge = 'Blocked';
      s3Summary = 'Cannot be released due to lab test failure. Unit is permanently quarantined.';
    }

    const s3References: WorkflowReference[] = [
      { label: 'Donated Unit', value: record.unitCode || 'Pending', isCode: true },
      { label: 'Lab Clearance', value: unitStatus === 'APPROVED' ? 'Approved (Safe)' : unitStatus || 'Pending' },
      { label: 'Inventory Stock', value: trace?.relativeDonation?.isReleasedToInventory ? 'Active (General Pool)' : 'Quarantine / Lab Holding' },
      { label: 'Intake Authority', value: 'Lab Supervisor / Quality Manager' },
    ];

    const s3CanAct = isSuperAdminOrAdmin;
    const s3Step: WorkflowStep = {
      number: 3,
      title: 'Supervisor Approval & Release',
      shortDesc: 'Inventory Intake',
      status: s3Status,
      statusBadge: s3Badge,
      summary: s3Summary,
      responsibleRole: 'Laboratory Supervisor / Quality Manager',
      allowedRoles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN],
      canUserAct: s3CanAct,
      permissionReason: s3CanAct ? undefined : 'Only Laboratory Supervisors, Quality Managers, and Admins can authorize inventory release. Lab Technicians cannot self-release blood units.',
      references: s3References,
      primaryAction: s3Status === 'COMPLETED'
        ? {
            label: 'View in Active Inventory',
            type: 'NAVIGATE',
            href: `/admin/inventory?returnTo=/admin/replacement-donations/${record._id}`,
          }
        : s2Status === 'REJECTED'
        ? {
            label: 'Release Blocked (Quarantined)',
            type: 'DISABLED',
            disabledReason: 'Donated unit failed laboratory criteria and is quarantined.',
          }
        : s2Status !== 'COMPLETED'
        ? {
            label: 'Awaiting Lab Clearance',
            type: 'DISABLED',
            disabledReason: 'Laboratory screening must be fully approved before supervisor release sign-off.',
          }
        : !s3CanAct
        ? {
            label: 'Supervisor Sign-off Required',
            type: 'DISABLED',
            disabledReason: 'You are signed in as Lab Technician. A Supervisor or Admin must authorize release.',
          }
        : {
            label: 'Review & Authorize Release',
            type: 'NAVIGATE',
            href: `/admin/testing?bloodUnitId=${encodeURIComponent(record.bloodUnitId || '')}${returnToCaseParam}`,
          },
      secondaryAction: {
        label: 'Open Inventory View',
        href: `/admin/inventory?returnTo=/admin/replacement-donations/${record._id}`,
      },
    };

    // Stage 4: Patient Crossmatching & Authorization
    let s4Status: StepState = 'PENDING';
    let s4Badge = 'Pending';
    let s4Summary = 'Awaiting laboratory crossmatch for patient request.';
    const cmStatus = trace?.crossmatching?.status || record.crossmatchStatus;
    const isAuthorized = trace?.crossmatching?.isAuthorized;
    const cmResult = trace?.crossmatching?.compatibilityResult;
    if (isCancelled && !cmStatus) {
      s4Status = 'NOT_APPLICABLE';
      s4Badge = 'N/A';
      s4Summary = 'Not reached before case cancellation.';
    } else if (isAuthorized || cmStatus === 'RESERVED' || cmStatus === 'ISSUED') {
      s4Status = 'COMPLETED';
      s4Badge = 'Authorized';
      s4Summary = `Compatible unit (${trace?.crossmatching?.selectedInventoryUnit || 'assigned'}) authorized by Transfusion Officer.`;
    } else if (cmResult === 'INCOMPATIBLE') {
      s4Status = 'REJECTED';
      s4Badge = 'Incompatible';
      s4Summary = 'Selected unit test was incompatible with patient. Another unit must be selected from inventory.';
    } else if (cmStatus && cmStatus !== 'NOT_STARTED') {
      s4Status = 'IN_PROGRESS';
      s4Badge = 'In Progress';
      s4Summary = `Crossmatch order status: ${cmStatus}. Serological compatibility evaluation underway.`;
    }

    const s4References: WorkflowReference[] = [
      { label: 'Patient Request', value: `${record.requestCode} (${record.patientBloodGroup.replace('_', ' ')})`, isCode: true },
      { label: 'Crossmatch ID', value: record.crossmatchId || trace?.crossmatching?.crossmatchId || 'Pending initiation', isCode: true },
      { label: 'Compatibility', value: trace?.crossmatching?.compatibilityResult || 'PENDING' },
      { label: 'Reserved Unit', value: trace?.crossmatching?.selectedInventoryUnit || 'None yet', isCode: true },
    ];

    const s4CanAct = isLabStaff;
    const s4Step: WorkflowStep = {
      number: 4,
      title: 'Patient Crossmatching',
      shortDesc: 'Compatibility Check',
      status: s4Status,
      statusBadge: s4Badge,
      summary: s4Summary,
      responsibleRole: 'Transfusion Officer / Lab Technician',
      allowedRoles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN],
      canUserAct: s4CanAct,
      permissionReason: s4CanAct ? undefined : 'Requires Transfusion Officer, Lab Technician, or Admin role to conduct or authorize crossmatching.',
      references: s4References,
      clinicalNotice: 'Independent Clinical Gate: Patient crossmatch does NOT require relative donation completion. Patient blood can be crossmatched from available inventory immediately.',
      primaryAction: record.crossmatchId || trace?.crossmatching?.crossmatchId
        ? {
            label: 'Open Crossmatch Record',
            type: 'NAVIGATE',
            href: `/admin/crossmatching/${record.crossmatchId || trace?.crossmatching?.crossmatchId}?returnTo=/admin/replacement-donations/${record._id}`,
          }
        : {
            label: 'Initiate Patient Crossmatch',
            type: 'NAVIGATE',
            href: `/admin/crossmatching?search=${encodeURIComponent(record.requestCode)}${returnToCaseParam}`,
          },
      secondaryAction: {
        label: 'View Patient Request',
        href: `/admin/blood-requests?requestId=${encodeURIComponent(record.bloodRequestId)}&requestCode=${encodeURIComponent(record.requestCode)}${returnToCaseParam}`,
      },
    };

    // Stage 5: Patient Blood Issue
    let s5Status: StepState = 'PENDING';
    let s5Badge = 'Pending';
    let s5Summary = 'Patient unit will be issued once authorized.';
    const hasIssue = Boolean(record.issueCode || trace?.bloodIssue?.issueCode || record.issuedUnitCode);
    if (isCancelled && !hasIssue) {
      s5Status = 'NOT_APPLICABLE';
      s5Badge = 'N/A';
      s5Summary = 'Not reached before case cancellation.';
    } else if (hasIssue) {
      s5Status = 'COMPLETED';
      s5Badge = 'Issued';
      s5Summary = `Unit ${record.issuedUnitCode || trace?.bloodIssue?.issuedUnits?.[0]?.unitCode || ''} issued under ${record.issueCode || trace?.bloodIssue?.issueCode || ''}. Inventory deducted.`;
    } else if (s4Status === 'COMPLETED') {
      s5Status = 'IN_PROGRESS';
      s5Badge = 'Ready to Issue';
      s5Summary = 'Compatible unit reserved & authorized; ready for physical dispensing and verification.';
    }

    const s5References: WorkflowReference[] = [
      { label: 'Blood Issue Code', value: record.issueCode || trace?.bloodIssue?.issueCode || 'Not Issued Yet', isCode: true },
      { label: 'Dispensed Unit Code', value: record.issuedUnitCode || trace?.bloodIssue?.issuedUnits?.[0]?.unitCode || 'Pending Match', isCode: true },
      { label: 'Dispensed Component', value: (trace?.patientRequest?.requestedComponent || 'PRBC').replace(/_/g, ' ') },
      { label: 'Issue Date', value: trace?.bloodIssue?.issuedAt ? new Date(trace.bloodIssue.issuedAt).toLocaleDateString() : 'Pending' },
    ];

    const s5CanAct = isSuperAdminOrAdmin;
    const s5Step: WorkflowStep = {
      number: 5,
      title: 'Patient Blood Issue',
      shortDesc: 'Unit Dispensed',
      status: s5Status,
      statusBadge: s5Badge,
      summary: s5Summary,
      responsibleRole: 'Blood Bank Issuing Officer',
      allowedRoles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN],
      canUserAct: s5CanAct,
      permissionReason: s5CanAct ? undefined : 'Requires Blood Bank Issuing Officer or Admin role to issue and dispense blood.',
      references: s5References,
      clinicalNotice: 'Strict Clinical Separation: Patient receives blood solely from verified compatible inventory. Deducts inventory exactly once.',
      primaryAction: s5Status === 'COMPLETED'
        ? {
            label: 'View Dispensed Requisition',
            type: 'NAVIGATE',
            href: `/admin/blood-requests?requestId=${encodeURIComponent(record.bloodRequestId)}&requestCode=${encodeURIComponent(record.requestCode)}${returnToCaseParam}`,
          }
        : s4Status !== 'COMPLETED'
        ? {
            label: 'Awaiting Crossmatch Authorization',
            type: 'DISABLED',
            disabledReason: 'Crossmatching must be completed and authorized before blood unit can be issued.',
          }
        : !s5CanAct
        ? {
            label: 'Issuing Role Required',
            type: 'DISABLED',
            disabledReason: 'Authorized transfusion supervisor or admin role required to issue blood.',
          }
        : {
            label: 'Proceed to Issue Blood',
            type: 'NAVIGATE',
            href: record.crossmatchId
              ? `/admin/crossmatching/${record.crossmatchId}?returnTo=/admin/replacement-donations/${record._id}`
              : `/admin/blood-requests?requestId=${encodeURIComponent(record.bloodRequestId)}&requestCode=${encodeURIComponent(record.requestCode)}${returnToCaseParam}`,
          },
      secondaryAction: {
        label: 'Open Blood Requests Desk',
        href: `/admin/blood-requests?requestId=${encodeURIComponent(record.bloodRequestId)}&requestCode=${encodeURIComponent(record.requestCode)}${returnToCaseParam}`,
      },
    };

    // Stage 6: Billing & Payment
    let s6Status: StepState = 'PENDING';
    let s6Badge = 'Pending';
    let s6Summary = 'Tariff invoicing generated upon or after blood issue.';
    const paymentStatus = trace?.payment?.status || record.paymentStatus;
    const hasInvoice = Boolean(record.invoiceNumber || trace?.payment?.invoiceNumber);
    if (paymentStatus === 'PAID') {
      s6Status = 'COMPLETED';
      s6Badge = 'Paid in Full';
      s6Summary = 'Invoice settled in full. Official receipt issued.';
    } else if (paymentStatus === 'WAIVED') {
      s6Status = 'COMPLETED';
      s6Badge = '100% Waived';
      s6Summary = '100% concession/waiver approved by medical administration.';
    } else if (paymentStatus === 'PARTIALLY_PAID') {
      s6Status = 'IN_PROGRESS';
      s6Badge = 'Partial Due';
      s6Summary = `Balance outstanding: ₹${record.invoiceBalanceDue ?? trace?.payment?.balanceDue ?? 0}.`;
    } else if (hasInvoice) {
      s6Status = 'IN_PROGRESS';
      s6Badge = 'Unpaid Invoice';
      s6Summary = `Invoice generated; payment pending (₹${record.invoiceTotalAmount ?? trace?.payment?.subtotal ?? 0}).`;
    } else if (hasIssue) {
      s6Status = 'IN_PROGRESS';
      s6Badge = 'Awaiting Invoicing';
      s6Summary = 'Blood unit has been issued to patient; tariff invoice needs to be generated at finance desk.';
    }

    const s6References: WorkflowReference[] = [
      { label: 'Invoice Number', value: record.invoiceNumber || trace?.payment?.invoiceNumber || 'Not Generated Yet', isCode: true },
      { label: 'Payment Status', value: record.paymentStatus || trace?.payment?.status || 'UNBILLED' },
      { label: 'Total Charge', value: `₹${record.invoiceTotalAmount ?? trace?.payment?.subtotal ?? 0}` },
      { label: 'Balance Due', value: `₹${record.invoiceBalanceDue ?? trace?.payment?.balanceDue ?? 0}` },
    ];

    const s6CanAct = isFinanceStaff;
    const s6Step: WorkflowStep = {
      number: 6,
      title: 'Billing & Payment',
      shortDesc: 'Tariff Settlement',
      status: s6Status,
      statusBadge: s6Badge,
      summary: s6Summary,
      responsibleRole: 'Finance Cashier / Billing Desk',
      allowedRoles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.FINANCE_RECEPTIONIST],
      canUserAct: s6CanAct,
      permissionReason: s6CanAct ? undefined : 'Requires Finance Receptionist, Cashier, or Admin role to process invoices and payments.',
      references: s6References,
      primaryAction: hasInvoice || hasIssue
        ? s6CanAct
          ? {
              label: 'Open Finance Billing Desk',
              type: 'NAVIGATE',
              href: `/admin/finance/billing?search=${encodeURIComponent(record.invoiceNumber || record.issueCode || '')}${returnToCaseParam}`,
            }
          : {
              label: 'Finance Role Required',
              type: 'DISABLED',
              disabledReason: 'Cashier or Finance Receptionist role required to settle billing.',
            }
        : {
            label: 'Billing Awaits Blood Issue',
            type: 'DISABLED',
            disabledReason: 'Invoices are generated upon or after patient blood issue.',
          },
      secondaryAction: {
        label: 'Open Billing Console',
        href: `/admin/finance/billing?search=${encodeURIComponent(record.invoiceNumber || record.issueCode || '')}${returnToCaseParam}`,
      },
    };

    return [s1Step, s2Step, s3Step, s4Step, s5Step, s6Step];
  }, [record, trace, userRole, isSuperAdminOrAdmin, isLabStaff, isFinanceStaff]);

  // Contextual "Continue Workflow" Next Action Hero Determination
  const nextAction = useMemo<NextOperationalAction | null>(() => {
    if (!record) return null;
    if (record.status === ReplacementTrackingStatus.CANCELLED) return null;

    // Check Stage 1
    const s1 = workflowSteps[0];
    if (s1 && s1.status !== 'COMPLETED' && s1.status !== 'REJECTED' && s1.status !== 'NOT_APPLICABLE') {
      return {
        stepNumber: 1,
        stageName: 'Stage 1: Relative Donor & Physical Donation',
        responsibleRole: s1.responsibleRole,
        headline: 'Physical blood donation collection is pending',
        explanation: `Relative ${record.donorName} (${record.donorCode}, ${record.donorBloodGroup.replace('_', ' ')}) is linked to patient request ${record.requestCode}. Collect physical blood donation in phlebotomy room or link the completed donation code to begin laboratory intake.`,
        actionLabel: '+ Link Physical Donation Record',
        actionType: 'MODAL',
        canUserAct: s1.canUserAct,
        permissionReason: s1.permissionReason,
      };
    }

    // Check Stage 2
    const s2 = workflowSteps[1];
    if (s2 && s2.status !== 'COMPLETED' && s2.status !== 'REJECTED' && s2.status !== 'NOT_APPLICABLE') {
      return {
        stepNumber: 2,
        stageName: 'Stage 2: Laboratory Testing & Screening',
        responsibleRole: s2.responsibleRole,
        headline: `Unit ${record.unitCode || 'donation'} is undergoing mandatory laboratory screening`,
        explanation: `Infectious disease screening (HIV, HBsAg, HCV, VDRL/Syphilis, MP/Malaria) and ABO/Rh validation must be performed in the Laboratory Module before intake into stock.`,
        actionLabel: 'Open Laboratory Testing →',
        actionType: 'NAVIGATE',
        actionHref: s2.primaryAction.href,
        canUserAct: s2.canUserAct,
        permissionReason: s2.permissionReason,
      };
    }

    // Check Stage 3
    const s3 = workflowSteps[2];
    if (s3 && s3.status !== 'COMPLETED' && s3.status !== 'REJECTED' && s3.status !== 'NOT_APPLICABLE') {
      return {
        stepNumber: 3,
        stageName: 'Stage 3: Supervisor Approval & Inventory Release',
        responsibleRole: s3.responsibleRole,
        headline: 'Laboratory testing PASSED (APPROVED) — Awaiting formal supervisor sign-off',
        explanation: `Unit ${record.unitCode} passed laboratory screening. An authorized supervisor must review and approve the test record to release this unit into general active inventory stock.`,
        actionLabel: 'Review & Authorize Release →',
        actionType: 'NAVIGATE',
        actionHref: s3.primaryAction.href,
        canUserAct: s3.canUserAct,
        permissionReason: s3.permissionReason,
      };
    }

    // Note: If relative donation was rejected in 1/2/3, we still fall through to Stage 4 for patient!
    // Check Stage 4
    const s4 = workflowSteps[3];
    if (s4 && s4.status !== 'COMPLETED' && s4.status !== 'NOT_APPLICABLE') {
      return {
        stepNumber: 4,
        stageName: 'Stage 4: Patient Clinical Crossmatching & Authorization',
        responsibleRole: s4.responsibleRole,
        headline: `Crossmatch and authorize a compatible blood unit for patient ${record.patientName}`,
        explanation: `Patient requisition ${record.requestCode} requires ${(trace?.patientRequest?.requestedComponent || 'PRBC').replace(/_/g, ' ')} (${record.patientBloodGroup.replace('_', ' ')}). Select and crossmatch a compatible unit from inventory.`,
        actionLabel: (s4.primaryAction.label || 'Initiate Patient Crossmatch') + ' →',
        actionType: 'NAVIGATE',
        actionHref: s4.primaryAction.href,
        canUserAct: s4.canUserAct,
        permissionReason: s4.permissionReason,
      };
    }

    // Check Stage 5
    const s5 = workflowSteps[4];
    if (s5 && s5.status !== 'COMPLETED' && s5.status !== 'NOT_APPLICABLE') {
      return {
        stepNumber: 5,
        stageName: 'Stage 5: Patient Blood Issue Fulfillment',
        responsibleRole: s5.responsibleRole,
        headline: `Dispense authorized unit to patient ${record.patientName}`,
        explanation: `Compatible unit is authorized. Complete physical dispensing in the Blood Issue desk to dispense the unit and deduct inventory.`,
        actionLabel: 'Proceed to Issue Blood →',
        actionType: 'NAVIGATE',
        actionHref: s5.primaryAction.href,
        canUserAct: s5.canUserAct,
        permissionReason: s5.permissionReason,
      };
    }

    // Check Stage 6
    const s6 = workflowSteps[5];
    if (s6 && s6.status !== 'COMPLETED' && s6.status !== 'NOT_APPLICABLE') {
      return {
        stepNumber: 6,
        stageName: 'Stage 6: Financial Reconciliation & Billing',
        responsibleRole: s6.responsibleRole,
        headline: `Invoice settlement pending (Balance due: ₹${record.invoiceBalanceDue ?? trace?.payment?.balanceDue ?? 0})`,
        explanation: `Blood unit was dispensed under issue ${record.issueCode}. Process payment collection or record authorized fee waiver at the billing desk.`,
        actionLabel: 'Open Finance Billing Desk →',
        actionType: 'NAVIGATE',
        actionHref: s6.primaryAction.href,
        canUserAct: s6.canUserAct,
        permissionReason: s6.permissionReason,
      };
    }

    return null; // All stages completed!
  }, [record, trace, workflowSteps]);

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
    description: '',
  };

  const isFinanceUser =
    adminUser?.role === 'SUPER_ADMIN' ||
    adminUser?.role === 'ADMIN' ||
    adminUser?.role === 'FINANCE_RECEPTIONIST';

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', fontFamily: 'inherit' }}>
      <style>{`
        @media (max-width: 900px) {
          .stepper-container {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .step-card {
            width: 100% !important;
          }
          .step-arrow {
            display: none !important;
          }
          .dual-unit-grid {
            grid-template-columns: 1fr !important;
          }
          .summary-ribbon {
            grid-template-columns: 1fr !important;
          }
          .guided-workflow-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-cta-card {
            flex-direction: column !important;
            align-items: stretch !important;
          }
        }
      `}</style>

      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
        <Link href="/admin/replacement-donations" style={{ color: '#64748b', textDecoration: 'none' }}>
          Replacement Donations
        </Link>
        <span>/</span>
        <span style={{ color: '#0f172a', fontWeight: '600', fontFamily: 'monospace' }}>{record.trackingCode}</span>
      </div>

      {/* 1. TOP SUMMARY CARD */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                Replacement Tracking Case
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  backgroundColor: '#f1f5f9',
                  color: '#0f172a',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontWeight: '600',
                }}
              >
                {record.trackingCode}
              </span>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: '700',
                  backgroundColor: statusInfo.bg,
                  color: statusInfo.text,
                  border: `1px solid ${statusInfo.border}`,
                }}
              >
                {statusInfo.label}
              </span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
              Patient: {record.patientName} &bull; Donor: {record.donorName}
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              {statusInfo.description}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleSync}
              disabled={syncing || record.status === ReplacementTrackingStatus.CANCELLED}
              title="Synchronize live status from laboratory, inventory, crossmatch, and billing records"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#334155',
                cursor: syncing || record.status === ReplacementTrackingStatus.CANCELLED ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: syncing ? 'spin 0.8s linear infinite' : 'none' }}>
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              {syncing ? 'Synchronizing...' : 'Refresh Status'}
            </button>

            {!record.donationCode && record.status !== ReplacementTrackingStatus.CANCELLED && (
              <button
                onClick={() => setShowLinkModal(true)}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(220,38,38,0.2)',
                }}
              >
                + Link Physical Donation
              </button>
            )}

            {record.status !== ReplacementTrackingStatus.CANCELLED && (
              <button
                onClick={() => setShowCancelModal(true)}
                style={{
                  padding: '9px 14px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel Tracking
              </button>
            )}
          </div>
        </div>

        {/* Executive 4-Pillar Summary Ribbon */}
        <div
          className="summary-ribbon"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
          }}
        >
          {/* Pillar 1: Patient Blood Request */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#b91c1c', marginBottom: '4px' }}>
              Patient Requisition
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              {record.patientName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <span
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: '800',
                  fontSize: '12px',
                }}
              >
                {record.patientBloodGroup.replace('_', ' ')}
              </span>
              <span style={{ fontSize: '13px', color: '#475569' }}>
                Req:{' '}
                <Link
                  href={`/admin/blood-requests?requestId=${encodeURIComponent(record.bloodRequestId)}&requestCode=${encodeURIComponent(record.requestCode)}&returnTo=/admin/replacement-donations/${record._id}`}
                  style={{ fontFamily: 'monospace', fontWeight: '600', color: '#2563eb', textDecoration: 'none' }}
                >
                  {record.requestCode}
                </Link>
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Component: <strong>{(trace?.patientRequest?.requestedComponent || 'WHOLE_BLOOD').replace(/_/g, ' ')}</strong> ({trace?.patientRequest?.unitsRequested || 1} unit)
            </div>
          </div>

          {/* Pillar 2: Relative Donor */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#0369a1', marginBottom: '4px' }}>
              Relative Donor Contribution
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              {record.donorName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <span
                style={{
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: '800',
                  fontSize: '12px',
                }}
              >
                {record.donorBloodGroup.replace('_', ' ')}
              </span>
              <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                Relationship: {record.relationshipToPatient}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Donor ID: <span style={{ fontFamily: 'monospace' }}>{record.donorCode}</span>
              {record.donorPhone ? ` • ${record.donorPhone}` : ''}
            </div>
          </div>

          {/* Pillar 3: Clinical Fulfillment Status */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#166534', marginBottom: '4px' }}>
              Patient Issue Fulfillment
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
              {record.issueCode ? (
                <span style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Issued ({record.issueCode})
                </span>
              ) : trace?.crossmatching?.isAuthorized ? (
                <span style={{ color: '#0284c7' }}>Crossmatched & Authorized</span>
              ) : (
                <span style={{ color: '#64748b' }}>Awaiting Crossmatch & Issue</span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
              Issued Unit:{' '}
              <strong style={{ fontFamily: 'monospace', color: record.issuedUnitCode ? '#166534' : '#64748b' }}>
                {record.issuedUnitCode || trace?.bloodIssue?.issuedUnits?.[0]?.unitCode || 'Pending Match'}
              </strong>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Crossmatch: <strong>{trace?.crossmatching?.compatibilityResult || 'PENDING'}</strong>
            </div>
          </div>

          {/* Pillar 4: Billing Snapshot */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#7c3aed', marginBottom: '4px' }}>
              Billing & Settlement
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
              {record.invoiceNumber ? (
                <span>Invoice: <span style={{ fontFamily: 'monospace' }}>{record.invoiceNumber}</span></span>
              ) : (
                <span style={{ color: '#94a3b8' }}>Unbilled</span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
              Status:{' '}
              <span
                style={{
                  fontWeight: '700',
                  color: (record.paymentStatus || trace?.payment?.status) === 'PAID' ? '#166534' : '#b45309',
                }}
              >
                {record.paymentStatus || trace?.payment?.status || 'NOT_INVOICED'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Total: <strong>₹{record.invoiceTotalAmount ?? trace?.payment?.subtotal ?? 0}</strong> &bull; Due:{' '}
              <strong style={{ color: (record.invoiceBalanceDue ?? trace?.payment?.balanceDue ?? 0) > 0 ? '#b91c1c' : '#166534' }}>
                ₹{record.invoiceBalanceDue ?? trace?.payment?.balanceDue ?? 0}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. VISUAL WORKFLOW TRACKER (6 STAGES) */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 2px 0' }}>
              Workflow Lifecycle Tracker
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Tracks progress across donor intake, laboratory quality gates, clinical crossmatching, and billing reconciliation.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontWeight: '600' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#166534' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} /> Completed
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#b45309' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> In Progress
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} /> Pending
            </span>
          </div>
        </div>

        {/* Stepper Grid (Horizontal on Desktop, Vertical on Mobile via media query) */}
        <div
          className="stepper-container"
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '6px',
          }}
        >
          {workflowSteps.map((step, idx) => {
            const isCompleted = step.status === 'COMPLETED';
            const isInProgress = step.status === 'IN_PROGRESS';
            const isRejected = step.status === 'REJECTED';
            const isNA = step.status === 'NOT_APPLICABLE';

            let borderColor = '#e2e8f0';
            let bgHeader = '#f8fafc';
            let numBg = '#e2e8f0';
            let numColor = '#475569';
            let badgeBg = '#f1f5f9';
            let badgeColor = '#64748b';

            if (isCompleted) {
              borderColor = '#bbf7d0';
              bgHeader = '#f0fdf4';
              numBg = '#16a34a';
              numColor = '#ffffff';
              badgeBg = '#dcfce7';
              badgeColor = '#166534';
            } else if (isInProgress) {
              borderColor = '#fde68a';
              bgHeader = '#fffbeb';
              numBg = '#d97706';
              numColor = '#ffffff';
              badgeBg = '#fef3c7';
              badgeColor = '#92400e';
            } else if (isRejected) {
              borderColor = '#fca5a5';
              bgHeader = '#fef2f2';
              numBg = '#dc2626';
              numColor = '#ffffff';
              badgeBg = '#fee2e2';
              badgeColor = '#b91c1c';
            } else if (isNA) {
              borderColor = '#e2e8f0';
              bgHeader = '#f8fafc';
              numBg = '#94a3b8';
              numColor = '#ffffff';
              badgeBg = '#f1f5f9';
              badgeColor = '#64748b';
            }

            return (
              <React.Fragment key={step.number}>
                <div
                  className="step-card"
                  style={{
                    flex: '1 1 0px',
                    minWidth: '180px',
                    borderRadius: '12px',
                    border: `1px solid ${borderColor}`,
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: isInProgress ? '0 2px 6px rgba(217,119,6,0.1)' : 'none',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 12px',
                      backgroundColor: bgHeader,
                      borderBottom: `1px solid ${borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: numBg,
                          color: numColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '800',
                          flexShrink: 0,
                        }}
                      >
                        {isCompleted ? '✓' : step.number}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {step.title}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: badgeBg,
                        color: badgeColor,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {step.statusBadge}
                    </span>
                  </div>

                  <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                      {step.summary}
                    </p>
                    <div style={{ fontSize: '10px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                      Role: <strong>{step.responsibleRole}</strong>
                    </div>
                  </div>
                </div>

                {idx < workflowSteps.length - 1 && (
                  <div
                    className="step-arrow"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isCompleted ? '#22c55e' : '#cbd5e1',
                      padding: '0 2px',
                      flexShrink: 0,
                    }}
                  >
                    &rarr;
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 3. CENTRALIZED GUIDED WORKFLOW PANEL */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
          marginBottom: '24px',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #bfdbfe',
              }}
            >
              Interactive Operations Desk
            </span>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
            Centralized Guided Workflow Navigation
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
            Monitor and execute each workflow step across hospital departments. Click contextual buttons to open the relevant modules with pre-filled case data. When finished, return here to continue from the next eligible step.
          </p>
        </div>

        {/* Hero CTA Banner: Next Recommended Operational Step */}
        {nextAction ? (
          <div
            className="hero-cta-card"
            style={{
              backgroundColor: '#f8fafc',
              borderRadius: '14px',
              border: '2px solid #3b82f6',
              padding: '20px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              boxShadow: '0 4px 12px rgba(59,130,246,0.08)',
            }}
          >
            <div style={{ flex: '1 1 600px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    backgroundColor: '#1d4ed8',
                    color: '#ffffff',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    letterSpacing: '0.04em',
                  }}
                >
                  NEXT ACTION: STEP {nextAction.stepNumber}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    backgroundColor: '#e2e8f0',
                    color: '#334155',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  Role: {nextAction.responsibleRole}
                </span>
                {nextAction.canUserAct ? (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid #86efac',
                    }}
                  >
                    ✓ Authorized ({adminUser?.role})
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid #fde68a',
                    }}
                  >
                    ⚠ Role Required ({adminUser?.role || 'Guest'})
                  </span>
                )}
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
                {nextAction.headline}
              </h3>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                {nextAction.explanation}
              </p>

              {!nextAction.canUserAct && (
                <div
                  style={{
                    fontSize: '12px',
                    color: '#b45309',
                    backgroundColor: '#fffbeb',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #fde68a',
                    display: 'inline-block',
                    marginTop: '4px',
                  }}
                >
                  {nextAction.permissionReason || 'Your current account role does not have authorization to perform this step.'}
                </div>
              )}
            </div>

            <div style={{ flexShrink: 0 }}>
              {nextAction.actionType === 'MODAL' ? (
                <button
                  onClick={() => setShowLinkModal(true)}
                  disabled={!nextAction.canUserAct}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: nextAction.canUserAct ? '#dc2626' : '#cbd5e1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: nextAction.canUserAct ? 'pointer' : 'not-allowed',
                    boxShadow: nextAction.canUserAct ? '0 2px 4px rgba(220,38,38,0.25)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span>{nextAction.actionLabel}</span>
                </button>
              ) : nextAction.canUserAct && nextAction.actionHref ? (
                <Link
                  href={nextAction.actionHref}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '700',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                  }}
                >
                  <span>{nextAction.actionLabel}</span>
                </Link>
              ) : (
                <button
                  disabled
                  title={nextAction.permissionReason || 'Missing permissions'}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#e2e8f0',
                    color: '#94a3b8',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'not-allowed',
                  }}
                >
                  {nextAction.actionLabel}
                </button>
              )}
            </div>
          </div>
        ) : record.status === ReplacementTrackingStatus.CANCELLED ? (
          <div
            style={{
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              padding: '16px 20px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '20px' }}>🛑</span>
            <div>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>Tracking Stopped:</strong>{' '}
              <span style={{ fontSize: '13px', color: '#475569' }}>
                This case was cancelled. Reason: &quot;{record.cancellationReason || 'No reason provided'}&quot;. The patient&apos;s requisition remains active independently.
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: '#f0fdf4',
              borderRadius: '12px',
              border: '1px solid #86efac',
              padding: '16px 20px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '20px', color: '#16a34a' }}>✓</span>
            <div>
              <strong style={{ fontSize: '14px', color: '#166534' }}>All Workflow Stages Completed:</strong>{' '}
              <span style={{ fontSize: '13px', color: '#15803d' }}>
                The relative donation was screened and released to active inventory, the patient received an authorized compatible blood unit, and the associated billing has been settled in full.
              </span>
            </div>
          </div>
        )}

        {/* 6-Stage Interactive Operational Cards Grid */}
        <div
          className="guided-workflow-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '18px',
          }}
        >
          {workflowSteps.map((step) => {
            const isCompleted = step.status === 'COMPLETED';
            const isInProgress = step.status === 'IN_PROGRESS';
            const isRejected = step.status === 'REJECTED';
            const isNA = step.status === 'NOT_APPLICABLE';

            let cardBorder = '#e2e8f0';
            let headerBg = '#f8fafc';
            let badgeBg = '#f1f5f9';
            let badgeText = '#475569';
            let numColor = '#ffffff';
            let numBg = '#64748b';

            if (isCompleted) {
              cardBorder = '#bbf7d0';
              headerBg = '#f0fdf4';
              badgeBg = '#dcfce7';
              badgeText = '#166534';
              numBg = '#16a34a';
            } else if (isInProgress) {
              cardBorder = '#fde68a';
              headerBg = '#fffbeb';
              badgeBg = '#fef3c7';
              badgeText = '#92400e';
              numBg = '#d97706';
            } else if (isRejected) {
              cardBorder = '#fca5a5';
              headerBg = '#fef2f2';
              badgeBg = '#fee2e2';
              badgeText = '#b91c1c';
              numBg = '#dc2626';
            } else if (isNA) {
              cardBorder = '#e2e8f0';
              headerBg = '#f8fafc';
              badgeBg = '#f1f5f9';
              badgeText = '#64748b';
              numBg = '#94a3b8';
            }

            return (
              <div
                key={step.number}
                style={{
                  borderRadius: '14px',
                  border: `1px solid ${cardBorder}`,
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isInProgress ? '0 2px 6px rgba(217,119,6,0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                  overflow: 'hidden',
                }}
              >
                {/* Card Header */}
                <div
                  style={{
                    padding: '14px 16px',
                    backgroundColor: headerBg,
                    borderBottom: `1px solid ${cardBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        backgroundColor: numBg,
                        color: numColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '800',
                        flexShrink: 0,
                      }}
                    >
                      {isCompleted ? '✓' : step.number}
                    </span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                        {step.title}
                      </h4>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                        {step.shortDesc}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: badgeBg,
                      color: badgeText,
                      border: `1px solid ${cardBorder}`,
                    }}
                  >
                    {step.statusBadge}
                  </span>
                </div>

                {/* Card Body */}
                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#334155', lineHeight: '1.45' }}>
                    {step.summary}
                  </p>

                  {/* Concrete References Box */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      marginBottom: '12px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '8px',
                    }}
                  >
                    {step.references.map((ref, rIdx) => (
                      <div key={rIdx}>
                        <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: '#64748b', letterSpacing: '0.03em' }}>
                          {ref.label}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#0f172a',
                            fontFamily: ref.isCode ? 'monospace' : 'inherit',
                          }}
                        >
                          {ref.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Clinical Notice if applicable */}
                  {step.clinicalNotice && (
                    <div
                      style={{
                        backgroundColor: '#eff6ff',
                        borderRadius: '6px',
                        border: '1px solid #bfdbfe',
                        padding: '8px 10px',
                        fontSize: '11px',
                        color: '#1e40af',
                        lineHeight: '1.4',
                        marginBottom: '12px',
                      }}
                    >
                      <strong>Clinical Gate:</strong> {step.clinicalNotice}
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', fontSize: '11px' }}>
                      <span style={{ color: '#64748b' }}>
                        Assigned: <strong>{step.responsibleRole}</strong>
                      </span>
                      {step.canUserAct ? (
                        <span style={{ color: '#166534', fontWeight: '700' }}>✓ Permitted</span>
                      ) : (
                        <span style={{ color: '#b45309', fontWeight: '600' }} title={step.permissionReason}>
                          ⚠ Restricted
                        </span>
                      )}
                    </div>

                    {/* Contextual Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {step.primaryAction.type === 'MODAL' ? (
                        <button
                          onClick={() => setShowLinkModal(true)}
                          disabled={!step.canUserAct}
                          style={{
                            flex: 1,
                            padding: '8px 14px',
                            backgroundColor: step.canUserAct ? '#dc2626' : '#e2e8f0',
                            color: step.canUserAct ? '#ffffff' : '#94a3b8',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: step.canUserAct ? 'pointer' : 'not-allowed',
                            boxShadow: step.canUserAct ? '0 1px 2px rgba(220,38,38,0.2)' : 'none',
                          }}
                        >
                          {step.primaryAction.label}
                        </button>
                      ) : step.primaryAction.type === 'NAVIGATE' && step.primaryAction.href ? (
                        <Link
                          href={step.primaryAction.href}
                          style={{
                            flex: 1,
                            padding: '8px 14px',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            textAlign: 'center',
                            textDecoration: 'none',
                            boxShadow: '0 1px 2px rgba(15,23,42,0.1)',
                          }}
                        >
                          {step.primaryAction.label} &rarr;
                        </Link>
                      ) : (
                        <button
                          disabled
                          title={step.primaryAction.disabledReason || 'Prerequisite not met'}
                          style={{
                            flex: 1,
                            padding: '8px 14px',
                            backgroundColor: '#f1f5f9',
                            color: '#94a3b8',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'not-allowed',
                          }}
                        >
                          {step.primaryAction.label}
                        </button>
                      )}

                      {step.secondaryAction && (
                        <Link
                          href={step.secondaryAction.href}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#f8fafc',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {step.secondaryAction.label}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. TWO DISTINCT BLOOD UNITS (STRICT CLINICAL SEPARATION) */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
            Unit Separation Verification
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            The relative&apos;s donated unit enters general hospital stock. The patient receives an independently crossmatched compatible unit.
          </p>
        </div>

        <div
          className="dual-unit-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Unit A: Donated Replacement Unit (From Relative) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #bae6fd',
              boxShadow: '0 2px 4px rgba(2,132,199,0.04)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                backgroundColor: '#f0f9ff',
                padding: '16px 20px',
                borderBottom: '1px solid #bae6fd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#0284c7', letterSpacing: '0.05em' }}>
                  Relative&apos;s Donated Blood Unit
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '2px 0 0 0' }}>
                  Donation: {record.donationCode || 'Awaiting Collection'}
                </h3>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: trace?.relativeDonation?.isReleasedToInventory ? '#dcfce7' : '#e0f2fe',
                  color: trace?.relativeDonation?.isReleasedToInventory ? '#166534' : '#0369a1',
                  border: `1px solid ${trace?.relativeDonation?.isReleasedToInventory ? '#86efac' : '#bae6fd'}`,
                }}
              >
                {trace?.relativeDonation?.isReleasedToInventory ? 'In Active Inventory' : 'In Lab Intake / Testing'}
              </span>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px', marginBottom: '16px' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Donor Name:</span>
                  <strong style={{ color: '#0f172a' }}>{record.donorName}</strong>
                  <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>({record.donorCode})</div>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Donated Blood Group:</span>
                  <span
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#e0f2fe',
                      color: '#0369a1',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: '800',
                      fontSize: '12px',
                      marginTop: '2px',
                    }}
                  >
                    {record.donorBloodGroup.replace('_', ' ')}
                  </span>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Blood Unit Code:</span>
                  {record.unitCode ? (
                    <strong style={{ fontFamily: 'monospace', color: '#166534', fontSize: '14px' }}>
                      {record.unitCode}
                    </strong>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Awaiting lab processing</span>
                  )}
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Laboratory Testing:</span>
                  <strong style={{ color: trace?.relativeDonation?.unitStatus === 'APPROVED' ? '#166534' : '#b45309' }}>
                    {trace?.relativeDonation?.unitStatus || (record.donationCode ? 'Testing in progress' : 'Pending draw')}
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Supervisor Approval:</span>
                  <strong style={{ color: trace?.relativeDonation?.isReleasedToInventory ? '#166534' : '#64748b' }}>
                    {trace?.relativeDonation?.isReleasedToInventory ? 'Approved by Supervisor' : (trace?.relativeDonation?.unitStatus === 'APPROVED' ? 'Pending Supervisor Release' : 'Awaiting Test Clearance')}
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Inventory Availability:</span>
                  <strong style={{ color: trace?.relativeDonation?.isReleasedToInventory ? '#166534' : '#64748b' }}>
                    {trace?.relativeDonation?.isReleasedToInventory ? 'Available for ANY Matching Patient' : 'Not yet in active inventory'}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                  color: '#475569',
                  lineHeight: '1.4',
                }}
              >
                <strong>Destination:</strong> General Hospital Blood Bank Stock. This unit is distributed to any compatible recipient based on clinical priority.
              </div>
            </div>
          </div>

          {/* Unit B: Patient-Issued Unit (From Inventory) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #bbf7d0',
              boxShadow: '0 2px 4px rgba(22,101,52,0.04)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                backgroundColor: '#f0fdf4',
                padding: '16px 20px',
                borderBottom: '1px solid #bbf7d0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#16a34a', letterSpacing: '0.05em' }}>
                  Patient-Issued Blood Unit
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '2px 0 0 0' }}>
                  Issue: {record.issueCode || trace?.bloodIssue?.issueCode || 'Pending Medical Issue'}
                </h3>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: record.issueCode ? '#dcfce7' : '#f1f5f9',
                  color: record.issueCode ? '#166534' : '#475569',
                  border: `1px solid ${record.issueCode ? '#86efac' : '#cbd5e1'}`,
                }}
              >
                {record.issueCode ? 'Unit Dispensed to Patient' : 'Awaiting Fulfillment'}
              </span>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px', marginBottom: '16px' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Recipient Patient:</span>
                  <strong style={{ color: '#0f172a' }}>{record.patientName}</strong>
                  <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>Req: {record.requestCode}</div>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Patient Blood Group:</span>
                  <span
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: '800',
                      fontSize: '12px',
                      marginTop: '2px',
                    }}
                  >
                    {record.patientBloodGroup.replace('_', ' ')}
                  </span>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Issued Unit Code:</span>
                  {record.issuedUnitCode || trace?.bloodIssue?.issuedUnits?.[0]?.unitCode ? (
                    <strong style={{ fontFamily: 'monospace', color: '#166534', fontSize: '14px' }}>
                      {record.issuedUnitCode || trace?.bloodIssue?.issuedUnits?.[0]?.unitCode}
                    </strong>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Awaiting crossmatch reservation</span>
                  )}
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Issued Blood Group & Component:</span>
                  <strong style={{ color: '#0f172a' }}>
                    {trace?.crossmatching?.selectedUnitBloodGroup?.replace('_', ' ') || trace?.bloodIssue?.issuedUnits?.[0]?.bloodGroup?.replace('_', ' ') || record.patientBloodGroup.replace('_', ' ')} &bull; {(trace?.patientRequest?.requestedComponent || 'PRBC').replace(/_/g, ' ')}
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Crossmatch Result:</span>
                  <strong style={{ color: trace?.crossmatching?.compatibilityResult === 'COMPATIBLE' ? '#166534' : '#64748b' }}>
                    {trace?.crossmatching?.compatibilityResult || 'PENDING'}
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Medical Authorization:</span>
                  <strong style={{ color: trace?.crossmatching?.isAuthorized ? '#166534' : '#64748b' }}>
                    {trace?.crossmatching?.isAuthorized ? 'Authorized by Transfusion Supervisor' : 'Pending Authorization'}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                  color: '#475569',
                  lineHeight: '1.4',
                }}
              >
                <strong>Source:</strong> Sourced strictly from verified compatible inventory. Patient receives blood solely based on clinical matching and supervisor authorization.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. BILLING & RECONCILIATION SUMMARY */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 2px 0' }}>
              Financial Reconciliation & Billing
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Traceable invoice records generated from the standard blood issue tariff schedule.
            </p>
          </div>
          {isFinanceUser && record.invoiceNumber && (
            <Link
              href={`/admin/finance/billing?search=${encodeURIComponent(record.invoiceNumber)}&returnTo=/admin/replacement-donations/${record._id}`}
              style={{ fontSize: '13px', color: '#2563eb', fontWeight: '600', textDecoration: 'none' }}
            >
              Open Invoice in Billing Desk &rarr;
            </Link>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginBottom: '2px' }}>
              Invoice Number
            </div>
            <div style={{ fontSize: '16px', fontWeight: '800', fontFamily: 'monospace', color: '#0f172a' }}>
              {record.invoiceNumber || trace?.payment?.invoiceNumber || 'Not Generated Yet'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Status:{' '}
              <span
                style={{
                  fontWeight: '700',
                  color: (record.paymentStatus || trace?.payment?.status) === 'PAID' ? '#166534' : '#b45309',
                }}
              >
                {record.paymentStatus || trace?.payment?.status || 'UNBILLED'}
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginBottom: '2px' }}>
              Subtotal Charge
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              ₹{record.invoiceTotalAmount ?? trace?.payment?.subtotal ?? 0}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Per approved tariff</div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginBottom: '2px' }}>
              Authorized Waiver
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#15803d' }}>
              - ₹{record.invoiceWaiverAmount ?? trace?.payment?.waiverTotal ?? 0}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Supervisory concession</div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginBottom: '2px' }}>
              Amount Paid
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              ₹{record.invoicePaidAmount ?? trace?.payment?.paidAmount ?? 0}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Receipted collection</div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginBottom: '2px' }}>
              Outstanding Balance
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: '800',
                color: (record.invoiceBalanceDue ?? trace?.payment?.balanceDue ?? 0) > 0 ? '#b91c1c' : '#166534',
              }}
            >
              ₹{record.invoiceBalanceDue ?? trace?.payment?.balanceDue ?? 0}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {(record.invoiceBalanceDue ?? trace?.payment?.balanceDue ?? 0) === 0 ? 'Fully Settled' : 'Payment Due'}
            </div>
          </div>
        </div>
      </div>

      {/* 6. INTERNAL CASE NOTES & AUDIT TIMELINE */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
          marginBottom: '24px',
        }}
      >
        {/* Notes Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Operational Case Notes
            </h2>
            {!isEditingNotes && (
              <button
                onClick={() => setIsEditingNotes(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Edit Notes
              </button>
            )}
          </div>

          {isEditingNotes ? (
            <div>
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={4}
                placeholder="Enter internal operational notes regarding this replacement donor/case..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '10px',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsEditingNotes(false)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: record.notes ? '#334155' : '#94a3b8', fontStyle: record.notes ? 'normal' : 'italic', lineHeight: '1.5' }}>
              {record.notes || 'No internal operational notes entered.'}
            </p>
          )}

          {record.cancellationReason && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b', marginBottom: '2px' }}>
                Cancellation Reason:
              </div>
              <div style={{ fontSize: '13px', color: '#b91c1c' }}>{record.cancellationReason}</div>
            </div>
          )}
        </div>

        {/* Audit Timeline Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 16px 0' }}>
            Case Audit Timeline
          </h2>

          {record.timeline?.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>No audit events recorded.</p>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '20px' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '6px',
                  top: '6px',
                  bottom: '6px',
                  width: '2px',
                  backgroundColor: '#e2e8f0',
                }}
              />

              {record.timeline.map((item, idx) => {
                const eventConfig = STATUS_CONFIG[item.status] || {
                  bg: '#f1f5f9',
                  text: '#475569',
                  border: '#cbd5e1',
                  label: item.status,
                };

                let eventTitle = item.event.replace(/_/g, ' ');
                if (item.event === 'CASE_CREATED') eventTitle = 'Replacement Tracking Opened';
                if (item.event === 'DONOR_ASSOCIATED') eventTitle = 'Relative Donor Associated';
                if (item.event === 'DONATION_LINKED') eventTitle = 'Physical Donation Linked';
                if (item.event === 'STATUS_SYNCED') eventTitle = 'Lifecycle Synchronized';
                if (item.event === 'PATIENT_UNIT_ISSUED') eventTitle = 'Patient Blood Unit Issued';
                if (item.event === 'CASE_CANCELLED') eventTitle = 'Case Tracking Cancelled';

                return (
                  <div key={idx} style={{ position: 'relative', marginBottom: '16px' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: '-18px',
                        top: '4px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: eventConfig.text,
                        border: '2px solid #ffffff',
                        boxShadow: '0 0 0 2px #e2e8f0',
                      }}
                    />

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                          {eventTitle}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: eventConfig.bg,
                            color: eventConfig.text,
                          }}
                        >
                          {eventConfig.label}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {new Date(item.timestamp).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#475569', lineHeight: '1.4' }}>
                        {item.description}
                      </p>

                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        By: <strong>{item.actorName}</strong> ({item.actorRole})
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Link Physical Donation */}
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
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
              Link Physical Donation Record
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
              Link the completed donation record for donor <strong>{record.donorName}</strong> ({record.donorCode}).
            </p>

            <form onSubmit={handleLinkDonation}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Donation Record ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 24-character ObjectId"
                  value={manualDonationId}
                  onChange={(e) => setManualDonationId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

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
                  type="submit"
                  disabled={linkingDonation}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: linkingDonation ? 'not-allowed' : 'pointer',
                  }}
                >
                  {linkingDonation ? 'Linking...' : 'Confirm Link'}
                </button>
              </div>
            </form>
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
              Provide an operational reason for stopping tracking for this relative donation case. The patient&apos;s blood request will remain unaffected.
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
