'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  Plus,
  X,
  Check,
  FolderPlus,
  Sparkles,
} from 'lucide-react';
import {
  ExpenseCategory,
  CostCenter,
  EXPENSE_CATEGORY_LABELS,
  COST_CENTER_LABELS,
  createExpense,
  updateExpense,
  uploadExpenseReceipt,
  removeExpenseReceipt,
  submitExpense,
  resubmitExpense,
  fetchExpenseById,
  checkDuplicateInvoice,
  ExpenseItem,
  ExpenseStatus,
  formatINR,
} from '@/lib/expense-api';
import { fetchCampaigns } from '@/lib/campaign-api';

export const STANDARD_EXPENDITURES_BY_CATEGORY: Record<ExpenseCategory, string[]> = {
  [ExpenseCategory.MEDICAL_SUPPLIES]: [
    '500 Triple Blood Bags with CPDA-1',
    '350ml Single Blood Collection Bags with Anticoagulant',
    '450ml Quadruple Blood Bags with SAGM Additive Solution',
    'Blood Collection Vacuum Tubes (EDTA, Serum Gel, Citrate)',
    'Sterile Phlebotomy Needles & Blood Lancets (16G)',
    'Blood Tubing Strippers, Hand Sealers & Aluminum Clips',
    'Sterile Alcohol Swabs & Povidone Iodine Prep Pads',
    'Latex-Free Phlebotomy Tourniquets & Venipuncture Spot Bandages',
    'Blood Donor Recliner Chair Armrest Covers & Disposables',
  ],
  [ExpenseCategory.LABORATORY_TESTING]: [
    'HIV 1&2 4th Generation ELISA Diagnostic Screening Kits',
    'Hepatitis B Surface Antigen (HBsAg) ELISA Diagnostic Kits',
    'Hepatitis C Virus (HCV) Antibody Diagnostic Reagent Kits',
    'Syphilis (VDRL / RPR) Serological Screening Reagent Packs',
    'Malaria Antigen (Pf/Pv) Rapid Diagnostic Cards',
    'Monoclonal Blood Grouping Antisera (Anti-A, Anti-B, Anti-D)',
    'Crossmatching & Coombs Anti-Human Globulin (AHG) Reagents',
    'Laboratory Internal Quality Control (IQC) Sera & Standards',
    'Disposable Pipette Tips, Test Tubes & Microplates',
  ],
  [ExpenseCategory.FACILITIES_EQUIPMENT]: [
    'Refrigerated Blood Component Centrifuge AMC & Annual Calibration',
    'Blood Bank Walk-in Refrigerator (+4°C) Servicing & Gas Top-up',
    'Deep Plasma Freezer (-40°C / -80°C) Temperature Calibration & Validation',
    'High-Frequency Dielectric Tube Sealer Maintenance & Battery',
    'Platelet Agitator & Temperature-Controlled Incubator Maintenance',
    'Laminar Airflow & Biosafety Cabinet HEPA Filter Certification',
    'Central Blood Bank UPS Battery Bank Replacement & Inverter AMC',
    'Emergency Diesel Generator AMC & Automatic Transfer Switch Service',
  ],
  [ExpenseCategory.LOGISTICS_TRANSPORT]: [
    'Insulated Secondary Blood Transport Coolers & Hard Ice Packs',
    'Digital Temperature Data Loggers & Calibrated Cold-Chain Sensors',
    'Mobile Blood Donation Van Fuel & Routine Maintenance',
    'Specialized Medical Courier Charges for External Testing Samples',
    'Emergency Blood Component Dispatch & Hospital Delivery Van Fuel',
  ],
  [ExpenseCategory.STAFF_CAMP_MEALS]: [
    'Post-Donation Fruit Juices & Glucose Drink Packs for Donors',
    'High-Protein Biscuits & Wholesome Nutritional Snacks for Donors',
    'Donor Appreciation Certificates, Lapel Pins & Recognition Badges',
    'Mobile Donation Drive Canopy Tents, Chairs & Table Rental',
    'Camp Packaged Drinking Water Bottles & Biodegradable Paper Cups',
  ],
  [ExpenseCategory.ADMIN_OFFICE]: [
    'Thermal Barcode Labels & Donor Identification Wristbands',
    'Thermal Transfer Wax-Resin Ribbon Rolls for Barcode Printers',
    'Donor Blood Group Identification Cards & Lamination Pouches',
    'Administrative Stationery, Register Books & Archival Binders',
    'Blood Bank ERP Software Annual License & Cloud Backup',
  ],
  [ExpenseCategory.UTILITIES_WASTE]: [
    'Authorized Biomedical Waste Management & Incineration Agency Charges',
    'Color-Coded Biohazard Waste Bags (Red, Yellow, Blue, White)',
    'Puncture-Proof Sharps Disposal Translucent Containers',
    'Hospital-Grade Sodium Hypochlorite 10% Disinfectant Solution',
    'Commercial Electricity Tariff for Non-Stop Cold-Chain Storage',
  ],
  [ExpenseCategory.OTHER]: [
    'Nitrile Examination Gloves & Sterile Surgical Gloves',
    'Medical Staff Protective Disposable Aprons & Face Shields',
    'Hospital-Grade Floor Sanitization & Housekeeping Consumables',
    'Emergency First Aid Kit & Vasovagal Syncope Emergency Meds',
  ],
};

export const DEFAULT_CATEGORY_COST_CENTER: Record<ExpenseCategory, CostCenter> = {
  [ExpenseCategory.MEDICAL_SUPPLIES]: CostCenter.BLOOD_BANK_OPERATIONS,
  [ExpenseCategory.LABORATORY_TESTING]: CostCenter.LABORATORY_SERVICES,
  [ExpenseCategory.FACILITIES_EQUIPMENT]: CostCenter.BLOOD_BANK_OPERATIONS,
  [ExpenseCategory.LOGISTICS_TRANSPORT]: CostCenter.STORAGE_COLD_CHAIN,
  [ExpenseCategory.STAFF_CAMP_MEALS]: CostCenter.MOBILE_DONATION_CAMPS,
  [ExpenseCategory.ADMIN_OFFICE]: CostCenter.ADMIN_OVERHEAD,
  [ExpenseCategory.UTILITIES_WASTE]: CostCenter.BLOOD_BANK_OPERATIONS,
  [ExpenseCategory.OTHER]: CostCenter.BLOOD_BANK_OPERATIONS,
};

interface ExpenseFormProps {
  portalRole: 'ADMIN' | 'SUPER_ADMIN';
  expenseId?: string; // If editing an existing draft/rejected expense
}

export default function ExpenseFormContent({ portalRole, expenseId }: ExpenseFormProps) {
  const router = useRouter();
  const basePath = portalRole === 'SUPER_ADMIN' ? '/super-admin/finance' : '/admin/finance';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(!!expenseId);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.MEDICAL_SUPPLIES);
  const [customCategoryName, setCustomCategoryName] = useState<string | null>(null);
  const [costCenter, setCostCenter] = useState<CostCenter>(CostCenter.BLOOD_BANK_OPERATIONS);
  const [campaignId, setCampaignId] = useState<string>('');
  const [campaignsList, setCampaignsList] = useState<Array<{ _id: string; name: string; campaignCode: string; status: string }>>([]);
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<string>('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [gstinNumber, setGstinNumber] = useState('');
  const [taxAmount, setTaxAmount] = useState<string>('');
  const [description, setDescription] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');

  // Dropdown preset selection & custom categories state
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customEntries, setCustomEntries] = useState<Array<{ categoryName: string; title: string; costCenter: CostCenter }>>([]);

  // Add New Category Modal State
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newTitleInput, setNewTitleInput] = useState('');
  const [newCostCenterInput, setNewCostCenterInput] = useState<CostCenter>(CostCenter.BLOOD_BANK_OPERATIONS);
  const [modalError, setModalError] = useState<string | null>(null);

  // Receipt state
  const [existingReceipt, setExistingReceipt] = useState<any | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [currentStatus, setCurrentStatus] = useState<ExpenseStatus>(ExpenseStatus.DRAFT);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  // Duplicate Invoice Warning state
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);

  // Normal Admin submission completion state
  const [submittedResult, setSubmittedResult] = useState<{
    expenseCode: string;
    amount: number;
    title: string;
    vendorName: string;
    submittedAt: string;
  } | null>(null);

  // Load campaigns list for campaign linking
  useEffect(() => {
    fetchCampaigns({ limit: 100 })
      .then((res) => {
        if (res && res.campaigns) {
          setCampaignsList(res.campaigns);
        }
      })
      .catch(() => {});
  }, []);

  // Load custom categories from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bb_custom_expense_entries_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCustomEntries(parsed);
        }
      }
    } catch {}
  }, []);

  // Load existing expense if edit mode
  useEffect(() => {
    if (!expenseId) return;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchExpenseById(expenseId!);
        setTitle(data.title);
        setCategory(data.category);
        if ((data as any).customCategory) {
          setCustomCategoryName((data as any).customCategory);
        }
        setCostCenter(data.costCenter);
        if ((data as any).campaignId) {
          setCampaignId(String((data as any).campaignId));
        }

        // Set matching preset in dropdown
        const cat = data.category;
        const matchingStandard = (STANDARD_EXPENDITURES_BY_CATEGORY[cat] || []).find((t) => t === data.title);
        if (matchingStandard) {
          setSelectedPreset(`standard::${cat}::${data.title}::${data.costCenter}`);
        } else if ((data as any).customCategory) {
          setSelectedPreset(`custom::${(data as any).customCategory}::${data.title}::${data.costCenter}`);
        } else {
          setSelectedPreset(`custom::Other::${data.title}::${data.costCenter}`);
        }

        setExpenseDate(new Date(data.expenseDate).toISOString().slice(0, 10));
        setAmount(String(data.amount));
        setVendorName(data.vendorName);
        setInvoiceNumber(data.invoiceNumber);
        setGstinNumber(data.gstinNumber || '');
        setTaxAmount(data.taxAmount ? String(data.taxAmount) : '');
        setDescription(data.description || '');
        setExistingReceipt(data.receipt || null);
        setCurrentStatus(data.status);
        setRejectionReason(data.rejectionReason || null);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to load expense for editing.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [expenseId]);

  const isTitleInPresets = useMemo(() => {
    if (!title) return true;
    for (const cat of Object.values(ExpenseCategory)) {
      if ((STANDARD_EXPENDITURES_BY_CATEGORY[cat] || []).includes(title)) {
        return true;
      }
    }
    return customEntries.some((ce) => ce.title === title);
  }, [title, customEntries]);

  // Handler for selecting an expenditure preset from the dropdown
  const handlePresetSelect = (value: string) => {
    setSelectedPreset(value);
    if (!value) {
      setTitle('');
      return;
    }

    if (value.startsWith('custom::')) {
      const parts = value.split('::');
      const catName = parts[1];
      const presetTitle = parts[2];
      const presetCostCenter = (parts[3] as CostCenter) || CostCenter.BLOOD_BANK_OPERATIONS;

      setTitle(presetTitle);
      setCategory(ExpenseCategory.OTHER);
      setCustomCategoryName(catName);
      setCostCenter(presetCostCenter);
    } else if (value.startsWith('standard::')) {
      const parts = value.split('::');
      const cat = parts[1] as ExpenseCategory;
      const presetTitle = parts[2];
      const presetCostCenter = (parts[3] as CostCenter) || CostCenter.BLOOD_BANK_OPERATIONS;

      setTitle(presetTitle);
      setCategory(cat);
      setCustomCategoryName(null);
      setCostCenter(presetCostCenter);
    }
  };

  // Handler for adding a new custom category + title from modal
  const handleAddCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const catName = newCategoryInput.trim();
    const titleVal = newTitleInput.trim();

    if (!catName) {
      setModalError('Please enter a valid Category Name.');
      return;
    }
    if (!titleVal) {
      setModalError('Please enter a representative Expenditure Title for this category.');
      return;
    }

    const newEntry = {
      categoryName: catName,
      title: titleVal,
      costCenter: newCostCenterInput,
    };

    const updated = [newEntry, ...customEntries];
    setCustomEntries(updated);
    try {
      localStorage.setItem('bb_custom_expense_entries_v1', JSON.stringify(updated));
    } catch {}

    // Auto-select in form
    setTitle(titleVal);
    setCategory(ExpenseCategory.OTHER);
    setCustomCategoryName(catName);
    setCostCenter(newCostCenterInput);
    setSelectedPreset(`custom::${catName}::${titleVal}::${newCostCenterInput}`);

    // Reset and close
    setNewCategoryInput('');
    setNewTitleInput('');
    setIsAddCategoryModalOpen(false);
    setSuccessMessage(`New category "${catName}" and title added to dropdown and selected!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const uniqueCustomCategories = useMemo(() => {
    const set = new Set<string>();
    customEntries.forEach((c) => set.add(c.categoryName));
    if (customCategoryName && !set.has(customCategoryName)) {
      set.add(customCategoryName);
    }
    return Array.from(set);
  }, [customEntries, customCategoryName]);

  // Debounced duplicate invoice warning check
  useEffect(() => {
    if (!vendorName.trim() || !invoiceNumber.trim()) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const check = await checkDuplicateInvoice(vendorName, invoiceNumber, expenseId);
        if (check.isDuplicate) {
          setDuplicateWarning(check.existingExpense);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        setDuplicateWarning(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [vendorName, invoiceNumber, expenseId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(f.type)) {
        alert('Invalid file format. Please upload PDF, JPEG, PNG, or WEBP documents.');
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10 MB limit.');
        return;
      }
      setPendingFile(f);
    }
  };

  const handleSaveDraft = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedAmount = parseFloat(amount);
    if (!title.trim() || !vendorName.trim() || !invoiceNumber.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please provide Title, Vendor Name, Invoice Number, and a valid Amount (> 0).');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: title.trim(),
        category,
        customCategory: customCategoryName?.trim() || undefined,
        costCenter,
        expenseDate,
        amount: parsedAmount,
        vendorName: vendorName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        gstinNumber: gstinNumber.trim() || undefined,
        taxAmount: taxAmount ? parseFloat(taxAmount) : undefined,
        description: description.trim() || undefined,
        correctionNotes: correctionNotes.trim() || undefined,
        campaignId: campaignId || undefined,
      };

      let activeId = expenseId;
      if (expenseId) {
        await updateExpense(expenseId, payload);
      } else {
        const created = await createExpense(payload);
        activeId = created._id;
      }

      // If pending file exists, upload it now
      if (pendingFile && activeId) {
        await uploadExpenseReceipt(activeId, pendingFile);
      }

      setSuccessMessage('Draft expense saved successfully.');
      setTimeout(() => {
        router.push(`${basePath}/expenses`);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save expense draft.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForReview = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedAmount = parseFloat(amount);
    if (!title.trim() || !vendorName.trim() || !invoiceNumber.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please complete all mandatory invoice fields before submitting.');
      return;
    }

    if (!existingReceipt && !pendingFile) {
      setErrorMessage('A digital bill or receipt attachment is mandatory before submitting for Super Admin approval.');
      return;
    }

    if (currentStatus === ExpenseStatus.REJECTED && !correctionNotes.trim()) {
      setErrorMessage('Please provide correction remarks explaining what was updated as per the rejection notes.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: title.trim(),
        category,
        customCategory: customCategoryName?.trim() || undefined,
        costCenter,
        expenseDate,
        amount: parsedAmount,
        vendorName: vendorName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        gstinNumber: gstinNumber.trim() || undefined,
        taxAmount: taxAmount ? parseFloat(taxAmount) : undefined,
        description: description.trim() || undefined,
        correctionNotes: correctionNotes.trim() || undefined,
        campaignId: campaignId || undefined,
      };

      let activeId = expenseId;
      if (expenseId) {
        await updateExpense(expenseId, payload);
      } else {
        const created = await createExpense(payload);
        activeId = created._id;
      }

      if (pendingFile && activeId) {
        await uploadExpenseReceipt(activeId, pendingFile);
      }

      let finalExpense: ExpenseItem | null = null;
      if (activeId) {
        if (currentStatus === ExpenseStatus.REJECTED) {
          finalExpense = await resubmitExpense(activeId, correctionNotes.trim());
        } else {
          finalExpense = await submitExpense(activeId, correctionNotes.trim() || undefined);
        }
      }

      if (portalRole === 'SUPER_ADMIN') {
        setSuccessMessage('Expense recorded and directly APPROVED with Super Admin authorization.');
        setTimeout(() => {
          router.push(`${basePath}/expenses`);
        }, 1200);
      } else {
        // Normal Admin: Clear form and show explicit submission confirmation card with expense code
        setSubmittedResult({
          expenseCode: finalExpense?.expenseCode || 'EXP-SUBMITTED',
          amount: parsedAmount,
          title: title.trim(),
          vendorName: vendorName.trim(),
          submittedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit expense for review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        Loading expense record...
      </div>
    );
  }

  // Clear confirmation screen for Normal Admin
  if (submittedResult && portalRole === 'ADMIN') {
    return (
      <div style={{ maxWidth: '680px', margin: '2rem auto', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '2.5rem', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto', color: '#16a34a', fontSize: '1.75rem' }}>
          ✓
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
          Expense Successfully Submitted
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
          Your operational expenditure has been submitted for Super Admin review and verification along with the supporting receipt voucher.
        </p>

        <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '1.25rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '2rem', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
            <span style={{ color: '#64748b' }}>Tracking Code:</span>
            <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{submittedResult.expenseCode}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
            <span style={{ color: '#64748b' }}>Claim Title:</span>
            <strong style={{ color: '#0f172a' }}>{submittedResult.title}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
            <span style={{ color: '#64748b' }}>Vendor / Payee:</span>
            <span style={{ color: '#334155' }}>{submittedResult.vendorName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
            <span style={{ color: '#64748b' }}>Amount Claimed:</span>
            <strong style={{ color: '#0f172a' }}>{formatINR(submittedResult.amount)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
            <span style={{ color: '#64748b' }}>Status:</span>
            <span style={{ color: '#1d4ed8', fontWeight: 700 }}>AWAITING SUPER ADMIN REVIEW</span>
          </div>
        </div>

        <button
          onClick={() => {
            setSubmittedResult(null);
            setTitle('');
            setAmount('');
            setVendorName('');
            setInvoiceNumber('');
            setGstinNumber('');
            setTaxAmount('');
            setDescription('');
            setCorrectionNotes('');
            setPendingFile(null);
            setExistingReceipt(null);
          }}
          style={{
            padding: '0.65rem 1.5rem',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          + Submit Another Expense
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {portalRole === 'SUPER_ADMIN' && (
            <Link
              href={`${basePath}/expenses`}
              style={{ fontSize: '0.8rem', color: '#dc2626', textDecoration: 'none', fontWeight: 600 }}
            >
              &larr; Back to Expenses Directory
            </Link>
          )}
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.35rem 0 0 0' }}>
            {expenseId
              ? currentStatus === ExpenseStatus.REJECTED
                ? 'Correct & Resubmit Rejected Expense'
                : 'Edit Expense Draft'
              : portalRole === 'SUPER_ADMIN'
              ? 'Record Super Admin Expenditure'
              : 'Submit Operational Expense'}
          </h1>
          <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.825rem' }}>
            {portalRole === 'SUPER_ADMIN'
              ? 'Record center operational expenses with immediate Super Admin authorization and receipt attachment.'
              : 'Enter vendor bill details, attach digital receipts, and submit for Super Admin authorization.'}
          </p>
        </div>
      </div>

      {/* Rejection Alert Banner if correcting rejected expense */}
      {currentStatus === ExpenseStatus.REJECTED && rejectionReason && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            color: '#991b1b',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <span>⚠️ Super Admin Rejection Reason:</span>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', lineHeight: 1.5 }}>{rejectionReason}</p>
          <span style={{ fontSize: '0.75rem', color: '#b91c1c', display: 'block', marginTop: '0.5rem' }}>
            Update the items or replace the bill below, then explain your corrections in the &ldquo;Correction Notes&rdquo; field before resubmission.
          </span>
        </div>
      )}

      {/* Duplicate Invoice Warning Alert */}
      {duplicateWarning && (
        <div
          style={{
            padding: '0.85rem 1.15rem',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            color: '#92400e',
            fontSize: '0.85rem',
          }}
        >
          <strong>⚠️ Duplicate Invoice Warning:</strong> An invoice with number &ldquo;{invoiceNumber}&rdquo; for vendor &ldquo;{vendorName}&rdquo; was already recorded in the system:
          <span style={{ display: 'block', marginTop: '0.25rem', fontFamily: 'monospace' }}>
            {duplicateWarning.expenseCode} &bull; {formatINR(duplicateWarning.amount)} &bull; Status: {duplicateWarning.status}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#b45309', display: 'block', marginTop: '0.25rem' }}>
            Please ensure you are not submitting a duplicate claim for the same supplier invoice.
          </span>
        </div>
      )}

      {errorMessage && (
        <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '0.85rem' }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {successMessage && (
        <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', color: '#166534', fontSize: '0.85rem' }}>
          ✓ {successMessage}
        </div>
      )}

      {/* Form Container */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: '2rem',
        }}
      >
        {/* Left Column: General Expenditure Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
            1. Expenditure Information
          </h3>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#334155' }}>
                Expenditure Title *
              </label>
              <button
                type="button"
                onClick={() => setIsAddCategoryModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#f5f3ff',
                  color: '#6d28d9',
                  border: '1px solid #ddd6fe',
                  borderRadius: '6px',
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Add a new category or custom expenditure title"
              >
                <PlusCircle size={14} />
                <span>+ Add New Category</span>
              </button>
            </div>

            {/* Categorized Titles Dropdown */}
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetSelect(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                fontWeight: 600,
              }}
            >
              <option value="">-- Select from standard expenditure types by category --</option>
              {title && !isTitleInPresets && (
                <option value={selectedPreset || `custom::${customCategoryName || 'Custom'}::${title}::${costCenter}`}>
                  {title} {customCategoryName ? `[${customCategoryName}]` : ''}
                </option>
              )}
              {customEntries.length > 0 && (
                <optgroup label="⭐ Custom Categories & Titles">
                  {customEntries.map((ce, idx) => (
                    <option key={`custom-${idx}`} value={`custom::${ce.categoryName}::${ce.title}::${ce.costCenter}`}>
                      {ce.title} &mdash; [{ce.categoryName}]
                    </option>
                  ))}
                </optgroup>
              )}
              {Object.values(ExpenseCategory).map((cat) => {
                const items = STANDARD_EXPENDITURES_BY_CATEGORY[cat] || [];
                return (
                  <optgroup key={cat} label={`📂 ${EXPENSE_CATEGORY_LABELS[cat]}`}>
                    {items.map((itemTitle, idx) => (
                      <option key={`${cat}-${idx}`} value={`standard::${cat}::${itemTitle}::${DEFAULT_CATEGORY_COST_CENTER[cat]}`}>
                        {itemTitle}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Cost Center *
            </label>
            <select
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value as any)}
              style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.825rem', backgroundColor: '#ffffff' }}
            >
              {Object.values(CostCenter).map((cc) => (
                <option key={cc} value={cc}>{COST_CENTER_LABELS[cc]}</option>
              ))}
            </select>
          </div>

          {/* Campaign Selector if Mobile Donation Camps or campaigns exist */}
          {(costCenter === CostCenter.MOBILE_DONATION_CAMPS || campaignsList.length > 0) && (
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                🎪 Link to Scheduled Campaign (Optional)
              </label>
              <select
                value={campaignId}
                onChange={(e) => {
                  const val = e.target.value;
                  setCampaignId(val);
                  if (val) {
                    setCostCenter(CostCenter.MOBILE_DONATION_CAMPS);
                  }
                }}
                style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.825rem', backgroundColor: '#ffffff' }}
              >
                <option value="">-- No Campaign Linked (General Operational Expense) --</option>
                {campaignsList.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.campaignCode} &ndash; {c.name} ({c.status})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.725rem', color: '#64748b', display: 'block', marginTop: '0.35rem' }}>
                Select a scheduled campaign to link this expenditure directly to its budget.
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Total Amount (INR ₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="₹ 0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Expense Date *
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Operational Justification / Description
            </label>
            <textarea
              rows={3}
              placeholder="Itemized quantity, procurement purpose, or camp details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>

          {currentStatus === ExpenseStatus.REJECTED && (
            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.35rem' }}>
                Correction / Resubmission Remarks *
              </label>
              <textarea
                rows={2}
                placeholder="Explain what corrections were made matching the reviewer comments..."
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>
          )}
        </div>

        {/* Right Column: Vendor Details & Digital Receipt Uploader */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
            2. Payee & Bill Document
          </h3>

          <div>
            <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Vendor / Payee Company Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Hindustan Syringes & Medical Devices"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Tax Invoice / Cash Memo Number *
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-991"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Supplier GSTIN (Optional)
              </label>
              <input
                type="text"
                placeholder="15-digit GSTIN"
                maxLength={15}
                value={gstinNumber}
                onChange={(e) => setGstinNumber(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'monospace' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Tax / GST Amount in Bill (Optional ₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="₹ 0.00"
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
              style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Bill Receipt Upload Box */}
          <div>
            <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
              Upload Digital Bill / Voucher * (PDF, JPEG, PNG, WEBP &bull; Max 10MB)
            </label>

            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '1.25rem',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpeg,.jpg,.png,.webp,application/pdf,image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.35rem' }}>📎</span>

              {pendingFile ? (
                <div>
                  <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>Selected: {pendingFile.name}</strong>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#16a34a', marginTop: '0.2rem' }}>
                    {(pendingFile.size / 1024).toFixed(1)} KB &bull; Ready to attach upon saving
                  </span>
                </div>
              ) : existingReceipt ? (
                <div>
                  <strong style={{ color: '#0284c7', fontSize: '0.85rem' }}>Attached: {existingReceipt.originalName}</strong>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                    {(existingReceipt.sizeBytes / 1024).toFixed(1)} KB &bull; Click to choose new replacement file
                  </span>
                </div>
              ) : (
                <div>
                  <strong style={{ color: '#334155', fontSize: '0.85rem' }}>Click to select bill or drag & drop file</strong>
                  <span style={{ display: 'block', fontSize: '0.725rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Protected storage &bull; Mandatory for Super Admin submission
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingBottom: '2rem' }}>
        <button
          onClick={handleSaveDraft}
          disabled={submitting}
          style={{
            padding: '0.65rem 1.25rem',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            color: '#475569',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Saving...' : 'Save as Draft'}
        </button>

        <button
          onClick={handleSubmitForReview}
          disabled={submitting}
          style={{
            padding: '0.65rem 1.5rem',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 3px rgba(220,38,38,0.3)',
          }}
        >
          {submitting
            ? 'Submitting...'
            : portalRole === 'SUPER_ADMIN'
            ? 'Save & Approve Expense'
            : currentStatus === ExpenseStatus.REJECTED
            ? 'Resubmit Corrected Claim'
            : 'Submit for Super Admin Review'}
        </button>
      </div>

      {/* Add New Category & Title Modal */}
      {isAddCategoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddCategoryModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                backgroundColor: '#faf5ff',
                borderBottom: '1px solid #f3e8ff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#ede9fe',
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Add New Category &amp; Title
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    Create a custom expenditure category and title to add to your dropdown.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCategoryModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  borderRadius: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddCustomCategory} style={{ padding: '1.5rem' }}>
              {modalError && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    color: '#991b1b',
                    fontSize: '0.8rem',
                    marginBottom: '1rem',
                  }}
                >
                  ⚠️ {modalError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                    New Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IT &amp; Telephony Infrastructure, Security Services..."
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.725rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                    This category will appear in the Category dropdown and group your titles.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Expenditure Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Annual Cloud Backup &amp; SSL Security Certificate..."
                    value={newTitleInput}
                    onChange={(e) => setNewTitleInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.725rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                    Itemized procurement or expense title to add to the dropdown.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Default Cost Center *
                  </label>
                  <select
                    value={newCostCenterInput}
                    onChange={(e) => setNewCostCenterInput(e.target.value as CostCenter)}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.825rem',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {Object.values(CostCenter).map((cc) => (
                      <option key={cc} value={cc}>
                        {COST_CENTER_LABELS[cc]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  style={{
                    padding: '0.55rem 1rem',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.55rem 1.25rem',
                    backgroundColor: '#7c3aed',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 4px rgba(124, 58, 237, 0.25)',
                  }}
                >
                  <Plus size={15} />
                  <span>Add to Dropdown &amp; Select</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
