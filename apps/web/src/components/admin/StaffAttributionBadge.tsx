import React from 'react';

interface StaffAttributionBadgeProps {
  label?: string; // e.g., 'Recorded by', 'Approved by', 'Tested by', 'Issued by'
  name?: string | null;
  role?: string | null;
  timestamp?: string | Date | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export default function StaffAttributionBadge({
  label,
  name,
  role,
  timestamp,
  size = 'sm',
  className = '',
}: StaffAttributionBadgeProps) {
  if (!name && !role) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-gray-400 italic text-xs ${className}`}
        title="Legacy record with no historical staff attribution snapshot"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        Historical staff record unavailable
      </span>
    );
  }

  const normalizedRole = (role || '').toUpperCase();

  const getRoleBadgeStyle = (): { bg: string; text: string; border: string } => {
    switch (normalizedRole) {
      case 'SUPER_ADMIN':
        return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
      case 'ADMIN':
      case 'OPERATIONAL_ADMIN':
        return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
      case 'LAB_TECHNICIAN':
      case 'TESTER':
        return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
      case 'RECEPTIONIST':
      case 'FINANCE_RECEPTIONIST':
        return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
    }
  };

  const formatRoleLabel = (r: string) => {
    switch (r.toUpperCase()) {
      case 'SUPER_ADMIN':
        return 'Super Admin';
      case 'ADMIN':
        return 'Admin';
      case 'LAB_TECHNICIAN':
        return 'Lab Tech';
      case 'RECEPTIONIST':
        return 'Receptionist';
      default:
        return r.replace(/_/g, ' ');
    }
  };

  const roleStyle = getRoleBadgeStyle();

  const formatTimestamp = (ts: string | Date) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div
      className={`inline-flex items-center flex-wrap gap-1.5 text-xs text-gray-700 ${className}`}
    >
      {label && <span className="text-gray-500 font-medium">{label}:</span>}
      <span className="font-semibold text-gray-900">{name || 'Staff User'}</span>
      {role && (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
        >
          {formatRoleLabel(role)}
        </span>
      )}
      {timestamp && (
        <span className="text-[11px] text-gray-400 font-normal">
          • {formatTimestamp(timestamp)}
        </span>
      )}
    </div>
  );
}
