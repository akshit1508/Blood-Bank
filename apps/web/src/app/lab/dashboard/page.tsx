'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FlaskConical,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Droplet,
  Boxes,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { fetchTestingRecords, fetchUnitsAwaitingTesting, BloodTesting, BloodUnitSummary } from '@/lib/testing-api';

export default function LabDashboardPage() {
  const [testingRecords, setTestingRecords] = useState<BloodTesting[]>([]);
  const [awaitingUnits, setAwaitingUnits] = useState<BloodUnitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLabMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
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
  };

  useEffect(() => {
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
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Scoped Responsive Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .lab-dash-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 1.75rem;
              gap: 1rem;
            }
            .lab-dash-title {
              font-size: 1.75rem;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.02em;
              margin: 0;
            }
            .lab-dash-subtitle {
              color: #64748b;
              margin: 0.35rem 0 0 0;
              font-size: 0.875rem;
              line-height: 1.4;
            }
            .lab-dash-cta-btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 0.5rem;
              background-color: #7c3aed;
              color: #ffffff;
              padding: 0.75rem 1.25rem;
              border-radius: 8px;
              font-weight: 600;
              font-size: 0.875rem;
              text-decoration: none;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(124, 58, 237, 0.25);
              transition: all 0.15s ease;
            }
            .lab-dash-cta-btn:hover {
              background-color: #6d28d9;
              transform: translateY(-1px);
            }
            .lab-dash-stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 1.25rem;
              margin-bottom: 2rem;
            }
            .lab-dash-stat-card {
              background-color: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 1.25rem;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            .lab-dash-stat-card:hover {
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
            }
            .lab-table-desktop {
              display: block;
            }
            .lab-cards-mobile {
              display: none;
            }

            @media (max-width: 992px) {
              .lab-dash-stats-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
              }
            }

            @media (max-width: 768px) {
              .lab-dash-header {
                flex-direction: column;
                align-items: stretch;
                margin-bottom: 1.25rem;
              }
              .lab-dash-title {
                font-size: 1.4rem;
              }
              .lab-dash-cta-btn {
                width: 100%;
                padding: 0.75rem;
                font-size: 0.9rem;
              }
            }

            @media (max-width: 680px) {
              .lab-dash-stats-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
                margin-bottom: 1.5rem;
              }
              .lab-dash-stat-card {
                padding: 1rem 0.85rem;
                border-radius: 10px;
              }
              .lab-table-desktop {
                display: none;
              }
              .lab-cards-mobile {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                padding: 0.85rem;
              }
            }

            @media (max-width: 380px) {
              .lab-dash-stats-grid {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />

      {/* Page Header */}
      <div className="lab-dash-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#ede9fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7c3aed',
                flexShrink: 0,
              }}
            >
              <FlaskConical size={20} />
            </div>
            <h1 className="lab-dash-title">
              Laboratory Workstation Dashboard
            </h1>
          </div>
          <p className="lab-dash-subtitle">
            Diagnostic blood screening queues, infection testing logs, and quarantined release authorizations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={loadLabMetrics}
            disabled={loading}
            title="Refresh statistics"
            style={{
              padding: '0.75rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#475569',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link href="/lab/testing" className="lab-dash-cta-btn">
            <span>Open Testing Queue</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '10px',
            color: '#991b1b',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={loadLabMetrics}
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: '#ffffff',
              border: '1px solid #fca5a5',
              borderRadius: '6px',
              fontSize: '0.775rem',
              fontWeight: 700,
              color: '#991b1b',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Metrics Summary Cards */}
      <div className="lab-dash-stats-grid">
        {/* Card 1: Awaiting Testing */}
        <div className="lab-dash-stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Awaiting Initiation
              </span>
              <Clock size={16} color="#d97706" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', marginTop: '0.5rem', lineHeight: 1.1 }}>
              {loading ? '...' : awaitingUnits.length}
            </div>
          </div>
          <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.65rem' }}>
            Units quarantined in TESTING state
          </div>
        </div>

        {/* Card 2: Tests In Progress */}
        <div className="lab-dash-stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tests In Progress
              </span>
              <FlaskConical size={16} color="#7c3aed" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.5rem', lineHeight: 1.1 }}>
              {loading ? '...' : inProgressTests.length}
            </div>
          </div>
          <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.65rem' }}>
            Active screening panels
          </div>
        </div>

        {/* Card 3: Approved & Released */}
        <div className="lab-dash-stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Approved & Released
              </span>
              <CheckCircle2 size={16} color="#059669" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#059669', marginTop: '0.5rem', lineHeight: 1.1 }}>
              {loading ? '...' : completedApproved.length}
            </div>
          </div>
          <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.65rem' }}>
            All 5 screening tests passed
          </div>
        </div>

        {/* Card 4: Rejected & Quarantined */}
        <div className="lab-dash-stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Rejected / Failed
              </span>
              <XCircle size={16} color="#dc2626" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#dc2626', marginTop: '0.5rem', lineHeight: 1.1 }}>
              {loading ? '...' : completedRejected.length}
            </div>
          </div>
          <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.65rem' }}>
            Failed 1+ infection markers
          </div>
        </div>
      </div>

      {/* Quarantined Units Section */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {/* Section Header */}
        <div
          style={{
            padding: '1.15rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            backgroundColor: '#f8fafc',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Units Requiring Testing</span>
              <span
                style={{
                  fontSize: '0.725rem',
                  padding: '0.15rem 0.55rem',
                  backgroundColor: awaitingUnits.length > 0 ? '#fef3c7' : '#e2e8f0',
                  color: awaitingUnits.length > 0 ? '#92400e' : '#475569',
                  borderRadius: '999px',
                  fontWeight: 700,
                }}
              >
                {awaitingUnits.length}
              </span>
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Quarantined blood units registered awaiting 5-panel mandatory screening.
            </p>
          </div>
          <Link
            href="/lab/testing"
            style={{
              fontSize: '0.825rem',
              color: '#7c3aed',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>View Workstation</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: '#7c3aed' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading quarantined blood units...</div>
          </div>
        ) : awaitingUnits.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto', color: '#94a3b8' }}>
              <Boxes size={24} />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>Queue Clear</div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
              No blood units currently waiting for testing initiation.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 681px) */}
            <div className="lab-table-desktop" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Unit Code</th>
                    <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Blood Group</th>
                    <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Component</th>
                    <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {awaitingUnits.map((u) => (
                    <tr
                      key={u._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fdf4ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <Droplet size={14} color="#dc2626" />
                          <span>{u.unitCode}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            padding: '0.15rem 0.55rem',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '4px',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            border: '1px solid #fecaca',
                          }}
                        >
                          {u.bloodGroup}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', color: '#475569', fontWeight: 500 }}>
                        {u.componentType.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            padding: '0.15rem 0.55rem',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.725rem',
                            border: '1px solid #fde68a',
                          }}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        <Link
                          href="/lab/testing"
                          style={{
                            padding: '0.45rem 0.85rem',
                            backgroundColor: '#7c3aed',
                            color: '#ffffff',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '0.775rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            boxShadow: '0 1px 2px rgba(124, 58, 237, 0.2)',
                          }}
                        >
                          <span>Initiate Panel</span>
                          <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (<= 680px) */}
            <div className="lab-cards-mobile">
              {awaitingUnits.map((u) => (
                <div
                  key={u._id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  {/* Top row: Unit Code & Blood Group */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Droplet size={16} color="#dc2626" />
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                        {u.unitCode}
                      </span>
                    </div>
                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        border: '1px solid #fecaca',
                      }}
                    >
                      {u.bloodGroup}
                    </span>
                  </div>

                  {/* Middle row: Component & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.775rem', color: '#64748b' }}>
                    <span>{u.componentType.replace(/_/g, ' ')}</span>
                    <span
                      style={{
                        padding: '0.12rem 0.5rem',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        border: '1px solid #fde68a',
                      }}
                    >
                      {u.status}
                    </span>
                  </div>

                  {/* Action row: Full-width button for easy touch */}
                  <Link
                    href="/lab/testing"
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      backgroundColor: '#7c3aed',
                      color: '#ffffff',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span>Initiate in Workstation</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}