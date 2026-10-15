'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  CreditCard,
  Building,
  User,
  ArrowDownRight,
} from 'lucide-react';
import { fetchCollections, fetchInvoices } from '@/lib/receptionist-api';

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
    } catch (err) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-rose-500" />
            Receipts & Transaction Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Complete cashier journal of payments received, payment modes, and official stamped receipts.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print Transaction Ledger
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadCollections();
            }}
            className="relative flex-1"
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by receipt number, reference, or payment notes..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </form>

          <div className="flex items-center gap-2">
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="CASH">Cash Only</option>
              <option value="UPI">UPI Digital</option>
              <option value="CARD">Debit / Credit Card</option>
              <option value="HOSPITAL_CREDIT">Hospital Credit</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">
            Cashier Journal ({filteredCollections.length} Records)
          </h2>
          <span className="text-xs text-slate-400">Strictly immutable ledger entries</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-rose-500" />
            Loading transaction entries...
          </div>
        ) : paginatedCollections.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="font-medium text-slate-300">No transactions recorded</p>
            <p className="text-xs text-slate-500 mt-1">
              Collected counter payments will automatically post here with generated receipt numbers.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Receipt #</th>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">Payment Method</th>
                  <th className="px-5 py-3.5">Reference / UTR</th>
                  <th className="px-5 py-3.5 text-right">Amount Collected</th>
                  <th className="px-5 py-3.5 text-center">Receipt Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedCollections.map((col) => (
                  <tr key={col._id || col.id} className="hover:bg-slate-850 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-rose-400">
                      {col.receiptNumber || col._id?.slice(-8)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(col.createdAt || Date.now()).toLocaleDateString()} at{' '}
                        {new Date(col.createdAt || Date.now()).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          col.paymentMethod === 'CASH'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : col.paymentMethod === 'UPI'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : col.paymentMethod === 'CARD'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        <CreditCard className="w-3 h-3" />
                        {col.paymentMethod?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                      {col.referenceNumber || 'N/A'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-400 text-sm">
                      ₹{(col.amount || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => setSelectedReceipt(col)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {(page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, filteredCollections.length)} of{' '}
              {filteredCollections.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt View Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Payment Receipt Details</h3>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Receipt Paper */}
            <div className="p-5 bg-white text-slate-900 rounded-xl space-y-4 font-sans text-xs shadow-inner">
              <div className="text-center pb-3 border-b border-slate-300">
                <h4 className="font-bold text-base uppercase tracking-wider text-rose-700">
                  Blood Bank Management System
                </h4>
                <p className="text-[11px] text-slate-600">Official Payment & Collection Receipt</p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  Receipt #{selectedReceipt.receiptNumber || selectedReceipt._id?.slice(-8)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Date & Time:</span>
                  <span className="text-slate-900 font-mono">
                    {new Date(selectedReceipt.createdAt || Date.now()).toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Payment Mode:</span>
                  <span className="font-semibold text-slate-900">{selectedReceipt.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Reference / UTR:</span>
                  <span className="font-mono text-slate-800 text-[10px]">
                    {selectedReceipt.referenceNumber || 'N/A'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Desk:</span>
                  <span className="text-slate-800">Finance Reception Desk</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-300 flex items-center justify-between font-bold text-sm bg-slate-50 p-2.5 rounded">
                <span>Amount Paid:</span>
                <span className="font-mono text-emerald-700 text-base">
                  ₹{(selectedReceipt.amount || 0).toLocaleString()}
                </span>
              </div>

              {selectedReceipt.notes && (
                <div className="p-2 bg-slate-100 rounded text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-700">Remarks: </span>
                  {selectedReceipt.notes}
                </div>
              )}

              <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
                <p className="font-medium text-slate-700">Thank you for your payment.</p>
                <p>Computer-generated transaction record.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
