import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminAuthGuard } from './admin-auth.guard';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('AdminAuthGuard', () => {
  let guard: AdminAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    authService = {
      validateSession: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    guard = new AdminAuthGuard(reflector, authService);
  });

  function createMockContext(headers: Record<string, string> = {}): ExecutionContext {
    const request = {
      headers,
      admin: undefined,
      user: undefined,
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

  it('allows access without token when endpoint is marked @Public()', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createMockContext({});

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(authService.validateSession).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when Authorization header is missing on protected endpoint', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Authentication token is required.');
  });

  it('throws UnauthorizedException when Authorization header does not use Bearer scheme', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createMockContext({ authorization: 'Basic dXNlcjpwYXNz' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Invalid authorization scheme. Bearer token is required.',
    );
  });

  it('throws UnauthorizedException when Bearer token is empty', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createMockContext({ authorization: 'Bearer ' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Invalid authorization scheme. Bearer token is required.',
    );
  });

  it('throws UnauthorizedException when session is invalid or expired', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.validateSession.mockRejectedValue(
      new UnauthorizedException('Session is invalid or expired.'),
    );
    const context = createMockContext({ authorization: 'Bearer invalid.token.payload' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Session is invalid or expired.',
    );
  });

  it('attaches admin to request.admin and request.user and returns true when session is valid', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const mockAdmin: any = {
      id: 'admin-id-123',
      email: 'admin@bloodbank.org',
      fullName: 'Chief Admin',
      designation: 'Lab Admin',
      role: 'ADMIN',
      lastLoginAt: new Date(),
    };
    authService.validateSession.mockResolvedValue(mockAdmin as any);

    const context = createMockContext({ authorization: 'Bearer valid.session.token' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.admin).toEqual(mockAdmin);
    expect(req.user).toEqual(mockAdmin);
  });
});
