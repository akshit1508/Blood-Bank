import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { AdminRole } from '../auth/schemas/admin-user.schema';

describe('Replacement Donations RBAC & Permission Enforcement', () => {
  let rolesGuard: RolesGuard;
  let authGuard: AdminAuthGuard;
  let reflector: Reflector;

  // The exact roles configured on ReplacementDonationsController
  const READ_ALLOWED_ROLES = [
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.FINANCE_RECEPTIONIST,
    AdminRole.LAB_TECHNICIAN,
  ];

  const WRITE_ALLOWED_ROLES = [
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.FINANCE_RECEPTIONIST,
  ];

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
    authGuard = new AdminAuthGuard(reflector, {} as any);
  });

  function createMockContext(
    userRole: AdminRole | null,
    allowedRoles: AdminRole[] | null,
    isAuthenticated: boolean = true,
  ): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === 'roles') return allowedRoles;
      if (key === 'isPublic') return false;
      return null;
    });

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: isAuthenticated ? { authorization: 'Bearer valid.jwt.token' } : {},
          admin: isAuthenticated && userRole ? { role: userRole, id: 'admin-123', email: 'test@bloodbank.org' } : null,
          user: isAuthenticated && userRole ? { role: userRole, id: 'admin-123', email: 'test@bloodbank.org' } : null,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  describe('1. Super Admin Access', () => {
    it('SUPER_ADMIN is granted read access to replacement cases & metrics', () => {
      const context = createMockContext(AdminRole.SUPER_ADMIN, READ_ALLOWED_ROLES);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('SUPER_ADMIN is granted write access (create, link, cancel)', () => {
      const context = createMockContext(AdminRole.SUPER_ADMIN, WRITE_ALLOWED_ROLES);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });
  });

  describe('2. Admin Access', () => {
    it('ADMIN is granted read access', () => {
      const context = createMockContext(AdminRole.ADMIN, READ_ALLOWED_ROLES);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('ADMIN is granted write access', () => {
      const context = createMockContext(AdminRole.ADMIN, WRITE_ALLOWED_ROLES);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });
  });

  describe('3. Finance Receptionist Access', () => {
    it('FINANCE_RECEPTIONIST is granted read access to replacement cases', () => {
      const context = createMockContext(AdminRole.FINANCE_RECEPTIONIST, READ_ALLOWED_ROLES);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('FINANCE_RECEPTIONIST is granted write access to associate replacement donors', () => {
      const context = createMockContext(AdminRole.FINANCE_RECEPTIONIST, WRITE_ALLOWED_ROLES);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });
  });

  describe('4. Lab Technician Access Boundary', () => {
    it('LAB_TECHNICIAN is granted read access to replacement queue & sync', () => {
      const context = createMockContext(AdminRole.LAB_TECHNICIAN, READ_ALLOWED_ROLES);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('LAB_TECHNICIAN is DENIED write access (cannot create or cancel replacement tracking cases)', () => {
      const context = createMockContext(AdminRole.LAB_TECHNICIAN, WRITE_ALLOWED_ROLES);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('5. Unauthenticated User Access', () => {
    it('Unauthenticated user is denied prior to role check with 401 Unauthorized', () => {
      const context = createMockContext(null, READ_ALLOWED_ROLES, false);
      expect(() => rolesGuard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('6. Fail-closed security policy', () => {
    it('Denies access if an endpoint has no declared role metadata', () => {
      const context = createMockContext(AdminRole.ADMIN, null);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
