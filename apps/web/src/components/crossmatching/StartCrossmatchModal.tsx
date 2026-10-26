'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  BloodRequest,
  fetchBloodRequests,
} from '@/lib/blood-request-api';
import { createCrossmatch } from '@/lib/crossmatching-api';

interface StartCrossmatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedRequestId?: string;
}

export default function StartCrossmatchModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedRequestId,
}: StartCrossmatchModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin } = useAdminAuth();
  const isLabPortal = pathname?.startsWith('/lab') || admin?.role === 'LAB_TECHNICIAN';
  const basePath = isLabPortal ? '/lab' : '/admin';

  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>(
    preselectedRequestId || '',
  );
  const [sampleId, setSampleId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingRequests, setFetchingRequests] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setFetchingRequests(true);
    setError(null);

    fetchBloodRequests()
      .then((data) => {
        if (!isMounted) return;
        const eligible = data.filter((r) =>
          ['REQUESTED', 'VERIFIED', 'APPROVED'].includes(r.status),
        );
        setRequests(eligible);
        if (preselectedRequestId) {
          setSelectedRequestId(preselectedRequestId);
        } else if (eligible.length > 0 && !selectedRequestId) {
          setSelectedRequestId(eligible[0]._id);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load blood requests');
      })
      .finally(() => {
        if (isMounted) setFetchingRequests(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, preselectedRequestId, selectedRequestId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestId) {
      setError('Please select an eligible Blood Request to initiate crossmatching.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const created = await createCrossmatch(
        selectedRequestId,
        sampleId.trim() || undefined,
        notes.trim() || undefined,
      );

      if (onSuccess) onSuccess();
      onClose();
      router.push(`${basePath}/crossmatching/${created._id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start crossmatching');
    } finally {
      setLoading(false);
    }
  };

  const selectedReqObj = requests.find((r) => r._id === selectedRequestId);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🔬</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Initiate New Crossmatch Order
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Link compatibility testing directly to an active patient Blood Request
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {error && (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '12px',
                borderRadius: '8px',
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Select Patient Blood Request <span style={{ color: '#dc2626' }}>*</span>
            </label>
            {fetchingRequests ? (
              <div style={{ padding: '8px 0', fontSize: '12px', color: '#64748b' }}>
                Loading eligible patient requisitions...
              </div>
            ) : requests.length === 0 ? (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#64748b',
                }}
              >
                No active eligible blood requests found. Requisitions must be in REQUESTED, VERIFIED, or APPROVED status.
              </div>
            ) : (
              <select
                value={selectedRequestId}
                onChange={(e) => setSelectedRequestId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              >
                {requests.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.requestCode} — {r.patient.name} ({r.bloodGroup} • {r.componentType} • {r.unitsRequested} unit(s)) • {r.hospitalName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedReqObj && (
            <div
              style={{
                padding: '14px 16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Patient:</span>
                <strong style={{ color: '#0f172a' }}>
                  {selectedReqObj.patient.name} ({selectedReqObj.patient.age}y / {selectedReqObj.patient.gender})
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Requested Typing:</span>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                  }}
                >
                  {selectedReqObj.bloodGroup} {selectedReqObj.componentType} ({selectedReqObj.unitsRequested} unit(s))
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Hospital & Doctor:</span>
                <span style={{ color: '#334155' }}>
                  {selectedReqObj.hospitalName} • Dr. {selectedReqObj.doctorName}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Priority:</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: selectedReqObj.priority === 'CRITICAL_EMERGENCY' ? '#dc2626' : '#d97706',
                  }}
                >
                  {selectedReqObj.priority}
                </span>
              </div>
            </div>
          )}

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Initial Sample Tube ID (Optional)
            </label>
            <input
              type="text"
              value={sampleId}
              onChange={(e) => setSampleId(e.target.value)}
              placeholder="e.g. SMP-20261026-001 (can be verified later)"
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '13px',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Requisition Notes / Clinical Indication (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record surgery timing, special transfusion requirements, or clinical indications..."
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '13px',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Footer buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid #e2e8f0',
              marginTop: '8px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || requests.length === 0}
              style={{
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: '#dc2626',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || requests.length === 0 ? 'not-allowed' : 'pointer',
                opacity: loading || requests.length === 0 ? 0.6 : 1,
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
              }}
            >
              {loading ? 'Creating...' : 'Initiate Crossmatch Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
