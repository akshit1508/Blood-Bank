'use client';

import React, { useState, useEffect } from 'react';
import {
  Droplet,
  RefreshCw,
  Search,
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
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: '#064e3b',
              color: '#6ee7b7',
              border: '1px solid #059669',
            }}
          >
            <CheckCircle style={{ width: '12px', height: '12px' }} />
            Available
          </span>
        );
      case 'RESERVED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: '#172554',
              color: '#93c5fd',
              border: '1px solid #1d4ed8',
            }}
          >
            <Clock style={{ width: '12px', height: '12px' }} />
            Reserved
          </span>
        );
      case 'EXPIRED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: '#450a0a',
              color: '#fca5a5',
              border: '1px solid #dc2626',
            }}
          >
            <AlertTriangle style={{ width: '12px', height: '12px' }} />
            Expired
          </span>
        );
      case 'QUARANTINED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: '#451a03',
              color: '#fde68a',
              border: '1px solid #b45309',
            }}
          >
            <ShieldAlert style={{ width: '12px', height: '12px' }} />
            Quarantined
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 600,
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
            }}
          >
            {status}
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem', color: '#f8fafc' }}>
      {/* Page Header */}
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
            <Boxes style={{ width: '28px', height: '28px', color: '#f43f5e' }} />
            Real-Time Blood Availability Board
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
            Live inventory counts verified against existing quarantine, test approvals, and current reservations.
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
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
            cursor: refreshing ? 'not-allowed' : 'pointer',
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          <RefreshCw
            style={{
              width: '16px',
              height: '16px',
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
              color: refreshing ? '#f43f5e' : '#cbd5e1',
            }}
          />
          {refreshing ? 'Syncing Stock...' : 'Refresh Stock'}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#450a0a',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
          }}
        >
          <AlertTriangle style={{ width: '20px', height: '20px', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Blood Group Matrix Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => {
          const groupCount = summary?.byBloodGroup?.[group] || 0;
          const isSelected = selectedGroup === group;

          let badgeBg = '#450a0a';
          let badgeColor = '#fda4af';
          let badgeText = 'Critical Depleted';

          if (groupCount > 5) {
            badgeBg = '#064e3b';
            badgeColor = '#6ee7b7';
            badgeText = 'Adequate';
          } else if (groupCount > 0) {
            badgeBg = '#451a03';
            badgeColor = '#fde68a';
            badgeText = 'Low Stock';
          }

          return (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(isSelected ? 'ALL' : group)}
              style={{
                padding: '0.85rem 0.5rem',
                borderRadius: '10px',
                textAlign: 'center',
                backgroundColor: isSelected ? 'rgba(244, 63, 94, 0.15)' : '#0f172a',
                border: isSelected ? '1px solid #f43f5e' : '1px solid #1e293b',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 0 0 1px rgba(244, 63, 94, 0.4)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                  color: '#94a3b8',
                  marginBottom: '0.25rem',
                }}
              >
                <Droplet
                  style={{
                    width: '14px',
                    height: '14px',
                    color: isSelected ? '#f43f5e' : '#64748b',
                  }}
                />
                <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '1rem' }}>{group}</span>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>
                {groupCount} <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'sans-serif' }}>units</span>
              </div>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '0.35rem',
                  fontSize: '0.65rem',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                  backgroundColor: badgeBg,
                  color: badgeColor,
                }}
              >
                {badgeText}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
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
              placeholder="Search by unit number, storage rack, or component..."
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
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            {/* Blood Group Select */}
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              style={{
                padding: '0.65rem 0.85rem',
                backgroundColor: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: '#f8fafc',
                outline: 'none',
              }}
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
              style={{
                padding: '0.65rem 0.85rem',
                backgroundColor: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: '#f8fafc',
                outline: 'none',
              }}
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
              style={{
                padding: '0.65rem 0.85rem',
                backgroundColor: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: '#f8fafc',
                outline: 'none',
              }}
            >
              <option value="AVAILABLE">Available Only</option>
              <option value="RESERVED">Reserved Units</option>
              <option value="ALL">All Statuses</option>
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedGroup !== 'ALL' || selectedComponent !== 'ALL' || selectedStatus !== 'AVAILABLE') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid #1e293b',
              fontSize: '0.75rem',
              color: '#94a3b8',
            }}
          >
            <span>Active Filters:</span>
            {selectedGroup !== 'ALL' && (
              <span
                style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: '#450a0a',
                  color: '#fda4af',
                  border: '1px solid #9f1239',
                  fontWeight: 600,
                }}
              >
                Group: {selectedGroup}
              </span>
            )}
            {selectedComponent !== 'ALL' && (
              <span
                style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  fontWeight: 600,
                }}
              >
                Component: {selectedComponent.replace(/_/g, ' ')}
              </span>
            )}
            {selectedStatus !== 'AVAILABLE' && (
              <span
                style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: '#172554',
                  color: '#93c5fd',
                  border: '1px solid #1d4ed8',
                  fontWeight: 600,
                }}
              >
                Status: {selectedStatus}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedGroup('ALL');
                setSelectedComponent('ALL');
                setSelectedStatus('AVAILABLE');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#f43f5e',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '0.15rem 0.35rem',
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Inventory Units Table */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers style={{ width: '18px', height: '18px', color: '#f43f5e' }} />
            <h2 style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.9rem', margin: 0 }}>
              Live Stock Units ({filteredItems.length})
            </h2>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Strictly tested & released units only</span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <Clock style={{ width: '28px', height: '28px', margin: '0 auto 0.75rem auto', color: '#f43f5e' }} />
            Querying real-time blood bank inventory...
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <Droplet style={{ width: '36px', height: '36px', margin: '0 auto 0.75rem auto', color: '#475569' }} />
            <p style={{ fontWeight: 600, color: '#e2e8f0', margin: 0 }}>No eligible blood units found</p>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.35rem 0 0 0' }}>
              Either no stock matches the selected criteria or all units are reserved/unavailable.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
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
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem' }}>Unit Identifier</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Blood Group</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Component</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Volume</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Storage Rack</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Expiry Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isExpiringSoon =
                    item.expiryDate &&
                    new Date(item.expiryDate).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

                  return (
                    <tr
                      key={item._id || item.id}
                      style={{
                        borderBottom: '1px solid #1e293b',
                        backgroundColor: '#0f172a',
                      }}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#ffffff' }}>
                        {item.unitNumber || item.barcode || item._id?.slice(-8)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            backgroundColor: '#450a0a',
                            color: '#fda4af',
                            border: '1px solid #9f1239',
                          }}
                        >
                          {item.bloodGroup}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                        {item.componentType?.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#cbd5e1' }}>
                        {item.volumeMl ? `${item.volumeMl} mL` : '1 Unit'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Thermometer style={{ width: '14px', height: '14px', color: '#64748b' }} />
                          {item.storageLocation || 'Main Cold Storage'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            color: isExpiringSoon ? '#fbbf24' : '#94a3b8',
                            fontWeight: isExpiringSoon ? 700 : 500,
                          }}
                        >
                          <Calendar style={{ width: '14px', height: '14px' }} />
                          {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{getStatusBadge(item.status)}</td>
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
