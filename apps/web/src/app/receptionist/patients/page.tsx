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
    if (s === 'COMPLETED' || s === 'ISSUED') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/40 text-emerald-300 border border-emerald-500/30">Issued / Complete</span>;
    }
    if (s === 'APPROVED' || s === 'RESERVED') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/40 text-blue-300 border border-blue-500/30">Ready for Issue</span>;
    }
    if (s === 'PENDING') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-300 border border-amber-500/30">Pending Review</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">{status}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-rose-500" />
            Patient Directory & History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Search patient records, examine historical blood requests, and review submitted verification documents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/receptionist/patients/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register Patient & Intake
          </Link>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(searchTerm);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by patient name, phone number, hospital case number, or doctor..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search Directory'}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg flex items-center gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Directory Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List: Patients */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            <span>Patients Found ({patients.length})</span>
            <span>Sorted by Recent Activity</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
              <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
              Searching directory...
            </div>
          ) : patients.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="font-medium text-slate-300">No patient records found</p>
              <p className="text-xs text-slate-500 mt-1">Try another search keyword or register a new patient.</p>
              <Link
                href="/receptionist/patients/new"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Register New Patient Now
              </Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
              {patients.map((p) => {
                const isSelected = selectedPatient?.patientKey === p.patientKey;
                return (
                  <div
                    key={p.patientKey}
                    onClick={() => setSelectedPatient(p)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-950/20 border-rose-600/60 ring-1 ring-rose-500/40 shadow-sm'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                          {p.name}
                          <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60">
                            {p.bloodGroup || 'Unknown'}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {p.age} yrs • {p.gender} • Case #{p.hospitalCaseNumber || 'N/A'}
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${isSelected ? 'translate-x-1 text-rose-400' : ''}`} />
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1 truncate max-w-[180px]">
                        <Building className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        {p.hospitalName}
                      </span>
                      <span className="font-medium text-slate-300">
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
        <div className="lg:col-span-7">
          {selectedPatient ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-800 gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-700/50 flex items-center justify-center text-rose-400 font-bold text-lg">
                      {selectedPatient.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {selectedPatient.name}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-900/40 text-rose-300 border border-rose-700/50">
                          {selectedPatient.bloodGroup}
                        </span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedPatient.age} years old • {selectedPatient.gender}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/receptionist/patients/new?patientName=${encodeURIComponent(selectedPatient.name)}&phone=${encodeURIComponent(selectedPatient.phone)}&bloodGroup=${encodeURIComponent(selectedPatient.bloodGroup)}&hospitalName=${encodeURIComponent(selectedPatient.hospitalName)}&hospitalCaseNumber=${encodeURIComponent(selectedPatient.hospitalCaseNumber)}&doctorName=${encodeURIComponent(selectedPatient.doctorName)}&age=${selectedPatient.age}&gender=${selectedPatient.gender}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Request for Patient
                  </Link>
                </div>
              </div>

              {/* Patient Meta Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-500" />
                    Hospital & Doctor
                  </div>
                  <p className="text-white font-medium">{selectedPatient.hospitalName}</p>
                  <p className="text-slate-400">Attending: Dr. {selectedPatient.doctorName}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    Contact & Case Reference
                  </div>
                  <p className="text-white font-medium">Phone: {selectedPatient.phone || 'None recorded'}</p>
                  <p className="text-slate-400">Case / MRN: #{selectedPatient.hospitalCaseNumber || 'N/A'}</p>
                </div>
              </div>

              {/* Request History Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-rose-500" />
                    Historical Blood Requests ({selectedPatient.recentRequests?.length || 0})
                  </h3>
                  <span className="text-xs text-slate-400">Complete audit history</span>
                </div>

                {(!selectedPatient.recentRequests || selectedPatient.recentRequests.length === 0) ? (
                  <div className="p-6 text-center text-slate-500 text-xs bg-slate-950 rounded-lg border border-slate-800">
                    No individual request records returned.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedPatient.recentRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-xs text-rose-400">
                              {req.requestCode}
                            </span>
                            {getStatusBadge(req.status)}
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            {req.componentType?.replace(/_/g, ' ')} • {req.bloodGroup} • {req.unitsRequested} unit(s)
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(req.createdAt).toLocaleDateString()} at{' '}
                            {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link
                            href={`/receptionist/requests?requestId=${req.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
              <UserCheck className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <h3 className="text-base font-medium text-slate-300">Select a patient to view details</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Select any patient record from the list on the left to review their case background, verification status, and historical blood requests.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
