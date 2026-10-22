import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthService } from './auth.service';
import { AdminUser, AdminRole } from './schemas/admin-user.schema';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditActionType, AuditEntityType } from '../audit-logs/constants/audit-log.constants';

describe('Multi-Staff Account Management & Governance (Phase 2)', () => {
  let service: AuthService;
  let mockAdminModel: any;
  let mockAuditLogsService: any;
  let mockConfigService: any;

  // In-memory store simulating MongoDB admins collection
  let inMemoryAdmins: any[] = [];

  beforeEach(async () => {
    inMemoryAdmins = [];

    mockAdminModel = {
      countDocuments: jest.fn().mockImplementation((filter?: any) => {
        if (!filter) return inMemoryAdmins.length;
        return inMemoryAdmins.filter((a) => {
          if (filter.role && a.role !== filter.role) return false;
          if (filter.isActive !== undefined && a.isActive !== filter.isActive) return false;
          return true;
        }).length;
      }),
      create: jest.fn().mockImplementation((doc: any) => {
        const created = {
          _id: new Types.ObjectId(),
          ...doc,
          createdAt: new Date(),
          updatedAt: new Date(),
          save: jest.fn().mockResolvedValue(true),
        };
        inMemoryAdmins.push(created);
        return created;
      }),
      findOne: jest.fn().mockImplementation((filter: any) => {
        if (filter.email) {
          return inMemoryAdmins.find((a) => a.email.toLowerCase() === filter.email.toLowerCase()) || null;
        }
        return null;
      }),
      findById: jest.fn().mockImplementation((id: any) => {
        return inMemoryAdmins.find((a) => a._id.toString() === id.toString()) || null;
      }),
      find: jest.fn().mockImplementation((filter: any = {}) => {
        return {
          select: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              lean: jest.fn().mockImplementation(() => {
                let results = [...inMemoryAdmins];
                if (filter.role) {
                  results = results.filter((a) => a.role === filter.role);
                }
                if (filter.isActive !== undefined) {
                  results = results.filter((a) => a.isActive === filter.isActive);
                }
                if (filter.$or) {
                  results = results.filter((a) => {
                    return filter.$or.some((cond: any) => {
                      if (cond.fullName?.$regex) {
                        return new RegExp(cond.fullName.$regex, cond.fullName.$options).test(a.fullName);
                      }
                      if (cond.email?.$regex) {
                        return new RegExp(cond.email.$regex, cond.email.$options).test(a.email);
                      }
                      if (cond.designation?.$regex) {
                        return new RegExp(cond.designation.$regex, cond.designation.$options).test(a.designation);
                      }
                      return false;
                    });
                  });
                }
                // strip password fields
                return results.map(({ passwordHash, passwordSalt, ...rest }) => rest);
              }),
            }),
          }),
        };
      }),
    };

    mockAuditLogsService = {
      logEvent: jest.fn().mockResolvedValue(true),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'AUTH_SESSION_SECRET') return 'test-secure-signing-key-32-chars-long';
        if (key === 'NODE_ENV') return 'development';
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
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('1. Multiple Accounts Under the Same Role', () => {
    it('allows Super Admin to create multiple Tester / Lab Tech accounts', async () => {
      const superAdminActor = {
        id: new Types.ObjectId().toString(),
        fullName: 'Dr. Sarah Connor',
        email: 'sarah.connor@bloodbank.org',
        role: AdminRole.SUPER_ADMIN,
      };

      // 1. Create Tester 1
      const tester1 = await service.createOrUpdateAdmin(
        {
          email: 'tester1@bloodbank.org',
          password: 'Password123!',
          fullName: 'Tester One (Hematology)',
          designation: 'Senior Screening Specialist',
          role: AdminRole.LAB_TECHNICIAN,
        },
        superAdminActor,
      );

      // 2. Create Tester 2
      const tester2 = await service.createOrUpdateAdmin(
        {
          email: 'tester2@bloodbank.org',
          password: 'Password123!',
          fullName: 'Tester Two (Serology)',
          designation: 'Infectious Disease Screening Technologist',
          role: AdminRole.LAB_TECHNICIAN,
        },
        superAdminActor,
      );

      expect(tester1.id).toBeDefined();
      expect(tester2.id).toBeDefined();
      expect(tester1.id.toString()).not.toEqual(tester2.id.toString());
      expect(tester1.role).toBe(AdminRole.LAB_TECHNICIAN);
      expect(tester2.role).toBe(AdminRole.LAB_TECHNICIAN);

      // Verify audit logs generated for both
      expect(mockAuditLogsService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActionType.STAFF_ACCOUNT_CREATED,
          entityIdentifier: 'tester1@bloodbank.org',
          actorName: superAdminActor.fullName,
        }),
      );
      expect(mockAuditLogsService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActionType.STAFF_ACCOUNT_CREATED,
          entityIdentifier: 'tester2@bloodbank.org',
          actorName: superAdminActor.fullName,
        }),
      );
    });

    it('allows Super Admin to create multiple Finance Receptionist accounts', async () => {
      const superAdminActor = {
        id: new Types.ObjectId().toString(),
        fullName: 'Dr. Sarah Connor',
        email: 'sarah.connor@bloodbank.org',
        role: AdminRole.SUPER_ADMIN,
      };

      const rec1 = await service.createOrUpdateAdmin(
        {
          email: 'receptionist1@bloodbank.org',
          password: 'Password123!',
          fullName: 'Receptionist One (Morning Shift)',
          role: AdminRole.FINANCE_RECEPTIONIST,
        },
        superAdminActor,
      );

      const rec2 = await service.createOrUpdateAdmin(
        {
          email: 'receptionist2@bloodbank.org',
          password: 'Password123!',
          fullName: 'Receptionist Two (Evening Shift)',
          role: AdminRole.FINANCE_RECEPTIONIST,
        },
        superAdminActor,
      );

      expect(rec1.id.toString()).not.toEqual(rec2.id.toString());
      expect(rec1.role).toBe(AdminRole.FINANCE_RECEPTIONIST);
      expect(rec2.role).toBe(AdminRole.FINANCE_RECEPTIONIST);
    });

    it('allows authorized Super Admin to create a peer Super Admin account', async () => {
      const primarySuperAdmin = {
        id: new Types.ObjectId().toString(),
        fullName: 'Primary Super Admin',
        email: 'primary.super@bloodbank.org',
        role: AdminRole.SUPER_ADMIN,
      };

      const peerSuperAdmin = await service.createOrUpdateAdmin(
        {
          email: 'deputy.director@bloodbank.org',
          password: 'DirectorPass2026!',
          fullName: 'Deputy Medical Director',
          designation: 'Co-Director of Blood Bank',
          role: AdminRole.SUPER_ADMIN,
        },
        primarySuperAdmin,
      );

      expect(peerSuperAdmin.role).toBe(AdminRole.SUPER_ADMIN);
      expect(peerSuperAdmin.fullName).toBe('Deputy Medical Director');
      expect(mockAuditLogsService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActionType.STAFF_ACCOUNT_CREATED,
          entityIdentifier: 'deputy.director@bloodbank.org',
        }),
      );
    });
  });

  describe('2. Independent Authentication & Distinct Identities', () => {
    it('authenticates Tester 1 and Tester 2 independently with distinct session tokens and identities', async () => {
      // Provision Tester 1
      await service.createOrUpdateAdmin({
        email: 'tester.alpha@bloodbank.org',
        password: 'PasswordAlpha123!',
        fullName: 'Alice Walker',
        role: AdminRole.LAB_TECHNICIAN,
      });

      // Provision Tester 2
      await service.createOrUpdateAdmin({
        email: 'tester.beta@bloodbank.org',
        password: 'PasswordBeta123!',
        fullName: 'Bob Martinez',
        role: AdminRole.LAB_TECHNICIAN,
      });

      // Login as Tester 1
      const login1 = await service.login({
        email: 'tester.alpha@bloodbank.org',
        password: 'PasswordAlpha123!',
      });

      // Login as Tester 2
      const login2 = await service.login({
        email: 'tester.beta@bloodbank.org',
        password: 'PasswordBeta123!',
      });

      expect(login1.admin.id.toString()).not.toEqual(login2.admin.id.toString());
      expect(login1.admin.fullName).toBe('Alice Walker');
      expect(login2.admin.fullName).toBe('Bob Martinez');
      expect(login1.token).not.toEqual(login2.token);

      // Verify sessions decode to correct distinct actors
      const session1 = service.verifySessionToken(login1.token);
      const session2 = service.verifySessionToken(login2.token);

      expect(session1.id).toBe(login1.admin.id.toString());
      expect(session1.email).toBe('tester.alpha@bloodbank.org');
      expect(session2.id).toBe(login2.admin.id.toString());
      expect(session2.email).toBe('tester.beta@bloodbank.org');
    });
  });

  describe('3. Searching, Filtering & Viewing Staff Directory', () => {
    beforeEach(async () => {
      await service.createOrUpdateAdmin({
        email: 'director@bloodbank.org',
        password: 'Pass123!',
        fullName: 'Dr. Arthur Director',
        designation: 'Director of Blood Bank & Operations',
        role: AdminRole.SUPER_ADMIN,
      });
      await service.createOrUpdateAdmin({
        email: 'ops.admin@bloodbank.org',
        password: 'Pass123!',
        fullName: 'Clara Operations',
        designation: 'Blood Bank Officer',
        role: AdminRole.ADMIN,
      });
      await service.createOrUpdateAdmin({
        email: 'lab.tech1@bloodbank.org',
        password: 'Pass123!',
        fullName: 'David Lab Specialist',
        designation: 'Serology Analyst',
        role: AdminRole.LAB_TECHNICIAN,
      });
      await service.createOrUpdateAdmin({
        email: 'reception.front@bloodbank.org',
        password: 'Pass123!',
        fullName: 'Eva Receptionist',
        designation: 'Billing Desk Officer',
        role: AdminRole.FINANCE_RECEPTIONIST,
      });
    });

    it('returns all staff accounts without sensitive password hashes', async () => {
      const all = await service.findAllAdmins();
      expect(all).toHaveLength(4);
      all.forEach((acc: any) => {
        expect(acc).not.toHaveProperty('passwordHash');
        expect(acc).not.toHaveProperty('passwordSalt');
      });
    });

    it('filters staff by role correctly', async () => {
      const labs = await service.findAllAdmins({ role: AdminRole.LAB_TECHNICIAN });
      expect(labs).toHaveLength(1);
      expect(labs[0].email).toBe('lab.tech1@bloodbank.org');
    });

    it('searches staff by keyword matching name, email, or designation', async () => {
      const byName = await service.findAllAdmins({ search: 'Clara' });
      expect(byName).toHaveLength(1);
      expect(byName[0].fullName).toBe('Clara Operations');

      const byDesignation = await service.findAllAdmins({ search: 'Serology' });
      expect(byDesignation).toHaveLength(1);
      expect(byDesignation[0].email).toBe('lab.tech1@bloodbank.org');
    });
  });

  describe('4. Updating Staff Accounts & Password Resets', () => {
    it('updates staff full name, designation, and role with audit logging', async () => {
      const superAdminActor = {
        id: new Types.ObjectId().toString(),
        fullName: 'Super Admin One',
        email: 'super1@bloodbank.org',
        role: AdminRole.SUPER_ADMIN,
      };

      const staff = await service.createOrUpdateAdmin({
        email: 'staff.edit@bloodbank.org',
        password: 'Pass123!',
        fullName: 'Junior Officer',
        designation: 'Trainee Officer',
        role: AdminRole.ADMIN,
      });

      const updated = await service.updateAdmin(
        staff.id.toString(),
        {
          fullName: 'Senior Officer John',
          designation: 'Head of Clinical Inventory',
          role: AdminRole.ADMIN,
        },
        superAdminActor,
      );

      expect(updated.fullName).toBe('Senior Officer John');
      expect(updated.designation).toBe('Head of Clinical Inventory');
      expect(mockAuditLogsService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActionType.STAFF_ACCOUNT_UPDATED,
          entityIdentifier: 'staff.edit@bloodbank.org',
          actorName: superAdminActor.fullName,
        }),
      );
    });

    it('resets staff password using scrypt hash without exposing credentials', async () => {
      const superAdminActor = {
        id: new Types.ObjectId().toString(),
        fullName: 'Super Admin One',
        email: 'super1@bloodbank.org',
        role: AdminRole.SUPER_ADMIN,
      };

      const staff = await service.createOrUpdateAdmin({
        email: 'staff.pwd@bloodbank.org',
        password: 'OldPassword123!',
        fullName: 'Password Change User',
        role: AdminRole.ADMIN,
      });

      // Reset password to new one
      await service.updateAdmin(
        staff.id.toString(),
        {
          password: 'NewStrongPassword2026!',
        },
        superAdminActor,
      );

      // Old password should fail
      await expect(
        service.login({
          email: 'staff.pwd@bloodbank.org',
          password: 'OldPassword123!',
        }),
      ).rejects.toThrow('Invalid email or password.');

      // New password should succeed
      const loginResult = await service.login({
        email: 'staff.pwd@bloodbank.org',
        password: 'NewStrongPassword2026!',
      });
      expect(loginResult.token).toBeDefined();
    });
  });

  describe('5. Security Safeguards & Protection Policies', () => {
    it('prevents self-deactivation of current Super Admin account', async () => {
      const superId = new Types.ObjectId().toString();
      inMemoryAdmins.push({
        _id: superId,
        email: 'self@bloodbank.org',
        fullName: 'Self Admin',
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      });

      await expect(
        service.updateAdminStatus(superId, false, superId),
      ).rejects.toThrow('Security violation: You cannot deactivate your own active account.');
    });

    it('prevents deactivating the last remaining active Super Admin', async () => {
      const callerId = new Types.ObjectId().toString();
      const targetSuperId = new Types.ObjectId().toString();

      // Only one Super Admin in the system
      inMemoryAdmins.push({
        _id: targetSuperId,
        email: 'sole.super@bloodbank.org',
        fullName: 'Sole Super Admin',
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      });

      await expect(
        service.updateAdminStatus(targetSuperId, false, callerId),
      ).rejects.toThrow('Security violation: Cannot deactivate the last remaining active Super Administrator.');
    });

    it('prevents a Super Admin from demoting their own account', async () => {
      const selfSuperId = new Types.ObjectId().toString();
      const selfSuper = {
        _id: selfSuperId,
        email: 'super.demote@bloodbank.org',
        fullName: 'Demoting Admin',
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };
      inMemoryAdmins.push(selfSuper);

      await expect(
        service.updateAdmin(
          selfSuperId,
          { role: AdminRole.ADMIN },
          { id: selfSuperId, fullName: 'Demoting Admin', role: AdminRole.SUPER_ADMIN },
        ),
      ).rejects.toThrow('Security violation: You cannot demote your own Super Admin account.');
    });

    it('prevents demoting the last remaining active Super Admin to another role', async () => {
      const callerId = new Types.ObjectId().toString();
      const targetSuperId = new Types.ObjectId().toString();

      inMemoryAdmins.push({
        _id: targetSuperId,
        email: 'sole.super@bloodbank.org',
        fullName: 'Sole Super Admin',
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      });

      await expect(
        service.updateAdmin(
          targetSuperId,
          { role: AdminRole.ADMIN },
          { id: callerId, fullName: 'Caller Admin', role: AdminRole.SUPER_ADMIN },
        ),
      ).rejects.toThrow('Security violation: Cannot demote the last remaining active Super Administrator.');
    });
  });
});
