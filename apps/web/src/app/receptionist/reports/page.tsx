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
  ArrowUpRight,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-rose-500" />
            Daily Cashier Register & Shift Report
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Cashier shift reconciliation, cash count breakdown, and digital collection audit.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Shift Report
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg flex items-center gap-3 text-rose-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-rose-500" />
          Generating shift reconciliation report for {selectedDate}...
        </div>
      ) : report ? (
        <div className="space-y-6" id="shift-report-content">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Total Collected</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                ₹{(report.totalCollected || report.summary?.totalCollected || 0).toLocaleString()}
              </div>
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Shift Total Reconciled
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Cash on Hand</span>
                <Receipt className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono">
                ₹{(report.totalCash || report.summary?.totalCash || 0).toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-1">Physical drawer currency</p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Digital Payments</span>
                <CreditCard className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400 font-mono">
                ₹{(report.totalDigital || report.summary?.totalDigital || 0).toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-1">UPI, POS Card & Online</p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Total Receipts Issued</span>
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-400 font-mono">
                {report.transactionCount || report.collections?.length || 0}
              </div>
              <p className="text-xs text-slate-400 mt-1">Verified transactions</p>
            </div>
          </div>

          {/* Detailed Collections Shift Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold text-white text-sm">
                Shift Transactions for {new Date(selectedDate).toLocaleDateString()}
              </h2>
              <span className="text-xs text-slate-400">Reception Counter Drawer</span>
            </div>

            {(!report.collections || report.collections.length === 0) ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No collections logged for the selected date.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="px-5 py-3">Receipt #</th>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3">Payment Mode</th>
                      <th className="px-5 py-3">Reference</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {report.collections.map((c: any) => (
                      <tr key={c._id || c.id} className="hover:bg-slate-850">
                        <td className="px-5 py-3 font-mono font-semibold text-rose-400">
                          {c.receiptNumber || c._id?.slice(-8)}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {new Date(c.createdAt || Date.now()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-semibold text-slate-300">
                            {c.paymentMethod}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-400">
                          {c.referenceNumber || 'N/A'}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-emerald-400">
                          ₹{(c.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-950 border-t border-slate-800 font-bold">
                    <tr>
                      <td colSpan={4} className="px-5 py-3 text-right text-slate-400">
                        Shift Total:
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-emerald-400 text-sm">
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
