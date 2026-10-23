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
import BloodDonationCertificateModal, {
  BloodDonationCertificateData,
} from '@/components/admin/BloodDonationCertificateModal';
import StaffAttributionBadge from '@/components/admin/StaffAttributionBadge';

type CampaignTab = 'overview' | 'expenditure' | 'blood_collection' | 'volunteers' | 'testing_inventory';

export default function CampaignCommandCenterPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { admin } = useAdminAuth();
  const isSuperAdmin = admin?.role === AdminRole.SUPER_ADMIN;

  const [campaign, setCampaign] = useState<CampaignItem | null>(null);
  const [financials, setFinancials] = useState<CampaignFinancials | null>(null);
  const [revisions, setRevisions] = useState<CampaignBudgetRevisionItem[]>([]);
  const [bloodReport, setBloodReport] = useState<CampaignBloodUnitsReport | null>(null);
  const [campaignVolunteers, setCampaignVolunteers] = useState<CampaignVolunteersResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<CampaignTab>('overview');

  // Status Updating
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // Revise Budget Modal State (Super Admin)
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

  // Expense Review Actions
  const [actionExpenseId, setActionExpenseId] = useState<string | null>(null);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'>('ALL');

  // Link Expense Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [availableExpenses, setAvailableExpenses] = useState<any[]>([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>('');
  const [linking, setLinking] = useState<boolean>(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Blood Collection & Record Donation State
  const [isRecordDonationModalOpen, setIsRecordDonationModalOpen] = useState<boolean>(false);
  const [recordingDonation, setRecordingDonation] = useState<boolean>(false);
  const [recordDonationError, setRecordDonationError] = useState<string | null>(null);
  const [recordDonationSuccess, setRecordDonationSuccess] = useState<string | null>(null);
  const [donationDonorType, setDonationDonorType] = useState<'CAMPAIGN_DONOR' | 'REGISTERED'>('CAMPAIGN_DONOR');
  const [registeredDonors, setRegisteredDonors] = useState<any[]>([]);
  const [searchingDonors, setSearchingDonors] = useState<boolean>(false);
  const [selectedDonorId, setSelectedDonorId] = useState<string>('');
  const [walkInName, setWalkInName] = useState<string>('');
  const [walkInPhone, setWalkInPhone] = useState<string>('');
  const [walkInEmail, setWalkInEmail] = useState<string>('');
  const [walkInBloodGroup, setWalkInBloodGroup] = useState<string>('O+');
  const [walkInGender, setWalkInGender] = useState<string>('MALE');
  const [donationComponentType, setDonationComponentType] = useState<string>('WHOLE_BLOOD');
  const [unitVolume, setUnitVolume] = useState<number>(450);
  const [immediateScreening, setImmediateScreening] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [donationNotes, setDonationNotes] = useState<string>('');

  // Certificate Modal State
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState<boolean>(false);
  const [certificateData, setCertificateData] = useState<BloodDonationCertificateData | null>(null);

  // Blood Filters
  const [bloodSearchTerm, setBloodSearchTerm] = useState<string>('');
  const [bloodFilterGroup, setBloodFilterGroup] = useState<string>('ALL');
  const [bloodFilterStatus, setBloodFilterStatus] = useState<string>('ALL');

  // Central Inventory Intake State
  const [intakingInventory, setIntakingInventory] = useState<boolean>(false);
  const [intakeSuccessMessage, setIntakeSuccessMessage] = useState<string | null>(null);
  const [intakeErrorMessage, setIntakeErrorMessage] = useState<string | null>(null);

  // Volunteer Management States
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

  // Load All Campaign Data
  const loadAllData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      const campData = await fetchCampaignById(id);
      setCampaign(campData);
      setNewBudgetInput(String(campData.approvedBudget || 0));

      const [finData, revData, bloodData, volData] = await Promise.allSettled([
        fetchCampaignFinancials(id),
        fetchCampaignBudgetRevisions(id),
        fetchCampaignBloodUnits(id),
        fetchCampaignVolunteers(id),
      ]);

      if (finData.status === 'fulfilled') setFinancials(finData.value);
      if (revData.status === 'fulfilled') setRevisions(revData.value);
      if (bloodData.status === 'fulfilled') setBloodReport(bloodData.value);
      if (volData.status === 'fulfilled') setCampaignVolunteers(volData.value);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign data.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Status Change Handler
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

  // Revise Budget Handler (Super Admin)
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

  // Add Expense Submit Handler
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
      setAddExpenseError('Invoice / Bill Number is required.');
      return;
    }
    if (!expenseFormData.vendorName.trim()) {
      setAddExpenseError('Vendor / Merchant Name is required.');
      return;
    }

    try {
      setAddingExpense(true);
      setAddExpenseError(null);
      await createCampaignExpenditure(
        campaign._id,
        {
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
        },
        { autoApprove: isSuperAdmin },
      );

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

  // Expense Approval Handler (Super Admin)
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

  // Expense Rejection Handler (Super Admin)
  const handleRejectExpense = async (expenseId: string, voucherNum: string) => {
    const reason = prompt(`Enter mandatory rejection reason for invoice ${voucherNum}:`);
    if (!reason || !reason.trim()) {
      alert('Rejection cancelled: A valid reason is required.');
      return;
    }

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

  // Unlink Expense Handler
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

  // Link Expense Handlers
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

  // Record Donation Submit
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
      // Non-blocking
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
        if (!walkInName.trim()) throw new Error('Donor Full Name is required.');
        if (!walkInPhone.trim()) throw new Error('Donor Phone Number is required.');
        payload.donorFullName = walkInName.trim();
        payload.donorBloodGroup = walkInBloodGroup;
        payload.donorGender = walkInGender;
        payload.donorPhone = walkInPhone.trim();
        payload.donorEmail = walkInEmail.trim() || undefined;
      }

      const res = await recordCampaignDonation(campaign._id, payload);

      const [updatedBlood, updatedFin] = await Promise.all([
        fetchCampaignBloodUnits(campaign._id),
        fetchCampaignFinancials(campaign._id),
      ]);
      setBloodReport(updatedBlood);
      setFinancials(updatedFin);

      // Prepare Certificate Data
      const donorName =
        res.donor?.fullName ||
        (donationDonorType === 'REGISTERED'
          ? registeredDonors.find((d) => d._id === selectedDonorId)?.fullName
          : walkInName.trim()) ||
        'Valued Donor';
      const donorCode =
        res.donor?.donorCode ||
        (donationDonorType === 'REGISTERED'
          ? registeredDonors.find((d) => d._id === selectedDonorId)?.donorCode
          : undefined);
      const donorPhone =
        res.donor?.phone ||
        (donationDonorType === 'REGISTERED'
          ? registeredDonors.find((d) => d._id === selectedDonorId)?.phone
          : walkInPhone.trim()) ||
        '';
      const bloodGroup = res.donor?.bloodGroup || res.unit?.bloodGroup || walkInBloodGroup;
      const unitCode = res.unit?.unitCode || `UNIT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      setCertificateData({
        certificateNumber: `CERT-${campaign.campaignCode}-${unitCode.slice(-6)}`,
        donorName,
        donorCode,
        donorPhone,
        bloodGroup,
        donationDate: new Date().toISOString(),
        campaignName: campaign.name,
        venue: `${campaign.venue}, ${campaign.city}`,
        unitCode,
        volume: res.unit?.volume || Number(unitVolume) || 450,
        componentType: res.unit?.componentType || donationComponentType,
      });

      setIsRecordDonationModalOpen(false);
      setIsCertificateModalOpen(true);
    } catch (err: any) {
      setRecordDonationError(err.message || 'Failed to record donation.');
    } finally {
      setRecordingDonation(false);
    }
  };

  const handleOpenUnitCertificate = (u: CampaignBloodUnitItem) => {
    if (!campaign) return;
    setCertificateData({
      certificateNumber: `CERT-${campaign.campaignCode}-${u.unitCode.slice(-6)}`,
      donorName: u.donorName || 'Valued Donor',
      donorCode: u.donorCode,
      donorPhone: '',
      bloodGroup: u.bloodGroup || 'O+',
      donationDate: u.collectionDate,
      campaignName: campaign.name,
      venue: `${campaign.venue}, ${campaign.city}`,
      unitCode: u.unitCode,
      volume: u.volume || 450,
      componentType: u.componentType,
    });
    setIsCertificateModalOpen(true);
  };

  // Central Inventory Intake
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

  // Volunteer Attendance Update
  const handleUpdateAttendance = async (assignmentId: string, status: 'PRESENT' | 'ABSENT') => {
    if (!campaign) return;
    try {
      setUpdatingAttendanceId(assignmentId);

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

      await updateVolunteerAttendance(campaign._id, assignmentId, {
        attendanceStatus: status,
      });

      const updatedVolunteers = await fetchCampaignVolunteers(campaign._id);
      setCampaignVolunteers(updatedVolunteers);
    } catch (err: any) {
      alert(`Failed to update attendance: ${err.message}`);
      if (campaign) {
        const revert = await fetchCampaignVolunteers(campaign._id);
        setCampaignVolunteers(revert);
      }
    } finally {
      setUpdatingAttendanceId(null);
    }
  };

  // Volunteer Modal Handlers
  const handleOpenAssignModal = async () => {
    if (!campaign) return;
    setIsAssignVolunteerModalOpen(true);
    setAssignError(null);
    setAssignSearchInitials('');
    setSelectedAssignVolId('');
    setSelectedAssignRole('GENERAL');

    try {
      const res = await fetchVolunteers({ status: 'APPROVED', limit: 100 });
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

  // Filtered Blood Units
  const filteredBloodUnits = useMemo(() => {
    if (!bloodReport?.units) return [];
    return bloodReport.units.filter((u) => {
      if (bloodFilterGroup !== 'ALL' && u.bloodGroup !== bloodFilterGroup) return false;
      if (bloodFilterStatus === 'PASSED' && u.testingDecision !== 'APPROVED') return false;
      if (bloodFilterStatus === 'FAILED' && u.testingDecision !== 'REJECTED') return false;
      if (bloodFilterStatus === 'IN_PROGRESS' && u.testingDecision !== 'PENDING') return false;
      if (bloodFilterStatus === 'IN_INVENTORY' && !u.isInInventory) return false;
      if (bloodFilterStatus === 'NEEDS_INTAKE' && (u.testingDecision !== 'APPROVED' || u.isInInventory)) return false;
      if (bloodSearchTerm.trim()) {
        const q = bloodSearchTerm.toLowerCase();
        const matchesCode = u.unitCode.toLowerCase().includes(q);
        const matchesDonation = (u.donationCode || '').toLowerCase().includes(q);
        const matchesDonor = (u.donorName || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesDonation && !matchesDonor) return false;
      }
      return true;
    });
  }, [bloodReport, bloodFilterGroup, bloodFilterStatus, bloodSearchTerm]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    if (!financials?.linkedExpenses) return [];
    if (invoiceStatusFilter === 'ALL') return financials.linkedExpenses;
    return financials.linkedExpenses.filter((e) => e.status === invoiceStatusFilter);
  }, [financials?.linkedExpenses, invoiceStatusFilter]);

  // Filtered Available Volunteers
  const filteredAvailableVolunteers = useMemo(() => {
    if (!assignSearchInitials.trim()) return availableVolunteers;
    const term = assignSearchInitials.trim().toLowerCase();
    return availableVolunteers.filter((v) => {
      const name = v.fullName.toLowerCase();
      const code = v.volunteerCode.toLowerCase();
      const phone = v.phone || '';
      return name.includes(term) || code.includes(term) || phone.includes(term);
    });
  }, [availableVolunteers, assignSearchInitials]);

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
      <div style={{ minHeight: '100vh', backgroundColor: '#fffbeb', color: '#0f172a', padding: '3rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: '36px', height: '36px', border: '3px solid #d97706', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: '1rem', color: '#64748b', fontWeight: 600 }}>Loading Campaign Details...</div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#fffbeb', color: '#0f172a', padding: '2rem' }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #fecaca', borderRadius: '12px', padding: '2rem', maxWidth: '600px', margin: '2rem auto', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', color: '#991b1b', fontSize: '1.25rem' }}>Campaign Record Error</h2>
          <p style={{ color: '#475569', marginBottom: '1.25rem' }}>{error || 'Unable to retrieve campaign data.'}</p>
          <Link href="/admin/campaigns" style={{ color: '#d97706', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Campaigns Directory
          </Link>
        </div>
      </div>
    );
  }

  const badge = CAMPAIGN_STATUS_BADGE_COLORS[campaign.status] || { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
  const targetDonations = campaign.targetDonations || 0;
  const unitsCollected = bloodReport?.summary?.totalUnitsCollected ?? campaign.completedDonationsCount ?? 0;
  const bloodTargetPercent = targetDonations > 0 ? Math.min(100, Math.round((unitsCollected / targetDonations) * 100)) : 0;

  const totalVolAssigned = campaignVolunteers?.summary?.totalAssigned || 0;
  const volPresent = campaignVolunteers?.summary?.present || 0;
  const volAbsent = campaignVolunteers?.summary?.absent || 0;
  const volParticipationRate = totalVolAssigned > 0 ? Math.round((volPresent / totalVolAssigned) * 100) : 0;

  const bm = financials?.budgetMetrics;
  const pendingExpenses = financials?.linkedExpenses?.filter((e) => e.status === 'SUBMITTED') || [];
  const pendingReviewCount = pendingExpenses.length;
  const pendingReviewAmount = pendingExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fffbeb', color: '#0f172a', padding: '1.5rem' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
          <Link href="/admin/campaigns" style={{ color: '#64748b', textDecoration: 'none' }}>
            Campaigns
          </Link>
          <span>/</span>
          <span style={{ color: '#0f172a', fontWeight: 700 }}>{campaign.campaignCode}</span>
        </div>

        <Link
          href="/admin/campaigns"
          style={{
            backgroundColor: '#ffffff',
            color: '#64748b',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            padding: '0.4rem 0.85rem',
            fontSize: '0.8rem',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          ← Back to All Campaigns
        </Link>
      </div>

      {/* Main Campaign Header Banner */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.05)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 800,
                fontSize: '0.9rem',
                color: '#92400e',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
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
                padding: '0.2rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status}
            </span>

            {/* Campaign Status Transition */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Transition:</span>
              <select
                disabled={updatingStatus}
                value={campaign.status}
                onChange={(e) => handleStatusChange(e.target.value as CampaignStatus)}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.75rem',
                  outline: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {Object.values(CampaignStatus).map((s) => (
                  <option key={s} value={s}>
                    {CAMPAIGN_STATUS_LABELS[s] || s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#0f172a' }}>
            {campaign.name}
          </h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
            <div>📍 <strong>{campaign.venue}</strong>, {campaign.city}</div>
            <div>🗓️ <strong>{formatDate(campaign.startDate)}</strong> to <strong>{formatDate(campaign.endDate)}</strong></div>
            <div>🎯 Target: <strong>{campaign.targetDonations} units</strong></div>
          </div>

          {campaign.description && (
            <p style={{ margin: '0.65rem 0 0 0', color: '#475569', fontSize: '0.875rem', maxWidth: '780px', lineHeight: 1.5 }}>
              {campaign.description}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                padding: '0.55rem 1.1rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)',
              }}
            >
              <span>+</span> Add Expenditure
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
                  padding: '0.55rem 1.1rem',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.2)',
                }}
              >
                <span>⚙️</span> Revise Budget
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5 Distinct Operational Tabs as Requested */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          borderBottom: '2px solid #fde68a',
          paddingBottom: '0.65rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            backgroundColor: activeTab === 'overview' ? '#d97706' : '#ffffff',
            color: activeTab === 'overview' ? '#ffffff' : '#64748b',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '0.55rem 1.15rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>📊</span> 1. Overview
        </button>

        <button
          onClick={() => setActiveTab('expenditure')}
          style={{
            backgroundColor: activeTab === 'expenditure' ? '#d97706' : '#ffffff',
            color: activeTab === 'expenditure' ? '#ffffff' : '#64748b',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '0.55rem 1.15rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>💰</span> 2. Expenditure
          {pendingReviewCount > 0 && (
            <span
              style={{
                backgroundColor: activeTab === 'expenditure' ? '#ffffff' : '#dc2626',
                color: activeTab === 'expenditure' ? '#dc2626' : '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 800,
                borderRadius: '9999px',
                padding: '0.1rem 0.5rem',
              }}
            >
              {pendingReviewCount} Pending
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('blood_collection')}
          style={{
            backgroundColor: activeTab === 'blood_collection' ? '#d97706' : '#ffffff',
            color: activeTab === 'blood_collection' ? '#ffffff' : '#64748b',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '0.55rem 1.15rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🩸</span> 3. Blood Unit Collection
          {bloodReport?.summary && (
            <span
              style={{
                backgroundColor: activeTab === 'blood_collection' ? '#ffffff' : '#e11d48',
                color: activeTab === 'blood_collection' ? '#e11d48' : '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                borderRadius: '9999px',
                padding: '0.1rem 0.5rem',
              }}
            >
              {bloodReport.summary.totalUnitsCollected} Units
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('volunteers')}
          style={{
            backgroundColor: activeTab === 'volunteers' ? '#d97706' : '#ffffff',
            color: activeTab === 'volunteers' ? '#ffffff' : '#64748b',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '0.55rem 1.15rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🤝</span> 4. Volunteers &amp; Attendance
          {campaignVolunteers?.summary && (
            <span
              style={{
                backgroundColor: activeTab === 'volunteers' ? '#ffffff' : '#9333ea',
                color: activeTab === 'volunteers' ? '#9333ea' : '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                borderRadius: '9999px',
                padding: '0.1rem 0.5rem',
              }}
            >
              {campaignVolunteers.summary.present}/{campaignVolunteers.summary.totalAssigned} Present
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('testing_inventory')}
          style={{
            backgroundColor: activeTab === 'testing_inventory' ? '#d97706' : '#ffffff',
            color: activeTab === 'testing_inventory' ? '#ffffff' : '#64748b',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '0.55rem 1.15rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🔬</span> 5. Blood Testing &amp; Inventory Progress
          {bloodReport?.summary && (
            <span
              style={{
                backgroundColor: activeTab === 'testing_inventory' ? '#ffffff' : '#059669',
                color: activeTab === 'testing_inventory' ? '#059669' : '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                borderRadius: '9999px',
                padding: '0.1rem 0.5rem',
              }}
            >
              {bloodReport.summary.inInventoryCount} In Vault
            </span>
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: OVERVIEW */}
      {/* ======================================================== */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Executive Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Target vs Collection Progress */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Blood Collection Progress</span>
                <span style={{ fontSize: '1.25rem' }}>🎯</span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
                {unitsCollected} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>/ {targetDonations} units</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', margin: '0.75rem 0' }}>
                <div
                  style={{
                    width: `${bloodTargetPercent}%`,
                    height: '100%',
                    backgroundColor: '#e11d48',
                    borderRadius: '9999px',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>{bloodTargetPercent}% Target Achieved</span>
                <span>{bloodReport?.summary?.inInventoryCount || 0} Safe in Vault</span>
              </div>
            </div>

            {/* Budget Utilization Card */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Approved Budget vs Actuals</span>
                <span style={{ fontSize: '1.25rem' }}>💰</span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
                {formatCurrency(bm?.actualExpenditure || 0)}
                <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}> / {formatCurrency(campaign.approvedBudget)}</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', margin: '0.75rem 0' }}>
                <div
                  style={{
                    width: `${Math.min(100, bm?.utilizationPercentage || 0)}%`,
                    height: '100%',
                    backgroundColor: (bm?.isOverBudget ? '#dc2626' : '#10b981'),
                    borderRadius: '9999px',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Remaining: <strong>{formatCurrency(bm?.remainingBudget || 0)}</strong></span>
                <span>{bm?.utilizationPercentage || 0}% Utilized</span>
              </div>
            </div>

            {/* Volunteer Field Force */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Volunteers &amp; Attendance</span>
                <span style={{ fontSize: '1.25rem' }}>🤝</span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
                {volPresent} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>/ {totalVolAssigned} Present</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', margin: '0.75rem 0' }}>
                <div
                  style={{
                    width: `${volParticipationRate}%`,
                    height: '100%',
                    backgroundColor: '#9333ea',
                    borderRadius: '9999px',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                <span>Attendance: <strong>{volParticipationRate}%</strong></span>
                <span>{volAbsent} Absent</span>
              </div>
            </div>

            {/* Blood Safety & Clearance */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Mandatory Lab Clearance</span>
                <span style={{ fontSize: '1.25rem' }}>🔬</span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#059669' }}>
                {bloodReport?.summary?.testingPassed || 0} Safe
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', fontSize: '0.775rem' }}>
                <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                  ✓ {bloodReport?.summary?.testingPassed || 0} Passed
                </span>
                <span style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                  ⏳ {bloodReport?.summary?.testingInProgress || 0} In Lab
                </span>
                <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                  ✕ {bloodReport?.summary?.testingFailed || 0} Rejected
                </span>
              </div>
            </div>
          </div>

          {/* Creation & Budget Governance Attribution */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0f172a' }}>
              Governance &amp; Staff Attribution
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: '#fffdf5', border: '1px solid #fef3c7', borderRadius: '8px', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                  Campaign Creation
                </span>
                <StaffAttributionBadge
                  label="Created by"
                  name={campaign.createdByName || 'Super Administrator'}
                  role={campaign.createdByRole || 'SUPER_ADMIN'}
                  timestamp={campaign.createdAt}
                  size="sm"
                />
              </div>

              <div style={{ backgroundColor: '#fffdf5', border: '1px solid #fef3c7', borderRadius: '8px', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                  Initial Approved Budget Baseline
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                  {formatCurrency(campaign.initialBudgetPaise ? campaign.initialBudgetPaise / 100 : campaign.approvedBudget)}
                </div>
                <StaffAttributionBadge
                  label="Budget authorized by"
                  name={campaign.budgetApprovedByName || campaign.createdByName || 'Super Administrator'}
                  role="SUPER_ADMIN"
                  timestamp={campaign.budgetApprovedAt || campaign.createdAt}
                  size="sm"
                />
              </div>

              <div style={{ backgroundColor: '#fffdf5', border: '1px solid #fef3c7', borderRadius: '8px', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                  Field Venue &amp; Operation Drive
                </span>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{campaign.venue}</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{campaign.city} • {formatDate(campaign.startDate)} to {formatDate(campaign.endDate)}</div>
              </div>
            </div>
          </div>

          {/* Budget Revision Audit Timeline (Super Admin Only) */}
          {isSuperAdmin && revisions.length > 0 && (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  📜 Approved Budget Revision History
                </h2>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Immutable Audit Trail • Justification Mandatory
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {revisions.map((rev) => {
                  const isPositive = rev.deltaPaise > 0;
                  return (
                    <div
                      key={rev._id}
                      style={{
                        border: '1px solid #f1f5f9',
                        borderRadius: '8px',
                        padding: '0.85rem 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                            Revision #{rev.revisionNumber}:
                          </span>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>
                            {formatCurrency(rev.newBudget)}
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: isPositive ? '#16a34a' : '#dc2626',
                            }}
                          >
                            ({isPositive ? '+' : ''}{formatCurrency(rev.delta)})
                          </span>
                        </div>
                        <div style={{ color: '#475569', fontSize: '0.825rem' }}>
                          <em>&ldquo;{rev.reason}&rdquo;</em>
                        </div>
                        <div style={{ marginTop: '0.35rem' }}>
                          <StaffAttributionBadge
                            label="Revised by"
                            name={rev.actorName}
                            role={rev.actorRole}
                            timestamp={rev.timestamp}
                            size="xs"
                          />
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {formatDateTime(rev.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: EXPENDITURE */}
      {/* ======================================================== */}
      {activeTab === 'expenditure' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Financial KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
            }}
          >
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>Approved Budget</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                {formatCurrency(campaign.approvedBudget)}
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>Approved Expenses</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
                {formatCurrency(bm?.actualExpenditure || 0)}
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>Pending Review</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '0.25rem' }}>
                {formatCurrency(pendingReviewAmount)}
              </div>
              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>{pendingReviewCount} vouchers awaiting review</span>
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>Disbursed (Paid)</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb', marginTop: '0.25rem' }}>
                {formatCurrency(bm?.cashDisbursed || 0)}
              </div>
              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Unpaid: {formatCurrency(bm?.pendingDisbursement || 0)}</span>
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>Remaining Budget</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: (bm?.isOverBudget ? '#dc2626' : '#059669'), marginTop: '0.25rem' }}>
                {formatCurrency(bm?.remainingBudget || 0)}
              </div>
            </div>
          </div>

          {/* Action Bar & Filter Tabs */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Campaign Expenditure Ledger
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Single canonical expense record linked directly to this campaign drive.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setAddExpenseError(null);
                    setIsAddExpenseModalOpen(true);
                  }}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.45rem 0.95rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Add Expenditure
                </button>
              </div>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {(['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setInvoiceStatusFilter(st)}
                  style={{
                    backgroundColor: invoiceStatusFilter === st ? '#d97706' : '#f8fafc',
                    color: invoiceStatusFilter === st ? '#ffffff' : '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {st === 'ALL' ? 'All Invoices' : st === 'SUBMITTED' ? `Pending Review (${pendingReviewCount})` : st}
                </button>
              ))}
            </div>

            {/* Expenses Table */}
            {filteredInvoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.875rem' }}>
                No expenditures found matching current filter.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Voucher / Date</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Title &amp; Category</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Vendor &amp; Invoice</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Approval</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Payment</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Staff Attribution</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Receipt</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((exp: any) => {
                      const isPending = exp.status === 'SUBMITTED';
                      const isApproved = exp.status === 'APPROVED';
                      const isRejected = exp.status === 'REJECTED';

                      return (
                        <tr key={exp._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                              {exp.expenseCode || exp.voucherNumber}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{formatDate(exp.expenseDate)}</div>
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{exp.title}</div>
                            <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                              {EXPENSE_CATEGORY_LABELS[exp.category as ExpenseCategory] || exp.category}
                            </span>
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div style={{ color: '#0f172a' }}>{exp.vendorName || '-'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>#{exp.invoiceNumber || '-'}</div>
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            {formatCurrency(exp.amount)}
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.725rem',
                                fontWeight: 700,
                                backgroundColor: isApproved ? '#ecfdf5' : isPending ? '#fffbeb' : '#fef2f2',
                                color: isApproved ? '#065f46' : isPending ? '#b45309' : '#991b1b',
                                border: isApproved ? '1px solid #a7f3d0' : isPending ? '1px solid #fde68a' : '1px solid #fecaca',
                              }}
                            >
                              {isPending ? 'Pending Review' : exp.status}
                            </span>
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.725rem',
                                fontWeight: 700,
                                backgroundColor: exp.paymentStatus === 'PAID' ? '#ecfdf5' : '#f1f5f9',
                                color: exp.paymentStatus === 'PAID' ? '#065f46' : '#64748b',
                              }}
                            >
                              {exp.paymentStatus || 'UNPAID'}
                            </span>
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {exp.submittedByName ? (
                                <StaffAttributionBadge
                                  label="Submitted by"
                                  name={exp.submittedByName}
                                  role={exp.submittedByRole || 'ADMIN'}
                                  timestamp={exp.submittedAt}
                                  size="xs"
                                />
                              ) : (
                                <StaffAttributionBadge
                                  label="Created by"
                                  name={exp.creatorName || 'Admin'}
                                  role={exp.creatorRole || 'ADMIN'}
                                  timestamp={exp.createdAt}
                                  size="xs"
                                />
                              )}

                              {exp.reviewedByName && (
                                <StaffAttributionBadge
                                  label="Reviewed by"
                                  name={exp.reviewedByName}
                                  role={exp.reviewedByRole || 'SUPER_ADMIN'}
                                  timestamp={exp.reviewedAt}
                                  size="xs"
                                />
                              )}

                              {isRejected && exp.rejectionReason && (
                                <span style={{ color: '#dc2626', fontSize: '0.725rem' }}>
                                  Reason: {exp.rejectionReason}
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            {exp.receipt?.fileId ? (
                              <a
                                href={getReceiptStreamUrl(exp._id)}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: '#0284c7',
                                  textDecoration: 'none',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                              >
                                📄 Receipt
                              </a>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>None</span>
                            )}
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                              {isSuperAdmin && isPending && (
                                <>
                                  <button
                                    disabled={actionExpenseId === exp._id}
                                    onClick={() => handleApproveExpense(exp._id, exp.expenseCode || exp.voucherNumber)}
                                    style={{
                                      backgroundColor: '#10b981',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    disabled={actionExpenseId === exp._id}
                                    onClick={() => handleRejectExpense(exp._id, exp.expenseCode || exp.voucherNumber)}
                                    style={{
                                      backgroundColor: '#dc2626',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              <button
                                disabled={actionExpenseId === exp._id}
                                onClick={() => handleUnlinkExpense(exp._id, exp.expenseCode || exp.voucherNumber)}
                                style={{
                                  backgroundColor: '#ffffff',
                                  color: '#64748b',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.45rem',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                }}
                              >
                                Unlink
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: BLOOD UNIT COLLECTION */}
      {/* ======================================================== */}
      {activeTab === 'blood_collection' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Collection Progress & Action Header */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              padding: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🩸</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Mobile Blood Collection Desk
                </h2>
              </div>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Track and record physical blood units collected on-site during this drive.
              </span>
            </div>

            <button
              onClick={handleOpenRecordDonationModal}
              style={{
                backgroundColor: '#e11d48',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.25rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)',
              }}
            >
              <span>+</span> Record Blood Donation
            </button>
          </div>

          {/* Collection Target Metric Box */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>Campaign Target Achievement</span>
              <span style={{ fontWeight: 800, color: '#e11d48' }}>{bloodTargetPercent}% Complete</span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${bloodTargetPercent}%`,
                  height: '100%',
                  backgroundColor: '#e11d48',
                  borderRadius: '9999px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.775rem', color: '#64748b', marginTop: '0.45rem' }}>
              <span>Collected: <strong>{unitsCollected} units</strong></span>
              <span>Target: <strong>{targetDonations} units</strong></span>
              <span>Remaining: <strong>{Math.max(0, targetDonations - unitsCollected)} units</strong></span>
            </div>
          </div>

          {/* Blood Units Table */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Collected Blood Units ({filteredBloodUnits.length})
              </h3>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search unit or donor..."
                  value={bloodSearchTerm}
                  onChange={(e) => setBloodSearchTerm(e.target.value)}
                  style={{
                    backgroundColor: '#fffdf5',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8rem',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />

                <select
                  value={bloodFilterGroup}
                  onChange={(e) => setBloodFilterGroup(e.target.value)}
                  style={{
                    backgroundColor: '#fffdf5',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8rem',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                >
                  <option value="ALL">All Blood Groups</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredBloodUnits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                No blood units recorded yet for this campaign. Click &ldquo;+ Record Blood Donation&rdquo; to add.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Unit Code</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Donor</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Blood Group</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Component / Volume</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Collected Date</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Testing Status</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Certificate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBloodUnits.map((u) => (
                      <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                          {u.unitCode}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{u.donorName}</div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.donorCode}</span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <span
                            style={{
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              fontWeight: 800,
                              borderRadius: '4px',
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.8rem',
                            }}
                          >
                            {u.bloodGroup}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>
                          {u.componentType} ({u.volume || 450} ml)
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748b' }}>
                          {formatDateTime(u.collectionDate)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              backgroundColor: u.testingDecision === 'APPROVED' ? '#ecfdf5' : u.testingDecision === 'REJECTED' ? '#fef2f2' : '#eff6ff',
                              color: u.testingDecision === 'APPROVED' ? '#065f46' : u.testingDecision === 'REJECTED' ? '#991b1b' : '#1e40af',
                            }}
                          >
                            {u.testingDecision === 'APPROVED' ? 'Safe (Passed)' : u.testingDecision === 'REJECTED' ? 'Contaminated' : 'In Screening'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleOpenUnitCertificate(u)}
                            style={{
                              backgroundColor: '#fffdf5',
                              border: '1px solid #d97706',
                              color: '#b45309',
                              borderRadius: '6px',
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <span>🎖️</span> Issue Certificate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 4: VOLUNTEERS AND ATTENDANCE */}
      {/* ======================================================== */}
      {activeTab === 'volunteers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Volunteer KPI Metrics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
            }}
          >
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>Total Assigned</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                {totalVolAssigned} Volunteers
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>Marked Present</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a', marginTop: '0.25rem' }}>
                {volPresent} Present
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>Marked Absent</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
                {volAbsent} Absent
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>Participation Rate</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#9333ea', marginTop: '0.25rem' }}>
                {volParticipationRate}%
              </div>
            </div>
          </div>

          {/* Volunteer Roster */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Volunteer Field Roster
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Mark attendance and assign roles for camp execution.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleOpenAssignModal}
                  style={{
                    backgroundColor: '#9333ea',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.45rem 0.95rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Assign Registered Volunteer
                </button>

                <button
                  onClick={() => {
                    setRegisterVolError(null);
                    setIsRegisterVolModalOpen(true);
                  }}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#9333ea',
                    border: '1px solid #9333ea',
                    borderRadius: '6px',
                    padding: '0.45rem 0.95rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  + Register On-Site Volunteer
                </button>
              </div>
            </div>

            {(!campaignVolunteers?.volunteers || campaignVolunteers.volunteers.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                No volunteers assigned yet. Click &ldquo;+ Assign Registered Volunteer&rdquo; to add field staff.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Volunteer</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Role</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Contact</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Attendance</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Staff Attribution</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignVolunteers.volunteers.map((vol) => {
                      const isPresent = vol.attendanceStatus === 'PRESENT';
                      const isAbsent = vol.attendanceStatus === 'ABSENT';

                      return (
                        <tr key={vol._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{vol.volunteerName}</div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                              {vol.volunteerCode}
                            </span>
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>
                            {VOLUNTEER_ROLE_LABELS[vol.role as VolunteerRole] || vol.role}
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem', color: '#64748b' }}>
                            <div>{vol.volunteerPhone}</div>
                            <div style={{ fontSize: '0.75rem' }}>{(vol as any).city || campaign.city}</div>
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '4px',
                                fontSize: '0.725rem',
                                fontWeight: 700,
                                backgroundColor: isPresent ? '#ecfdf5' : isAbsent ? '#fef2f2' : '#f1f5f9',
                                color: isPresent ? '#065f46' : isAbsent ? '#991b1b' : '#64748b',
                                border: isPresent ? '1px solid #a7f3d0' : isAbsent ? '1px solid #fecaca' : '1px solid #cbd5e1',
                              }}
                            >
                              {vol.attendanceStatus}
                            </span>
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {vol.attendanceMarkedBy ? (
                              <StaffAttributionBadge
                                label="Marked by"
                                name={vol.attendanceMarkedBy}
                                role="ADMIN"
                                timestamp={vol.attendanceMarkedAt}
                                size="xs"
                              />
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Pending check-in</span>
                            )}
                          </td>

                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                              <button
                                disabled={updatingAttendanceId === vol._id}
                                onClick={() => handleUpdateAttendance(vol._id, 'PRESENT')}
                                style={{
                                  backgroundColor: isPresent ? '#059669' : '#10b981',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                ✓ Present
                              </button>

                              <button
                                disabled={updatingAttendanceId === vol._id}
                                onClick={() => handleUpdateAttendance(vol._id, 'ABSENT')}
                                style={{
                                  backgroundColor: isAbsent ? '#991b1b' : '#ef4444',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                ✕ Absent
                              </button>

                              <button
                                onClick={() => handleUnassignVolunteer(vol._id, vol.volunteerName)}
                                style={{
                                  backgroundColor: '#ffffff',
                                  color: '#64748b',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.45rem',
                                  fontSize: '0.725rem',
                                  cursor: 'pointer',
                                }}
                              >
                                Unassign
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 5: BLOOD TESTING AND INVENTORY PROGRESS */}
      {/* ======================================================== */}
      {activeTab === 'testing_inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Intake Notification Alert */}
          {intakeSuccessMessage && (
            <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '8px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>✅ Central Inventory Enrollment Successful: </strong>
                {intakeSuccessMessage}
              </div>
              <button onClick={() => setIntakeSuccessMessage(null)} style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>
          )}

          {intakeErrorMessage && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>⚠️ Inventory Intake Error: </strong>
                {intakeErrorMessage}
              </div>
              <button onClick={() => setIntakeErrorMessage(null)} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>
          )}

          {/* 5-Panel TTI Testing Pipeline Funnel */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#0f172a' }}>
              Mandatory 5-Panel Screening &amp; Central Inventory Pipeline
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
              }}
            >
              <div style={{ backgroundColor: '#fffdf5', border: '1px solid #fef3c7', borderRadius: '8px', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>1. Collected at Camp</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                  {unitsCollected} Units
                </div>
              </div>

              <div style={{ backgroundColor: '#fffdf5', border: '1px solid #fef3c7', borderRadius: '8px', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>2. In Testing Lab</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7', marginTop: '0.25rem' }}>
                  {bloodReport?.summary?.testingInProgress || 0} Units
                </div>
              </div>

              <div style={{ backgroundColor: '#fffdf5', border: '1px solid #fef3c7', borderRadius: '8px', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>3. Screened Safe</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem' }}>
                  {bloodReport?.summary?.testingPassed || 0} Units
                </div>
              </div>

              <div style={{ backgroundColor: '#fffdf5', border: '1px solid #fef3c7', borderRadius: '8px', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>4. Stocked in Vault</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
                  {bloodReport?.summary?.inInventoryCount || 0} Units
                </div>
              </div>

              <div style={{ backgroundColor: '#fffdf5', border: '1px solid #fef3c7', borderRadius: '8px', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>5. Contaminated</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
                  {bloodReport?.summary?.testingFailed || 0} Units
                </div>
              </div>
            </div>

            {/* Central Inventory Intake Action Banner */}
            {bloodReport && (bloodReport.summary.testingPassed > bloodReport.summary.inInventoryCount) && (
              <div
                style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginTop: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#065f46', fontSize: '1rem', fontWeight: 700 }}>
                    📦 {bloodReport.summary.testingPassed - bloodReport.summary.inInventoryCount} Units Cleared &amp; Ready for Vault Intake
                  </h4>
                  <p style={{ margin: 0, color: '#047857', fontSize: '0.85rem' }}>
                    These units passed all mandatory infectious disease screening (HIV, HBV, HCV, Syphilis, Malaria) and are authorized to enroll into central stock.
                  </p>
                </div>

                <button
                  disabled={intakingInventory}
                  onClick={handleIntakePassedUnits}
                  style={{
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1.25rem',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                  }}
                >
                  {intakingInventory ? 'Enrolling into Vault...' : 'Intake Passed Units to Central Inventory →'}
                </button>
              </div>
            )}
          </div>

          {/* Blood Units Testing Table */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Unit-by-Unit Screening Outcomes &amp; Inventory Status
              </h3>

              {/* Status Filter */}
              <select
                value={bloodFilterStatus}
                onChange={(e) => setBloodFilterStatus(e.target.value)}
                style={{
                  backgroundColor: '#fffdf5',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8rem',
                  color: '#0f172a',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Screening Statuses</option>
                <option value="PASSED">Passed (Safe)</option>
                <option value="IN_PROGRESS">In Progress (Screening)</option>
                <option value="FAILED">Failed (Contaminated)</option>
                <option value="NEEDS_INTAKE">Needs Vault Intake</option>
                <option value="IN_INVENTORY">In Central Vault</option>
              </select>
            </div>

            {filteredBloodUnits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                No units matching current screening filter.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Unit Code</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Blood Group</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Donor</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>Collection Date</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Screening Result</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Vault Stock Status</th>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBloodUnits.map((u) => (
                      <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                          {u.unitCode}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                            {u.bloodGroup}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{u.donorName}</div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.donorCode}</span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748b' }}>
                          {formatDateTime(u.collectionDate)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              backgroundColor: u.testingDecision === 'APPROVED' ? '#ecfdf5' : u.testingDecision === 'REJECTED' ? '#fef2f2' : '#eff6ff',
                              color: u.testingDecision === 'APPROVED' ? '#065f46' : u.testingDecision === 'REJECTED' ? '#991b1b' : '#1e40af',
                            }}
                          >
                            {u.testingDecision === 'APPROVED' ? '✓ SAFE (Passed)' : u.testingDecision === 'REJECTED' ? '✕ Contaminated' : '⏳ In Screening'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          {u.isInInventory ? (
                            <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.725rem', fontWeight: 700 }}>
                              📦 In Vault Stock
                            </span>
                          ) : u.testingDecision === 'APPROVED' ? (
                            <span style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.725rem', fontWeight: 700 }}>
                              Needs Vault Intake
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Awaiting clearance</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleOpenUnitCertificate(u)}
                            style={{
                              backgroundColor: '#fffdf5',
                              border: '1px solid #fde68a',
                              color: '#92400e',
                              borderRadius: '4px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Certificate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}

      {/* 1. Add Campaign Expenditure Modal */}
      {isAddExpenseModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Add Campaign Expenditure</h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Linked to {campaign.campaignCode} ({campaign.name})</span>
              </div>
              <button onClick={() => setIsAddExpenseModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
            </div>

            {addExpenseError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {addExpenseError}
              </div>
            )}

            <div style={{ backgroundColor: isSuperAdmin ? '#ecfdf5' : '#eff6ff', border: isSuperAdmin ? '1px solid #a7f3d0' : '1px solid #bfdbfe', color: isSuperAdmin ? '#065f46' : '#1e40af', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
              {isSuperAdmin
                ? '👑 Super Admin Direct Authorization: This expenditure will be created directly in APPROVED status with payment tracked separately.'
                : '🛡️ Admin Submission: This expenditure will be submitted in PENDING status for Super Admin review and approval.'}
            </div>

            <form onSubmit={handleAddExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Expenditure Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cold-chain transport or donor refreshments"
                  value={expenseFormData.title}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, title: e.target.value })}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Category *</label>
                  <select
                    value={expenseFormData.category}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value as ExpenseCategory })}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Amount (₹ INR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 8500"
                    value={expenseFormData.amount}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Vendor / Merchant Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Supreme Logistics Ltd"
                    value={expenseFormData.vendorName}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, vendorName: e.target.value })}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Invoice / Bill Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-2026-0891"
                    value={expenseFormData.invoiceNumber}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, invoiceNumber: e.target.value })}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseFormData.expenseDate}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, expenseDate: e.target.value })}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Digital Bill / Receipt (PDF/Image)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, receiptFile: e.target.files?.[0] || null })}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Description / Purpose</label>
                <textarea
                  rows={2}
                  placeholder="Operational details for this expenditure..."
                  value={expenseFormData.description}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  style={{ backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingExpense}
                  style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {addingExpense ? 'Saving Expenditure...' : isSuperAdmin ? 'Authorize & Log Expense' : 'Submit for Super Admin Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Revise Budget Modal (Super Admin) */}
      {isReviseModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '1.75rem', color: '#0f172a' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Revise Approved Budget</h2>
            <p style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: '1rem' }}>
              Super Admin authority to adjust approved budget with immutable version tracking.
            </p>

            {reviseError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {reviseError}
              </div>
            )}

            <form onSubmit={handleReviseBudgetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Current Budget: {formatCurrency(campaign.approvedBudget)}
                </label>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>New Approved Budget (₹ INR) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newBudgetInput}
                  onChange={(e) => setNewBudgetInput(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Mandatory Justification Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain the operational rationale for this budget revision..."
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsReviseModalOpen(false)}
                  style={{ backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revising}
                  style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {revising ? 'Saving Revision...' : 'Save Approved Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Record Blood Donation Modal */}
      {isRecordDonationModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Record Campaign Blood Donation</h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Logs physical donation and issues unique Blood Unit code</span>
              </div>
              <button onClick={() => setIsRecordDonationModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
            </div>

            {recordDonationError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {recordDonationError}
              </div>
            )}

            <form onSubmit={handleRecordDonationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Donor Type Toggle */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setDonationDonorType('CAMPAIGN_DONOR')}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: donationDonorType === 'CAMPAIGN_DONOR' ? '2px solid #e11d48' : '1px solid #cbd5e1',
                    backgroundColor: donationDonorType === 'CAMPAIGN_DONOR' ? '#ffe4e6' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: donationDonorType === 'CAMPAIGN_DONOR' ? '#9f1239' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Walk-in Camp Donor
                </button>
                <button
                  type="button"
                  onClick={() => setDonationDonorType('REGISTERED')}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: donationDonorType === 'REGISTERED' ? '2px solid #e11d48' : '1px solid #cbd5e1',
                    backgroundColor: donationDonorType === 'REGISTERED' ? '#ffe4e6' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: donationDonorType === 'REGISTERED' ? '#9f1239' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Existing Registered Donor
                </button>
              </div>

              {donationDonorType === 'REGISTERED' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Select Registered Donor *</label>
                  <select
                    value={selectedDonorId}
                    onChange={(e) => setSelectedDonorId(e.target.value)}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    {registeredDonors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.fullName} ({d.bloodGroup}) • {d.donorCode} • {d.phone}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Donor Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        value={walkInName}
                        onChange={(e) => setWalkInName(e.target.value)}
                        style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={walkInPhone}
                        onChange={(e) => setWalkInPhone(e.target.value)}
                        style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Blood Group *</label>
                      <select
                        value={walkInBloodGroup}
                        onChange={(e) => setWalkInBloodGroup(e.target.value)}
                        style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                      >
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Gender</label>
                      <select
                        value={walkInGender}
                        onChange={(e) => setWalkInGender(e.target.value)}
                        style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Component Type *</label>
                  <select
                    value={donationComponentType}
                    onChange={(e) => setDonationComponentType(e.target.value)}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    <option value="WHOLE_BLOOD">Whole Blood</option>
                    <option value="PACKED_RED_CELLS">Packed Red Cells (PRBC)</option>
                    <option value="PLATELETS">Platelets (Random / Single)</option>
                    <option value="PLASMA">Fresh Frozen Plasma</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Unit Volume (ml) *</label>
                  <input
                    type="number"
                    required
                    min="100"
                    max="600"
                    value={unitVolume}
                    onChange={(e) => setUnitVolume(Number(e.target.value))}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Phlebotomist / Clinical Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Normal vitals, donor rested 15 min"
                  value={donationNotes}
                  onChange={(e) => setDonationNotes(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRecordDonationModalOpen(false)}
                  style={{ backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingDonation}
                  style={{ backgroundColor: '#e11d48', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {recordingDonation ? 'Recording Unit...' : 'Record & Issue Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Link Existing Expense Modal */}
      {isLinkModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '1.75rem', color: '#0f172a' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Link Central Expense</h2>
            <p style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: '1rem' }}>
              Associate an existing approved central blood bank liability with this campaign.
            </p>

            {linkError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {linkError}
              </div>
            )}

            <form onSubmit={handleLinkExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Select Approved Expense *</label>
                <select
                  value={selectedExpenseId}
                  onChange={(e) => setSelectedExpenseId(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                >
                  {availableExpenses.map((exp) => (
                    <option key={exp._id} value={exp._id}>
                      {exp.expenseCode} • {exp.title} ({formatCurrency(exp.amount)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  style={{ backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linking || availableExpenses.length === 0}
                  style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {linking ? 'Linking...' : 'Link to Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Assign Registered Volunteer Modal */}
      {isAssignVolunteerModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '1.75rem', color: '#0f172a' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Assign Registered Volunteer</h2>
            <p style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: '1rem' }}>
              Select a verified volunteer from the pool and assign an on-site campaign role.
            </p>

            {assignError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {assignError}
              </div>
            )}

            <form onSubmit={handleAssignVolunteerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Search Volunteer</label>
                <input
                  type="text"
                  placeholder="Search by name, code or phone..."
                  value={assignSearchInitials}
                  onChange={(e) => setAssignSearchInitials(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                />
                <select
                  value={selectedAssignVolId}
                  onChange={(e) => setSelectedAssignVolId(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                >
                  {filteredAvailableVolunteers.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.fullName} ({v.volunteerCode}) • {v.phone || v.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Assign Role *</label>
                <select
                  value={selectedAssignRole}
                  onChange={(e) => setSelectedAssignRole(e.target.value as VolunteerRole)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                >
                  {Object.entries(VOLUNTEER_ROLE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAssignVolunteerModalOpen(false)}
                  style={{ backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningVolunteer || !selectedAssignVolId}
                  style={{ backgroundColor: '#9333ea', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {assigningVolunteer ? 'Assigning...' : 'Assign to Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Register & Assign On-Site Volunteer Modal */}
      {isRegisterVolModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', width: '100%', maxWidth: '540px', padding: '1.75rem', color: '#0f172a' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Register On-Site Volunteer</h2>
            <p style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: '1rem' }}>
              Enrolls a walk-in volunteer directly into the blood bank registry and assigns them to this campaign drive.
            </p>

            {registerVolError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {registerVolError}
              </div>
            )}

            <form onSubmit={handleRegisterAndAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Anita Sharma"
                    value={newVolName}
                    onChange={(e) => setNewVolName(e.target.value)}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={newVolPhone}
                    onChange={(e) => setNewVolPhone(e.target.value)}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Blood Group</label>
                  <select
                    value={newVolBloodGroup}
                    onChange={(e) => setNewVolBloodGroup(e.target.value)}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Assigned Role *</label>
                  <select
                    value={newVolRole}
                    onChange={(e) => setNewVolRole(e.target.value as VolunteerRole)}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    {Object.entries(VOLUNTEER_ROLE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRegisterVolModalOpen(false)}
                  style={{ backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registeringVol}
                  style={{ backgroundColor: '#9333ea', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {registeringVol ? 'Enrolling...' : 'Register & Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Blood Donation Certificate Modal */}
      {isCertificateModalOpen && certificateData && (
        <BloodDonationCertificateModal
          isOpen={isCertificateModalOpen}
          onClose={() => setIsCertificateModalOpen(false)}
          data={certificateData}
        />
      )}
    </div>
  );
}
