'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const [costCenter, setCostCenter] = useState<CostCenter>(CostCenter.BLOOD_BANK_OPERATIONS);
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<string>('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [gstinNumber, setGstinNumber] = useState('');
  const [taxAmount, setTaxAmount] = useState<string>('');
  const [description, setDescription] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');

  // Receipt state
  const [existingReceipt, setExistingReceipt] = useState<any | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [currentStatus, setCurrentStatus] = useState<ExpenseStatus>(ExpenseStatus.DRAFT);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  // Duplicate Invoice Warning state
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);

  // Load existing expense if edit mode
  useEffect(() => {
    if (!expenseId) return;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchExpenseById(expenseId!);
        setTitle(data.title);
        setCategory(data.category);
        setCostCenter(data.costCenter);
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
        costCenter,
        expenseDate,
        amount: parsedAmount,
        vendorName: vendorName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        gstinNumber: gstinNumber.trim() || undefined,
        taxAmount: taxAmount ? parseFloat(taxAmount) : undefined,
        description: description.trim() || undefined,
        correctionNotes: correctionNotes.trim() || undefined,
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
        costCenter,
        expenseDate,
        amount: parsedAmount,
        vendorName: vendorName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        gstinNumber: gstinNumber.trim() || undefined,
        taxAmount: taxAmount ? parseFloat(taxAmount) : undefined,
        description: description.trim() || undefined,
        correctionNotes: correctionNotes.trim() || undefined,
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

      if (activeId) {
        if (currentStatus === ExpenseStatus.REJECTED) {
          await resubmitExpense(activeId, correctionNotes.trim());
        } else {
          await submitExpense(activeId, correctionNotes.trim() || undefined);
        }
      }

      setSuccessMessage('Expense successfully submitted for Super Admin review.');
      setTimeout(() => {
        router.push(`${basePath}/expenses`);
      }, 1200);
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

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link
            href={`${basePath}/expenses`}
            style={{ fontSize: '0.8rem', color: '#dc2626', textDecoration: 'none', fontWeight: 600 }}
          >
            &larr; Back to Expenses Directory
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.35rem 0 0 0' }}>
            {expenseId
              ? currentStatus === ExpenseStatus.REJECTED
                ? 'Correct & Resubmit Rejected Expense'
                : 'Edit Expense Draft'
              : 'Record Center Expenditure'}
          </h1>
          <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.825rem' }}>
            Enter vendor bill details, attach digital receipts, and submit for Super Admin authorization.
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
            <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Expenditure Title *
            </label>
            <input
              type="text"
              placeholder="e.g. 500 Triple Blood Bags with CPDA-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.825rem', backgroundColor: '#ffffff' }}
              >
                {Object.values(ExpenseCategory).map((c) => (
                  <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
                ))}
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
          </div>

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
            : currentStatus === ExpenseStatus.REJECTED
            ? 'Resubmit Corrected Claim'
            : 'Submit for Super Admin Review'}
        </button>
      </div>
    </div>
  );
}
