'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchAdminAccounts,
  createStaffAccount,
  updateAdminAccountStatus,
  AdminAccountSummary,
  CreateStaffInput,
} from '@/lib/auth-api';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function SuperAdminStaffManagementPage() {
  const { admin: currentAdmin } = useAdminAuth();
  const [admins, setAdmins] = useState<AdminAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal / Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateStaffInput>({
    email: '',
    fullName: '',
    password: '',
    role: 'ADMIN',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusTogglingId, setStatusTogglingId] = useState<string | null>(null);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminAccounts();
      setAdmins(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load staff accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await createStaffAccount(createForm);
      setSuccess(`Account for ${createForm.fullName} (${createForm.role}) created successfully.`);
      setShowCreateModal(false);
      setCreateForm({ email: '', fullName: '', password: '', role: 'ADMIN' });
      await loadAccounts();
    } catch (err: any) {
      setError(err?.message || 'Failed to create staff account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (targetAdmin: AdminAccountSummary) => {
    if (targetAdmin._id === currentAdmin?.id) {
      alert('You cannot deactivate your own account.');
      return;
    }

    const nextStatus = !targetAdmin.isActive;
    const confirmMsg = nextStatus
      ? `Reactivate account for ${targetAdmin.fullName}?`
      : `Are you sure you want to deactivate ${targetAdmin.fullName}? They will not be able to log in.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setStatusTogglingId(targetAdmin._id);
      setError(null);
      setSuccess(null);
      await updateAdminAccountStatus(targetAdmin._id, nextStatus);
      setSuccess(`Updated status for ${targetAdmin.fullName} to ${nextStatus ? 'Active' : 'Inactive'}.`);
      await loadAccounts();
    } catch (err: any) {
      setError(err?.message || 'Failed to update account status');
    } finally {
      setStatusTogglingId(null);
    }
  };

  const roleBadgeStyle = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { backgroundColor: '#451a03', color: '#f59e0b', border: '1px solid #78350f' };
      case 'LAB_TECHNICIAN':
        return { backgroundColor: '#3b0764', color: '#c084fc', border: '1px solid #581c87' };
      case 'FINANCE_RECEPTIONIST':
        return { backgroundColor: '#064e3b', color: '#34d399', border: '1px solid #059669' };
      default:
        return { backgroundColor: '#082f49', color: '#38bdf8', border: '1px solid #075985' };
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href="/super-admin/dashboard" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none' }}>
              &larr; Super Admin Portal
            </Link>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Staff & Role Management
          </h1>
          <p style={{ color: '#94a3b8', margin: '0.35rem 0 0 0', fontSize: '0.875rem' }}>
            Create and maintain staff profiles. Standard admins and laboratory technicians are provisioned here.
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              backgroundColor: '#d97706',
              color: '#ffffff',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>+ Add Staff Member</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#450a0a', border: '1px solid #991b1b', borderRadius: '8px', color: '#fca5a5', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '1rem', backgroundColor: '#064e3b', border: '1px solid #047857', borderRadius: '8px', color: '#6ee7b7', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          {success}
        </div>
      )}

      <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
            Authorized Personnel Directory ({admins.length})
          </span>
          <button
            onClick={loadAccounts}
            disabled={loading}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              color: '#94a3b8',
              fontSize: '0.75rem',
              padding: '0.35rem 0.75rem',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#fef3c7', color: '#92400e', borderBottom: '1px solid #fde68a' }}>
              <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600 }}>Staff Member</th>
              <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600 }}>Assigned Role</th>
              <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600 }}>Created</th>
              <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  Loading staff profiles...
                </td>
              </tr>
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No accounts found in directory.
                </td>
              </tr>
            ) : (
              admins.map((acc) => {
                const isSelf = acc._id === currentAdmin?.id;
                const badge = roleBadgeStyle(acc.role);

                return (
                  <tr key={acc._id} style={{ borderBottom: '1px solid #fef3c7' }}>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {acc.fullName} {isSelf && <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: '0.25rem' }}>(You)</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{acc.email}</div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          ...badge,
                        }}
                      >
                        {acc.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.75rem',
                          color: acc.isActive ? '#10b981' : '#ef4444',
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: acc.isActive ? '#10b981' : '#ef4444' }} />
                        {acc.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: '#64748b', fontSize: '0.75rem' }}>
                      {new Date(acc.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      {acc.role === 'SUPER_ADMIN' ? (
                        <span style={{ fontSize: '0.75rem', color: '#475569' }}>Protected</span>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(acc)}
                          disabled={statusTogglingId === acc._id || isSelf}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid',
                            borderColor: acc.isActive ? '#991b1b' : '#047857',
                            backgroundColor: acc.isActive ? '#450a0a' : '#064e3b',
                            color: acc.isActive ? '#fca5a5' : '#6ee7b7',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {statusTogglingId === acc._id
                            ? 'Updating...'
                            : acc.isActive
                            ? 'Deactivate'
                            : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              maxWidth: '480px',
              width: '100%',
              padding: '2rem',
              color: '#0f172a',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Add Staff Member</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateStaff}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. Dr. Jane Smith"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. jane.smith@hospital.org"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                  placeholder="••••••••••••"
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Role Assignment
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'ADMIN' | 'LAB_TECHNICIAN' | 'FINANCE_RECEPTIONIST' })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="ADMIN">ADMIN — Clinical & Operational Management</option>
                  <option value="LAB_TECHNICIAN">LAB_TECHNICIAN — Dedicated Testing Workstation</option>
                  <option value="FINANCE_RECEPTIONIST">FINANCE_RECEPTIONIST — Front Desk Patient & Billing</option>
                </select>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.35rem' }}>
                  Note: Super Admin role assignment cannot be granted via this form to prevent privilege escalation.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '0.6rem 1.25rem',
                    backgroundColor: '#dc2626',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  {isSubmitting ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}