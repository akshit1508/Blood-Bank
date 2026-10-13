'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchTestingRecords, fetchUnitsAwaitingTesting, BloodTesting, BloodUnitSummary } from '@/lib/testing-api';

export default function LabDashboardPage() {
  const [testingRecords, setTestingRecords] = useState<BloodTesting[]>([]);
  const [awaitingUnits, setAwaitingUnits] = useState<BloodUnitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLabMetrics() {
      try {
        setLoading(true);
        const [testsRes, unitsRes] = await Promise.all([
          fetchTestingRecords(),
          fetchUnitsAwaitingTesting(10),
        ]);
        setTestingRecords(testsRes.items);
        setAwaitingUnits(unitsRes.items);
      } catch (err: any) {
        setError(err?.message || 'Failed to load laboratory queue metrics.');
      } finally {
        setLoading(false);
      }
    }
    loadLabMetrics();
  }, []);

  const inProgressTests = testingRecords.filter((t) => t.status === 'IN_PROGRESS');
  const completedApproved = testingRecords.filter(
    (t) => t.status === 'COMPLETED' && t.decision === 'APPROVED'
  );
  const completedRejected = testingRecords.filter(
    (t) => t.status === 'COMPLETED' && t.decision === 'REJECTED'
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Laboratory Workstation Dashboard
          </h1>
          <p style={{ color: '#64748b', margin: '0.35rem 0 0 0', fontSize: '0.875rem' }}>
            Diagnostic blood screening queues, infection testing logs, and quarantined release authorizations.
          </p>
        </div>
        <Link
          href="/lab/testing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: '#7c3aed',
            color: '#ffffff',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.875rem',
            textDecoration: 'none',
          }}
        >
          <span>Open Testing Queue &rarr;</span>
        </Link>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Awaiting Testing Initiation</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.5rem' }}>
            {loading ? '...' : awaitingUnits.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Units quarantined in TESTING state</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tests In Progress</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.5rem' }}>
            {loading ? '...' : inProgressTests.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Active screening panels</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Approved & Released</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', marginTop: '0.5rem' }}>
            {loading ? '...' : completedApproved.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>All 5 screening tests passed</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rejected & Quarantined</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444', marginTop: '0.5rem' }}>
            {loading ? '...' : completedRejected.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Failed 1+ infection markers</div>
        </div>
      </div>

      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Units Requiring Testing ({awaitingUnits.length})
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Blood units registered and quarantined awaiting 5-panel mandatory screening.
            </p>
          </div>
          <Link
            href="/lab/testing"
            style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}
          >
            View Workstation &rarr;
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading quarantined blood units...</div>
        ) : awaitingUnits.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            No blood units currently waiting for testing.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: 600 }}>Unit Code</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: 600 }}>Blood Group</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: 600 }}>Component</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.75rem 1.5rem', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {awaitingUnits.map((u) => (
                  <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.5rem', fontWeight: 600, color: '#0f172a' }}>{u.unitCode}</td>
                    <td style={{ padding: '0.85rem 1.5rem' }}>
                      <span style={{ padding: '0.15rem 0.5rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
                        {u.bloodGroup}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1.5rem', color: '#64748b' }}>{u.componentType.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '0.85rem 1.5rem' }}>
                      <span style={{ padding: '0.15rem 0.5rem', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem' }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1.5rem', textAlign: 'right' }}>
                      <Link
                        href="/lab/testing"
                        style={{
                          padding: '0.35rem 0.75rem',
                          backgroundColor: '#7c3aed',
                          color: '#ffffff',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        Initiate in Workstation
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}