'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  fetchAdminAccounts,
  createStaffAccount,
  updateStaffAccount,
  updateAdminAccountStatus,
  AdminAccountSummary,
  CreateStaffInput,
  UpdateStaffInput,
} from '@/lib/auth-api';
import { useAdminAuth } from '@/context/AdminAuthContext';
import StaffAttributionBadge from '@/components/admin/StaffAttributionBadge';

export default function SuperAdminStaffManagementPage() {
  const { admin: currentAdmin } = useAdminAuth();
  const [admins, setAdmins] = useState<AdminAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateStaffInput>({
    email: '',
    fullName: '',
    password: '',
    designation: '',
    role: 'ADMIN',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modal state
  const [editingAdmin, setEditingAdmin] = useState<AdminAccountSummary | null>(null);
  const [editForm, setEditForm] = useState<UpdateStaffInput>({
    fullName: '',
    designation: '',
    role: 'ADMIN',
    password: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Action busy state
  const [statusTogglingId, setStatusTogglingId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminAccounts({
        search: searchQuery,
        role: roleFilter,
        status: statusFilter,
      });
      setAdmins(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load staff accounts');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAccounts();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadAccounts]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await createStaffAccount(createForm);
      setSuccess(`Account for ${createForm.fullName} (${createForm.role}) created successfully.`);
      setShowCreateModal(false);
      setCreateForm({ email: '', fullName: '', password: '', designation: '', role: 'ADMIN' });
      await loadAccounts();
    } catch (err: any) {
      setError(err?.message || 'Failed to create staff account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (target: AdminAccountSummary) => {
    setEditingAdmin(target);
    setEditForm({
      fullName: target.fullName,
      designation: target.designation || '',
      role: target.role as any,
      password: '',
    });
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;

    setError(null);
    setSuccess(null);
    setIsUpdating(true);

    try {
      const payload: UpdateStaffInput = {
        fullName: editForm.fullName,
        designation: editForm.designation,
        role: editForm.role,
      };
      if (editForm.password && editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      await updateStaffAccount(editingAdmin._id, payload);
      setSuccess(`Account details for ${editForm.fullName} updated successfully.`);
      setEditingAdmin(null);
      await loadAccounts();
    } catch (err: any) {
      setError(err?.message || 'Failed to update staff account');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (targetAdmin: AdminAccountSummary) => {
    if (targetAdmin._id === currentAdmin?.id) {
      alert('Security violation: You cannot deactivate your own active account.');
      return;
    }

    const nextStatus = !targetAdmin.isActive;
    const confirmMsg = nextStatus
      ? `Reactivate account for ${targetAdmin.fullName} (${targetAdmin.email})?`
      : `Are you sure you want to deactivate ${targetAdmin.fullName} (${targetAdmin.email})? They will not be able to log in.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setStatusTogglingId(targetAdmin._id);
      setError(null);
      setSuccess(null);
      await updateAdminAccountStatus(targetAdmin._id, nextStatus);
      setSuccess(`Updated status for ${targetAdmin.fullName} to ${nextStatus ? 'Active' : 'Deactivated'}.`);
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
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
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
            Provision, manage, and audit individual staff accounts across all system roles.
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
              boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.2)',
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

      {/* Search and Filters Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ flex: '1 1 250px' }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            Search Staff
          </label>
          <input
            type="text"
            placeholder="Search by name, email, or designation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              fontSize: '0.85rem',
              color: '#0f172a',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ flex: '0 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            Filter by Role
          </label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              fontSize: '0.85rem',
              color: '#0f172a',
              boxSizing: 'border-box',
            }}
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Operational Admin</option>
            <option value="LAB_TECHNICIAN">Lab Tech / Tester</option>
            <option value="FINANCE_RECEPTIONIST">Finance Receptionist</option>
          </select>
        </div>

        <div style={{ flex: '0 1 160px' }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              fontSize: '0.85rem',
              color: '#0f172a',
              boxSizing: 'border-box',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Deactivated Only</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
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

        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#fef3c7', color: '#92400e', borderBottom: '1px solid #fde68a' }}>
                <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600 }}>Staff Member</th>
                <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600 }}>Assigned Role</th>
                <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600 }}>Designation</th>
                <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600 }}>Last Login</th>
                <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    Loading staff profiles...
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    No staff accounts match the specified criteria.
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
                          {acc.fullName} {isSelf && <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: '0.25rem', fontWeight: 700 }}>(You)</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>{acc.email}</div>
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
                          {acc.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#334155', fontSize: '0.8rem' }}>
                        {acc.designation || 'Staff Officer'}
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
                        {acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleString('en-IN') : 'Never logged in'}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            onClick={() => handleOpenEdit(acc)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#f8fafc',
                              color: '#334155',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          {isSelf ? (
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.35rem 0.5rem' }}>
                              Current User
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(acc)}
                              disabled={statusTogglingId === acc._id}
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

      {/* Add Staff Modal */}
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
              maxWidth: '520px',
              width: '100%',
              padding: '2rem',
              color: '#0f172a',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Add Individual Staff Member</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Create secure login credentials for a new authorized operator.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateStaff}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Full Name *
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
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. Dr. Jane Smith"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Official Email Address *
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
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. jane.smith@hospital.org"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Designation / Title (Optional)
                </label>
                <input
                  type="text"
                  value={createForm.designation}
                  onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. Senior Screening Specialist"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Initial Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                  placeholder="••••••••••••"
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Role Assignment *
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="ADMIN">ADMIN — Clinical & Operational Management</option>
                  <option value="LAB_TECHNICIAN">LAB_TECHNICIAN — Laboratory Testing Workstation</option>
                  <option value="FINANCE_RECEPTIONIST">FINANCE_RECEPTIONIST — Front Desk Patient & Billing</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN — Full Administrative & Governance Access</option>
                </select>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.35rem' }}>
                  The staff member will be strictly authorized based on this assigned role.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#64748b',
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
                    backgroundColor: '#d97706',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
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

      {/* Edit Staff Modal */}
      {editingAdmin && (
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
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              padding: '2rem',
              color: '#0f172a',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Edit Staff Member</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  {editingAdmin.email}
                </p>
              </div>
              <button
                onClick={() => setEditingAdmin(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateStaff}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Designation / Title
                </label>
                <input
                  type="text"
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Role Assignment *
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="ADMIN">ADMIN — Clinical & Operational Management</option>
                  <option value="LAB_TECHNICIAN">LAB_TECHNICIAN — Laboratory Testing Workstation</option>
                  <option value="FINANCE_RECEPTIONIST">FINANCE_RECEPTIONIST — Front Desk Patient & Billing</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN — Full Administrative & Governance Access</option>
                </select>
                {editingAdmin._id === currentAdmin?.id && editForm.role !== 'SUPER_ADMIN' && (
                  <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '0.35rem', fontWeight: 600 }}>
                    Warning: You cannot demote your own Super Admin account.
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Reset Password (Leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                  placeholder="New password (optional)"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  style={{
                    padding: '0.6rem 1.25rem',
                    backgroundColor: '#0284c7',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}