'use client';

import React, { useState } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const [role, setRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'LAB_TECHNICIAN' | 'FINANCE_RECEPTIONIST'>('SUPER_ADMIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleChange = (newRole: 'SUPER_ADMIN' | 'ADMIN' | 'LAB_TECHNICIAN' | 'FINANCE_RECEPTIONIST') => {
    setRole(newRole);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password, role);
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Top Header / Brand Banner */}
        <div
          style={{
            backgroundColor: '#dc2626',
            padding: '2rem 1.75rem 1.75rem 1.75rem',
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              margin: '0 auto 1rem auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Blood Bank Management
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
            Internal Clinical & Operations Console
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: '2rem 1.75rem' }}>
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              Staff & Administrator Sign In
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Enter your verified email and password to access operations.
            </p>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.35rem',
                }}
              >
                Select Portal / Role
              </label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  border: '2px solid #dc2626',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  backgroundColor: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <option value="SUPER_ADMIN">👑 Super Admin Portal (/super-admin/dashboard)</option>
                <option value="ADMIN">🛡️ Operations Admin Portal (/admin/dashboard)</option>
                <option value="LAB_TECHNICIAN">🧪 Testing / Lab Technician Portal (/lab/dashboard)</option>
                <option value="FINANCE_RECEPTIONIST">🧾 Finance Receptionist Portal (/receptionist/dashboard)</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.35rem',
                }}
              >
                Staff Email Address
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@bloodbank.org"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.35rem',
                }}
              >
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: '0.5rem',
                backgroundColor: submitting ? '#ef4444' : '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease',
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
              }}
            >
              {submitting ? 'Verifying Credentials...' : 'Sign In to Admin Portal'}
            </button>
          </form>

          {/* Security note */}
          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid #f1f5f9',
              fontSize: '0.75rem',
              color: '#94a3b8',
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            🔒 Authorized personnel only. All access is logged and verified against the blood bank database.
          </div>
        </div>
      </div>
    </div>
  );
}
