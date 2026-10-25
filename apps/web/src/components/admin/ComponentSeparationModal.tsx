'use client';

import React, { useState, useEffect } from 'react';
import {
  prepareComponents,
  ComponentItemInput,
} from '@/lib/testing-api';
import { getStoredAdmin } from '@/lib/auth-api';

interface ComponentSeparationModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: any;
  onSuccess: (result: { parentUnit: any; childUnits: any[] }) => void;
}

interface ComponentRow {
  componentType: 'PRBC' | 'FFP' | 'PLATELETS' | 'CRYOPRECIPITATE';
  selected: boolean;
  volume: number;
  storageLocation: string;
  shelfLifeDays: number;
  storageRequirement: string;
}

const DEFAULT_ROWS: ComponentRow[] = [
  {
    componentType: 'PRBC',
    selected: true,
    volume: 250,
    storageLocation: 'Blood Refrigerator 1 (2°C - 6°C)',
    shelfLifeDays: 35,
    storageRequirement: '2°C to 6°C (Blood Bank Refrigerator)',
  },
  {
    componentType: 'FFP',
    selected: true,
    volume: 150,
    storageLocation: 'Deep Freezer 1 (-18°C or colder)',
    shelfLifeDays: 365,
    storageRequirement: '-18°C or colder (Deep Freezer)',
  },
  {
    componentType: 'PLATELETS',
    selected: true,
    volume: 50,
    storageLocation: 'Platelet Agitator 1 (20°C - 24°C)',
    shelfLifeDays: 5,
    storageRequirement: '20°C to 24°C with continuous agitation',
  },
  {
    componentType: 'CRYOPRECIPITATE',
    selected: false,
    volume: 20,
    storageLocation: 'Deep Freezer 2 (-18°C or colder)',
    shelfLifeDays: 365,
    storageRequirement: '-18°C or colder (Deep Freezer)',
  },
];

export default function ComponentSeparationModal({
  isOpen,
  onClose,
  unit,
  onSuccess,
}: ComponentSeparationModalProps) {
  const [components, setComponents] = useState<ComponentRow[]>(DEFAULT_ROWS);
  const [separationNotes, setSeparationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setComponents(DEFAULT_ROWS.map((r) => ({ ...r })));
      setSeparationNotes('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen || !unit) return null;

  const isWholeBlood =
    unit.componentType === 'WHOLE_BLOOD' ||
    (unit.bloodUnitId && unit.bloodUnitId.componentType === 'WHOLE_BLOOD');

  const unitCode = unit.unitCode || unit.bloodUnitId?.unitCode || 'UNIT';
  const unitBloodGroup = unit.bloodGroup || unit.bloodUnitId?.bloodGroup || 'O+';
  const parentUnitId = unit._id || unit.bloodUnitId?._id;

  const selectedComponents = components.filter((c) => c.selected);
  const totalVolume = selectedComponents.reduce((sum, c) => sum + Number(c.volume || 0), 0);

  // Apply Presets
  const applyPreset = (type: 'DOUBLE' | 'TRIPLE' | 'QUADRUPLE') => {
    setComponents([
      {
        componentType: 'PRBC',
        selected: true,
        volume: type === 'DOUBLE' ? 220 : 250,
        storageLocation: 'Blood Refrigerator 1 (2°C - 6°C)',
        shelfLifeDays: 35,
        storageRequirement: '2°C to 6°C (Blood Bank Refrigerator)',
      },
      {
        componentType: 'FFP',
        selected: true,
        volume: type === 'DOUBLE' ? 130 : 150,
        storageLocation: 'Deep Freezer 1 (-18°C or colder)',
        shelfLifeDays: 365,
        storageRequirement: '-18°C or colder (Deep Freezer)',
      },
      {
        componentType: 'PLATELETS',
        selected: type === 'TRIPLE' || type === 'QUADRUPLE',
        volume: 50,
        storageLocation: 'Platelet Agitator 1 (20°C - 24°C)',
        shelfLifeDays: 5,
        storageRequirement: '20°C to 24°C with continuous agitation',
      },
      {
        componentType: 'CRYOPRECIPITATE',
        selected: type === 'QUADRUPLE',
        volume: 20,
        storageLocation: 'Deep Freezer 2 (-18°C or colder)',
        shelfLifeDays: 365,
        storageRequirement: '-18°C or colder (Deep Freezer)',
      },
    ]);
  };

  const handleSeparate = async () => {
    if (selectedComponents.length === 0) {
      setErrorMessage('Please select at least one component to separate.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: ComponentItemInput[] = selectedComponents.map((c) => ({
        componentType: c.componentType,
        volume: Number(c.volume),
        storageLocation: c.storageLocation.trim() || undefined,
      }));

      const result = await prepareComponents(parentUnitId, {
        components: payload,
        notes: separationNotes.trim() || undefined,
      });

      onSuccess(result);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Component preparation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🧪</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Blood Component Separation & Traceability
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 30px', fontSize: '12px', color: '#94a3b8' }}>
              Parent Unit: <strong style={{ color: '#f8fafc' }}>{unitCode}</strong> | Group:{' '}
              <strong style={{ color: '#f87171' }}>{unitBloodGroup}</strong> | Type: Whole Blood
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '24px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {!isWholeBlood ? (
            <div
              style={{
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '14px',
              }}
            >
              ⚠️ <strong>Ineligible for Component Preparation:</strong> Only Whole Blood units can be
              separated into components. This unit is already a derived component ({unit.componentType}).
            </div>
          ) : (
            <div>
              {/* Presets Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '20px',
                  backgroundColor: '#f1f5f9',
                  padding: '12px 16px',
                  borderRadius: '10px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Standard Separation Presets:
                </span>
                <button
                  type="button"
                  onClick={() => applyPreset('DOUBLE')}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Double Bag (PRBC + FFP)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('TRIPLE')}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Triple Bag (PRBC + FFP + Platelets)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('QUADRUPLE')}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Quadruple (PRBC + FFP + Platelets + Cryo)
                </button>
              </div>

              {errorMessage && (
                <div
                  style={{
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px',
                  }}
                >
                  ⚠️ {errorMessage}
                </div>
              )}

              {/* Component Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {components.map((c, idx) => (
                  <div
                    key={c.componentType}
                    style={{
                      border: c.selected ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '14px 18px',
                      backgroundColor: c.selected ? '#f8fafc' : '#ffffff',
                      display: 'grid',
                      gridTemplateColumns: 'auto 150px 100px 1fr 140px',
                      alignItems: 'center',
                      gap: '14px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={c.selected}
                      onChange={(e) => {
                        const updated = [...components];
                        updated[idx].selected = e.target.checked;
                        setComponents(updated);
                      }}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />

                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{c.componentType}</strong>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                        Shelf-life: {c.shelfLifeDays} days
                      </span>
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Volume (mL)</label>
                      <input
                        type="number"
                        value={c.volume}
                        disabled={!c.selected}
                        onChange={(e) => {
                          const updated = [...components];
                          updated[idx].volume = Number(e.target.value);
                          setComponents(updated);
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>
                        Storage Location
                      </label>
                      <input
                        type="text"
                        value={c.storageLocation}
                        disabled={!c.selected}
                        onChange={(e) => {
                          const updated = [...components];
                          updated[idx].storageLocation = e.target.value;
                          setComponents(updated);
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                        }}
                      />
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
                      {c.storageRequirement}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total volume & traceability notice */}
              <div
                style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  marginBottom: '20px',
                  fontSize: '12px',
                  color: '#1e40af',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <strong>Selected Components: {selectedComponents.length}</strong>
                  <strong>Total Component Yield: {totalVolume} mL</strong>
                </div>
                <span>
                  🛡️ <strong>Safety Invariant:</strong> Parent unit <code>{unitCode}</code> status will update
                  to <strong>PROCESSED_INTO_COMPONENTS</strong> and its whole blood inventory entry will be
                  decommissioned to prevent double-counting or inflated stock. Child units link to parent bag
                  identifier for 100% audit traceability.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Preparation Notes / Centrifugation Protocol
                </label>
                <input
                  type="text"
                  value={separationNotes}
                  onChange={(e) => setSeparationNotes(e.target.value)}
                  placeholder="e.g. Centrifuged at 4000 RPM for 10 mins at 4°C using refrigerated centrifuge"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          {isWholeBlood && (
            <button
              type="button"
              onClick={handleSeparate}
              disabled={submitting || selectedComponents.length === 0}
              style={{
                padding: '10px 22px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: submitting || selectedComponents.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {submitting ? 'Processing...' : `✓ Authorize & Separate into ${selectedComponents.length} Components`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
