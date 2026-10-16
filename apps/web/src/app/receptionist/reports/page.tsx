'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Printer,
  DollarSign,
  CreditCard,
  Receipt,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { fetchDailyRegisterReport } from '@/lib/receptionist-api';

export default function ReceptionistReportsPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadReport = async (dateStr: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchDailyRegisterReport(dateStr);
      setReport(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate cashier shift report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(selectedDate);
  }, [selectedDate]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem', color: '#f8fafc' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#f8fafc',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <BarChart3 style={{ width: '28px', height: '28px', color: '#f43f5e' }} />
            Daily Cashier Register & Shift Report
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
            Cashier shift reconciliation, cash count breakdown, and digital collection audit.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
            }}
          >
            <Calendar style={{ width: '16px', height: '16px', color: '#94a3b8' }} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1.25rem',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
            }}
          >
            <Printer style={{ width: '16px', height: '16px' }} />
            Print Shift Report
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle style={{ width: '20px', height: '20px', flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div
          style={{
            padding: '4rem 1.5rem',
            textAlign: 'center',
            color: '#94a3b8',
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
          }}
        >
          <Clock style={{ width: '32px', height: '32px', margin: '0 auto 0.75rem auto', color: '#f43f5e' }} />
          Generating shift reconciliation report for {selectedDate}...
        </div>
      ) : report ? (
        <div id="shift-report-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                <span>Total Collected</span>
                <DollarSign style={{ width: '16px', height: '16px', color: '#6ee7b7' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>
                ₹{(report.totalCollected || report.summary?.totalCollected || 0).toLocaleString()}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6ee7b7', margin: '0.35rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                Shift Total Reconciled
              </p>
            </div>

            <div
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                <span>Cash on Hand</span>
                <Receipt style={{ width: '16px', height: '16px', color: '#fbbf24' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>
                ₹{(report.totalCash || report.summary?.totalCash || 0).toLocaleString()}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>Physical drawer currency</p>
            </div>

            <div
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                <span>Digital Payments</span>
                <CreditCard style={{ width: '16px', height: '16px', color: '#60a5fa' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#60a5fa', fontFamily: 'monospace' }}>
                ₹{(report.totalDigital || report.summary?.totalDigital || 0).toLocaleString()}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>UPI, POS Card & Online</p>
            </div>

            <div
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                <span>Total Receipts Issued</span>
                <TrendingUp style={{ width: '16px', height: '16px', color: '#c084fc' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c084fc', fontFamily: 'monospace' }}>
                {report.transactionCount || report.collections?.length || 0}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>Verified transactions</p>
            </div>
          </div>

          {/* Detailed Collections Shift Breakdown */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1rem',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.9rem', margin: 0 }}>
                Shift Transactions for {new Date(selectedDate).toLocaleDateString()}
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Reception Counter Drawer</span>
            </div>

            {!report.collections || report.collections.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No collections logged for the selected date.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#020617',
                        borderBottom: '1px solid #1e293b',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                      }}
                    >
                      <th style={{ padding: '0.75rem 1rem' }}>Receipt #</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Time</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Payment Mode</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Reference</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.collections.map((c: any) => (
                      <tr
                        key={c._id || c.id}
                        style={{
                          borderBottom: '1px solid #1e293b',
                          backgroundColor: '#0f172a',
                        }}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#f43f5e' }}>
                          {c.receiptNumber || c._id?.slice(-8)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                          {new Date(c.createdAt || Date.now()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{c.paymentMethod}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#94a3b8', fontSize: '0.75rem' }}>
                          {c.referenceNumber || 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#6ee7b7' }}>
                          ₹{(c.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#020617', borderTop: '1px solid #1e293b', fontWeight: 800 }}>
                      <td colSpan={4} style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8' }}>
                        Shift Total:
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#6ee7b7', fontSize: '0.95rem' }}>
                        ₹{(report.totalCollected || report.summary?.totalCollected || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
