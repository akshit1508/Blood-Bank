import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AdminRole } from '../schemas/admin-user.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  function createMockContext(admin?: any): ExecutionContext {
    const request = {
      admin,
      user: admin,
    };

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows access immediately when endpoint is marked @Public()', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });

    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access with ForbiddenException when no roles are mandated for the endpoint (fail-closed policy)', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return undefined;
      return undefined;
    });

    const context = createMockContext({ role: AdminRole.ADMIN });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Access denied: Protected endpoint has no declared role metadata (fail-closed security policy).',
    );
  });

  it('throws UnauthorizedException when required roles exist but no admin is on request', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return [AdminRole.SUPER_ADMIN];
      return undefined;
    });

    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow(
      'Authentication is required prior to role verification.',
    );
  });

  it('throws ForbiddenException when admin role is insufficient', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return [AdminRole.SUPER_ADMIN];
      return undefined;
    });

    const context = createMockContext({ role: AdminRole.ADMIN });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      "Forbidden resource: Required role(s) [SUPER_ADMIN], current role is 'ADMIN'.",
    );
  });

  it('allows access when admin role satisfies the required roles', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return [AdminRole.SUPER_ADMIN];
      return undefined;
    });

    const context = createMockContext({ role: AdminRole.SUPER_ADMIN });
    expect(guard.canActivate(context)).toBe(true);
  });
});
