import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminRole } from '../auth/schemas/admin-user.schema';

describe('Financial RBAC Security & Role Isolation', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(userRole: AdminRole | null, allowedRoles: AdminRole[] | null): ExecutionContext {
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
          user: userRole ? { role: userRole, userId: 'user-123' } : null,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  describe('Vendor & Payment Endpoints Role Boundaries', () => {
    it('SUPER_ADMIN is granted access to payment creation endpoint', () => {
      const context = createMockContext(AdminRole.SUPER_ADMIN, [AdminRole.SUPER_ADMIN]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('ADMIN is denied access to payment creation endpoint (403 Forbidden)', () => {
      const context = createMockContext(AdminRole.ADMIN, [AdminRole.SUPER_ADMIN]);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('LAB_TECHNICIAN is denied access to payment creation endpoint (403 Forbidden)', () => {
      const context = createMockContext(AdminRole.LAB_TECHNICIAN, [AdminRole.SUPER_ADMIN]);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('Both SUPER_ADMIN and ADMIN are granted access to narrow vendor selector (/api/vendors/active-options)', () => {
      const allowedRoles = [AdminRole.SUPER_ADMIN, AdminRole.ADMIN];
      const adminContext = createMockContext(AdminRole.ADMIN, allowedRoles);
      const superAdminContext = createMockContext(AdminRole.SUPER_ADMIN, allowedRoles);

      expect(guard.canActivate(adminContext)).toBe(true);
      expect(guard.canActivate(superAdminContext)).toBe(true);
    });

    it('LAB_TECHNICIAN is denied access to narrow vendor selector (403 Forbidden)', () => {
      const allowedRoles = [AdminRole.SUPER_ADMIN, AdminRole.ADMIN];
      const labContext = createMockContext(AdminRole.LAB_TECHNICIAN, allowedRoles);
      expect(() => guard.canActivate(labContext)).toThrow(ForbiddenException);
    });
  });
});
