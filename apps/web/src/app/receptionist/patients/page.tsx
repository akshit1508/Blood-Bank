'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  FileText,
  Clock,
  Phone,
  Building,
  UserCheck,
  ChevronRight,
  Droplet,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { searchPatients, PatientSearchResult } from '@/lib/receptionist-api';

export default function ReceptionistPatientsDirectoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<PatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const results = await searchPatients(term);
      setPatients(results);
      if (results.length > 0 && !selectedPatient) {
        setSelectedPatient(results[0]);
      } else if (results.length === 0) {
        setSelectedPatient(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search patients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch('');
  }, []);

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase();
    let bg = '#1e293b';
    let color = '#94a3b8';
    let border = '#334155';
    let label = status;

    if (s === 'COMPLETED' || s === 'ISSUED') {
      bg = '#064e3b';
      color = '#6ee7b7';
      border = '#059669';
      label = 'Issued / Complete';
    } else if (s === 'APPROVED' || s === 'RESERVED') {
      bg = '#1e3a8a';
      color = '#93c5fd';
      border = '#2563eb';
      label = 'Ready for Issue';
    } else if (s === 'PENDING') {
      bg = '#451a03';
      color = '#fde68a';
      border = '#b45309';
      label = 'Pending Review';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.15rem 0.5rem',
          borderRadius: '9999px',
          fontSize: '0.7rem',
          fontWeight: 600,
          backgroundColor: bg,
          color: color,
          border: `1px solid ${border}`,
        }}
      >
        {label}
      </span>
    );
  };

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
            <Users style={{ width: '28px', height: '28px', color: '#f43f5e' }} />
            Patient Directory & History
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
            Search patient records, examine historical blood requests, and review submitted verification documents.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href="/receptionist/patients/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
            }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Register Patient & Intake
          </Link>
        </div>
      </div>

      {/* Search Input Bar */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(searchTerm);
          }}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
        >
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by patient name, phone number, hospital case number, or doctor..."
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
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid #334155',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Searching...' : 'Search Directory'}
          </button>
        </form>
      </div>

      {error && (
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
          <AlertCircle style={{ width: '20px', height: '20px', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Directory Split View */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Left List: Patients */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0 0.25rem',
            }}
          >
            <span>Patients Found ({patients.length})</span>
            <span>Sorted by Recent Activity</span>
          </div>

          {loading ? (
            <div
              style={{
                padding: '2.5rem',
                textAlign: 'center',
                color: '#94a3b8',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '12px',
              }}
            >
              <Clock style={{ width: '24px', height: '24px', margin: '0 auto 0.5rem auto', color: '#f43f5e' }} />
              Searching directory...
            </div>
          ) : patients.length === 0 ? (
            <div
              style={{
                padding: '2.5rem',
                textAlign: 'center',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                color: '#94a3b8',
              }}
            >
              <Users style={{ width: '36px', height: '36px', margin: '0 auto 0.75rem auto', color: '#475569' }} />
              <p style={{ fontWeight: 600, color: '#f8fafc', margin: 0 }}>No patient records found</p>
              <p style={{ fontSize: '0.775rem', color: '#64748b', margin: '0.35rem 0 1rem 0' }}>
                Try another search keyword or register a new patient.
              </p>
              <Link
                href="/receptionist/patients/new"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.8rem',
                  color: '#f43f5e',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <Plus style={{ width: '14px', height: '14px' }} />
                Register New Patient Now
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '650px', overflowY: 'auto' }}>
              {patients.map((p) => {
                const isSelected = selectedPatient?.patientKey === p.patientKey;
                return (
                  <div
                    key={p.patientKey}
                    onClick={() => setSelectedPatient(p)}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      border: isSelected ? '1px solid #f43f5e' : '1px solid #1e293b',
                      backgroundColor: isSelected ? 'rgba(244, 63, 94, 0.08)' : '#0f172a',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 0 1px rgba(244, 63, 94, 0.4)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>
                            {p.name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: '#450a0a',
                              color: '#fda4af',
                              border: '1px solid #9f1239',
                            }}
                          >
                            {p.bloodGroup || 'Unknown'}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.35rem 0 0 0' }}>
                          {p.age} yrs • {p.gender} • Case #{p.hospitalCaseNumber || 'N/A'}
                        </p>
                      </div>
                      <ChevronRight
                        style={{
                          width: '16px',
                          height: '16px',
                          color: isSelected ? '#f43f5e' : '#475569',
                          transform: isSelected ? 'translateX(2px)' : 'none',
                          transition: 'transform 0.15s',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid #1e293b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          maxWidth: '180px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Building style={{ width: '14px', height: '14px', color: '#64748b', flexShrink: 0 }} />
                        {p.hospitalName}
                      </span>
                      <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
                        {p.totalRequests} {p.totalRequests === 1 ? 'request' : 'requests'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Detail Pane */}
        <div>
          {selectedPatient ? (
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
              }}
            >
              {/* Header Info */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  paddingBottom: '1.25rem',
                  borderBottom: '1px solid #1e293b',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      backgroundColor: '#4c0519',
                      border: '1px solid #be123c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fb7185',
                      fontWeight: 800,
                      fontSize: '1.1rem',
                    }}
                  >
                    {selectedPatient.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: '#ffffff',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {selectedPatient.name}
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          backgroundColor: '#450a0a',
                          color: '#fca5a5',
                          border: '1px solid #dc2626',
                          fontWeight: 700,
                        }}
                      >
                        {selectedPatient.bloodGroup}
                      </span>
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                      {selectedPatient.age} years old • {selectedPatient.gender}
                    </p>
                  </div>
                </div>

                <div>
                  <Link
                    href={`/receptionist/patients/new?patientName=${encodeURIComponent(selectedPatient.name)}&phone=${encodeURIComponent(selectedPatient.phone)}&bloodGroup=${encodeURIComponent(selectedPatient.bloodGroup)}&hospitalName=${encodeURIComponent(selectedPatient.hospitalName)}&hospitalCaseNumber=${encodeURIComponent(selectedPatient.hospitalCaseNumber)}&doctorName=${encodeURIComponent(selectedPatient.doctorName)}&age=${selectedPatient.age}&gender=${selectedPatient.gender}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.55rem 1rem',
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      textDecoration: 'none',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                    }}
                  >
                    <Plus style={{ width: '14px', height: '14px' }} />
                    New Request for Patient
                  </Link>
                </div>
              </div>

              {/* Patient Meta Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <Building style={{ width: '14px', height: '14px', color: '#64748b' }} />
                    Hospital & Doctor
                  </div>
                  <p style={{ color: '#ffffff', fontWeight: 600, margin: '0 0 0.2rem 0' }}>{selectedPatient.hospitalName}</p>
                  <p style={{ color: '#94a3b8', margin: 0 }}>Attending: Dr. {selectedPatient.doctorName}</p>
                </div>

                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <Phone style={{ width: '14px', height: '14px', color: '#64748b' }} />
                    Contact & Case Reference
                  </div>
                  <p style={{ color: '#ffffff', fontWeight: 600, margin: '0 0 0.2rem 0' }}>Phone: {selectedPatient.phone || 'None recorded'}</p>
                  <p style={{ color: '#94a3b8', margin: 0 }}>Case / MRN: #{selectedPatient.hospitalCaseNumber || 'N/A'}</p>
                </div>
              </div>

              {/* Request History Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <Droplet style={{ width: '16px', height: '16px', color: '#f43f5e' }} />
                    Historical Blood Requests ({selectedPatient.recentRequests?.length || 0})
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Complete audit history</span>
                </div>

                {!selectedPatient.recentRequests || selectedPatient.recentRequests.length === 0 ? (
                  <div
                    style={{
                      padding: '1.5rem',
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: '0.8rem',
                      backgroundColor: '#020617',
                      borderRadius: '8px',
                      border: '1px solid #1e293b',
                    }}
                  >
                    No individual request records returned.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {selectedPatient.recentRequests.map((req) => (
                      <div
                        key={req.id}
                        style={{
                          padding: '1rem',
                          borderRadius: '10px',
                          backgroundColor: '#020617',
                          border: '1px solid #1e293b',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#f43f5e' }}>
                              {req.requestCode}
                            </span>
                            {getStatusBadge(req.status)}
                          </div>
                          <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: '0.35rem 0 0 0' }}>
                            {req.componentType?.replace(/_/g, ' ')} • {req.bloodGroup} • {req.unitsRequested} unit(s)
                          </p>
                          <p
                            style={{
                              fontSize: '0.7rem',
                              color: '#64748b',
                              margin: '0.2rem 0 0 0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <Calendar style={{ width: '12px', height: '12px' }} />
                            {new Date(req.createdAt).toLocaleDateString()} at{' '}
                            {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div>
                          <Link
                            href={`/receptionist/requests?requestId=${req.id}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '6px',
                              backgroundColor: '#1e293b',
                              color: '#f8fafc',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              border: '1px solid #334155',
                              textDecoration: 'none',
                            }}
                          >
                            <FileText style={{ width: '14px', height: '14px' }} />
                            Open Issue Desk
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '3rem 1.5rem',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              <UserCheck style={{ width: '42px', height: '42px', margin: '0 auto 0.75rem auto', color: '#334155' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#cbd5e1', margin: 0 }}>
                Select a patient to view details
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.35rem auto 0 auto', maxWidth: '380px' }}>
                Select any patient record from the list on the left to review their case background, verification status, and historical blood requests.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
