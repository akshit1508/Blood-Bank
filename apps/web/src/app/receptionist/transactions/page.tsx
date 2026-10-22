'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Printer,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  CreditCard,
} from 'lucide-react';
import { fetchCollections } from '@/lib/receptionist-api';
import ReceptionistSelect from '@/components/receptionist/ReceptionistSelect';

export default function ReceptionistTransactionsHistoryPage() {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const loadCollections = async () => {
    setLoading(true);
    try {
      const data = await fetchCollections({
        paymentMethod: paymentMethodFilter,
        search: searchQuery,
      });
      setCollections(data);
    } catch {
      // Soft error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, [paymentMethodFilter]);

  const filteredCollections = collections.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.receiptNumber?.toLowerCase().includes(q) ||
      c.referenceNumber?.toLowerCase().includes(q) ||
      c.paymentMethod?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredCollections.length / pageSize) || 1;
  const paginatedCollections = filteredCollections.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

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
            <Receipt style={{ width: '28px', height: '28px', color: '#f43f5e' }} />
            Receipts & Transaction Ledger
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
            Complete cashier journal of payments received, payment modes, and official stamped receipts.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            fontWeight: 600,
            fontSize: '0.85rem',
            borderRadius: '8px',
            border: '1px solid #334155',
            cursor: 'pointer',
          }}
        >
          <Printer style={{ width: '16px', height: '16px' }} />
          Print Transaction Ledger
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media (max-width: 768px) {
                .transactions-filter-row {
                  flex-direction: column !important;
                  align-items: stretch !important;
                  gap: 0.5rem !important;
                }
                .transactions-filter-row > * {
                  width: 100% !important;
                  min-width: 0 !important;
                }
              }
            `,
          }}
        />

        <div className="transactions-filter-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadCollections();
            }}
            style={{ position: 'relative', flex: 1, minWidth: 'min(100%, 260px)' }}
          >
            <Search
              style={{
                width: '18px',
                height: '18px',
                color: '#64748b',
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by receipt number, reference, or payment notes..."
              style={{
                width: '100%',
                backgroundColor: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem 0.65rem 2.5rem',
                fontSize: '0.85rem',
                color: '#f8fafc',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </form>

          <div style={{ minWidth: '200px' }}>
            <ReceptionistSelect
              value={paymentMethodFilter}
              onChange={(val) => {
                setPaymentMethodFilter(val);
              }}
              options={[
                { value: 'ALL', label: 'All Payment Methods' },
                { value: 'CASH', label: 'Cash Only' },
                { value: 'UPI', label: 'UPI Digital' },
                { value: 'CARD', label: 'Debit / Credit Card' },
                { value: 'HOSPITAL_CREDIT', label: 'Hospital Credit' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
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
            Cashier Journal ({filteredCollections.length} Records)
          </h2>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Strictly immutable ledger entries</span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <Clock style={{ width: '28px', height: '28px', margin: '0 auto 0.75rem auto', color: '#f43f5e' }} />
            Loading transaction entries...
          </div>
        ) : paginatedCollections.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <Receipt style={{ width: '36px', height: '36px', margin: '0 auto 0.75rem auto', color: '#475569' }} />
            <p style={{ fontWeight: 600, color: '#e2e8f0', margin: 0 }}>No transactions recorded</p>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.35rem 0 0 0' }}>
              Collected counter payments will automatically post here with generated receipt numbers.
            </p>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', display: 'block' }}>
            <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid #1e293b',
                    backgroundColor: '#020617',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem' }}>Receipt #</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Payment Method</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reference / UTR</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cashier</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount Collected</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Receipt Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCollections.map((col) => {
                  let badgeBg = '#064e3b';
                  let badgeColor = '#6ee7b7';
                  let badgeBorder = '#059669';

                  if (col.paymentMethod === 'CASH') {
                    badgeBg = '#451a03';
                    badgeColor = '#fde68a';
                    badgeBorder = '#b45309';
                  } else if (col.paymentMethod === 'UPI') {
                    badgeBg = '#172554';
                    badgeColor = '#93c5fd';
                    badgeBorder = '#1d4ed8';
                  } else if (col.paymentMethod === 'CARD') {
                    badgeBg = '#3b0764';
                    badgeColor = '#d8b4fe';
                    badgeBorder = '#7e22ce';
                  }

                  return (
                    <tr
                      key={col._id || col.id}
                      style={{
                        borderBottom: '1px solid #1e293b',
                        backgroundColor: '#0f172a',
                      }}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#f43f5e' }}>
                        {col.receiptNumber || col._id?.slice(-8)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Calendar style={{ width: '14px', height: '14px', color: '#64748b' }} />
                          {new Date(col.createdAt || Date.now()).toLocaleDateString()} at{' '}
                          {new Date(col.createdAt || Date.now()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: badgeBg,
                            color: badgeColor,
                            border: `1px solid ${badgeBorder}`,
                          }}
                        >
                          <CreditCard style={{ width: '12px', height: '12px' }} />
                          {col.paymentMethod?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8' }}>
                        {col.referenceNumber || 'N/A'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc', display: 'block' }}>
                          {col.collectedByName || 'Finance Receptionist'}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                          {col.collectedByRole ? col.collectedByRole.replace(/_/g, ' ') : 'RECEPTIONIST'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#6ee7b7', fontSize: '0.9rem' }}>
                        ₹{(col.amount || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(col)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            backgroundColor: '#1e293b',
                            color: '#e2e8f0',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            border: '1px solid #334155',
                            cursor: 'pointer',
                          }}
                        >
                          <Eye style={{ width: '14px', height: '14px' }} />
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderTop: '1px solid #1e293b',
              backgroundColor: '#020617',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.75rem',
              color: '#94a3b8',
            }}
          >
            <span>
              Showing {(page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, filteredCollections.length)} of{' '}
              {filteredCollections.length} entries
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: '0.35rem 0.5rem',
                  borderRadius: '6px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  color: '#f8fafc',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.5 : 1,
                }}
              >
                <ChevronLeft style={{ width: '14px', height: '14px' }} />
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '0.35rem 0.5rem',
                  borderRadius: '6px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  color: '#f8fafc',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.5 : 1,
                }}
              >
                <ChevronRight style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt View Modal */}
      {selectedReceipt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backgroundColor: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt style={{ width: '20px', height: '20px', color: '#6ee7b7' }} />
                <h3 style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.1rem', margin: 0 }}>
                  Payment Receipt Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Printable Receipt Paper */}
            <div
              style={{
                padding: '1.25rem',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.75rem',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ textAlign: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #cbd5e1' }}>
                <h4
                  style={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#be123c',
                    margin: 0,
                  }}
                >
                  Blood Bank Management System
                </h4>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0.2rem 0 0 0' }}>Official Payment & Collection Receipt</p>
                <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '0.15rem 0 0 0', fontFamily: 'monospace' }}>
                  Receipt #{selectedReceipt.receiptNumber || selectedReceipt._id?.slice(-8)}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Date & Time:</span>
                  <span style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                    {new Date(selectedReceipt.createdAt || Date.now()).toLocaleString()}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#64748b', display: 'block' }}>Payment Mode:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedReceipt.paymentMethod}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Reference / UTR:</span>
                  <span style={{ fontFamily: 'monospace', color: '#334155', fontSize: '0.7rem' }}>
                    {selectedReceipt.referenceNumber || 'N/A'}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#64748b', display: 'block' }}>Desk / Cashier:</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedReceipt.collectedByName || 'Finance Reception Desk'}</span>
                  {selectedReceipt.collectedByRole && (
                    <span style={{ display: 'block', color: '#64748b', fontSize: '0.65rem' }}>
                      ({selectedReceipt.collectedByRole.replace(/_/g, ' ')})
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #cbd5e1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  backgroundColor: '#f8fafc',
                  padding: '0.65rem',
                  borderRadius: '6px',
                }}
              >
                <span>Amount Paid:</span>
                <span style={{ fontFamily: 'monospace', color: '#047857', fontSize: '1rem' }}>
                  ₹{(selectedReceipt.amount || 0).toLocaleString()}
                </span>
              </div>

              {selectedReceipt.notes && (
                <div style={{ padding: '0.5rem', backgroundColor: '#f1f5f9', borderRadius: '6px', fontSize: '0.7rem', color: '#475569' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>Remarks: </span>
                  {selectedReceipt.notes}
                </div>
              )}

              <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#64748b', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                <p style={{ fontWeight: 600, color: '#334155', margin: 0 }}>Thank you for your payment.</p>
                <p style={{ margin: '0.2rem 0 0 0' }}>Computer-generated transaction record.</p>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                style={{
                  padding: '0.55rem 1rem',
                  backgroundColor: '#1e293b',
                  color: '#cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
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
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
