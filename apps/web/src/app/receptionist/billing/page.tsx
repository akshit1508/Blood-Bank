'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  Printer,
  X,
  FileText,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Building,
} from 'lucide-react';
import {
  fetchInvoices,
  recordCollectionPayment,
} from '@/lib/receptionist-api';

export default function ReceptionistBillingPage() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams?.get('search') || '';

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Payment Collection Modal State
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'HOSPITAL_CREDIT'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Generated Receipt Modal State
  const [receiptData, setReceiptData] = useState<any | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchInvoices({
        status: statusFilter,
        search: searchQuery,
      });
      setInvoices(data);
      if (data.length > 0 && !selectedInvoice) {
        setSelectedInvoice(data[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  const handleOpenCollect = (inv: any) => {
    setSelectedInvoice(inv);
    const balance = (inv.totalAmount || 0) - (inv.collectedAmount || 0);
    setCollectAmount(balance > 0 ? balance : inv.totalAmount || 0);
    setReferenceNumber(
      paymentMethod === 'CASH'
        ? `CASH-${Date.now().toString().slice(-6)}`
        : `TXN-${Date.now().toString().slice(-8)}`,
    );
    setIsCollectModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setSubmittingPayment(true);
    setErrorMsg(null);

    try {
      const invId = selectedInvoice._id || selectedInvoice.id;
      const idempotencyKey = `PAY-${invId}-${Date.now()}`;
      const collectionResult = await recordCollectionPayment(invId, {
        amount: Number(collectAmount),
        paymentMethod,
        referenceNumber: referenceNumber || `REF-${Date.now()}`,
        idempotencyKey,
        notes: paymentNotes || 'Counter payment collected by Finance Receptionist',
      });

      setSuccessMsg(`Payment of ₹${collectAmount.toLocaleString()} recorded successfully!`);
      setIsCollectModalOpen(false);
      setReceiptData({
        collection: collectionResult,
        invoice: selectedInvoice,
      });

      // Reload invoices
      await loadInvoices();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record payment collection.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Paid in Full
          </span>
        );
      case 'PARTIALLY_COLLECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800">
            <Clock className="w-3 h-3" />
            Partially Collected
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
            <AlertTriangle className="w-3 h-3" />
            Unpaid / Pending
          </span>
        );
      case 'WAIVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-950 text-purple-300 border border-purple-800">
            Waived by Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-rose-500" />
            Billing & Payment Desk
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review blood issue invoices, collect customer counter payments, and generate official stamped receipts.
          </p>
        </div>
      </div>

      {/* Alert Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg flex items-center gap-3 text-rose-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-lg flex items-center gap-3 text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List: Invoices */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadInvoices();
              }}
              className="relative"
            >
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice number, patient, case #..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </form>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              {['ALL', 'PENDING', 'PARTIALLY_COLLECTED', 'PAID'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                    statusFilter === st
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {st === 'PARTIALLY_COLLECTED' ? 'PARTIAL' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices List */}
          {loading ? (
            <div className="p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
              <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
              Loading invoices...
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-sm">
              No matching invoices found.
            </div>
          ) : (
            <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
              {invoices.map((inv) => {
                const isSelected = (selectedInvoice?._id || selectedInvoice?.id) === (inv._id || inv.id);
                const balance = (inv.totalAmount || 0) - (inv.collectedAmount || 0);

                return (
                  <div
                    key={inv._id || inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-950/20 border-rose-600/60 ring-1 ring-rose-500/40 shadow-sm'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-rose-400">
                            {inv.invoiceNumber}
                          </span>
                          {getStatusBadge(inv.status)}
                        </div>
                        <h4 className="font-semibold text-white text-sm mt-1.5">
                          {inv.patientSnapshot?.name || inv.patientName || 'Walk-in Patient'}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Case #{inv.patientSnapshot?.hospitalCaseNumber || 'N/A'} • {inv.hospitalSnapshot?.name || inv.hospitalName || 'Hospital'}
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-slate-500 transition-transform ${
                          isSelected ? 'translate-x-1 text-rose-400' : ''
                        }`}
                      />
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400">Total: </span>
                        <span className="font-bold text-white">₹{(inv.totalAmount || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Due: </span>
                        <span className={`font-bold ${balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          ₹{balance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Detail Pane */}
        <div className="lg:col-span-7">
          {selectedInvoice ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              {/* Invoice Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-800 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg text-white">
                      {selectedInvoice.invoiceNumber}
                    </span>
                    {getStatusBadge(selectedInvoice.status)}
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">
                    {selectedInvoice.patientSnapshot?.name || selectedInvoice.patientName}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Hospital: {selectedInvoice.hospitalSnapshot?.name || selectedInvoice.hospitalName} • Date: {new Date(selectedInvoice.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">Net Payable Amount</div>
                  <div className="text-2xl font-bold text-emerald-400 font-mono">
                    ₹{(selectedInvoice.totalAmount || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Patient Meta Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <span className="text-slate-400 block mb-0.5">Patient Details</span>
                  <p className="font-semibold text-white">
                    {selectedInvoice.patientSnapshot?.name || 'N/A'} ({selectedInvoice.patientSnapshot?.age || '-'} yrs)
                  </p>
                  <p className="text-slate-400">Blood Group: {selectedInvoice.patientSnapshot?.bloodGroup || 'N/A'}</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <span className="text-slate-400 block mb-0.5">Hospital & Case</span>
                  <p className="font-semibold text-white">
                    {selectedInvoice.hospitalSnapshot?.name || 'N/A'}
                  </p>
                  <p className="text-slate-400">Case #{selectedInvoice.patientSnapshot?.hospitalCaseNumber || 'N/A'}</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <span className="text-slate-400 block mb-0.5">Payment Ledger</span>
                  <p className="font-semibold text-emerald-400">
                    Paid: ₹{(selectedInvoice.collectedAmount || 0).toLocaleString()}
                  </p>
                  <p className="text-amber-400 font-medium">
                    Balance: ₹{((selectedInvoice.totalAmount || 0) - (selectedInvoice.collectedAmount || 0)).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Line Items Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-rose-500" />
                  Itemized Tariff Charges
                </h3>

                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                        <th className="px-4 py-2.5">Item Description</th>
                        <th className="px-4 py-2.5 text-center">Qty</th>
                        <th className="px-4 py-2.5 text-right">Unit Rate</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(selectedInvoice.items || []).map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-950/40">
                          <td className="px-4 py-2.5 text-white font-medium">
                            {item.description || item.componentType?.replace(/_/g, ' ') || 'Blood Service Charge'}
                          </td>
                          <td className="px-4 py-2.5 text-center text-slate-300 font-mono">
                            {item.quantity || 1}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-300 font-mono">
                            ₹{(item.unitPrice || item.rate || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right text-white font-mono font-semibold">
                            ₹{(item.totalAmount || item.amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-950 border-t border-slate-800 text-xs">
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-right text-slate-400 font-medium">
                          Total Invoice Value:
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-white">
                          ₹{(selectedInvoice.totalAmount || 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <div className="text-xs text-slate-400">
                  {selectedInvoice.status === 'PAID' ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Invoice is fully settled.
                    </span>
                  ) : (
                    <span>
                      Outstanding balance:{' '}
                      <strong className="text-amber-400">
                        ₹{((selectedInvoice.totalAmount || 0) - (selectedInvoice.collectedAmount || 0)).toLocaleString()}
                      </strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {selectedInvoice.status !== 'PAID' && (
                    <button
                      onClick={() => handleOpenCollect(selectedInvoice)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
                    >
                      <DollarSign className="w-4 h-4" />
                      Receive & Record Payment
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
              <Receipt className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <h3 className="text-base font-medium text-slate-300">Select an invoice</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Pick an invoice from the queue to inspect charges, review patient insurance/case codes, and record counter payment collections.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collect Payment Modal */}
      {isCollectModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Collect Payment</h3>
              </div>
              <button
                onClick={() => setIsCollectModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex justify-between items-center">
                <div>
                  <span className="text-slate-400">Invoice: </span>
                  <span className="font-mono font-bold text-white">{selectedInvoice.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400">Total Due: </span>
                  <span className="font-mono font-bold text-amber-400">
                    ₹{((selectedInvoice.totalAmount || 0) - (selectedInvoice.collectedAmount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Amount to Collect (₹)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={(selectedInvoice.totalAmount || 0) - (selectedInvoice.collectedAmount || 0)}
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['CASH', 'UPI', 'CARD', 'HOSPITAL_CREDIT'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m);
                        setReferenceNumber(
                          m === 'CASH'
                            ? `CASH-${Date.now().toString().slice(-6)}`
                            : `${m}-${Date.now().toString().slice(-8)}`,
                        );
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                        paymentMethod === m
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500 ring-1 ring-emerald-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {m.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Transaction / UTR / Reference Number
                </label>
                <input
                  type="text"
                  required
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. UTR12389472 / CARD-AUTH-8821"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Collection Notes
                </label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Counter remarks or cashier shift note..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCollectModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {submittingPayment ? 'Recording Collection...' : 'Confirm Payment & Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Payment Receipt Generated</h3>
              </div>
              <button
                onClick={() => setReceiptData(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Paper Card */}
            <div id="receptionist-receipt-print" className="p-5 bg-white text-slate-900 rounded-xl space-y-4 font-sans text-xs shadow-inner">
              <div className="text-center pb-3 border-b border-slate-300">
                <h4 className="font-bold text-base uppercase tracking-wider text-rose-700">
                  Blood Bank Management System
                </h4>
                <p className="text-[11px] text-slate-600">Official Payment & Collection Receipt</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Receipt #{receiptData.collection?.receiptNumber || receiptData.collection?._id?.slice(-8) || 'RCP-001'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Patient Name:</span>
                  <strong className="text-slate-900">{receiptData.invoice?.patientSnapshot?.name || 'Walk-in'}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Date & Time:</span>
                  <span className="text-slate-900 font-mono">
                    {new Date().toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Invoice Number:</span>
                  <span className="font-mono text-slate-900 font-semibold">{receiptData.invoice?.invoiceNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Payment Mode:</span>
                  <span className="font-semibold text-slate-900">{receiptData.collection?.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Reference / UTR:</span>
                  <span className="font-mono text-slate-800 text-[10px]">{receiptData.collection?.referenceNumber || 'N/A'}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Cashier Desk:</span>
                  <span className="text-slate-800">Finance Receptionist</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-300 flex items-center justify-between font-bold text-sm bg-slate-50 p-2.5 rounded">
                <span>Total Amount Paid:</span>
                <span className="font-mono text-emerald-700 text-base">
                  ₹{(receiptData.collection?.amount || collectAmount).toLocaleString()}
                </span>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
                <p className="font-medium text-slate-700">Thank you for your payment.</p>
                <p>This is a computer-generated transaction receipt. No physical signature required.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setReceiptData(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Official Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
