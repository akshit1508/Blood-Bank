'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { AdminRole } from '@/lib/auth-api';
import {
  CampaignItem,
  CampaignFinancials,
  CampaignBudgetRevisionItem,
  CampaignStatus,
  ExpenseCategory,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_BADGE_COLORS,
  EXPENSE_CATEGORY_LABELS,
  fetchCampaignById,
  fetchCampaignFinancials,
  fetchCampaignBudgetRevisions,
  reviseCampaignBudget,
  updateCampaign,
  linkExpenseToCampaign,
  unlinkExpenseFromCampaign,
  fetchAvailableExpensesForLinking,
  createCampaignExpenditure,
  approveCampaignExpense,
  rejectCampaignExpense,
  getReceiptStreamUrl,
  CreateCampaignExpensePayload,
  CampaignBloodUnitsReport,
  CampaignBloodUnitItem,
  fetchCampaignBloodUnits,
  intakeCampaignUnitsToInventory,
  recordCampaignDonation,
  updateCampaignUnitTestingDecision,
  RecordCampaignDonationPayload,
} from '@/lib/campaign-api';
import { submitExpense } from '@/lib/expense-api';
import { fetchDonors } from '@/lib/donor-api';
import {
  CampaignVolunteersResponse,
  CampaignVolunteerAssignment,
  Volunteer,
  VolunteerRole,
  VOLUNTEER_ROLE_LABELS,
  fetchCampaignVolunteers,
  assignVolunteerToCampaign,
  registerAndAssignCampaignVolunteer,
  updateVolunteerAttendance,
  removeVolunteerFromCampaign,
  fetchVolunteers,
} from '@/lib/volunteer-api';

export default function CampaignCommandCenterPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { admin } = useAdminAuth();
  const isSuperAdmin = admin?.role === AdminRole.SUPER_ADMIN;

  const [campaign, setCampaign] = useState<CampaignItem | null>(null);
  const [financials, setFinancials] = useState<CampaignFinancials | null>(null);
  const [revisions, setRevisions] = useState<CampaignBudgetRevisionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status Updating
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // Revise Budget Modal State
  const [isReviseModalOpen, setIsReviseModalOpen] = useState<boolean>(false);
  const [newBudgetInput, setNewBudgetInput] = useState<string>('');
  const [revisionReason, setRevisionReason] = useState<string>('');
  const [revising, setRevising] = useState<boolean>(false);
  const [reviseError, setReviseError] = useState<string | null>(null);

  // Add Expenditure Modal State
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState<boolean>(false);
  const [addingExpense, setAddingExpense] = useState<boolean>(false);
  const [addExpenseError, setAddExpenseError] = useState<string | null>(null);
  const [expenseFormData, setExpenseFormData] = useState<{
    title: string;
    category: ExpenseCategory;
    amount: string;
    invoiceNumber: string;
    vendorName: string;
    expenseDate: string;
    description: string;
    taxAmount: string;
    gstinNumber: string;
    receiptFile: File | null;
  }>({
    title: '',
    category: ExpenseCategory.STAFF_CAMP_MEALS,
    amount: '',
    invoiceNumber: '',
    vendorName: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    description: '',
    taxAmount: '',
    gstinNumber: '',
    receiptFile: null,
  });

  // Link Existing Expense Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [availableExpenses, setAvailableExpenses] = useState<any[]>([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>('');
  const [linking, setLinking] = useState<boolean>(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Action in progress IDs
  const [actionExpenseId, setActionExpenseId] = useState<string | null>(null);

  // Blood Units & Central Inventory State
  const [bloodReport, setBloodReport] = useState<CampaignBloodUnitsReport | null>(null);
  const [loadingBloodReport, setLoadingBloodReport] = useState<boolean>(false);
  const [intakingInventory, setIntakingInventory] = useState<boolean>(false);
  const [intakeSuccessMessage, setIntakeSuccessMessage] = useState<string | null>(null);
  const [intakeErrorMessage, setIntakeErrorMessage] = useState<string | null>(null);

  // Record Blood Donation Modal State
  const [isRecordDonationModalOpen, setIsRecordDonationModalOpen] = useState<boolean>(false);
  const [donationDonorType, setDonationDonorType] = useState<'CAMPAIGN_DONOR' | 'REGISTERED'>('CAMPAIGN_DONOR');
  const [recordingDonation, setRecordingDonation] = useState<boolean>(false);
  const [recordDonationError, setRecordDonationError] = useState<string | null>(null);
  const [recordDonationSuccess, setRecordDonationSuccess] = useState<string | null>(null);

  // Campaign donor fields
  const [walkInName, setWalkInName] = useState<string>('');
  const [walkInBloodGroup, setWalkInBloodGroup] = useState<string>('O+');
  const [walkInGender, setWalkInGender] = useState<string>('MALE');
  const [walkInPhone, setWalkInPhone] = useState<string>('');
  const [walkInEmail, setWalkInEmail] = useState<string>('');

  // Registered donor selection
  const [registeredDonors, setRegisteredDonors] = useState<any[]>([]);
  const [selectedDonorId, setSelectedDonorId] = useState<string>('');
  const [searchingDonors, setSearchingDonors] = useState<boolean>(false);

  // Donation & Blood Unit fields
  const [donationComponentType, setDonationComponentType] = useState<string>('WHOLE_BLOOD');
  const [unitVolume, setUnitVolume] = useState<number>(450);
  const [immediateScreening, setImmediateScreening] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [donationNotes, setDonationNotes] = useState<string>('');

  // Action state for unit testing decision
  const [updatingUnitId, setUpdatingUnitId] = useState<string | null>(null);

  // Volunteer Management States
  const [campaignVolunteers, setCampaignVolunteers] = useState<CampaignVolunteersResponse | null>(null);
  const [updatingAttendanceId, setUpdatingAttendanceId] = useState<string | null>(null);
  const [isAssignVolunteerModalOpen, setIsAssignVolunteerModalOpen] = useState<boolean>(false);
  const [availableVolunteers, setAvailableVolunteers] = useState<Volunteer[]>([]);
  const [selectedAssignVolId, setSelectedAssignVolId] = useState<string>('');
  const [selectedAssignRole, setSelectedAssignRole] = useState<VolunteerRole>('GENERAL');
  const [assignSearchInitials, setAssignSearchInitials] = useState<string>('');
  const [assigningVolunteer, setAssigningVolunteer] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Register New Volunteer On-Site Modal
  const [isRegisterVolModalOpen, setIsRegisterVolModalOpen] = useState<boolean>(false);
  const [newVolName, setNewVolName] = useState<string>('');
  const [newVolPhone, setNewVolPhone] = useState<string>('');
  const [newVolEmail, setNewVolEmail] = useState<string>('');
  const [newVolBloodGroup, setNewVolBloodGroup] = useState<string>('O+');
  const [newVolGender, setNewVolGender] = useState<string>('MALE');
  const [newVolCity, setNewVolCity] = useState<string>('');
  const [newVolRole, setNewVolRole] = useState<VolunteerRole>('GENERAL');
  const [newVolNotes, setNewVolNotes] = useState<string>('');
  const [registeringVol, setRegisteringVol] = useState<boolean>(false);
  const [registerVolError, setRegisterVolError] = useState<string | null>(null);

  // Filter and View States
  const [activeTab, setActiveTab] = useState<'all' | 'blood' | 'volunteers' | 'financials'>('all');
  const [bloodSearchTerm, setBloodSearchTerm] = useState<string>('');
  const [bloodFilterGroup, setBloodFilterGroup] = useState<string>('ALL');
  const [bloodFilterStatus, setBloodFilterStatus] = useState<string>('ALL');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'>('ALL');

  const filteredInvoices = useMemo(() => {
    if (!financials?.linkedExpenses) return [];
    if (invoiceStatusFilter === 'ALL') return financials.linkedExpenses;
    return financials.linkedExpenses.filter((e) => e.status === invoiceStatusFilter);
  }, [financials?.linkedExpenses, invoiceStatusFilter]);

  const loadAllData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch general campaign
      const campData = await fetchCampaignById(id);
      setCampaign(campData);
      setNewBudgetInput(String(campData.approvedBudget || 0));

      // Fetch financials, revisions, blood units, and volunteers report concurrently
      const [finData, revData, bloodData, volData] = await Promise.allSettled([
        fetchCampaignFinancials(id),
        fetchCampaignBudgetRevisions(id),
        fetchCampaignBloodUnits(id),
        fetchCampaignVolunteers(id),
      ]);

      if (finData.status === 'fulfilled') {
        setFinancials(finData.value);
      }
      if (revData.status === 'fulfilled') {
        setRevisions(revData.value);
      }
      if (bloodData.status === 'fulfilled') {
        setBloodReport(bloodData.value);
      }
      if (volData.status === 'fulfilled') {
        setCampaignVolunteers(volData.value);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign command center.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleStatusChange = async (nextStatus: CampaignStatus) => {
    if (!campaign || campaign.status === nextStatus) return;
    try {
      setUpdatingStatus(true);
      await updateCampaign(campaign._id, { status: nextStatus });
      await loadAllData();
    } catch (err: any) {
      alert(`Status transition failed: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReviseBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    const numBudget = Number(newBudgetInput);
    if (isNaN(numBudget) || numBudget < 0) {
      setReviseError('Budget must be a non-negative number.');
      return;
    }
    if (!revisionReason.trim()) {
      setReviseError('Mandatory justification reason is required for budget revisions.');
      return;
    }

    try {
      setRevising(true);
      setReviseError(null);
      await reviseCampaignBudget(campaign._id, {
        newBudget: numBudget,
        reason: revisionReason.trim(),
        budgetVersion: campaign.budgetVersion,
      });

      setIsReviseModalOpen(false);
      setRevisionReason('');
      await loadAllData();
    } catch (err: any) {
      setReviseError(err.message || 'Budget revision failed.');
    } finally {
      setRevising(false);
    }
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    if (!expenseFormData.title.trim()) {
      setAddExpenseError('Expenditure title / item description is required.');
      return;
    }
    const numAmount = Number(expenseFormData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setAddExpenseError('Amount must be greater than zero.');
      return;
    }
    if (!expenseFormData.invoiceNumber.trim()) {
      setAddExpenseError('Invoice / Bill Number is required for systematic tracking.');
      return;
    }
    if (!expenseFormData.vendorName.trim()) {
      setAddExpenseError('Vendor / Merchant Name is required.');
      return;
    }

    try {
      setAddingExpense(true);
      setAddExpenseError(null);
      await createCampaignExpenditure(campaign._id, {
        title: expenseFormData.title.trim(),
        category: expenseFormData.category,
        amount: numAmount,
        invoiceNumber: expenseFormData.invoiceNumber.trim(),
        vendorName: expenseFormData.vendorName.trim(),
        expenseDate: expenseFormData.expenseDate,
        description: expenseFormData.description.trim() || undefined,
        taxAmount: expenseFormData.taxAmount ? Number(expenseFormData.taxAmount) : undefined,
        gstinNumber: expenseFormData.gstinNumber.trim() || undefined,
        receiptFile: expenseFormData.receiptFile,
      });

      setIsAddExpenseModalOpen(false);
      setExpenseFormData({
        title: '',
        category: ExpenseCategory.STAFF_CAMP_MEALS,
        amount: '',
        invoiceNumber: '',
        vendorName: '',
        expenseDate: new Date().toISOString().slice(0, 10),
        description: '',
        taxAmount: '',
        gstinNumber: '',
        receiptFile: null,
      });
      await loadAllData();
    } catch (err: any) {
      setAddExpenseError(err.message || 'Failed to record campaign expenditure.');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleApproveExpense = async (expenseId: string, voucherNum: string) => {
    if (!confirm(`Confirm approval of invoice ${voucherNum} for this campaign?`)) return;
    try {
      setActionExpenseId(expenseId);
      await approveCampaignExpense(expenseId, 'Approved for campaign budget accounting');
      await loadAllData();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setActionExpenseId(null);
    }
  };

  const handleRejectExpense = async (expenseId: string, voucherNum: string) => {
    const reason = prompt(`Enter rejection reason for invoice ${voucherNum}:`);
    if (!reason || !reason.trim()) return;

    try {
      setActionExpenseId(expenseId);
      await rejectCampaignExpense(expenseId, reason.trim());
      await loadAllData();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setActionExpenseId(null);
    }
  };

  const handleSubmitDraftExpense = async (expenseId: string, voucherNum: string) => {
    try {
      setActionExpenseId(expenseId);
      await submitExpense(expenseId);
      await loadAllData();
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setActionExpenseId(null);
    }
  };

  const handleOpenLinkModal = async () => {
    try {
      setLinkError(null);
      setIsLinkModalOpen(true);
      const exps = await fetchAvailableExpensesForLinking();
      setAvailableExpenses(exps);
      if (exps.length > 0) {
        setSelectedExpenseId(exps[0]._id);
      }
    } catch (err: any) {
      setLinkError('Failed to load eligible unlinked expenses.');
    }
  };

  const handleLinkExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign || !selectedExpenseId) return;

    try {
      setLinking(true);
      setLinkError(null);
      await linkExpenseToCampaign(campaign._id, selectedExpenseId);
      setIsLinkModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      setLinkError(err.message || 'Failed to link expense.');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkExpense = async (expenseId: string, voucherNum: string) => {
    if (!campaign) return;
    if (!confirm(`Are you sure you want to unlink voucher ${voucherNum} from this campaign?`)) return;

    try {
      setActionExpenseId(expenseId);
      await unlinkExpenseFromCampaign(campaign._id, expenseId);
      await loadAllData();
    } catch (err: any) {
      alert(`Unlink failed: ${err.message}`);
    } finally {
      setActionExpenseId(null);
    }
  };

  const handleIntakePassedUnits = async () => {
    if (!campaign) return;
    try {
      setIntakingInventory(true);
      setIntakeSuccessMessage(null);
      setIntakeErrorMessage(null);

      const res = await intakeCampaignUnitsToInventory(campaign._id);
      setIntakeSuccessMessage(res.message);
      const updated = await fetchCampaignBloodUnits(campaign._id);
      setBloodReport(updated);
    } catch (err: any) {
      setIntakeErrorMessage(err.message || 'Failed to intake passed blood units to Central Inventory.');
    } finally {
      setIntakingInventory(false);
    }
  };

  const handleRefreshBloodReport = async () => {
    if (!campaign) return;
    try {
      setLoadingBloodReport(true);
      const updated = await fetchCampaignBloodUnits(campaign._id);
      setBloodReport(updated);
    } catch (err: any) {
      alert(`Failed to refresh blood collection pipeline: ${err.message}`);
    } finally {
      setLoadingBloodReport(false);
    }
  };

  const handleOpenRecordDonationModal = async () => {
    setIsRecordDonationModalOpen(true);
    setRecordDonationError(null);
    setRecordDonationSuccess(null);
    setDonationDonorType('CAMPAIGN_DONOR');
    setWalkInName('');
    setWalkInPhone('');
    setWalkInEmail('');
    setWalkInBloodGroup('O+');
    setWalkInGender('MALE');
    setSelectedDonorId('');
    setDonationNotes('');
    setUnitVolume(450);
    setDonationComponentType('WHOLE_BLOOD');
    setImmediateScreening('PENDING');

    try {
      setSearchingDonors(true);
      const donors = await fetchDonors({ status: 'ACTIVE' });
      setRegisteredDonors(donors);
      if (donors.length > 0) {
        setSelectedDonorId(donors[0]._id);
      }
    } catch {
      // Ignore
    } finally {
      setSearchingDonors(false);
    }
  };

  const handleRecordDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    try {
      setRecordingDonation(true);
      setRecordDonationError(null);
      setRecordDonationSuccess(null);

      const payload: RecordCampaignDonationPayload = {
        donationType: 'WHOLE_BLOOD',
        componentType: donationComponentType,
        volume: Number(unitVolume) || 450,
        immediateScreeningDecision: immediateScreening,
        notes: donationNotes.trim() || undefined,
      };

      if (donationDonorType === 'REGISTERED') {
        if (!selectedDonorId) {
          throw new Error('Please select an active registered donor.');
        }
        payload.donorId = selectedDonorId;
      } else {
        if (!walkInName.trim()) {
          throw new Error('Donor Full Name is required.');
        }
        if (!walkInPhone.trim()) {
          throw new Error('Donor Phone Number is required.');
        }
        payload.donorFullName = walkInName.trim();
        payload.donorBloodGroup = walkInBloodGroup;
        payload.donorGender = walkInGender;
        payload.donorPhone = walkInPhone.trim();
        payload.donorEmail = walkInEmail.trim() || undefined;
      }

      const res = await recordCampaignDonation(campaign._id, payload);
      setRecordDonationSuccess(res.message);

      // Reload pipeline & financials immediately
      const [updatedBlood, updatedFin] = await Promise.all([
        fetchCampaignBloodUnits(campaign._id),
        fetchCampaignFinancials(campaign._id),
      ]);
      setBloodReport(updatedBlood);
      setFinancials(updatedFin);

      setTimeout(() => {
        setIsRecordDonationModalOpen(false);
        setRecordDonationSuccess(null);
      }, 1200);
    } catch (err: any) {
      setRecordDonationError(err.message || 'Failed to record donation.');
    } finally {
      setRecordingDonation(false);
    }
  };

  const handleUnitTestingDecision = async (unitId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!campaign) return;
    const actionLabel = decision === 'APPROVED' ? 'SAFE (PASS)' : 'CONTAMINATED / DISCARD (REJECT)';
    if (!confirm(`Confirm marking blood unit as ${actionLabel}?`)) return;

    try {
      setUpdatingUnitId(unitId);
      await updateCampaignUnitTestingDecision(campaign._id, unitId, { decision });
      const updated = await fetchCampaignBloodUnits(campaign._id);
      setBloodReport(updated);
    } catch (err: any) {
      alert(`Testing outcome update failed: ${err.message}`);
    } finally {
      setUpdatingUnitId(null);
    }
  };

  // Volunteer Actions
  const handleUpdateAttendance = async (assignmentId: string, status: 'PRESENT' | 'ABSENT') => {
    if (!campaign) return;
    try {
      setUpdatingAttendanceId(assignmentId);

      // 1. Optimistic instant UI update
      setCampaignVolunteers((prev) => {
        if (!prev) return prev;
        const updatedList = prev.volunteers.map((v) =>
          v._id === assignmentId
            ? { ...v, attendanceStatus: status, attendanceMarkedAt: new Date().toISOString() }
            : v,
        );
        return {
          ...prev,
          summary: {
            ...prev.summary,
            present: updatedList.filter((a) => a.attendanceStatus === 'PRESENT').length,
            absent: updatedList.filter((a) => a.attendanceStatus === 'ABSENT').length,
            pending: updatedList.filter((a) => a.attendanceStatus === 'PENDING').length,
          },
          volunteers: updatedList,
        };
      });

      // 2. Persist to server
      await updateVolunteerAttendance(campaign._id, assignmentId, {
        attendanceStatus: status,
      });

      // 3. Sync authoritative server state
      const updatedVolunteers = await fetchCampaignVolunteers(campaign._id);
      setCampaignVolunteers(updatedVolunteers);
    } catch (err: any) {
      alert(`Failed to update attendance: ${err.message || 'Please check your connection and login status.'}`);
      if (campaign) {
        const revert = await fetchCampaignVolunteers(campaign._id);
        setCampaignVolunteers(revert);
      }
    } finally {
      setUpdatingAttendanceId(null);
    }
  };

  const handleOpenAssignModal = async () => {
    if (!campaign) return;
    setIsAssignVolunteerModalOpen(true);
    setAssignError(null);
    setAssignSearchInitials('');
    setSelectedAssignVolId('');
    setSelectedAssignRole('GENERAL');

    try {
      const res = await fetchVolunteers({ status: 'APPROVED', limit: 100 });
      // Exclude already assigned volunteers
      const assignedIds = new Set((campaignVolunteers?.volunteers || []).map((v) => v.volunteerId));
      const unassigned = res.volunteers.filter((v) => !assignedIds.has(v._id));
      setAvailableVolunteers(unassigned);
      if (unassigned.length > 0) {
        setSelectedAssignVolId(unassigned[0]._id);
      }
    } catch (err: any) {
      setAssignError(err.message || 'Failed to fetch active volunteers.');
    }
  };

  const handleAssignVolunteerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign || !selectedAssignVolId) return;

    try {
      setAssigningVolunteer(true);
      setAssignError(null);
      await assignVolunteerToCampaign(campaign._id, {
        volunteerId: selectedAssignVolId,
        role: selectedAssignRole,
      });

      setIsAssignVolunteerModalOpen(false);
      const updatedVolunteers = await fetchCampaignVolunteers(campaign._id);
      setCampaignVolunteers(updatedVolunteers);
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign volunteer.');
    } finally {
      setAssigningVolunteer(false);
    }
  };

  const handleRegisterAndAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    if (!newVolName.trim()) {
      setRegisterVolError('Volunteer Name is required.');
      return;
    }
    if (!newVolPhone.trim()) {
      setRegisterVolError('Phone number is required.');
      return;
    }

    try {
      setRegisteringVol(true);
      setRegisterVolError(null);
      await registerAndAssignCampaignVolunteer(campaign._id, {
        fullName: newVolName.trim(),
        phone: newVolPhone.trim(),
        email: newVolEmail.trim() || undefined,
        bloodGroup: newVolBloodGroup,
        gender: newVolGender,
        city: newVolCity.trim() || campaign.city,
        role: newVolRole,
        notes: newVolNotes.trim() || undefined,
      });

      setIsRegisterVolModalOpen(false);
      setNewVolName('');
      setNewVolPhone('');
      setNewVolEmail('');
      setNewVolCity('');
      setNewVolNotes('');
      const updatedVolunteers = await fetchCampaignVolunteers(campaign._id);
      setCampaignVolunteers(updatedVolunteers);
    } catch (err: any) {
      setRegisterVolError(err.message || 'Failed to register volunteer.');
    } finally {
      setRegisteringVol(false);
    }
  };

  const handleUnassignVolunteer = async (assignmentId: string, volName: string) => {
    if (!campaign) return;
    if (!confirm(`Are you sure you want to unassign volunteer ${volName} from this campaign?`)) return;

    try {
      await removeVolunteerFromCampaign(campaign._id, assignmentId);
      const updatedVolunteers = await fetchCampaignVolunteers(campaign._id);
      setCampaignVolunteers(updatedVolunteers);
    } catch (err: any) {
      alert(`Failed to unassign volunteer: ${err.message}`);
    }
  };


  const filteredAvailableVolunteers = useMemo(() => {
    if (!assignSearchInitials.trim()) return availableVolunteers;
    const term = assignSearchInitials.trim().toLowerCase();
    return availableVolunteers.filter((v) => {
      const name = v.fullName.toLowerCase();
      const code = v.volunteerCode.toLowerCase();
      const phone = v.phone || '';
      const city = v.city.toLowerCase();
      const initials = v.fullName
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .toLowerCase();
      return (
        name.includes(term) ||
        code.includes(term) ||
        phone.includes(term) ||
        city.includes(term) ||
        initials.startsWith(term) ||
        name.split(/\s+/).some((w) => w.startsWith(term))
      );
    });
  }, [availableVolunteers, assignSearchInitials]);

  const filteredBloodUnits = useMemo(() => {
    if (!bloodReport?.units) return [];
    return bloodReport.units.filter((u) => {
      // Blood Group filter
      if (bloodFilterGroup !== 'ALL' && u.bloodGroup !== bloodFilterGroup) {
        return false;
      }
      // Status filter
      if (bloodFilterStatus === 'PASSED' && u.testingDecision !== 'APPROVED') {
        return false;
      }
      if (bloodFilterStatus === 'FAILED' && u.testingDecision !== 'REJECTED') {
        return false;
      }
      if (bloodFilterStatus === 'IN_PROGRESS' && u.testingDecision !== 'PENDING') {
        return false;
      }
      if (bloodFilterStatus === 'IN_INVENTORY' && !u.isInInventory) {
        return false;
      }
      if (bloodFilterStatus === 'NEEDS_INTAKE' && (u.testingDecision !== 'APPROVED' || u.isInInventory)) {
        return false;
      }
      // Search term
      if (bloodSearchTerm.trim()) {
        const q = bloodSearchTerm.toLowerCase();
        const matchesCode = u.unitCode.toLowerCase().includes(q);
        const matchesDonation = (u.donationCode || '').toLowerCase().includes(q);
        const matchesDonor = (u.donorName || '').toLowerCase().includes(q);
        const matchesTestingCode = (u.testingCode || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesDonation && !matchesDonor && !matchesTestingCode) {
          return false;
        }
      }
      return true;
    });
  }, [bloodReport, bloodFilterGroup, bloodFilterStatus, bloodSearchTerm]);

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (isoStr?: string) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && !campaign) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0b1120', color: '#f8fafc', padding: '3rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: '1rem', color: '#94a3b8' }}>Loading Campaign Command Center...</div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0b1120', color: '#f8fafc', padding: '2rem' }}>
        <div style={{ backgroundColor: '#450a0a', border: '1px solid #dc2626', color: '#fecaca', borderRadius: '8px', padding: '1.5rem', maxWidth: '600px', margin: '2rem auto' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Campaign Not Found</h2>
          <p>{error || 'The requested campaign record could not be loaded.'}</p>
          <Link href="/admin/campaigns" style={{ color: '#38bdf8', textDecoration: 'underline', fontSize: '0.9rem' }}>
            ← Back to Campaigns List
          </Link>
        </div>
      </div>
    );
  }

  const badge = CAMPAIGN_STATUS_BADGE_COLORS[campaign.status] || CAMPAIGN_STATUS_BADGE_COLORS[CampaignStatus.PLANNED];
  const bm = financials?.budgetMetrics;
  const cm = financials?.collectionMetrics;
  const util = bm?.utilizationPercentage || 0;
  const isOver = bm?.isOverBudget || false;
  const pendingReviewCount = financials?.linkedExpenses?.filter((e) => e.status === 'SUBMITTED').length || 0;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b1120', color: '#f8fafc', padding: '1.75rem' }}>
      {/* Breadcrumb & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          <Link href="/admin/campaigns" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Campaigns
          </Link>
          <span>/</span>
          <span style={{ color: '#f8fafc', fontWeight: 600 }}>{campaign.campaignCode}</span>
        </div>

        <Link
          href="/admin/campaigns"
          style={{
            backgroundColor: '#1e293b',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '0.4rem 0.85rem',
            fontSize: '0.8rem',
            textDecoration: 'none',
          }}
        >
          ← Back to All Campaigns
        </Link>
      </div>

      {/* Header Banner */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '0.9rem',
                color: '#38bdf8',
                backgroundColor: '#0369a120',
                border: '1px solid #0284c740',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
              }}
            >
              {campaign.campaignCode}
            </span>

            <span
              style={{
                backgroundColor: badge.bg,
                color: badge.text,
                border: `1px solid ${badge.border}`,
                borderRadius: '9999px',
                padding: '0.25rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {CAMPAIGN_STATUS_LABELS[campaign.status]}
            </span>

            {/* Status Change Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Transition:</span>
              <select
                disabled={updatingStatus}
                value={campaign.status}
                onChange={(e) => handleStatusChange(e.target.value as CampaignStatus)}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {Object.values(CampaignStatus).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
            {campaign.name}
          </h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', color: '#94a3b8', fontSize: '0.875rem' }}>
            <div>
              📍 <strong>{campaign.venue}</strong>, {campaign.city}
            </div>
            <div>
              🗓️ <strong>{formatDate(campaign.startDate)}</strong> to <strong>{formatDate(campaign.endDate)}</strong>
            </div>
            <div>
              🎯 Target: <strong>{campaign.targetDonations} units</strong>
            </div>
          </div>

          {campaign.description && (
            <p style={{ margin: '0.75rem 0 0 0', color: '#cbd5e1', fontSize: '0.875rem', maxWidth: '750px', lineHeight: 1.5 }}>
              {campaign.description}
            </p>
          )}
        </div>

        {/* Action Buttons: Add Expenditure & Revise Budget */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.65rem' }}>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setAddExpenseError(null);
                setIsAddExpenseModalOpen(true);
              }}
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.2rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#059669')}
              onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#10b981')}
            >
              <span>+</span> Add Campaign Expenditure
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => {
                  setReviseError(null);
                  setNewBudgetInput(String(campaign.approvedBudget || 0));
                  setIsReviseModalOpen(true);
                }}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.65rem 1.2rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0369a1')}
                onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0284c7')}
              >
                <span>⚙️</span> Revise Approved Budget
              </button>
            )}
          </div>
          <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
            Version: {campaign.budgetVersion} • Concurrency Locked
          </span>
        </div>
      </div>

      {/* Navigation Segment Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.75rem',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setActiveTab('all')}
          style={{
            backgroundColor: activeTab === 'all' ? '#1e293b' : 'transparent',
            color: activeTab === 'all' ? '#f8fafc' : '#94a3b8',
            border: activeTab === 'all' ? '1px solid #38bdf8' : '1px solid transparent',
            borderRadius: '8px',
            padding: '0.55rem 1.15rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>📊</span> Overview & All Modules
        </button>

        <button
          onClick={() => setActiveTab('blood')}
          style={{
            backgroundColor: activeTab === 'blood' ? '#4c0519' : 'transparent',
            color: activeTab === 'blood' ? '#ffe4e6' : '#94a3b8',
            border: activeTab === 'blood' ? '1px solid #e11d48' : '1px solid transparent',
            borderRadius: '8px',
            padding: '0.55rem 1.15rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🩸</span> Blood Collection & Central Inventory
          {bloodReport?.summary && (
            <span
              style={{
                backgroundColor: '#e11d48',
                color: '#ffffff',
                fontSize: '0.725rem',
                fontWeight: 700,
                borderRadius: '9999px',
                padding: '0.1rem 0.55rem',
              }}
            >
              {bloodReport.summary.totalUnitsCollected} Collected • {bloodReport.summary.inInventoryCount} In Vault
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('volunteers')}
          style={{
            backgroundColor: activeTab === 'volunteers' ? '#581c87' : 'transparent',
            color: activeTab === 'volunteers' ? '#f5d0fe' : '#94a3b8',
            border: activeTab === 'volunteers' ? '1px solid #c084fc' : '1px solid transparent',
            borderRadius: '8px',
            padding: '0.55rem 1.15rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🤝</span> Volunteers & Attendance
          {campaignVolunteers?.summary && (
            <span
              style={{
                backgroundColor: '#9333ea',
                color: '#ffffff',
                fontSize: '0.725rem',
                fontWeight: 700,
                borderRadius: '9999px',
                padding: '0.1rem 0.55rem',
              }}
            >
              {campaignVolunteers.summary.totalAssigned} Team • {campaignVolunteers.summary.present} Present
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('financials')}
          style={{
            backgroundColor: activeTab === 'financials' ? '#064e3b' : 'transparent',
            color: activeTab === 'financials' ? '#a7f3d0' : '#94a3b8',
            border: activeTab === 'financials' ? '1px solid #10b981' : '1px solid transparent',
            borderRadius: '8px',
            padding: '0.55rem 1.15rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>💰</span> Financials & Invoices
          {financials?.expenseCounts && (
            <span
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontSize: '0.725rem',
                fontWeight: 700,
                borderRadius: '9999px',
                padding: '0.1rem 0.55rem',
              }}
            >
              {financials.expenseCounts.totalLinked} Invoices
            </span>
          )}
        </button>
      </div>

      {/* Intake Success / Error Notifications */}
      {intakeSuccessMessage && (
        <div
          style={{
            backgroundColor: '#064e3b',
            border: '1px solid #059669',
            color: '#a7f3d0',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.35rem' }}>✅</span>
            <div>
              <strong style={{ display: 'block', fontSize: '0.925rem' }}>
                Central Inventory Enrollment Successful
              </strong>
              <span style={{ fontSize: '0.825rem', color: '#d1fae5' }}>
                {intakeSuccessMessage}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <Link
              href="/admin/inventory"
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '0.45rem 0.95rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>📦</span> View Central Inventory Vault →
            </Link>
            <button
              onClick={() => setIntakeSuccessMessage(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a7f3d0',
                cursor: 'pointer',
                fontSize: '1.15rem',
                padding: '0.25rem',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {intakeErrorMessage && (
        <div
          style={{
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            color: '#fecaca',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <div>
              <strong style={{ display: 'block', fontSize: '0.9rem' }}>
                Inventory Intake Failed
              </strong>
              <span style={{ fontSize: '0.825rem', color: '#fee2e2' }}>
                {intakeErrorMessage}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIntakeErrorMessage(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fecaca',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 🩸 BLOOD COLLECTION, TESTING & CENTRAL INVENTORY MODULE */}
      {(activeTab === 'all' || activeTab === 'blood') && (
        <div style={{ marginBottom: '2.5rem' }}>
          {/* Header & Intake Action Bar */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    margin: '0 0 0.25rem 0',
                    color: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>🩸</span> Blood Collection, Testing Pipeline & Central Inventory
                </h2>
                <span style={{ color: '#94a3b8', fontSize: '0.825rem' }}>
                  Authoritative campaign audit: Total units collected, laboratory testing clearance, safe remaining units, and enrollment into central inventory with unique unit codes.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Primary Entry Point: Record Blood Donation for Campaign */}
                <button
                  onClick={handleOpenRecordDonationModal}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.55rem 1.15rem',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                    transition: 'all 0.2s ease',
                  }}
                  title="Record blood donation and auto-issue unique blood unit code for this campaign"
                >
                  <span style={{ fontSize: '1rem' }}>🩸</span> + Record Blood Donation
                </button>

                <button
                  onClick={handleRefreshBloodReport}
                  disabled={loadingBloodReport}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#94a3b8',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '0.55rem 0.95rem',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    cursor: loadingBloodReport ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>🔄</span> {loadingBloodReport ? 'Refreshing...' : 'Refresh Pipeline'}
                </button>

                <Link
                  href="/admin/inventory"
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#38bdf8',
                    border: '1px solid #0284c7',
                    borderRadius: '8px',
                    padding: '0.55rem 1rem',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>📦</span> Central Inventory Vault
                </Link>

                {(() => {
                  const passed = bloodReport?.summary?.testingPassed || 0;
                  const inVault = bloodReport?.summary?.inInventoryCount || 0;
                  const canIntake = passed > inVault;

                  return (
                    <button
                      onClick={handleIntakePassedUnits}
                      disabled={intakingInventory || !canIntake}
                      style={{
                        backgroundColor: canIntake ? '#0284c7' : '#1e293b',
                        color: canIntake ? '#ffffff' : '#64748b',
                        border: canIntake ? 'none' : '1px solid #334155',
                        borderRadius: '8px',
                        padding: '0.55rem 1.15rem',
                        fontSize: '0.825rem',
                        fontWeight: 700,
                        cursor: intakingInventory || !canIntake ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        boxShadow: canIntake ? '0 4px 14px rgba(2, 132, 199, 0.4)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span>⚡</span>{' '}
                      {intakingInventory
                        ? 'Enrolling in Inventory...'
                        : canIntake
                        ? `Intake ${passed - inVault} Safe Unit(s) to Inventory`
                        : passed > 0
                        ? '✓ All Safe Units Enrolled in Inventory'
                        : 'No Approved Units Ready for Intake'}
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* 6 Key Operational Metrics Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              {/* 1. Total Units Collected */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '1.1rem',
                }}
              >
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Collected Units</span>
                  <span>🩸</span>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
                  {bloodReport?.summary?.totalUnitsCollected ?? 0}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  From {bloodReport?.summary?.totalDonations ?? 0} registered donations
                </div>
              </div>

              {/* 2. Safe Units Remaining */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #059669',
                  borderRadius: '10px',
                  padding: '1.1rem',
                }}
              >
                <div
                  style={{
                    color: '#34d399',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Safe Units Remaining</span>
                  <span>🛡️</span>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
                  {bloodReport?.summary?.testingPassed ?? 0}
                </div>
                <div style={{ color: '#6ee7b7', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  Passed 100% of lab infection screens
                </div>
              </div>

              {/* 3. Testing Failed / Discarded */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #991b1b',
                  borderRadius: '10px',
                  padding: '1.1rem',
                }}
              >
                <div
                  style={{
                    color: '#f87171',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Failed & Discarded</span>
                  <span>🚫</span>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444' }}>
                  {bloodReport?.summary?.testingFailed ?? 0}
                </div>
                <div style={{ color: '#fca5a5', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  Contaminated / positive screen (Discarded)
                </div>
              </div>

              {/* 4. In Laboratory Testing */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #b45309',
                  borderRadius: '10px',
                  padding: '1.1rem',
                }}
              >
                <div
                  style={{
                    color: '#fbbf24',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>In Laboratory Testing</span>
                  <span>⏳</span>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>
                  {bloodReport?.summary?.testingInProgress ?? 0}
                </div>
                <div style={{ color: '#fde68a', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  Pending serology / screening results
                </div>
              </div>

              {/* 5. In Central Inventory */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #0284c7',
                  borderRadius: '10px',
                  padding: '1.1rem',
                }}
              >
                <div
                  style={{
                    color: '#38bdf8',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>In Central Inventory</span>
                  <span>📦</span>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8' }}>
                  {bloodReport?.summary?.inInventoryCount ?? 0}
                  <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 500 }}>
                    {' '}/ {bloodReport?.summary?.testingPassed ?? 0}
                  </span>
                </div>
                <div style={{ color: '#7dd3fc', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  Active stock in central vault with unitCode
                </div>
              </div>

              {/* 6. Safe Yield Clearance Rate */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #7c3aed',
                  borderRadius: '10px',
                  padding: '1.1rem',
                }}
              >
                <div
                  style={{
                    color: '#c084fc',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Safe Yield Rate</span>
                  <span>📈</span>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#c084fc' }}>
                  {bloodReport?.summary?.safeYieldRate ?? 0}%
                </div>
                <div style={{ color: '#d8b4fe', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  Net safe usable blood efficiency
                </div>
              </div>
            </div>

            {/* Blood Group Distribution Badges */}
            {bloodReport?.summary?.bloodGroupBreakdown && Object.keys(bloodReport.summary.bloodGroupBreakdown).length > 0 && (
              <div
                style={{
                  backgroundColor: '#0b1120',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                  Blood Group Distribution:
                </span>
                {Object.entries(bloodReport.summary.bloodGroupBreakdown).map(([group, count]) => {
                  const formattedGroup = group.replace('_', ' ').replace('POSITIVE', '+').replace('NEGATIVE', '-');
                  return (
                    <span
                      key={group}
                      style={{
                        backgroundColor: '#881337',
                        border: '1px solid #be123c',
                        color: '#ffe4e6',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.65rem',
                        borderRadius: '9999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>🩸</span> {formattedGroup}: <strong>{count} units</strong>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search, Filter & Detailed Blood Units Table */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#f8fafc' }}>
                  Authoritative Unit Inventory & Testing Roster
                </h3>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                  Showing {filteredBloodUnits.length} of {bloodReport?.units?.length || 0} unit(s) linked to this campaign.
                </span>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search unit code, donor, donation..."
                  value={bloodSearchTerm}
                  onChange={(e) => setBloodSearchTerm(e.target.value)}
                  style={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8rem',
                    minWidth: '220px',
                    outline: 'none',
                  }}
                />

                <select
                  value={bloodFilterGroup}
                  onChange={(e) => setBloodFilterGroup(e.target.value)}
                  style={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">All Blood Groups</option>
                  <option value="O_POSITIVE">O Positive (O+)</option>
                  <option value="O_NEGATIVE">O Negative (O-)</option>
                  <option value="A_POSITIVE">A Positive (A+)</option>
                  <option value="A_NEGATIVE">A Negative (A-)</option>
                  <option value="B_POSITIVE">B Positive (B+)</option>
                  <option value="B_NEGATIVE">B Negative (B-)</option>
                  <option value="AB_POSITIVE">AB Positive (AB+)</option>
                  <option value="AB_NEGATIVE">AB Negative (AB-)</option>
                </select>

                <select
                  value={bloodFilterStatus}
                  onChange={(e) => setBloodFilterStatus(e.target.value)}
                  style={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">All Pipeline Decisions</option>
                  <option value="PASSED">Passed Tests (Safe Remaining)</option>
                  <option value="FAILED">Failed / Discarded</option>
                  <option value="IN_PROGRESS">In Testing</option>
                  <option value="IN_INVENTORY">In Central Inventory</option>
                  <option value="NEEDS_INTAKE">Needs Intake to Inventory</option>
                </select>

                {(bloodSearchTerm || bloodFilterGroup !== 'ALL' || bloodFilterStatus !== 'ALL') && (
                  <button
                    onClick={() => {
                      setBloodSearchTerm('');
                      setBloodFilterGroup('ALL');
                      setBloodFilterStatus('ALL');
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      padding: '0.45rem 0.75rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #1e293b', color: '#94a3b8' }}>
                    <th style={{ padding: '0.75rem 0.65rem' }}>Unit Code</th>
                    <th style={{ padding: '0.75rem 0.65rem' }}>Donation Ref</th>
                    <th style={{ padding: '0.75rem 0.65rem' }}>Donor</th>
                    <th style={{ padding: '0.75rem 0.65rem' }}>Blood Group</th>
                    <th style={{ padding: '0.75rem 0.65rem' }}>Component</th>
                    <th style={{ padding: '0.75rem 0.65rem' }}>Collected Date</th>
                    <th style={{ padding: '0.75rem 0.65rem' }}>Laboratory Decision</th>
                    <th style={{ padding: '0.75rem 0.65rem' }}>Central Inventory Status</th>
                    <th style={{ padding: '0.75rem 0.65rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBloodUnits.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        {bloodReport?.units && bloodReport.units.length > 0
                          ? 'No blood units match the active filter criteria.'
                          : 'No blood units collected yet for this campaign.'}
                      </td>
                    </tr>
                  ) : (
                    filteredBloodUnits.map((u) => {
                      const bgText = u.bloodGroup
                        ? u.bloodGroup.replace('_', ' ').replace('POSITIVE', '+').replace('NEGATIVE', '-')
                        : 'UNKNOWN';

                      return (
                        <tr key={u._id} style={{ borderBottom: '1px solid #1e293b' }}>
                          {/* Unit Code */}
                          <td style={{ padding: '0.75rem 0.65rem' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                color: '#38bdf8',
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                backgroundColor: '#0284c715',
                                border: '1px solid #0284c740',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                              }}
                            >
                              {u.unitCode}
                            </span>
                          </td>

                          {/* Donation Code */}
                          <td style={{ padding: '0.75rem 0.65rem', fontFamily: 'monospace', color: '#cbd5e1' }}>
                            {u.donationCode || 'N/A'}
                          </td>

                          {/* Donor */}
                          <td style={{ padding: '0.75rem 0.65rem' }}>
                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>{u.donorName}</div>
                            <div style={{ color: '#64748b', fontSize: '0.725rem' }}>{u.donorCode}</div>
                          </td>

                          {/* Blood Group */}
                          <td style={{ padding: '0.75rem 0.65rem' }}>
                            <span
                              style={{
                                backgroundColor: '#881337',
                                border: '1px solid #be123c',
                                color: '#ffe4e6',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '0.775rem',
                                display: 'inline-block',
                              }}
                            >
                              {bgText}
                            </span>
                          </td>

                          {/* Component */}
                          <td style={{ padding: '0.75rem 0.65rem', color: '#cbd5e1' }}>
                            {u.componentType?.replace('_', ' ') || 'WHOLE BLOOD'}
                          </td>

                          {/* Collection Date */}
                          <td style={{ padding: '0.75rem 0.65rem', color: '#94a3b8' }}>
                            {formatDate(u.collectionDate)}
                          </td>

                          {/* Laboratory Decision */}
                          <td style={{ padding: '0.75rem 0.65rem' }}>
                            {u.testingDecision === 'APPROVED' ? (
                              <span
                                style={{
                                  backgroundColor: '#064e3b',
                                  color: '#34d399',
                                  border: '1px solid #059669',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                              >
                                <span>✓</span> PASSED (Approved)
                              </span>
                            ) : u.testingDecision === 'REJECTED' ? (
                              <span
                                style={{
                                  backgroundColor: '#450a0a',
                                  color: '#f87171',
                                  border: '1px solid #dc2626',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                              >
                                <span>✗</span> FAILED (Discarded)
                              </span>
                            ) : (
                              <span
                                style={{
                                  backgroundColor: '#451a03',
                                  color: '#fbbf24',
                                  border: '1px solid #d97706',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                              >
                                <span>⏳</span> IN TESTING
                              </span>
                            )}
                          </td>

                          {/* Central Inventory Status */}
                          <td style={{ padding: '0.75rem 0.65rem' }}>
                            {u.isInInventory ? (
                              <span
                                style={{
                                  backgroundColor: '#064e3b',
                                  color: '#34d399',
                                  border: '1px solid #059669',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                              >
                                <span>✓</span> IN INVENTORY (Available)
                              </span>
                            ) : u.testingDecision === 'APPROVED' ? (
                              <span
                                style={{
                                  backgroundColor: '#0c4a6e',
                                  color: '#38bdf8',
                                  border: '1px solid #0284c7',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                              >
                                <span>⚡</span> Ready for Intake
                              </span>
                            ) : u.testingDecision === 'REJECTED' ? (
                              <span
                                style={{
                                  backgroundColor: '#1e293b',
                                  color: '#94a3b8',
                                  border: '1px solid #334155',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                }}
                              >
                                ⛔ Discarded
                              </span>
                            ) : (
                              <span
                                style={{
                                  backgroundColor: '#1e293b',
                                  color: '#64748b',
                                  border: '1px solid #334155',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                }}
                              >
                                ⏳ Pending Lab Tests
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td style={{ padding: '0.75rem 0.65rem', textAlign: 'right' }}>
                            {u.isInInventory ? (
                              <Link
                                href="/admin/inventory"
                                style={{
                                  color: '#38bdf8',
                                  textDecoration: 'none',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                }}
                              >
                                View in Vault →
                              </Link>
                            ) : u.testingDecision === 'APPROVED' ? (
                              <button
                                onClick={handleIntakePassedUnits}
                                disabled={intakingInventory}
                                style={{
                                  backgroundColor: '#0284c7',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: intakingInventory ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Intake Unit
                              </button>
                            ) : u.testingDecision === 'PENDING' ? (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                                <button
                                  onClick={() => handleUnitTestingDecision(u._id, 'APPROVED')}
                                  disabled={updatingUnitId === u._id}
                                  style={{
                                    backgroundColor: '#059669',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '0.25rem 0.55rem',
                                    fontSize: '0.725rem',
                                    fontWeight: 700,
                                    cursor: updatingUnitId === u._id ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                  }}
                                  title="Mark screening passed — safe for inventory intake"
                                >
                                  ✓ Safe (Pass)
                                </button>
                                <button
                                  onClick={() => handleUnitTestingDecision(u._id, 'REJECTED')}
                                  disabled={updatingUnitId === u._id}
                                  style={{
                                    backgroundColor: 'transparent',
                                    color: '#f87171',
                                    border: '1px solid #7f1d1d',
                                    borderRadius: '4px',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.725rem',
                                    cursor: updatingUnitId === u._id ? 'not-allowed' : 'pointer',
                                  }}
                                  title="Mark as contaminated or positive screen (Discarded)"
                                >
                                  ✕ Contaminated
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: '#475569', fontSize: '0.75rem' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🤝 CAMPAIGN VOLUNTEER TEAM & ATTENDANCE MODULE */}
      {(activeTab === 'all' || activeTab === 'volunteers') && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '1.25rem',
            }}
          >
            {/* Header with Assign & Register Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    margin: '0 0 0.25rem 0',
                    color: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>🤝</span> Campaign Volunteer Team & Attendance
                </h2>
                <span style={{ color: '#94a3b8', fontSize: '0.825rem' }}>
                  Manage campaign volunteers, track real-time attendance (Present / Absent), and register new volunteers directly on-site.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Assign Existing Volunteer */}
                <button
                  type="button"
                  onClick={handleOpenAssignModal}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.55rem 1.15rem',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <span>📋</span> Assign from Active Roster
                </button>

                {/* Register New Volunteer on Campaign Page */}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterVolModalOpen(true);
                    setRegisterVolError(null);
                    setNewVolName('');
                    setNewVolPhone('');
                    setNewVolEmail('');
                    setNewVolCity(campaign?.city || '');
                    setNewVolNotes('');
                  }}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.55rem 1.15rem',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                  }}
                >
                  <span>+</span> Register New Volunteer
                </button>
              </div>
            </div>

            {/* Attendance & Participation Metric Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '10px',
                  padding: '1rem',
                  border: '1px solid #334155',
                }}
              >
                <span style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Assigned Team Size
                </span>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', margin: '0.35rem 0 0.15rem 0' }}>
                  {campaignVolunteers?.summary.totalAssigned ?? 0}
                </div>
                <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                  Total volunteers deployed
                </span>
              </div>

              <div
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '10px',
                  padding: '1rem',
                  border: '1px solid #334155',
                }}
              >
                <span style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Marked Present (Attended)
                </span>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#34d399', margin: '0.35rem 0 0.15rem 0' }}>
                  {campaignVolunteers?.summary.present ?? 0}
                </div>
                <span style={{ fontSize: '0.725rem', color: '#34d399' }}>
                  ✓ On-duty in campaign drive
                </span>
              </div>

              <div
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '10px',
                  padding: '1rem',
                  border: '1px solid #334155',
                }}
              >
                <span style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Marked Absent
                </span>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f87171', margin: '0.35rem 0 0.15rem 0' }}>
                  {campaignVolunteers?.summary.absent ?? 0}
                </div>
                <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                  Did not report to venue
                </span>
              </div>

              <div
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '10px',
                  padding: '1rem',
                  border: '1px solid #334155',
                }}
              >
                <span style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Pending Attendance
                </span>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fbbf24', margin: '0.35rem 0 0.15rem 0' }}>
                  {campaignVolunteers?.summary.pending ?? 0}
                </div>
                <span style={{ fontSize: '0.725rem', color: '#fbbf24' }}>
                  ⏳ Awaiting check-in
                </span>
              </div>
            </div>

            {/* Campaign Volunteer Roster Table */}
            <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Volunteer</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Contact</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Assigned Camp Role</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Attendance Status</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Check-in Log</th>
                    <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Mark Attendance / Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!campaignVolunteers || campaignVolunteers.volunteers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                        No volunteers currently assigned to this campaign drive.
                        <div style={{ marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={handleOpenAssignModal}
                            style={{
                              backgroundColor: '#0284c7',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.4rem 0.85rem',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                              marginRight: '0.5rem',
                            }}
                          >
                            + Assign Volunteer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsRegisterVolModalOpen(true);
                              setRegisterVolError(null);
                              setNewVolName('');
                              setNewVolPhone('');
                              setNewVolCity(campaign?.city || '');
                            }}
                            style={{
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.4rem 0.85rem',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            + Register New Volunteer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    campaignVolunteers.volunteers.map((v) => {
                      const isPresent = v.attendanceStatus === 'PRESENT';
                      const isAbsent = v.attendanceStatus === 'ABSENT';

                      return (
                        <tr
                          key={v._id}
                          style={{
                            borderBottom: '1px solid #1e293b',
                            backgroundColor: isPresent ? '#064e3b15' : isAbsent ? '#450a0a15' : 'transparent',
                          }}
                        >
                          {/* Volunteer Info */}
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <div style={{ fontWeight: 700, color: '#f8fafc' }}>{v.volunteerName}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.725rem', color: '#38bdf8' }}>
                              {v.volunteerCode}
                            </div>
                            {v.volunteerBloodGroup && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  backgroundColor: '#881337',
                                  color: '#fecdd3',
                                  borderRadius: '3px',
                                  padding: '0.05rem 0.35rem',
                                  fontSize: '0.675rem',
                                  fontWeight: 700,
                                  marginTop: '0.2rem',
                                }}
                              >
                                {v.volunteerBloodGroup}
                              </span>
                            )}
                          </td>

                          {/* Contact */}
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <div style={{ color: '#e2e8f0' }}>{v.volunteerPhone}</div>
                          </td>

                          {/* Role */}
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <span
                              style={{
                                backgroundColor: '#1e293b',
                                color: '#e2e8f0',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                padding: '0.2rem 0.55rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {VOLUNTEER_ROLE_LABELS[v.role] || v.role}
                            </span>
                            {v.notes && (
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                {v.notes}
                              </div>
                            )}
                          </td>

                          {/* Attendance Status */}
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            {isPresent ? (
                              <span
                                style={{
                                  backgroundColor: '#064e3b',
                                  color: '#34d399',
                                  border: '1px solid #059669',
                                  borderRadius: '9999px',
                                  padding: '0.2rem 0.65rem',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                              >
                                <span>✓</span> PRESENT
                              </span>
                            ) : isAbsent ? (
                              <span
                                style={{
                                  backgroundColor: '#450a0a',
                                  color: '#f87171',
                                  border: '1px solid #dc2626',
                                  borderRadius: '9999px',
                                  padding: '0.2rem 0.65rem',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                              >
                                <span>✕</span> ABSENT
                              </span>
                            ) : (
                              <span
                                style={{
                                  backgroundColor: '#451a03',
                                  color: '#fbbf24',
                                  border: '1px solid #b45309',
                                  borderRadius: '9999px',
                                  padding: '0.2rem 0.65rem',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                              >
                                <span>⏳</span> PENDING
                              </span>
                            )}
                          </td>

                          {/* Check-in Log */}
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            {v.attendanceMarkedAt ? (
                              <div>
                                <div style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>
                                  {formatDateTime(v.attendanceMarkedAt)}
                                </div>
                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                  by {v.attendanceMarkedBy || 'Staff'}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Not marked yet</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              {/* Attendance Toggle Buttons */}
                              <button
                                type="button"
                                disabled={updatingAttendanceId === v._id}
                                onClick={() => handleUpdateAttendance(v._id, 'PRESENT')}
                                style={{
                                  backgroundColor: isPresent ? '#064e3b' : 'transparent',
                                  color: isPresent ? '#34d399' : '#10b981',
                                  border: isPresent ? '1px solid #059669' : '1px solid #10b98160',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                  cursor: updatingAttendanceId === v._id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                ✓ Present
                              </button>

                              <button
                                type="button"
                                disabled={updatingAttendanceId === v._id}
                                onClick={() => handleUpdateAttendance(v._id, 'ABSENT')}
                                style={{
                                  backgroundColor: isAbsent ? '#450a0a' : 'transparent',
                                  color: isAbsent ? '#f87171' : '#ef4444',
                                  border: isAbsent ? '1px solid #dc2626' : '1px solid #ef444460',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                  cursor: updatingAttendanceId === v._id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                ✕ Absent
                              </button>

                              {/* Unassign */}
                              <button
                                type="button"
                                onClick={() => handleUnassignVolunteer(v._id, v.volunteerName)}
                                title="Unassign volunteer"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#64748b',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  padding: '0.2rem 0.35rem',
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 💰 FINANCIAL CONTROL MODULE */}
      {(activeTab === 'all' || activeTab === 'financials') && (
        <>
          {/* Pending Review Alert Banner for Super Admin */}
          {isSuperAdmin && pendingReviewCount > 0 && (
            <div
              style={{
                backgroundColor: '#451a03',
                border: '1px solid #d97706',
                color: '#fef3c7',
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.9rem' }}>
                    {pendingReviewCount} Campaign Expenditure{pendingReviewCount > 1 ? 's' : ''} Submitted by Admin Staff Pending Review
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: '#fde68a' }}>
                    Review attached invoices and click &ldquo;✓ Approve&rdquo; in the table below to include them in approved expenditures.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Financial Command Cards (Super Admin) */}
          {bm && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>💰</span> Budget vs. Actuals Financial Control
                </h2>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Integer-Paise Authoritative Accounting • Only APPROVED Expenses Count as Liabilities
                </span>
              </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            {/* Approved Budget */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Approved Budget
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#38bdf8' }}>
                {formatCurrency(bm.approvedBudget)}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.775rem', marginTop: '0.25rem' }}>
                Revision #{campaign.budgetRevisionCount} • v{campaign.budgetVersion}
              </div>
            </div>

            {/* Actual Expenditure */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Actual Expenditure
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isOver ? '#ef4444' : '#f59e0b' }}>
                {formatCurrency(bm.actualExpenditure)}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.775rem', marginTop: '0.25rem' }}>
                {financials?.expenseCounts?.approved || 0} approved liabilities
              </div>
            </div>

            {/* Cash Disbursed */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Cash Disbursed
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#10b981' }}>
                {formatCurrency(bm.cashDisbursed)}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.775rem', marginTop: '0.25rem' }}>
                Pending: {formatCurrency(bm.pendingDisbursement)}
              </div>
            </div>

            {/* Remaining Budget */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Remaining Budget
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isOver ? '#ef4444' : '#10b981' }}>
                {formatCurrency(bm.remainingBudget)}
              </div>
              <div style={{ color: isOver ? '#f87171' : '#64748b', fontSize: '0.775rem', marginTop: '0.25rem' }}>
                {isOver ? `Over budget by ${formatCurrency(bm.overspending)}` : 'Within approved limits'}
              </div>
            </div>

            {/* Cost Per Completed Donation */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '1.15rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Cost / Completed Unit
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#c084fc' }}>
                {cm?.costPerCompletedDonation !== null && cm?.costPerCompletedDonation !== undefined
                  ? formatCurrency(cm.costPerCompletedDonation)
                  : 'N/A'}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.775rem', marginTop: '0.25rem' }}>
                {cm?.completedDonations || 0} completed units
              </div>
            </div>
          </div>

          {/* Budget Utilization Bar */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '10px',
              padding: '1rem 1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>
                Budget Utilization: <strong style={{ color: isOver ? '#ef4444' : '#f8fafc' }}>{util}%</strong> of approved {formatCurrency(bm.approvedBudget)}
              </span>
              <span style={{ color: isOver ? '#ef4444' : util > 80 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                {isOver ? '⚠️ OVER BUDGET' : util > 80 ? '⚠️ High Utilization (>80%)' : '✓ Normal Spending'}
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, util)}%`,
                  height: '100%',
                  backgroundColor: isOver ? '#ef4444' : util > 80 ? '#f59e0b' : '#10b981',
                  borderRadius: '9999px',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Systematic Campaign Expenditures & Invoices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.75rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#f8fafc' }}>
                🧾 Campaign Invoices & Expenditures
              </h2>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                Systematically documented invoices, vendor bills, and campaign liabilities.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                onClick={() => {
                  setAddExpenseError(null);
                  setIsAddExpenseModalOpen(true);
                }}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>+</span> Add Expenditure
              </button>

              <button
                onClick={handleOpenLinkModal}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#38bdf8',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Link Existing Expense
              </button>
            </div>
          </div>

          {/* Status Filter Tabs for Invoices */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.15rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginRight: '0.25rem' }}>
              Filter by Status:
            </span>
            <button
              onClick={() => setInvoiceStatusFilter('ALL')}
              style={{
                backgroundColor: invoiceStatusFilter === 'ALL' ? '#334155' : '#1e293b',
                color: invoiceStatusFilter === 'ALL' ? '#ffffff' : '#94a3b8',
                border: invoiceStatusFilter === 'ALL' ? '1px solid #64748b' : '1px solid #334155',
                borderRadius: '6px',
                padding: '0.3rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              All Invoices ({financials?.linkedExpenses?.length || 0})
            </button>
            <button
              onClick={() => setInvoiceStatusFilter('SUBMITTED')}
              style={{
                backgroundColor: invoiceStatusFilter === 'SUBMITTED' ? '#78350f' : '#1e293b',
                color: invoiceStatusFilter === 'SUBMITTED' ? '#fef3c7' : '#f59e0b',
                border: invoiceStatusFilter === 'SUBMITTED' ? '1px solid #d97706' : '1px solid #334155',
                borderRadius: '6px',
                padding: '0.3rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ⚠️ Unapproved ({financials?.linkedExpenses?.filter((e) => e.status === 'SUBMITTED').length || 0})
            </button>
            <button
              onClick={() => setInvoiceStatusFilter('APPROVED')}
              style={{
                backgroundColor: invoiceStatusFilter === 'APPROVED' ? '#064e3b' : '#1e293b',
                color: invoiceStatusFilter === 'APPROVED' ? '#a7f3d0' : '#34d399',
                border: invoiceStatusFilter === 'APPROVED' ? '1px solid #059669' : '1px solid #334155',
                borderRadius: '6px',
                padding: '0.3rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✓ Approved ({financials?.linkedExpenses?.filter((e) => e.status === 'APPROVED').length || 0})
            </button>
            <button
              onClick={() => setInvoiceStatusFilter('REJECTED')}
              style={{
                backgroundColor: invoiceStatusFilter === 'REJECTED' ? '#450a0a' : '#1e293b',
                color: invoiceStatusFilter === 'REJECTED' ? '#fecaca' : '#f87171',
                border: invoiceStatusFilter === 'REJECTED' ? '1px solid #dc2626' : '1px solid #334155',
                borderRadius: '6px',
                padding: '0.3rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✕ Rejected ({financials?.linkedExpenses?.filter((e) => e.status === 'REJECTED').length || 0})
            </button>
          </div>

          {/* Systematic Invoices Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Invoice & Voucher #</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Vendor / Payee</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Item Details & Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Invoice Document</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Amount (₹)</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Management</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧾</div>
                      <strong style={{ display: 'block', color: '#94a3b8', fontSize: '1rem', marginBottom: '0.25rem' }}>
                        {financials?.linkedExpenses && financials.linkedExpenses.length > 0
                          ? `No invoices with status '${invoiceStatusFilter}' found`
                          : 'No expenditures recorded for this campaign yet'}
                      </strong>
                      <span>
                        {financials?.linkedExpenses && financials.linkedExpenses.length > 0 ? (
                          <button
                            onClick={() => setInvoiceStatusFilter('ALL')}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#38bdf8',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              marginTop: '0.5rem',
                            }}
                          >
                            Reset filter to view all invoices
                          </button>
                        ) : (
                          'Click "+ Add Expenditure" above to log campaign bills, refreshments, medical supplies, or transport expenses with invoices.'
                        )}
                      </span>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((exp) => {
                    const isSubmitted = exp.status === 'SUBMITTED';
                    const isApproved = exp.status === 'APPROVED';
                    const isRejected = exp.status === 'REJECTED';
                    const isDraft = exp.status === 'DRAFT';

                    return (
                      <tr
                        key={exp._id}
                        style={{
                          borderBottom: '1px solid #1e293b',
                          backgroundColor: isSubmitted ? '#1e1c14' : 'transparent',
                        }}
                      >
                        {/* Invoice & Voucher Code */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                color: '#f59e0b',
                                backgroundColor: '#78350f30',
                                border: '1px solid #d9770640',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                              }}
                            >
                              {exp.invoiceNumber ? `INV: ${exp.invoiceNumber}` : 'NO INVOICE #'}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>
                            {exp.expenseCode || exp.voucherNumber}
                          </span>
                        </td>

                        {/* Vendor Name */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <strong style={{ color: '#f8fafc', display: 'block' }}>
                            {exp.vendorName || 'Direct Vendor'}
                          </strong>
                          {exp.creatorName && (
                            <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                              Added by {exp.creatorName}
                            </span>
                          )}
                        </td>

                        {/* Title & Category */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ color: '#e2e8f0', fontWeight: 500, display: 'block' }}>
                            {exp.title}
                          </span>
                          <span
                            style={{
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              color: '#38bdf8',
                              backgroundColor: '#0369a120',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              display: 'inline-block',
                              marginTop: '0.2rem',
                            }}
                          >
                            {EXPENSE_CATEGORY_LABELS[exp.category as ExpenseCategory] || exp.category}
                          </span>
                          {exp.description && (
                            <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>
                              {exp.description}
                            </p>
                          )}
                        </td>

                        {/* Date */}
                        <td style={{ padding: '0.85rem 1rem', color: '#94a3b8' }}>
                          {formatDate(exp.expenseDate)}
                        </td>

                        {/* Invoice Document Stream */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {exp.receipt?.fileId ? (
                            <a
                              href={getReceiptStreamUrl(exp._id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                backgroundColor: '#1e293b',
                                color: '#38bdf8',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                padding: '0.25rem 0.6rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                              }}
                            >
                              <span>📄</span> View Bill ({exp.receipt.originalName?.slice(-12) || 'Invoice'})
                            </a>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic' }}>
                              No file attached
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.925rem', color: isApproved ? '#f59e0b' : '#f8fafc' }}>
                            {formatCurrency(exp.amount)}
                          </span>
                          {exp.paidAmount !== undefined && exp.paidAmount > 0 && (
                            <div style={{ fontSize: '0.725rem', color: '#10b981', marginTop: '0.15rem' }}>
                              Paid: {formatCurrency(exp.paidAmount)}
                            </div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                            <span
                              style={{
                                fontSize: '0.725rem',
                                fontWeight: 800,
                                letterSpacing: '0.03em',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '9999px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                backgroundColor: isApproved
                                  ? '#064e3b'
                                  : isSubmitted
                                  ? '#451a03'
                                  : isRejected
                                  ? '#450a0a'
                                  : '#1e293b',
                                color: isApproved
                                  ? '#34d399'
                                  : isSubmitted
                                  ? '#fbbf24'
                                  : isRejected
                                  ? '#f87171'
                                  : '#94a3b8',
                                border: `1px solid ${
                                  isApproved
                                    ? '#059669'
                                    : isSubmitted
                                    ? '#d97706'
                                    : isRejected
                                    ? '#dc2626'
                                    : '#475569'
                                }`,
                              }}
                            >
                              {isApproved && '✓ APPROVED'}
                              {isSubmitted && '⏳ NOT APPROVED'}
                              {isRejected && '✕ REJECTED'}
                              {isDraft && '📝 DRAFT'}
                              {!isApproved && !isSubmitted && !isRejected && !isDraft && exp.status}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: isApproved ? '#10b981' : isSubmitted ? '#f59e0b' : '#64748b' }}>
                              {isApproved && 'Recognized Expenditure'}
                              {isSubmitted && 'Awaiting Super Admin Approval'}
                              {isDraft && 'Not yet submitted'}
                              {isRejected && (exp.rejectionReason || 'Rejected liability')}
                            </span>
                          </div>
                        </td>

                        {/* Super Admin & Admin Actions */}
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* Draft expense: Allow submit for approval */}
                            {isDraft && (
                              <button
                                disabled={actionExpenseId === exp._id}
                                onClick={() => handleSubmitDraftExpense(exp._id, exp.invoiceNumber || exp.voucherNumber)}
                                style={{
                                  backgroundColor: '#2563eb',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.3rem 0.65rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Submit bill for Super Admin approval"
                              >
                                🚀 Submit for Review
                              </button>
                            )}

                            {/* Super Admin Approval buttons for SUBMITTED expenses */}
                            {isSuperAdmin && isSubmitted && (
                              <>
                                <button
                                  disabled={actionExpenseId === exp._id}
                                  onClick={() => handleApproveExpense(exp._id, exp.invoiceNumber || exp.voucherNumber)}
                                  style={{
                                    backgroundColor: '#059669',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '0.3rem 0.65rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}
                                  title="Approve expense to count toward campaign expenditure"
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  disabled={actionExpenseId === exp._id}
                                  onClick={() => handleRejectExpense(exp._id, exp.invoiceNumber || exp.voucherNumber)}
                                  style={{
                                    backgroundColor: 'transparent',
                                    color: '#f87171',
                                    border: '1px solid #7f1d1d',
                                    borderRadius: '4px',
                                    padding: '0.3rem 0.55rem',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                  }}
                                  title="Reject expense"
                                >
                                  ✕ Reject
                                </button>
                              </>
                            )}

                            {/* Standard Admin: In Review notice */}
                            {!isSuperAdmin && isSubmitted && (
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#f59e0b',
                                  backgroundColor: '#78350f20',
                                  border: '1px solid #d9770630',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  fontWeight: 500,
                                }}
                              >
                                ⏳ In Review
                              </span>
                            )}

                            {/* Unlink button */}
                            <button
                              disabled={actionExpenseId === exp._id}
                              onClick={() => handleUnlinkExpense(exp._id, exp.invoiceNumber || exp.voucherNumber)}
                              style={{
                                backgroundColor: 'transparent',
                                color: '#94a3b8',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                padding: '0.3rem 0.55rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                              title="Unlink from this campaign"
                            >
                              Unlink
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense Category Breakdown */}
        {financials?.categoryBreakdown && financials.categoryBreakdown.length > 0 && (
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#f8fafc' }}>
              Expense Breakdown by Category
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {financials.categoryBreakdown.map((item) => (
                <div key={item.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                      {item.categoryLabel} <span style={{ color: '#64748b' }}>({item.count} items)</span>
                    </span>
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                      {formatCurrency(item.amount)} ({item.percentageOfExpenditure}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${item.percentageOfExpenditure}%`,
                        height: '100%',
                        backgroundColor: '#38bdf8',
                        borderRadius: '9999px',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Budget Revision Audit Timeline (Super Admin) */}
      {isSuperAdmin && (
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📜</span> Budget Revision Audit History
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Immutable Audit Trail • Mandatory Justifications
            </span>
          </div>

          {revisions.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
              No budget revisions recorded.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {revisions.map((rev) => {
                const isPositive = rev.deltaPaise > 0;
                const isZero = rev.deltaPaise === 0;

                return (
                  <div
                    key={rev._id}
                    style={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            color: '#38bdf8',
                            backgroundColor: '#0369a130',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                          }}
                        >
                          Rev #{rev.revisionNumber}
                        </span>
                        <strong style={{ color: '#f8fafc', fontSize: '0.925rem' }}>
                          {formatCurrency(rev.previousBudget)} → {formatCurrency(rev.newBudget)}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: isZero ? '#94a3b8' : isPositive ? '#10b981' : '#ef4444',
                          }}
                        >
                          ({isPositive ? `+${formatCurrency(rev.delta)}` : formatCurrency(rev.delta)})
                        </span>
                      </div>

                      <div style={{ color: '#cbd5e1', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '0.35rem' }}>
                        &ldquo;{rev.reason}&rdquo;
                      </div>

                      <div style={{ color: '#64748b', fontSize: '0.775rem' }}>
                        Revised by <strong>{rev.actorName}</strong> ({rev.actorEmail}) • Role: {rev.actorRole}
                      </div>
                    </div>

                    <div style={{ color: '#64748b', fontSize: '0.775rem' }}>
                      {formatDateTime(rev.timestamp)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  )}

  {/* Add Campaign Expenditure Modal */}
      {isAddExpenseModalOpen && (
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
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#f8fafc' }}>
                  Add Campaign Expenditure
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Associate an operational invoice with <strong>{campaign.campaignCode}</strong>
                </span>
              </div>
              <button
                onClick={() => setIsAddExpenseModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {addExpenseError && (
              <div
                style={{
                  backgroundColor: '#450a0a',
                  border: '1px solid #dc2626',
                  color: '#fecaca',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                {addExpenseError}
              </div>
            )}

            <form onSubmit={handleAddExpenseSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {/* Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Expenditure Title / Item *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Refreshments & Juice for Donors, Sound Setup, Mobile Van Fuel"
                    value={expenseFormData.title}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, title: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.55rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Category & Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Category *
                    </label>
                    <select
                      value={expenseFormData.category}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value as ExpenseCategory })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {Object.values(ExpenseCategory).map((cat) => (
                        <option key={cat} value={cat}>
                          {EXPENSE_CATEGORY_LABELS[cat] || cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={expenseFormData.amount}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Invoice # & Vendor Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Invoice / Bill Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. INV-2026-9021 or BILL-4412"
                      value={expenseFormData.invoiceNumber}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, invoiceNumber: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Vendor / Merchant Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. City Refreshments, Audio Rentals"
                      value={expenseFormData.vendorName}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, vendorName: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Expense Date & GSTIN */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Invoice / Incurred Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={expenseFormData.expenseDate}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, expenseDate: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Vendor GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 27AABCT3518Q1ZV"
                      value={expenseFormData.gstinNumber}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, gstinNumber: e.target.value })}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.55rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Invoice File Upload */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Invoice / Receipt Document Attachment
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setExpenseFormData({ ...expenseFormData, receiptFile: file });
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px dashed #334155',
                      borderRadius: '6px',
                      padding: '0.65rem',
                      color: '#94a3b8',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                    Upload scanned bill or receipt (PDF, PNG, JPG). Required for Super Admin systematic audit.
                  </span>
                </div>

                {/* Description / Itemization */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Description & Item Breakdown (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Details of goods, snacks, or logistical equipment used during the camp..."
                    value={expenseFormData.description}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.55rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '0.55rem 1rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingExpense}
                  style={{
                    backgroundColor: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: addingExpense ? 'not-allowed' : 'pointer',
                    opacity: addingExpense ? 0.7 : 1,
                  }}
                >
                  {addingExpense ? 'Saving Expenditure...' : 'Save & Submit Expenditure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revise Budget Modal */}
      {isReviseModalOpen && (
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
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '500px',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Revise Approved Campaign Budget
              </h2>
              <button
                onClick={() => setIsReviseModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {reviseError && (
              <div
                style={{
                  backgroundColor: '#450a0a',
                  border: '1px solid #dc2626',
                  color: '#fecaca',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                {reviseError}
              </div>
            )}

            <form onSubmit={handleReviseBudgetSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <div style={{ color: '#94a3b8' }}>Current Approved Budget:</div>
                  <strong style={{ fontSize: '1.15rem', color: '#38bdf8' }}>
                    {formatCurrency(campaign.approvedBudget)}
                  </strong>
                  <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Version: {campaign.budgetVersion} • Concurrency Locked
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Proposed New Approved Budget (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newBudgetInput}
                    onChange={(e) => setNewBudgetInput(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.55rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                  {Number(newBudgetInput) !== (campaign.approvedBudget || 0) && (
                    <div style={{ fontSize: '0.775rem', marginTop: '0.35rem', color: Number(newBudgetInput) > (campaign.approvedBudget || 0) ? '#10b981' : '#ef4444' }}>
                      Delta: {Number(newBudgetInput) > (campaign.approvedBudget || 0) ? '+' : ''}
                      {formatCurrency(Number(newBudgetInput) - (campaign.approvedBudget || 0))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Mandatory Business Justification Reason *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide specific justification (e.g., expanded venue canopy costs, 50% higher donor turnout forecast, audio rental additions)..."
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.55rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsReviseModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '0.55rem 1rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revising}
                  style={{
                    backgroundColor: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: revising ? 'not-allowed' : 'pointer',
                    opacity: revising ? 0.7 : 1,
                  }}
                >
                  {revising ? 'Saving Revision...' : 'Confirm Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Existing Expense Modal */}
      {isLinkModalOpen && (
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
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '520px',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Link Existing Expense
              </h2>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {linkError && (
              <div
                style={{
                  backgroundColor: '#450a0a',
                  border: '1px solid #dc2626',
                  color: '#fecaca',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                {linkError}
              </div>
            )}

            {availableExpenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                No unlinked approved expenses found in the system. Use &ldquo;+ Add Campaign Expenditure&rdquo; to record a new one!
              </div>
            ) : (
              <form onSubmit={handleLinkExpenseSubmit}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Select Approved Expense Voucher *
                  </label>
                  <select
                    value={selectedExpenseId}
                    onChange={(e) => setSelectedExpenseId(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.55rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {availableExpenses.map((exp) => (
                      <option key={exp._id} value={exp._id}>
                        {exp.voucherNumber} — {exp.title} ({formatCurrency(exp.amount)})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsLinkModalOpen(false)}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #334155',
                      color: '#94a3b8',
                      borderRadius: '6px',
                      padding: '0.55rem 1rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={linking}
                    style={{
                      backgroundColor: '#0284c7',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '6px',
                      padding: '0.55rem 1.25rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: linking ? 'not-allowed' : 'pointer',
                      opacity: linking ? 0.7 : 1,
                    }}
                  >
                    {linking ? 'Linking...' : 'Link to Campaign'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Record Blood Donation Modal for this Campaign */}
      {isRecordDonationModalOpen && (
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
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '580px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              color: '#f8fafc',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span>🩸</span> Record Blood Donation for Campaign
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Campaign: <strong>{campaign?.name}</strong> ({campaign?.campaignCode}) • Auto-issues unique unitCode
                </span>
              </div>
              <button
                onClick={() => setIsRecordDonationModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {recordDonationError && (
              <div
                style={{
                  backgroundColor: '#450a0a',
                  border: '1px solid #dc2626',
                  color: '#fecaca',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                {recordDonationError}
              </div>
            )}

            {recordDonationSuccess && (
              <div
                style={{
                  backgroundColor: '#064e3b',
                  border: '1px solid #059669',
                  color: '#a7f3d0',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {recordDonationSuccess}
              </div>
            )}

            <form onSubmit={handleRecordDonationSubmit}>
              {/* Donor Type Tabs */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' }}>
                  Donor Entry Mode:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setDonationDonorType('CAMPAIGN_DONOR')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: donationDonorType === 'CAMPAIGN_DONOR' ? '#881337' : '#1e293b',
                      color: donationDonorType === 'CAMPAIGN_DONOR' ? '#ffe4e6' : '#94a3b8',
                      border: donationDonorType === 'CAMPAIGN_DONOR' ? '1px solid #be123c' : '1px solid #334155',
                    }}
                  >
                    🩸 Campaign Donor
                  </button>
                  <button
                    type="button"
                    onClick={() => setDonationDonorType('REGISTERED')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: donationDonorType === 'REGISTERED' ? '#0284c7' : '#1e293b',
                      color: donationDonorType === 'REGISTERED' ? '#ffffff' : '#94a3b8',
                      border: donationDonorType === 'REGISTERED' ? '1px solid #0284c7' : '1px solid #334155',
                    }}
                  >
                    📋 Existing Registered Donor
                  </button>
                </div>
              </div>

              {/* Campaign Donor Form */}
              {donationDonorType === 'CAMPAIGN_DONOR' ? (
                <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '1.15rem', border: '1px solid #334155' }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                      Donor Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#0f172a',
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                        Blood Group *
                      </label>
                      <select
                        value={walkInBloodGroup}
                        onChange={(e) => setWalkInBloodGroup(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '0.45rem 0.65rem',
                          color: '#f8fafc',
                          fontSize: '0.85rem',
                          outline: 'none',
                          cursor: 'pointer',
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
                      <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                        Gender *
                      </label>
                      <select
                        value={walkInGender}
                        onChange={(e) => setWalkInGender(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '0.45rem 0.65rem',
                          color: '#f8fafc',
                          fontSize: '0.85rem',
                          outline: 'none',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={walkInPhone}
                        onChange={(e) => setWalkInPhone(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: '#0f172a',
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
                      <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                        Email (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="donor@example.com"
                        value={walkInEmail}
                        onChange={(e) => setWalkInEmail(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: '#0f172a',
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
                </div>
              ) : (
                /* Registered Donor Select */
                <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '1.15rem', border: '1px solid #334155' }}>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Select Registered Donor *
                  </label>
                  {registeredDonors.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                      {searchingDonors ? 'Loading active donors...' : 'No active donors found. Please use the Campaign Donor tab above.'}
                    </div>
                  ) : (
                    <select
                      value={selectedDonorId}
                      onChange={(e) => setSelectedDonorId(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.5rem 0.65rem',
                        color: '#f8fafc',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      {registeredDonors.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.fullName} ({d.donorCode}) — Blood: {d.bloodGroup} • Phone: {d.phone}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Unit Specifications */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                    Blood Component
                  </label>
                  <select
                    value={donationComponentType}
                    onChange={(e) => setDonationComponentType(e.target.value)}
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
                    <option value="WHOLE_BLOOD">Whole Blood</option>
                    <option value="PRBC">Red Blood Cells (PRBC)</option>
                    <option value="PLATELETS">Platelets</option>
                    <option value="FFP">Fresh Frozen Plasma (FFP)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                    Bag Volume (mL)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="600"
                    value={unitVolume}
                    onChange={(e) => setUnitVolume(Number(e.target.value))}
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

              {/* Immediate Screening Decision Option */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Laboratory & Screening Pipeline Initial Decision:
                </label>
                <select
                  value={immediateScreening}
                  onChange={(e) => setImmediateScreening(e.target.value as any)}
                  style={{
                    width: '100%',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '0.5rem 0.65rem',
                    color: immediateScreening === 'APPROVED' ? '#34d399' : immediateScreening === 'REJECTED' ? '#f87171' : '#fbbf24',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="PENDING">⏳ In Laboratory Testing Pipeline (Pending Screen)</option>
                  <option value="APPROVED">✓ Rapid Camp Screen Passed (Safe & Ready for Inventory Intake)</option>
                  <option value="REJECTED">🚫 Failed Screening / Contaminated (Discarded)</option>
                </select>
                <span style={{ fontSize: '0.725rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                  If rapid-screened on-site, selecting Approved immediately registers it as safe remaining blood ready to intake.
                </span>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                  Phlebotomist / Clinical Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Standard 450 mL collection into CPDA-1 pack. Donor vitals normal (Hb 13.8 g/dL)."
                  value={donationNotes}
                  onChange={(e) => setDonationNotes(e.target.value)}
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
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRecordDonationModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '0.55rem 1rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingDonation}
                  style={{
                    backgroundColor: '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.55rem 1.35rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: recordingDonation ? 'not-allowed' : 'pointer',
                    opacity: recordingDonation ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                  }}
                >
                  {recordingDonation ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* 2. Assign Volunteer from Active Roster Modal */}
      {isAssignVolunteerModalOpen && (
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
              maxWidth: '540px',
              width: '100%',
              padding: '1.5rem',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span>📋</span> Assign Volunteer to Campaign
              </h3>
              <button
                onClick={() => setIsAssignVolunteerModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {assignError && (
              <div style={{ backgroundColor: '#450a0a', border: '1px solid #dc2626', color: '#fecaca', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.825rem' }}>
                {assignError}
              </div>
            )}

            <form onSubmit={handleAssignVolunteerSubmit}>
              {/* Quick Search / Initials Filter */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', marginBottom: '0.35rem' }}>
                  🔍 Search by Name / Initials (e.g. &quot;An&quot;, &quot;AS&quot;, &quot;Rohit&quot;, &quot;VOL-&quot;)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Type name or initials to quickly filter roster..."
                    value={assignSearchInitials}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssignSearchInitials(val);
                      const term = val.trim().toLowerCase();
                      const matches = !term
                        ? availableVolunteers
                        : availableVolunteers.filter((v) => {
                            const initials = v.fullName.split(/\s+/).map((p) => p[0]).join('').toLowerCase();
                            return (
                              v.fullName.toLowerCase().includes(term) ||
                              v.volunteerCode.toLowerCase().includes(term) ||
                              v.phone.includes(term) ||
                              v.city.toLowerCase().includes(term) ||
                              initials.startsWith(term) ||
                              v.fullName.toLowerCase().split(/\s+/).some((w) => w.startsWith(term))
                            );
                          });
                      if (matches.length > 0) {
                        setSelectedAssignVolId(matches[0]._id);
                      }
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #38bdf8',
                      borderRadius: '6px',
                      padding: '0.5rem 0.65rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {assignSearchInitials && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignSearchInitials('');
                        if (availableVolunteers.length > 0) {
                          setSelectedAssignVolId(availableVolunteers[0]._id);
                        }
                      }}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {assignSearchInitials && (
                  <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                    Showing <strong style={{ color: '#38bdf8' }}>{filteredAvailableVolunteers.length}</strong> of {availableVolunteers.length} available approved volunteers
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Select Approved Volunteer *
                </label>
                {availableVolunteers.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                    No unassigned approved volunteers found. You can register a new volunteer below.
                  </div>
                ) : filteredAvailableVolunteers.length === 0 ? (
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '0.75rem', color: '#f87171', fontSize: '0.8rem' }}>
                    No approved volunteers match &quot;{assignSearchInitials}&quot;. Try different initials or clear the filter.
                  </div>
                ) : (
                  <select
                    value={selectedAssignVolId}
                    onChange={(e) => setSelectedAssignVolId(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.5rem 0.65rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {filteredAvailableVolunteers.map((vol) => (
                      <option key={vol._id} value={vol._id}>
                        {vol.fullName} ({vol.volunteerCode}) • {vol.city} • Blood: {vol.bloodGroup || 'N/A'} • Phone: {vol.phone}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Assigned Camp Role
                </label>
                <select
                  value={selectedAssignRole}
                  onChange={(e) => setSelectedAssignRole(e.target.value as VolunteerRole)}
                  style={{
                    width: '100%',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '0.5rem 0.65rem',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {Object.entries(VOLUNTEER_ROLE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAssignVolunteerModalOpen(false)}
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
                  disabled={assigningVolunteer || availableVolunteers.length === 0}
                  style={{
                    backgroundColor: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: assigningVolunteer || availableVolunteers.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {assigningVolunteer ? 'Assigning...' : 'Assign to Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Register New Volunteer Directly on Campaign Page Modal */}
      {isRegisterVolModalOpen && (
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
              maxWidth: '560px',
              width: '100%',
              padding: '1.5rem',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span>🤝</span> Register & Assign Campaign Volunteer
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Registers volunteer in active roster and deploys them to this campaign drive.
                </span>
              </div>
              <button
                onClick={() => setIsRegisterVolModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {registerVolError && (
              <div style={{ backgroundColor: '#450a0a', border: '1px solid #dc2626', color: '#fecaca', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.825rem' }}>
                {registerVolError}
              </div>
            )}

            <form onSubmit={handleRegisterAndAssignSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                    Volunteer Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Patil"
                    value={newVolName}
                    onChange={(e) => setNewVolName(e.target.value)}
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
                    value={newVolPhone}
                    onChange={(e) => setNewVolPhone(e.target.value)}
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
                    value={newVolBloodGroup}
                    onChange={(e) => setNewVolBloodGroup(e.target.value)}
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
                    Assigned Camp Role
                  </label>
                  <select
                    value={newVolRole}
                    onChange={(e) => setNewVolRole(e.target.value as VolunteerRole)}
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
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={newVolCity}
                  onChange={(e) => setNewVolCity(e.target.value)}
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
                  onClick={() => setIsRegisterVolModalOpen(false)}
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
                  disabled={registeringVol}
                  style={{
                    backgroundColor: '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: registeringVol ? 'not-allowed' : 'pointer',
                  }}
                >
                  {registeringVol ? 'Registering...' : 'Save & Assign Volunteer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
