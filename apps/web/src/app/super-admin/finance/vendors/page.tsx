'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Vendor,
  VendorLedger,
  fetchVendors,
  createVendor,
  updateVendor,
  fetchVendorLedger,
} from '@/lib/vendor-api';
import { ExpenseCategory, EXPENSE_CATEGORY_LABELS, formatINR } from '@/lib/expense-api';

function VendorsContent() {
  const searchParams = useSearchParams();
  const queryVendorId = searchParams.get('vendorId');

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerData, setLedgerData] = useState<VendorLedger | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>(ExpenseCategory.MEDICAL_SUPPLIES);
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formPan, setFormPan] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formIfscCode, setFormIfscCode] = useState('');
  const [formBranchName, setFormBranchName] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadVendors = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await fetchVendors({
        search: search.trim() || undefined,
        category: categoryFilter || undefined,
      });
      setVendors(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  // Deep-link from other modules (?vendorId=...)
  useEffect(() => {
    if (queryVendorId) {
      viewLedger(queryVendorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryVendorId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadVendors();
  };

  const openCreateModal = () => {
    setFormName('');
    setFormCategory(ExpenseCategory.MEDICAL_SUPPLIES);
    setFormContactPerson('');
    setFormEmail('');
    setFormPhone('');
    setFormGstin('');
    setFormPan('');
    setFormBankName('');
    setFormAccountNumber('');
    setFormIfscCode('');
    setFormBranchName('');
    setFormNotes('');
    setFormActive(true);
    setModalError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (v: Vendor) => {
    setSelectedVendor(v);
    setFormName(v.name);
    setFormCategory(v.category);
    setFormContactPerson(v.contactPerson);
    setFormEmail(v.email || '');
    setFormPhone(v.phone);
    setFormGstin(v.gstinNumber || '');
    setFormPan(v.panNumber || '');
    setFormBankName(v.bankDetails?.bankName || '');
    setFormAccountNumber(''); // Leave blank to keep existing
    setFormIfscCode(v.bankDetails?.ifscCode || '');
    setFormBranchName(v.bankDetails?.branchName || '');
    setFormNotes(v.notes || '');
    setFormActive(v.isActive);
    setModalError(null);
    setShowEditModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formName.trim() || !formContactPerson.trim() || !formPhone.trim()) {
      setModalError('Please fill out Name, Contact Person, and Phone.');
      return;
    }

    try {
      setModalSubmitting(true);
      const bankDetails =
        formBankName.trim() && formAccountNumber.trim() && formIfscCode.trim()
          ? {
              bankName: formBankName.trim(),
              accountNumber: formAccountNumber.trim(),
              ifscCode: formIfscCode.trim().toUpperCase(),
              branchName: formBranchName.trim() || undefined,
            }
          : undefined;

      await createVendor({
        name: formName.trim(),
        category: formCategory,
        contactPerson: formContactPerson.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim(),
        gstinNumber: formGstin.trim() || undefined,
        panNumber: formPan.trim() || undefined,
        bankDetails,
        notes: formNotes.trim() || undefined,
      });

      setShowCreateModal(false);
      loadVendors();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to create vendor');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor) return;
    setModalError(null);

    try {
      setModalSubmitting(true);
      const updateData: any = {
        name: formName.trim(),
        category: formCategory,
        contactPerson: formContactPerson.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim(),
        gstinNumber: formGstin.trim() || undefined,
        panNumber: formPan.trim() || undefined,
        isActive: formActive,
        notes: formNotes.trim() || undefined,
      };

      if (formBankName.trim() && formAccountNumber.trim() && formIfscCode.trim()) {
        updateData.bankDetails = {
          bankName: formBankName.trim(),
          accountNumber: formAccountNumber.trim(),
          ifscCode: formIfscCode.trim().toUpperCase(),
          branchName: formBranchName.trim() || undefined,
        };
      }

      await updateVendor(selectedVendor._id, updateData);
      setShowEditModal(false);
      loadVendors();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to update vendor');
    } finally {
      setModalSubmitting(false);
    }
  };

  const viewLedger = async (vendorId: string) => {
    try {
      setLoadingLedger(true);
      setShowLedgerModal(true);
      setLedgerData(null);
      const ledger = await fetchVendorLedger(vendorId);
      setLedgerData(ledger);
    } catch (err: any) {
      alert(err?.message || 'Failed to load ledger');
      setShowLedgerModal(false);
    } finally {
      setLoadingLedger(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
            Vendor Directory
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
            Manage registered suppliers, contractors, banking coordinates, and financial ledgers.
          </p>
        </div>
          <button
            onClick={openCreateModal}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '0.65rem 1.25rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 1px 2px rgba(220,38,38,0.2)',
            }}
          >
            <span>+</span> Register New Vendor
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            backgroundColor: '#ffffff',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '1.5rem',
            alignItems: 'center',
          }}
        >
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Search vendor by name, phone, email, or GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              Search
            </button>
          </form>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.85rem',
              color: '#334155',
            }}
          >
            <option value="">All Categories</option>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {errorMessage && (
          <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Vendors Table */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              Loading vendors...
            </div>
          ) : vendors.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>No registered vendors found.</p>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem' }}>
                Click &ldquo;Register New Vendor&rdquo; above to onboard your first medical or facilities supplier.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Vendor / Company</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Contact Person</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Banking Coordinates</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{v.name}</div>
                      {v.gstinNumber && (
                        <div style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
                          GST: {v.gstinNumber}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.725rem',
                          fontWeight: 600,
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                        }}
                      >
                        {EXPENSE_CATEGORY_LABELS[v.category] || v.category}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{v.contactPerson}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{v.phone}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {v.bankDetails ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.8rem' }}>
                            {v.bankDetails.bankName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                            Acc: {v.bankDetails.accountNumber} &bull; IFSC: {v.bankDetails.ifscCode}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>
                          Not provided
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          backgroundColor: v.isActive ? '#ecfdf5' : '#f1f5f9',
                          color: v.isActive ? '#059669' : '#64748b',
                        }}
                      >
                        {v.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => viewLedger(v._id)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            color: '#1d4ed8',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          View Ledger
                        </button>
                        <button
                          onClick={() => openEditModal(v)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            color: '#334155',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Register Vendor Modal */}
        {showCreateModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
              padding: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                width: '100%',
                maxWidth: '640px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                padding: '1.75rem',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Register New Vendor
              </h2>

              {modalError && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', marginBottom: '1rem', fontSize: '0.825rem' }}>
                  ⚠️ {modalError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Legal / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apollo Diagnostics & Reagents Ltd"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Category *
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                    >
                      {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Contact Person *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rajesh Sharma"
                      value={formContactPerson}
                      onChange={(e) => setFormContactPerson(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="10-digit mobile or landline"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="billing@vendor.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="15-character GSTIN"
                      value={formGstin}
                      onChange={(e) => setFormGstin(e.target.value.toUpperCase())}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'monospace' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      PAN (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="10-character PAN"
                      value={formPan}
                      onChange={(e) => setFormPan(e.target.value.toUpperCase())}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                {/* Banking Section */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                    Banking Coordinates (Disbursement Details)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                        Bank Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. State Bank of India"
                        value={formBankName}
                        onChange={(e) => setFormBankName(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                        Account Number
                      </label>
                      <input
                        type="text"
                        placeholder="9 to 18 digits"
                        value={formAccountNumber}
                        onChange={(e) => setFormAccountNumber(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        maxLength={11}
                        placeholder="e.g. SBIN0001234"
                        value={formIfscCode}
                        onChange={(e) => setFormIfscCode(e.target.value.toUpperCase())}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'monospace' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                        Branch Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Main Branch"
                        value={formBranchName}
                        onChange={(e) => setFormBranchName(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{ padding: '0.55rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    style={{ padding: '0.55rem 1.25rem', border: 'none', borderRadius: '6px', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: modalSubmitting ? 'not-allowed' : 'pointer', opacity: modalSubmitting ? 0.7 : 1 }}
                  >
                    {modalSubmitting ? 'Registering...' : 'Register Vendor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Vendor Modal */}
        {showEditModal && selectedVendor && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
              padding: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                width: '100%',
                maxWidth: '640px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                padding: '1.75rem',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Edit Vendor Profile: {selectedVendor.name}
              </h2>

              {modalError && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', marginBottom: '1rem', fontSize: '0.825rem' }}>
                  ⚠️ {modalError}
                </div>
              )}

              <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Vendor Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                    >
                      {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={formContactPerson}
                      onChange={(e) => setFormContactPerson(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Status
                    </label>
                    <select
                      value={formActive ? 'true' : 'false'}
                      onChange={(e) => setFormActive(e.target.value === 'true')}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    style={{ padding: '0.55rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    style={{ padding: '0.55rem 1.25rem', border: 'none', borderRadius: '6px', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: modalSubmitting ? 'not-allowed' : 'pointer' }}
                  >
                    {modalSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Vendor Ledger Statement Modal */}
        {showLedgerModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
              padding: '1rem',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                width: '100%',
                maxWidth: '850px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                padding: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Vendor Financial Statement &amp; Ledger
                  </h2>
                  {ledgerData && (
                    <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                      {ledgerData.vendor.name} &bull; Contact: {ledgerData.vendor.phone}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowLedgerModal(false)}
                  style={{ border: 'none', background: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>

              {loadingLedger ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  Loading financial statement...
                </div>
              ) : ledgerData ? (
                <div>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>TOTAL INVOICED</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                        {formatINR(ledgerData.summary.totalInvoicedInr)}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem' }}>
                        {ledgerData.summary.invoicesCount} approved bills
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534' }}>TOTAL PAID</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginTop: '0.25rem' }}>
                        {formatINR(ledgerData.summary.totalPaidInr)}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#166534', marginTop: '0.2rem' }}>
                        {ledgerData.summary.disbursementsCount} completed payments
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#fff1f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9f1239' }}>OUTSTANDING BALANCE</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#be123c', marginTop: '0.25rem' }}>
                        {formatINR(ledgerData.summary.outstandingBalanceInr)}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#9f1239', marginTop: '0.2rem' }}>
                        Current Payable Balance
                      </div>
                    </div>
                  </div>

                  {/* Statement Items */}
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                    Chronological Ledger Statement
                  </h4>
                  {ledgerData.items.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                      No financial transactions recorded for this vendor yet.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Date</th>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Type</th>
                          <th style={{ padding: '0.65rem 0.75rem' }}>Reference / Details</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Billed (₹)</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Paid (₹)</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Balance (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.65rem 0.75rem', color: '#64748b' }}>
                              {new Date(item.date).toLocaleDateString('en-IN')}
                            </td>
                            <td style={{ padding: '0.65rem 0.75rem' }}>
                              <span
                                style={{
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  backgroundColor:
                                    item.type === 'INVOICE'
                                      ? '#eff6ff'
                                      : item.type === 'DISBURSEMENT'
                                      ? '#ecfdf5'
                                      : '#fef2f2',
                                  color:
                                    item.type === 'INVOICE'
                                      ? '#1d4ed8'
                                      : item.type === 'DISBURSEMENT'
                                      ? '#059669'
                                      : '#dc2626',
                                }}
                              >
                                {item.type}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.75rem' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.title}</div>
                              <div style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
                                Ref: {item.reference}
                              </div>
                            </td>
                            <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 600, color: item.debitInr > 0 ? '#0f172a' : '#94a3b8' }}>
                              {item.debitInr > 0 ? formatINR(item.debitInr) : '-'}
                            </td>
                            <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 600, color: item.creditInr > 0 ? '#15803d' : '#94a3b8' }}>
                              {item.creditInr > 0 ? formatINR(item.creditInr) : '-'}
                            </td>
                            <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#be123c' }}>
                              {formatINR(item.balanceInr)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
    </div>
  );
}

export default function SuperAdminVendorsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading vendor directory...</div>}>
      <VendorsContent />
    </Suspense>
  );
}
