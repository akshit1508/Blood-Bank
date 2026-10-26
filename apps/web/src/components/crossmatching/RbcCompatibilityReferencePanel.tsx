'use client';

import React, { useState } from 'react';
import { RBC_COMPATIBILITY_MATRIX } from '@/lib/crossmatching-api';

interface RbcCompatibilityReferencePanelProps {
  initialPatientGroup?: string;
  isModal?: boolean;
  onClose?: () => void;
}

export default function RbcCompatibilityReferencePanel({
  initialPatientGroup,
  isModal = false,
  onClose,
}: RbcCompatibilityReferencePanelProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>(
    initialPatientGroup || 'A+',
  );

  const groups = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  const content = (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '10px',
        padding: '1.5rem',
        color: '#0f172a',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
        maxWidth: '850px',
        margin: '0 auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '1rem',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
              fontWeight: 800,
              fontSize: '0.85rem',
            }}
          >
            RBC
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              Red Blood Cell (PRBC) Compatibility Reference Matrix
            </h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
              Authoritative clinical reference for Packed Red Blood Cells (PRBC). Whole Blood, FFP, and Platelets adhere to distinct protocols.
            </p>
          </div>
        </div>
        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '1.4rem',
              padding: '0.25rem 0.5rem',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        )}
      </div>

      {/* Mandatory Safety Alert */}
      <div
        style={{
          marginTop: '1rem',
          padding: '0.85rem 1rem',
          borderRadius: '8px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          color: '#92400e',
          fontSize: '0.78rem',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 800, color: '#b45309', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span>⚠️</span> MANDATORY CLINICAL SAFETY DIRECTIVE
        </div>
        <p style={{ margin: '0 0 0.35rem 0' }}>
          <strong>Component Specificity:</strong> This matrix applies <strong>exclusively to Packed Red Blood Cells (PRBC / Packed Cells)</strong> where donor plasma has been removed.
        </p>
        <p style={{ margin: '0 0 0.35rem 0' }}>
          <strong>Whole Blood Policy:</strong> Whole Blood contains ~250 mL of unseparated donor plasma with high titers of anti-A and anti-B isohemagglutinins. Under approved blood centre SOP, <strong>Whole Blood transfusions strictly require identical ABO/RhD matching</strong> (e.g., an O+ patient must receive O+ Whole Blood; O− Whole Blood cannot be transfused as whole blood to an O+ patient).
        </p>
        <p style={{ margin: '0 0 0.35rem 0' }}>
          <strong>Plasma (FFP) & Platelet Policy:</strong> Plasma and platelet components adhere to reverse compatibility rules (AB is universal plasma donor; group O plasma contains anti-A/anti-B and must only go to group O).
        </p>
        <p style={{ margin: 0 }}>
          <strong>Pre-Selection Guidance Only:</strong> Theoretical compatibility does <em>NOT</em> replace physical serological crossmatching. Laboratory testing, clinical authorization, and component-specific reservation checks must all be satisfied before issue.
        </p>
      </div>

      {/* Interactive Blood Group Selector */}
      <div style={{ marginTop: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
          Select Patient Blood Group:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '0.45rem' }}>
          {groups.map((grp) => {
            const isSelected = selectedGroup === grp;
            return (
              <button
                key={grp}
                type="button"
                onClick={() => setSelectedGroup(grp)}
                style={{
                  padding: '0.6rem 0.4rem',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  borderRadius: '6px',
                  border: isSelected ? '2px solid #dc2626' : '1px solid #cbd5e1',
                  backgroundColor: isSelected ? '#dc2626' : '#f8fafc',
                  color: isSelected ? '#ffffff' : '#1e293b',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease-in-out',
                  boxShadow: isSelected ? '0 2px 4px rgba(220, 38, 38, 0.25)' : 'none',
                }}
              >
                {grp}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Group Breakdown */}
      <div
        style={{
          marginTop: '1.25rem',
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
          Theoretical RBC Donors for Patient Group <span style={{ color: '#dc2626', fontWeight: 900, fontSize: '0.9rem' }}>{selectedGroup}</span>:
        </div>
        <div style={{ marginTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {RBC_COMPATIBILITY_MATRIX[selectedGroup]?.map((donorGrp) => {
            const isIdentical = donorGrp === selectedGroup;
            return (
              <span
                key={donorGrp}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  border: isIdentical ? '1px solid #86efac' : '1px solid #bfdbfe',
                  backgroundColor: isIdentical ? '#dcfce7' : '#eff6ff',
                  color: isIdentical ? '#15803d' : '#1d4ed8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <strong>{donorGrp}</strong>
                <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                  {isIdentical ? '(Identical Match)' : '(Alternative RBC Donor)'}
                </span>
              </span>
            );
          })}
        </div>
        <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
          {selectedGroup === 'AB+' &&
            'AB+ patients possess no ABO or Rh antibodies in plasma, making them theoretical universal recipients for RBC components.'}
          {selectedGroup === 'O-' &&
            'O- patients have anti-A, anti-B antibodies and lack the RhD antigen; they can only safely receive O- red cells.'}
          {selectedGroup !== 'AB+' && selectedGroup !== 'O-' &&
            `For ${selectedGroup} patients, group-identical (${selectedGroup}) RBCs should be prioritized before utilizing compatible alternative donor units.`}
        </p>
      </div>

      {/* Comprehensive Standard Table */}
      <div style={{ marginTop: '1.25rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.78rem', textAlign: 'left', borderCollapse: 'collapse', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          <thead style={{ backgroundColor: '#f1f5f9', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>
            <tr>
              <th style={{ padding: '0.65rem 0.85rem', borderBottom: '1px solid #cbd5e1' }}>Patient Group</th>
              <th style={{ padding: '0.65rem 0.85rem', borderBottom: '1px solid #cbd5e1' }}>Potentially Compatible RBC Donor Groups</th>
              <th style={{ padding: '0.65rem 0.85rem', borderBottom: '1px solid #cbd5e1' }}>Clinical Remarks</th>
            </tr>
          </thead>
          <tbody style={{ color: '#1e293b' }}>
            {Object.entries(RBC_COMPATIBILITY_MATRIX).map(([pGrp, dGrps]) => {
              const isHighlighted = pGrp === selectedGroup;
              return (
                <tr
                  key={pGrp}
                  style={{
                    backgroundColor: isHighlighted ? '#fee2e2' : 'transparent',
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={{ padding: '0.55rem 0.85rem', fontWeight: 900, color: '#dc2626' }}>
                    {pGrp}
                  </td>
                  <td style={{ padding: '0.55rem 0.85rem', fontFamily: 'monospace', fontWeight: 700 }}>
                    {dGrps.join(', ')}
                  </td>
                  <td style={{ padding: '0.55rem 0.85rem', color: '#64748b' }}>
                    {pGrp === 'O-' && 'Universal red cell donor; can only receive O-'}
                    {pGrp === 'O+' && 'Can receive O- and O+ red cells'}
                    {pGrp === 'A-' && 'Can receive O- and A- red cells'}
                    {pGrp === 'A+' && 'Can receive O-, O+, A-, A+ red cells'}
                    {pGrp === 'B-' && 'Can receive O- and B- red cells'}
                    {pGrp === 'B+' && 'Can receive O-, O+, B-, B+ red cells'}
                    {pGrp === 'AB-' && 'Can receive Rh-negative red cells (O-, A-, B-, AB-)'}
                    {pGrp === 'AB+' && 'Universal RBC recipient for all eight groups'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          overflowY: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: '850px', maxHeight: '92vh', overflowY: 'auto' }}>
          {content}
        </div>
      </div>
    );
  }

  return content;
}
