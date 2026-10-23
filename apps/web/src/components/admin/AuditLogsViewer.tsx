'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchAuditLogs,
  AuditLogEntry,
  AuditActionType,
  AuditEntityType,
  QueryAuditLogParams,
} from '@/lib/audit-logs-api';
import StaffAttributionBadge from './StaffAttributionBadge';

export default function AuditLogsViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Selected Log for Inspection Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: QueryAuditLogParams = {
        limit,
        skip: (page - 1) * limit,
      };

      if (search.trim()) params.search = search.trim();
      if (actionFilter !== 'all') params.action = actionFilter;
      if (entityFilter !== 'all') params.entityType = entityFilter;
      if (roleFilter !== 'all') params.actorRole = roleFilter;

      const data = await fetchAuditLogs(params);
      setLogs(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve audit events.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, actionFilter, entityFilter, roleFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLogs();
  };

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('all');
    setEntityFilter('all');
    setRoleFilter('all');
    setPage(1);
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  const getActionBadgeStyle = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('APPROVED') || act.includes('COMPLETED')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('REJECTED') || act.includes('CANCELLED') || act.includes('DISCARDED') || act.includes('REVERSED')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (act.includes('SUBMITTED') || act.includes('REVISED') || act.includes('WAIVER')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (act.includes('COLLECTED') || act.includes('DISBURSED') || act.includes('RECORDED')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      <style>{`
        .bg-white { background-color: #ffffff; }
        .border-gray-200 { border-color: #e2e8f0; }
        .border-gray-300 { border-color: #cbd5e1; }
        .rounded-xl { border-radius: 0.75rem; }
        .rounded-lg { border-radius: 0.5rem; }
        .rounded-full { border-radius: 9999px; }
        .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
        .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
        .border { border-width: 1px; border-style: solid; }
        .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
        .border-t { border-top-width: 1px; border-top-style: solid; }
        .p-6 { padding: 1.5rem; }
        .p-5 { padding: 1.25rem; }
        .p-4 { padding: 1rem; }
        .p-3 { padding: 0.75rem; }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
        .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
        .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
        .flex { display: flex; }
        .inline-flex { display: inline-flex; }
        .items-center { align-items: center; }
        .justify-between { justify-content: space-between; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }
        .space-y-4 > * + * { margin-top: 1rem; }
        .space-y-6 > * + * { margin-top: 1.5rem; }
        .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
        .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
        .text-xs { font-size: 0.75rem; line-height: 1rem; }
        .font-bold { font-weight: 700; }
        .font-semibold { font-weight: 600; }
        .font-medium { font-weight: 500; }
        .text-gray-900 { color: #0f172a; }
        .text-gray-800 { color: #1e293b; }
        .text-gray-700 { color: #334155; }
        .text-gray-600 { color: #475569; }
        .text-gray-500 { color: #64748b; }
        .text-gray-400 { color: #94a3b8; }
        .w-full { width: 100%; }
        .overflow-hidden { overflow: hidden; }
        .overflow-x-auto { overflow-x: auto; }
        .bg-gray-50 { background-color: #f8fafc; }
        .bg-gray-100 { background-color: #f1f5f9; }
        .bg-emerald-50 { background-color: #ecfdf5; }
        .text-emerald-700 { color: #047857; }
        .border-emerald-200 { border-color: #a7f3d0; }
        .bg-rose-50 { background-color: #fff1f2; }
        .text-rose-700 { color: #be123c; }
        .border-rose-200 { border-color: #fecdd3; }
        .bg-amber-50 { background-color: #fffbeb; }
        .text-amber-700 { color: #b45309; }
        .border-amber-200 { border-color: #fde68a; }
        .bg-blue-50 { background-color: #eff6ff; }
        .text-blue-700 { color: #1d4ed8; }
        .border-blue-200 { border-color: #bfdbfe; }
        .bg-slate-50 { background-color: #f8fafc; }
        .text-slate-700 { color: #334155; }
        .border-slate-200 { border-color: #e2e8f0; }
        .fixed { position: fixed; }
        .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
        .z-50 { z-index: 50; }
        .bg-slate-900\\/50 { background-color: rgba(15, 23, 42, 0.6); }
      `}</style>
      {/* Header Banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-red-50 text-red-600 border border-red-100">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <h1 className="text-xl font-bold text-gray-900">Central Audit Trail & Staff Attribution</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Immutable, append-only historical log of all operational, laboratory, inventory, and financial staff actions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadLogs()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh Logs
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Search Keywords</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff, code, description, entity..."
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 pl-8"
              />
              <svg
                className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Actions</option>
              {Object.values(AuditActionType).map((act) => (
                <option key={act} value={act}>
                  {act.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Entity Type</label>
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Entities</option>
              {Object.values(AuditEntityType).map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
          </div>

          {/* Staff Role Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Staff Role</label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Staff Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin / Operational</option>
              <option value="LAB_TECHNICIAN">Lab Technician</option>
              <option value="FINANCE_RECEPTIONIST">Finance Receptionist</option>
            </select>
          </div>
        </form>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
          <div className="text-gray-500">
            Showing <span className="font-semibold text-gray-800">{logs.length}</span> of{' '}
            <span className="font-semibold text-gray-800">{total}</span> total recorded audit events
          </div>
          {(search || actionFilter !== 'all' || entityFilter !== 'all' || roleFilter !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="text-red-600 hover:text-red-700 font-medium transition"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium">Loading immutable audit trail records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <p className="text-sm font-semibold text-gray-700">No audit events found</p>
            <p className="text-xs text-gray-500 mt-1">
              Try adjusting your search criteria or filter options above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3 px-4">Event ID / Time</th>
                  <th className="py-3 px-4">Authenticated Staff Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50/80 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-[11px] text-gray-500 font-semibold">{log.eventId}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{formatTimestamp(log.timestamp)}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StaffAttributionBadge
                        name={log.actorName}
                        role={log.actorRole}
                        timestamp={null}
                      />
                      <div className="text-[10px] text-gray-400 mt-0.5">{log.actorEmail}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getActionBadgeStyle(
                          log.action,
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-800">{log.entityType}</div>
                      <div className="font-mono text-[11px] text-gray-500">
                        {log.entityIdentifier || log.entityId.slice(-8)}
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-gray-700 line-clamp-2 leading-relaxed">{log.description}</p>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 text-[11px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition border border-gray-200"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {!loading && logs.length > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>entries per page</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <span className="font-medium text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-gray-500">{selectedLog.eventId}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getActionBadgeStyle(
                      selectedLog.action,
                    )}`}
                  >
                    {selectedLog.action}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mt-1">Audit Event Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600 transition p-1"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-gray-700">
              {/* Event Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <div className="text-[11px] text-gray-500 uppercase font-semibold">Timestamp</div>
                  <div className="font-medium text-gray-900 mt-0.5">{formatTimestamp(selectedLog.timestamp)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 uppercase font-semibold">Target Entity</div>
                  <div className="font-medium text-gray-900 mt-0.5">
                    {selectedLog.entityType} ({selectedLog.entityIdentifier || selectedLog.entityId.slice(-8)})
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 uppercase font-semibold">Staff Identity</div>
                  <div className="font-medium text-gray-900 mt-0.5">{selectedLog.actorName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 uppercase font-semibold">Role Profile</div>
                  <div className="font-medium text-gray-900 mt-0.5">{selectedLog.actorRole}</div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                  Action Narrative
                </label>
                <p className="p-3 bg-white border border-gray-200 rounded-lg text-gray-800 leading-relaxed font-sans">
                  {selectedLog.description}
                </p>
              </div>

              {/* State Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                    Previous State (Before)
                  </label>
                  <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto max-h-56">
                    {selectedLog.beforeState
                      ? JSON.stringify(selectedLog.beforeState, null, 2)
                      : '// No preceding state recorded'}
                  </pre>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                    Committed State (After)
                  </label>
                  <pre className="p-3 bg-slate-900 text-blue-400 font-mono text-[11px] rounded-lg overflow-x-auto max-h-56">
                    {selectedLog.afterState
                      ? JSON.stringify(selectedLog.afterState, null, 2)
                      : '// No subsequent state changes recorded'}
                  </pre>
                </div>
              </div>

              {/* Optional Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                    Context Metadata
                  </label>
                  <pre className="p-3 bg-gray-50 border border-gray-200 font-mono text-[11px] rounded-lg overflow-x-auto text-gray-800">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
