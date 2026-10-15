const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  LAB_TECHNICIAN = 'LAB_TECHNICIAN',
  FINANCE_RECEPTIONIST = 'FINANCE_RECEPTIONIST',
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  designation: string;
  role: string;
  lastLoginAt: string | null;
}

export interface LoginResponse {
  token: string;
  admin: AdminUser;
}

const TOKEN_KEY = 'blood_bank_admin_token';
const ADMIN_KEY = 'blood_bank_admin_user';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: 'Bearer ' + token } : {};
}

export function getStoredAdmin(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAdminSession(token: string, admin: AdminUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  document.cookie = 'bb_admin_session=' + encodeURIComponent(token) + '; path=/; max-age=604800; SameSite=Lax';
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
  document.cookie = 'bb_admin_session=; path=/; max-age=0; SameSite=Lax';
}

export async function adminLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(API_BASE_URL + '/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Login failed. Please check your credentials.';
    throw new Error(errorMsg);
  }

  const data: LoginResponse = body.data;
  saveAdminSession(data.token, data.admin);
  return data;
}

export async function fetchCurrentAdmin(): Promise<AdminUser | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch(API_BASE_URL + '/auth/me', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + token,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      clearAdminSession();
      return null;
    }

    const body = await res.json();
    if (body.data) {
      localStorage.setItem(ADMIN_KEY, JSON.stringify(body.data));
      return body.data;
    }
    return null;
  } catch {
    return getStoredAdmin();
  }
}

export interface AdminAccountSummary {
  _id: string;
  email: string;
  fullName: string;
  designation: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'LAB_TECHNICIAN';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateStaffInput {
  email: string;
  password: string;
  fullName: string;
  designation?: string;
  role: 'ADMIN' | 'LAB_TECHNICIAN' | 'FINANCE_RECEPTIONIST';
}

/**
 * Retrieves list of all staff accounts.
 * Restricted to SUPER_ADMIN.
 * GET /api/auth/admins
 */
export async function fetchAdminAccounts(): Promise<AdminAccountSummary[]> {
  const res = await fetch(`${API_BASE_URL}/auth/admins`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || 'Failed to fetch staff accounts');
  }

  return body.data || [];
}

/**
 * Provisions a new staff account (ADMIN or LAB_TECHNICIAN).
 * Restricted to SUPER_ADMIN.
 * POST /api/auth/create-admin
 */
export async function createStaffAccount(input: CreateStaffInput): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/create-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to create staff account';
    throw new Error(errorMsg);
  }

  return body.data || { message: 'Account created successfully' };
}

/**
 * Toggles active/deactivated status of a staff account.
 * Restricted to SUPER_ADMIN.
 * PATCH /api/auth/admins/:id/status
 */
export async function updateAdminAccountStatus(
  adminId: string,
  isActive: boolean,
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/admins/${encodeURIComponent(adminId)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ isActive }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Failed to update account status';
    throw new Error(errorMsg);
  }

  return body.data || { message: 'Account status updated' };
}
