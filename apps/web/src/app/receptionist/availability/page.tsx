'use client';

import React, { useState, useEffect } from 'react';
import {
  Droplet,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Boxes,
  Layers,
  Calendar,
  Thermometer,
} from 'lucide-react';
import {
  fetchBloodAvailabilitySummary,
  fetchAvailableInventory,
} from '@/lib/receptionist-api';

const BLOOD_GROUPS = ['ALL', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const COMPONENTS = [
  'ALL',
  'WHOLE_BLOOD',
  'RED_BLOOD_CELLS',
  'FRESH_FROZEN_PLASMA',
  'PLATELETS',
  'CRYOPRECIPITATE',
];
const STATUSES = ['AVAILABLE', 'RESERVED', 'ALL'];

export default function ReceptionistAvailabilityPage() {
  const [summary, setSummary] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [selectedComponent, setSelectedComponent] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('AVAILABLE');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [summaryRes, inventoryRes] = await Promise.all([
        fetchBloodAvailabilitySummary(),
        fetchAvailableInventory({
          bloodGroup: selectedGroup,
          componentType: selectedComponent,
          status: selectedStatus,
          limit: 100,
        }),
      ]);
      setSummary(summaryRes);
      setItems(inventoryRes);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inventory availability.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedGroup, selectedComponent, selectedStatus]);

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.unitNumber?.toLowerCase().includes(q) ||
      item.bloodGroup?.toLowerCase().includes(q) ||
      item.componentType?.toLowerCase().includes(q) ||
      item.storageLocation?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
            <CheckCircle className="w-3 h-3" />
            Available
          </span>
        );
      case 'RESERVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-950 text-blue-300 border border-blue-800">
            <Clock className="w-3 h-3" />
            Reserved
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-950 text-rose-300 border border-rose-800">
            <AlertTriangle className="w-3 h-3" />
            Expired
          </span>
        );
      case 'QUARANTINED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800">
            <ShieldAlert className="w-3 h-3" />
            Quarantined
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Boxes className="w-7 h-7 text-rose-500" />
            Real-Time Blood Availability Board
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Live inventory counts verified against existing quarantine, test approvals, and current reservations.
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm rounded-lg border border-slate-700 shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-rose-400' : ''}`} />
          {refreshing ? 'Syncing Stock...' : 'Refresh Stock'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg flex items-center gap-3 text-rose-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Blood Group Matrix Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => {
          const groupCount = summary?.byBloodGroup?.[group] || 0;
          const isSelected = selectedGroup === group;
          return (
            <button
              key={group}
              onClick={() => setSelectedGroup(isSelected ? 'ALL' : group)}
              className={`p-3.5 rounded-xl border text-center transition-all ${
                isSelected
                  ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                <Droplet className={`w-3.5 h-3.5 ${isSelected ? 'text-rose-400' : 'text-slate-500'}`} />
                <span className="font-bold text-white text-base">{group}</span>
              </div>
              <div className="text-lg font-bold text-white font-mono">
                {groupCount} <span className="text-[10px] text-slate-400 font-sans">units</span>
              </div>
              <span
                className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  groupCount > 5
                    ? 'bg-emerald-950/80 text-emerald-300'
                    : groupCount > 0
                    ? 'bg-amber-950/80 text-amber-300'
                    : 'bg-rose-950/80 text-rose-400'
                }`}
              >
                {groupCount > 5 ? 'Adequate' : groupCount > 0 ? 'Low Stock' : 'Critical Depleted'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by unit number, storage rack, or component..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Blood Group Select */}
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500"
            >
              <option value="ALL">All Blood Groups</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <option key={bg} value={bg}>
                  Group {bg}
                </option>
              ))}
            </select>

            {/* Component Type Select */}
            <select
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value)}
              className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500"
            >
              <option value="ALL">All Components</option>
              {COMPONENTS.filter((c) => c !== 'ALL').map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            {/* Status Select */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500"
            >
              <option value="AVAILABLE">Available Only</option>
              <option value="RESERVED">Reserved Units</option>
              <option value="ALL">All Statuses</option>
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedGroup !== 'ALL' || selectedComponent !== 'ALL' || selectedStatus !== 'AVAILABLE') && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-xs text-slate-400">
            <span>Active Filters:</span>
            {selectedGroup !== 'ALL' && (
              <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                Group: {selectedGroup}
              </span>
            )}
            {selectedComponent !== 'ALL' && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Component: {selectedComponent.replace(/_/g, ' ')}
              </span>
            )}
            {selectedStatus !== 'AVAILABLE' && (
              <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                Status: {selectedStatus}
              </span>
            )}
            <button
              onClick={() => {
                setSelectedGroup('ALL');
                setSelectedComponent('ALL');
                setSelectedStatus('AVAILABLE');
              }}
              className="text-rose-400 hover:text-rose-300 underline ml-2"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Inventory Units Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-rose-500" />
            <h2 className="font-semibold text-white text-sm">
              Live Stock Units ({filteredItems.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400">Strictly tested & released units only</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-rose-500" />
            Querying real-time blood bank inventory...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Droplet className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="font-medium text-slate-300">No eligible blood units found</p>
            <p className="text-xs text-slate-500 mt-1">
              Either no stock matches the selected criteria or all units are reserved/unavailable.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Unit Identifier</th>
                  <th className="px-5 py-3.5">Blood Group</th>
                  <th className="px-5 py-3.5">Component</th>
                  <th className="px-5 py-3.5">Volume</th>
                  <th className="px-5 py-3.5">Storage Rack</th>
                  <th className="px-5 py-3.5">Expiry Date</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredItems.map((item) => {
                  const isExpiringSoon =
                    item.expiryDate &&
                    new Date(item.expiryDate).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

                  return (
                    <tr key={item._id || item.id} className="hover:bg-slate-850 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-white">
                        {item.unitNumber || item.barcode || item._id?.slice(-8)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800">
                          {item.bloodGroup}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {item.componentType?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-300">
                        {item.volumeMl ? `${item.volumeMl} mL` : '1 Unit'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">
                        <span className="flex items-center gap-1">
                          <Thermometer className="w-3.5 h-3.5 text-slate-500" />
                          {item.storageLocation || 'Main Cold Storage'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        <span
                          className={`flex items-center gap-1 ${
                            isExpiringSoon ? 'text-amber-400 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          {item.expiryDate
                            ? new Date(item.expiryDate).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">{getStatusBadge(item.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
