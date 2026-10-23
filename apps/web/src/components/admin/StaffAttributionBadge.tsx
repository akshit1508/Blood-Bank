import React from 'react';

export interface StaffAttributionBadgeProps {
  label?: string; // e.g., 'Recorded by', 'Approved by', 'Tested by', 'Issued by', 'Called by'
  name?: string | null;
  role?: string | null;
  timestamp?: string | Date | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
  layout?: 'stacked' | 'inline';
}

export default function StaffAttributionBadge({
  label,
  name,
  role,
  timestamp,
  size = 'sm',
  className = '',
  style = {},
  layout = 'stacked',
}: StaffAttributionBadgeProps) {
  const sizeStyles = {
    xs: {
      labelSize: '0.72rem',
      nameSize: '0.78rem',
      badgeSize: '0.65rem',
      badgePadding: '0.1rem 0.35rem',
      timeSize: '0.7rem',
      gap: '0.35rem',
      lineGap: '0.15rem',
    },
    sm: {
      labelSize: '0.75rem',
      nameSize: '0.82rem',
      badgeSize: '0.68rem',
      badgePadding: '0.12rem 0.42rem',
      timeSize: '0.75rem',
      gap: '0.38rem',
      lineGap: '0.2rem',
    },
    md: {
      labelSize: '0.8rem',
      nameSize: '0.875rem',
      badgeSize: '0.72rem',
      badgePadding: '0.15rem 0.48rem',
      timeSize: '0.78rem',
      gap: '0.45rem',
      lineGap: '0.25rem',
    },
  }[size];

  if (!name && !role) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          color: '#94a3b8',
          fontStyle: 'italic',
          fontSize: sizeStyles.timeSize,
          ...style,
        }}
        title="Legacy record with no historical staff attribution snapshot"
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#cbd5e1',
            display: 'inline-block',
          }}
        />
        Historical record unavailable
      </span>
    );
  }

  const normalizedRole = (role || '').toUpperCase();

  const getRoleBadgeStyle = (): { bg: string; text: string; border: string } => {
    switch (normalizedRole) {
      case 'SUPER_ADMIN':
        return { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' };
      case 'ADMIN':
      case 'OPERATIONAL_ADMIN':
        return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
      case 'LAB_TECHNICIAN':
      case 'TESTER':
        return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
      case 'RECEPTIONIST':
      case 'FINANCE_RECEPTIONIST':
        return { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
      case 'DONOR_COORDINATOR':
        return { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' };
      default:
        return { bg: '#f8fafc', text: '#334155', border: '#cbd5e1' };
    }
  };

  const formatRoleLabel = (r: string) => {
    const upper = (r || '').toUpperCase();
    switch (upper) {
      case 'SUPER_ADMIN':
        return 'Super Admin';
      case 'ADMIN':
      case 'OPERATIONAL_ADMIN':
        return 'Admin';
      case 'LAB_TECHNICIAN':
      case 'TESTER':
        return 'Lab Tech';
      case 'FINANCE_RECEPTIONIST':
        return 'Finance Receptionist';
      case 'RECEPTIONIST':
        return 'Receptionist';
      case 'DONOR_COORDINATOR':
        return 'Donor Coordinator';
      default:
        return r
          .split(/[\s_]+/)
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
    }
  };

  const roleStyle = getRoleBadgeStyle();

  const formatTimestamp = (ts: string | Date | null | undefined): string => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  const formattedTime = formatTimestamp(timestamp);
  const cleanLabel = label ? label.replace(/:\s*$/, '') : '';

  if (layout === 'inline') {
    return (
      <div
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: sizeStyles.gap,
          rowGap: '0.2rem',
          lineHeight: 1.4,
          verticalAlign: 'middle',
          ...style,
        }}
      >
        {cleanLabel && (
          <span
            style={{
              fontSize: sizeStyles.labelSize,
              color: '#64748b',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {cleanLabel}:
          </span>
        )}
        <span
          style={{
            fontSize: sizeStyles.nameSize,
            fontWeight: 600,
            color: '#0f172a',
            whiteSpace: 'nowrap',
          }}
        >
          {name || 'Staff User'}
        </span>
        {role && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: sizeStyles.badgeSize,
              fontWeight: 600,
              padding: sizeStyles.badgePadding,
              borderRadius: '4px',
              border: `1px solid ${roleStyle.border}`,
              backgroundColor: roleStyle.bg,
              color: roleStyle.text,
              whiteSpace: 'nowrap',
              letterSpacing: '0.015em',
            }}
          >
            {formatRoleLabel(role)}
          </span>
        )}
        {formattedTime && (
          <span
            style={{
              fontSize: sizeStyles.timeSize,
              color: '#64748b',
              fontWeight: 400,
              whiteSpace: 'nowrap',
            }}
          >
            • {formattedTime}
          </span>
        )}
      </div>
    );
  }

  // Default: stacked layout (perfect for tables and audit cards)
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: sizeStyles.lineGap,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: sizeStyles.gap,
          lineHeight: 1.35,
        }}
      >
        {cleanLabel && (
          <span
            style={{
              fontSize: sizeStyles.labelSize,
              color: '#64748b',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {cleanLabel}:
          </span>
        )}
        <span
          style={{
            fontSize: sizeStyles.nameSize,
            fontWeight: 600,
            color: '#0f172a',
            whiteSpace: 'nowrap',
          }}
        >
          {name || 'Staff User'}
        </span>
        {role && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: sizeStyles.badgeSize,
              fontWeight: 600,
              padding: sizeStyles.badgePadding,
              borderRadius: '4px',
              border: `1px solid ${roleStyle.border}`,
              backgroundColor: roleStyle.bg,
              color: roleStyle.text,
              whiteSpace: 'nowrap',
              letterSpacing: '0.015em',
            }}
          >
            {formatRoleLabel(role)}
          </span>
        )}
      </div>

      {formattedTime && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: sizeStyles.timeSize,
            color: '#64748b',
            whiteSpace: 'nowrap',
            lineHeight: 1.25,
          }}
        >
          <span>{formattedTime}</span>
        </div>
      )}
    </div>
  );
}
