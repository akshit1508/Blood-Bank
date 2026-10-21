'use client';

import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type DateFilterPreset =
  | 'all'
  | 'today'
  | '7days'
  | '15days'
  | '30days'
  | 'this_month'
  | 'custom';

export interface DatePresetOption {
  id: DateFilterPreset;
  label: string;
}

export const DEFAULT_DATE_PRESETS: DatePresetOption[] = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 Days' },
  { id: '15days', label: 'Last 15 Days' },
  { id: '30days', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
];

export interface UnifiedDateFilterBarProps {
  label?: string;
  presets?: DatePresetOption[];
  activePreset: DateFilterPreset | string;
  onSelectPreset: (preset: DateFilterPreset) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomStartDateChange?: (date: string) => void;
  onCustomEndDateChange?: (date: string) => void;
  accentColor?: string; // Active button background
  className?: string;
}

export default function UnifiedDateFilterBar({
  label = '📅 Date Filter:',
  presets = DEFAULT_DATE_PRESETS,
  activePreset,
  onSelectPreset,
  customStartDate = '',
  customEndDate = '',
  onCustomStartDateChange,
  onCustomEndDateChange,
  accentColor = '#dc2626',
  className = '',
}: UnifiedDateFilterBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollHorizon = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -180 : 180;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div
      className={`unified-date-filter-container ${className}`}
      style={{
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Scoped CSS for Sleek Scroll & Responsive Range */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .unified-date-scroll-track::-webkit-scrollbar {
              height: 4px;
            }
            .unified-date-scroll-track::-webkit-scrollbar-track {
              background: rgba(226, 232, 240, 0.5);
              border-radius: 9999px;
            }
            .unified-date-scroll-track::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 9999px;
            }
            .unified-date-scroll-arrow:hover {
              background-color: #f1f5f9 !important;
              border-color: #94a3b8 !important;
            }
            @media (max-width: 640px) {
              .unified-date-label-text {
                display: none !important;
              }
              .unified-custom-range-inputs {
                width: 100% !important;
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: nowrap !important;
                gap: 0.4rem !important;
              }
              .unified-custom-field {
                flex: 1 1 50% !important;
                min-width: 0 !important;
              }
              .unified-custom-field input {
                width: 100% !important;
                min-width: 0 !important;
              }
            }
          `,
        }}
      />

      {/* Main Filter Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          width: '100%',
          minWidth: 0,
        }}
      >
        {label && (
          <span
            className="unified-date-label-text"
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#64748b',
              marginRight: '0.2rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {label}
          </span>
        )}

        {/* Left Scroll Arrow */}
        <button
          type="button"
          onClick={() => scrollHorizon('left')}
          className="unified-date-scroll-arrow"
          aria-label="Scroll filter left"
          title="Scroll left"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#475569',
            borderRadius: '6px',
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <ChevronLeft size={14} />
        </button>

        {/* Scrollable Pills Strip */}
        <div
          ref={scrollRef}
          className="unified-date-scroll-track"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            overflowX: 'auto',
            overflowY: 'hidden',
            flexWrap: 'nowrap',
            flex: '1 1 auto',
            minWidth: 0,
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch',
            padding: '2px 0',
          }}
        >
          {presets.map((p) => {
            const active = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset(p.id)}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  border: active ? `1px solid ${accentColor}` : '1px solid #e2e8f0',
                  backgroundColor: active ? accentColor : '#ffffff',
                  color: active ? '#ffffff' : '#475569',
                  fontSize: '0.75rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Right Scroll Arrow */}
        <button
          type="button"
          onClick={() => scrollHorizon('right')}
          className="unified-date-scroll-arrow"
          aria-label="Scroll filter right"
          title="Scroll right"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#475569',
            borderRadius: '6px',
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Single-Line Custom Range Picker on Mobile */}
      {activePreset === 'custom' && onCustomStartDateChange && onCustomEndDateChange && (
        <div
          className="unified-custom-range-inputs"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            paddingTop: '0.65rem',
            marginTop: '0.5rem',
            borderTop: '1px dashed #e2e8f0',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="unified-custom-field"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              flex: '1 1 0',
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>
              From:
            </span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => onCustomStartDateChange(e.target.value)}
              style={{
                width: '100%',
                minWidth: 0,
                padding: '0.3rem 0.5rem',
                fontSize: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div
            className="unified-custom-field"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              flex: '1 1 0',
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>
              To:
            </span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => onCustomEndDateChange(e.target.value)}
              style={{
                width: '100%',
                minWidth: 0,
                padding: '0.3rem 0.5rem',
                fontSize: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
