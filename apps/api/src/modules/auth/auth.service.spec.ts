import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminUser, AdminRole } from './schemas/admin-user.schema';

describe('AuthService', () => {
  let service: AuthService;
  let mockAdminModel: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockAdminModel = {
      countDocuments: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'AUTH_SESSION_SECRET') {
          return 'test-secret-key-that-is-at-least-32-chars-long';
        }
        if (key === 'NODE_ENV') {
          return 'development';
        }
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(AdminUser.name),
          useValue: mockAdminModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('Secret Key Handling', () => {
    it('returns configured AUTH_SESSION_SECRET', () => {
      expect(service.getSecretKey()).toBe('test-secret-key-that-is-at-least-32-chars-long');
    });

    it('falls back to JWT_SECRET if AUTH_SESSION_SECRET is empty', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'jwt-secret-key-at-least-32-characters-long';
        return null;
      });
      expect(service.getSecretKey()).toBe('jwt-secret-key-at-least-32-characters-long');
    });

    it('throws fatal error if neither secret is configured in production', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        return null;
      });
      expect(() => service.getSecretKey()).toThrow(
        'FATAL AUTHENTICATION ERROR: Neither AUTH_SESSION_SECRET nor JWT_SECRET is configured',
      );
    });

    it('falls back to development secret if neither secret is configured in development', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        return null;
      });
      expect(service.getSecretKey()).toBe('blood-bank-admin-secure-auth-secret-key-2026');
    });

    it('throws fatal error in production when secret is short or default placeholder', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'AUTH_SESSION_SECRET') return 'short-secret';
        if (key === 'NODE_ENV') return 'production';
        return null;
      });
      expect(() => service.getSecretKey()).toThrow(
        'FATAL SECURITY CONFIGURATION ERROR: Production environment detected with an insecure',
      );
    });
  });

  describe('Password Hashing and Verification', () => {
    it('hashes password with random salt using scrypt', () => {
      const { hash, salt } = service.hashPassword('SuperSecret123!');
      expect(hash).toBeDefined();
      expect(salt).toBeDefined();
      expect(hash.length).toBe(128); // 64 bytes hex
    });

    it('verifies valid password with timing-safe comparison', () => {
      const { hash, salt } = service.hashPassword('MyPassword@2026');
      expect(service.verifyPassword('MyPassword@2026', hash, salt)).toBe(true);
    });

    it('rejects invalid password', () => {
      const { hash, salt } = service.hashPassword('MyPassword@2026');
      expect(service.verifyPassword('WrongPassword', hash, salt)).toBe(false);
    });
  });

  describe('Session Token Sign & Verify', () => {
    it('generates a tamper-evident session token and verifies it', () => {
      const token = service.generateSessionToken('admin-123', 'admin@bloodbank.org', AdminRole.SUPER_ADMIN);
      expect(token).toContain('.');

      const payload = service.verifySessionToken(token);
      expect(payload).toBeDefined();
      expect(payload.id).toBe('admin-123');
      expect(payload.email).toBe('admin@bloodbank.org');
      expect(payload.role).toBe(AdminRole.SUPER_ADMIN);
    });

    it('rejects tampered tokens', () => {
      const token = service.generateSessionToken('admin-123', 'admin@bloodbank.org', AdminRole.ADMIN);
      const [b64Payload, sig] = token.split('.');
      const tamperedToken = `${b64Payload}X.${sig}`;
      expect(service.verifySessionToken(tamperedToken)).toBeNull();
    });

    it('rejects expired tokens', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000000000);
      const token = service.generateSessionToken('admin-123', 'admin@bloodbank.org', AdminRole.ADMIN);
      // Fast forward past expiration (7 days)
      jest.spyOn(Date, 'now').mockReturnValue(1000000000000 + 8 * 24 * 60 * 60 * 1000);
      expect(service.verifySessionToken(token)).toBeNull();
      jest.restoreAllMocks();
    });
  });

  describe('Bootstrap Admin Account (seedDefaultAdminIfEmpty)', () => {
    it('does NOT create admin if database already contains an admin', async () => {
      mockAdminModel.countDocuments.mockResolvedValue(1);
      await service.seedDefaultAdminIfEmpty();
      expect(mockAdminModel.create).not.toHaveBeenCalled();
    });

    it('creates default admin when count is 0 and INITIAL_ADMIN_PASSWORD is set', async () => {
      mockAdminModel.countDocuments.mockResolvedValue(0);
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'INITIAL_ADMIN_EMAIL') return 'admin@test.org';
        if (key === 'INITIAL_ADMIN_PASSWORD') return 'SecurePass!2026';
        if (key === 'AUTH_SESSION_SECRET') return 'test-secret-key-that-is-at-least-32-chars-long';
        return null;
      });

      await service.seedDefaultAdminIfEmpty();
      expect(mockAdminModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin@test.org',
          role: AdminRole.SUPER_ADMIN,
          isActive: true,
        }),
      );
    });
  });

  describe('validateSession', () => {
    it('throws UnauthorizedException when token signature is invalid', async () => {
      await expect(service.validateSession('invalid.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when admin is deactivated in database', async () => {
      const token = service.generateSessionToken('admin-inactive', 'inactive@test.org');
      mockAdminModel.findById.mockResolvedValue({
        _id: 'admin-inactive',
        isActive: false,
      });

      await expect(service.validateSession(token)).rejects.toThrow(
        'Admin account not found or deactivated.',
      );
    });

    it('returns admin profile when token and account are active', async () => {
      const token = service.generateSessionToken('admin-active', 'active@test.org', AdminRole.ADMIN);
      mockAdminModel.findById.mockResolvedValue({
        _id: 'admin-active',
        email: 'active@test.org',
        fullName: 'Active Admin',
        designation: 'Officer',
        role: AdminRole.ADMIN,
        isActive: true,
        lastLoginAt: new Date(),
      });

      const profile = await service.validateSession(token);
      expect(profile.id).toBe('admin-active');
      expect(profile.email).toBe('active@test.org');
      expect(profile.role).toBe(AdminRole.ADMIN);
    });
  });
});
