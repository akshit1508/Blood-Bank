'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  AdminUser,
  getStoredToken,
  getStoredAdmin,
  clearAdminSession,
  fetchCurrentAdmin,
  adminLogin as apiAdminLogin,
} from '@/lib/auth-api';

interface AdminAuthContextType {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === '/admin/login';

  // Initialize session from client storage
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const token = getStoredToken();
      if (!token) {
        if (isMounted) {
          setAdmin(null);
          setLoading(false);
          if (!isLoginPage) {
            router.replace('/admin/login');
          }
        }
        return;
      }

      // Read fast cached user first
      const cached = getStoredAdmin();
      if (cached && isMounted) {
        setAdmin(cached);
      }

      // Validate with backend
      try {
        const verified = await fetchCurrentAdmin();
        if (isMounted) {
          if (verified) {
            setAdmin(verified);
            if (isLoginPage) {
              router.replace('/admin');
            }
          } else {
            setAdmin(null);
            clearAdminSession();
            if (!isLoginPage) {
              router.replace('/admin/login');
            }
          }
        }
      } catch {
        // If error, rely on cached admin if available
        if (!cached && isMounted && !isLoginPage) {
          router.replace('/admin/login');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [pathname, isLoginPage, router]);

  const login = useCallback(
    async (email: string, pass: string) => {
      const res = await apiAdminLogin(email, pass);
      setAdmin(res.admin);
      router.push('/admin');
    },
    [router]
  );

  const logout = useCallback(() => {
    clearAdminSession();
    setAdmin(null);
    router.replace('/admin/login');
  }, [router]);

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        loading,
        login,
        logout,
        isAuthenticated: !!admin,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
