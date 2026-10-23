import { getAuthHeaders } from './auth-api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface ExpiryRuleItem {
  _id: string;
  componentType: string;
  shelfLifeDays: number;
  storageTemperature: string;
  description: string | null;
  isActive: boolean;
  updatedAt: string;
  updatedByName: string | null;
  updatedByRole?: string | null;
}

export const COMPONENT_DISPLAY_LABELS: Record<string, string> = {
  WHOLE_BLOOD: 'Whole Blood (WB)',
  PRBC: 'Packed Red Blood Cells (PRBC)',
  FFP: 'Fresh Frozen Plasma (FFP)',
  PLATELETS: 'Platelets Concentrate (RDP / SDP)',
};

export const COMPONENT_TEMPERATURE_GUIDES: Record<string, string> = {
  WHOLE_BLOOD: '2°C to 6°C in blood bank refrigerator',
  PRBC: '2°C to 6°C in monitored cold storage',
  FFP: '-18°C or colder in deep plasma freezer',
  PLATELETS: '20°C to 24°C under continuous gentle agitation',
};

export async function fetchExpiryRules(): Promise<ExpiryRuleItem[]> {
  const res = await fetch(`${API_BASE_URL}/inventory/expiry-rules`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch blood unit expiry rules');
  }
  const json = await res.json();
  return json.data;
}

export async function updateExpiryRule(data: {
  componentType: string;
  shelfLifeDays: number;
  storageTemperature?: string;
  description?: string;
  isActive?: boolean;
}): Promise<ExpiryRuleItem> {
  const res = await fetch(`${API_BASE_URL}/inventory/expiry-rules`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to update expiry rule');
  }
  const json = await res.json();
  return json.data;
}

export async function bulkUpdateExpiryRules(
  rules: Array<{
    componentType: string;
    shelfLifeDays: number;
    storageTemperature?: string;
    description?: string;
    isActive?: boolean;
  }>,
): Promise<ExpiryRuleItem[]> {
  const res = await fetch(`${API_BASE_URL}/inventory/expiry-rules/bulk`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ rules }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to bulk update expiry rules');
  }
  const json = await res.json();
  return json.data;
}

export async function recalculateInventoryExpiries(): Promise<{
  updatedCount: number;
  message: string;
}> {
  const res = await fetch(`${API_BASE_URL}/inventory/expiry-rules/recalculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to recalculate inventory expiries');
  }
  const json = await res.json();
  return {
    updatedCount: json.updatedCount,
    message: json.message,
  };
}

export interface ExpiryCalculationResult {
  expiryDate: Date | null;
  formattedDate: string;
  daysRemaining: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  statusText: string;
  badgeBg: string;
  badgeColor: string;
}

export const DEFAULT_SHELF_LIFE_DAYS: Record<string, number> = {
  WHOLE_BLOOD: 35,
  PRBC: 42,
  FFP: 365,
  PLATELETS: 5,
};

export function getUnitExpiryInfo(
  expiryDateStr?: string | Date | null,
  collectionDateStr?: string | Date | null,
  componentType?: string | null,
  unitCode?: string | null,
): ExpiryCalculationResult {
  let expDate: Date | null = expiryDateStr ? new Date(expiryDateStr) : null;
  const typeKey = (componentType || 'WHOLE_BLOOD').toUpperCase();
  const shelfDays = DEFAULT_SHELF_LIFE_DAYS[typeKey] || 35;

  if ((!expDate || isNaN(expDate.getTime())) && collectionDateStr) {
    const colDate = new Date(collectionDateStr);
    if (!isNaN(colDate.getTime())) {
      expDate = new Date(colDate.getTime() + shelfDays * 24 * 60 * 60 * 1000);
    }
  }

  // Fallback: extract date from standard blood unit code format (e.g. UNIT-20261016-3ZBH)
  if ((!expDate || isNaN(expDate.getTime())) && unitCode) {
    const m = unitCode.match(/UNIT-(\d{4})(\d{2})(\d{2})-/i);
    if (m) {
      const parsedDate = new Date(`${m[1]}-${m[2]}-${m[3]}`);
      if (!isNaN(parsedDate.getTime())) {
        expDate = new Date(parsedDate.getTime() + shelfDays * 24 * 60 * 60 * 1000);
      }
    }
  }

  if (!expDate || isNaN(expDate.getTime())) {
    return {
      expiryDate: null,
      formattedDate: '—',
      daysRemaining: null,
      isExpired: false,
      isExpiringSoon: false,
      statusText: 'No Expiry',
      badgeBg: '#f1f5f9',
      badgeColor: '#64748b',
    };
  }

  const daysRemaining = Math.ceil(
    (expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const formattedDate = expDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  if (daysRemaining < 0) {
    return {
      expiryDate: expDate,
      formattedDate,
      daysRemaining,
      isExpired: true,
      isExpiringSoon: false,
      statusText: `EXPIRED (${Math.abs(daysRemaining)}d ago)`,
      badgeBg: '#fee2e2',
      badgeColor: '#dc2626',
    };
  }

  if (daysRemaining === 0) {
    return {
      expiryDate: expDate,
      formattedDate,
      daysRemaining,
      isExpired: false,
      isExpiringSoon: true,
      statusText: 'EXPIRES TODAY',
      badgeBg: '#fef3c7',
      badgeColor: '#b45309',
    };
  }

  if (daysRemaining <= 3) {
    return {
      expiryDate: expDate,
      formattedDate,
      daysRemaining,
      isExpired: false,
      isExpiringSoon: true,
      statusText: `${daysRemaining}d left`,
      badgeBg: '#fef3c7',
      badgeColor: '#b45309',
    };
  }

  return {
    expiryDate: expDate,
    formattedDate,
    daysRemaining,
    isExpired: false,
    isExpiringSoon: false,
    statusText: `${daysRemaining}d left`,
    badgeBg: '#dcfce7',
    badgeColor: '#16a34a',
  };
}
