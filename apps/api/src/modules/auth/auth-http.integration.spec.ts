import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException, Controller, Get } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminRole } from './schemas/admin-user.schema';
import { AppController } from '../../app.controller';
import { AppService } from '../../app.service';
import { TestingController } from '../testing/testing.controller';
import { TestingService } from '../testing/testing.service';
import { DonorsController } from '../donors/donors.controller';
import { DonorsService } from '../donors/donors.service';
import { DonorEligibilityService } from '../donors/services/donor-eligibility.service';
import { DonorScreeningService } from '../donors/services/donor-screening.service';
import { InventoryController } from '../inventory/inventory.controller';
import { InventoryService } from '../inventory/inventory.service';
import { ExpiryRulesService } from '../inventory/services/expiry-rules.service';
import { BloodUnitsController } from '../blood-units/blood-units.controller';
import { BloodUnitsService } from '../blood-units/blood-units.service';

@Controller('unprotected-test')
class UnprotectedMockController {
  @Get('no-roles')
  getSecret() {
    return { data: 'should never be reached' };
  }
}

describe('HTTP Authentication & Authorization Integration (Phase 2)', () => {
  let app: INestApplication;
  let baseUrl: string;

  let authServiceMock: {
    login: jest.Mock;
    validateSession: jest.Mock;
    createOrUpdateAdmin: jest.Mock;
    findAllAdmins: jest.Mock;
    updateAdminStatus: jest.Mock;
    getSecretKey: jest.Mock;
  };

  let testingServiceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    updateTestResult: jest.Mock;
    completeTesting: jest.Mock;
  };

  let donorsServiceMock: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    updateStatus: jest.Mock;
  };

  let inventoryServiceMock: {
    findAll: jest.Mock;
    getSummary: jest.Mock;
    findExpiring: jest.Mock;
  };

  let bloodUnitsServiceMock: {
    findAwaitingTesting: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };

  beforeAll(async () => {
    authServiceMock = {
      login: jest.fn(),
      validateSession: jest.fn(),
      createOrUpdateAdmin: jest.fn(),
      findAllAdmins: jest.fn(),
      updateAdminStatus: jest.fn(),
      getSecretKey: jest.fn().mockReturnValue('test-secret-at-least-32-characters-long'),
    };

    testingServiceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      updateTestResult: jest.fn(),
      completeTesting: jest.fn(),
    };

    donorsServiceMock = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      updateStatus: jest.fn(),
    };

    inventoryServiceMock = {
      findAll: jest.fn(),
      getSummary: jest.fn(),
      findExpiring: jest.fn(),
    };

    bloodUnitsServiceMock = {
      findAwaitingTesting: jest.fn().mockResolvedValue({
        items: [{ _id: 'unit-1', unitCode: 'BU-100', bloodGroup: 'O_POSITIVE', status: 'TESTING' }],
        total: 1,
      }),
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ AUTH_SESSION_SECRET: 'test-secret-at-least-32-characters-long' })],
        }),
      ],
      controllers: [
        AppController,
        AuthController,
        TestingController,
        DonorsController,
        InventoryController,
        BloodUnitsController,
        UnprotectedMockController,
      ],
      providers: [
        AppService,
        { provide: AuthService, useValue: authServiceMock },
        { provide: TestingService, useValue: testingServiceMock },
        { provide: DonorsService, useValue: donorsServiceMock },
        { provide: DonorEligibilityService, useValue: { validateEligibility: jest.fn().mockResolvedValue({ isEligible: true }) } },
        { provide: DonorScreeningService, useValue: { createScreening: jest.fn(), findScreeningsByDonor: jest.fn(), findActiveScreeningForDonor: jest.fn() } },
        { provide: InventoryService, useValue: inventoryServiceMock },
        { provide: ExpiryRulesService, useValue: { calculateExpiryDate: jest.fn() } },
        { provide: BloodUnitsService, useValue: bloodUnitsServiceMock },
        Reflector,
        {
          provide: APP_GUARD,
          useClass: AdminAuthGuard,
        },
        {
          provide: APP_GUARD,
          useClass: RolesGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address.port;
    baseUrl = 'http://127.0.0.1:' + port + '/api';
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Fail-Closed Security Policy', () => {
    it('rejects authenticated requests to endpoints without @Roles() with HTTP 403 Forbidden', async () => {
      authServiceMock.validateSession.mockResolvedValue({
        id: 'user-1',
        email: 'user@bloodbank.org',
        role: AdminRole.SUPER_ADMIN,
      });

      const response = await fetch(baseUrl + '/unprotected-test/no-roles', {
        headers: { Authorization: 'Bearer valid.token' },
      });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.message).toContain('Protected endpoint has no declared role metadata (fail-closed security policy)');
    });
  });

  describe('2. Public Endpoints (@Public)', () => {
    it('GET /api/health allows unauthenticated public access (HTTP 200)', async () => {
      const response = await fetch(baseUrl + '/health');
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toHaveProperty('status', 'ok');
    });

    it('POST /api/auth/login allows unauthenticated public access (HTTP 200)', async () => {
      authServiceMock.login.mockResolvedValue({
        token: 'signed.test.jwt.token',
        admin: {
          id: 'admin-1',
          email: 'admin@bloodbank.org',
          role: AdminRole.ADMIN,
        },
      });

      const response = await fetch(baseUrl + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@bloodbank.org',
          password: 'Password123!',
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.token).toBe('signed.test.jwt.token');
    });
  });

  describe('3. Staff Account Governance (SUPER_ADMIN Only)', () => {
    it('GET /api/auth/admins allows SUPER_ADMIN (HTTP 200)', async () => {
      authServiceMock.validateSession.mockResolvedValue({
        id: 'super-1',
        email: 'super@bloodbank.org',
        role: AdminRole.SUPER_ADMIN,
      });
      authServiceMock.findAllAdmins.mockResolvedValue([
        { id: 'admin-1', email: 'admin@bloodbank.org', role: AdminRole.ADMIN, isActive: true },
      ]);

      const response = await fetch(baseUrl + '/auth/admins', {
        headers: { Authorization: 'Bearer super.token' },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
    });

    it('GET /api/auth/admins denies standard ADMIN (HTTP 403 Forbidden)', async () => {
      authServiceMock.validateSession.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@bloodbank.org',
        role: AdminRole.ADMIN,
      });

      const response = await fetch(baseUrl + '/auth/admins', {
        headers: { Authorization: 'Bearer admin.token' },
      });

      expect(response.status).toBe(403);
    });

    it('GET /api/auth/admins denies LAB_TECHNICIAN (HTTP 403 Forbidden)', async () => {
      authServiceMock.validateSession.mockResolvedValue({
        id: 'lab-1',
        email: 'lab@bloodbank.org',
        role: AdminRole.LAB_TECHNICIAN,
      });

      const response = await fetch(baseUrl + '/auth/admins', {
        headers: { Authorization: 'Bearer lab.token' },
      });

      expect(response.status).toBe(403);
    });

    it('PATCH /api/auth/admins/:id/status allows SUPER_ADMIN to toggle status (HTTP 200)', async () => {
      authServiceMock.validateSession.mockResolvedValue({
        id: 'super-1',
        email: 'super@bloodbank.org',
        role: AdminRole.SUPER_ADMIN,
      });
      authServiceMock.updateAdminStatus.mockResolvedValue({
        message: 'Account status updated successfully.',
      });

      const response = await fetch(baseUrl + '/auth/admins/admin-2/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer super.token',
        },
        body: JSON.stringify({ isActive: false }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.message).toContain('Account status updated');
    });

    it('PATCH /api/auth/admins/:id/status rejects self-deactivation with HTTP 400', async () => {
      authServiceMock.validateSession.mockResolvedValue({
        id: 'super-1',
        email: 'super@bloodbank.org',
        role: AdminRole.SUPER_ADMIN,
      });
      authServiceMock.updateAdminStatus.mockRejectedValue(
        new BadRequestException('You cannot deactivate your own account.'),
      );

      const response = await fetch(baseUrl + '/auth/admins/super-1/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer super.token',
        },
        body: JSON.stringify({ isActive: false }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('4. LAB_TECHNICIAN Scoped Workstation Access', () => {
    const labTechUser = {
      id: 'lab-tech-1',
      email: 'lab@hospital.org',
      role: AdminRole.LAB_TECHNICIAN,
    };

    it('GET /api/testing allows LAB_TECHNICIAN (HTTP 200)', async () => {
      authServiceMock.validateSession.mockResolvedValue(labTechUser);
      testingServiceMock.findAll.mockResolvedValue({
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });

      const response = await fetch(baseUrl + '/testing', {
        headers: { Authorization: 'Bearer lab.token' },
      });

      expect(response.status).toBe(200);
    });

    it('GET /api/blood-units/awaiting-testing allows LAB_TECHNICIAN (HTTP 200)', async () => {
      authServiceMock.validateSession.mockResolvedValue(labTechUser);
      bloodUnitsServiceMock.findAwaitingTesting.mockResolvedValue({
        items: [{ _id: 'unit-1', unitCode: 'BU-100', bloodGroup: 'O_POSITIVE', status: 'TESTING' }],
        total: 1,
      });

      const response = await fetch(baseUrl + '/blood-units/awaiting-testing', {
        headers: { Authorization: 'Bearer lab.token' },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toHaveLength(1);
    });

    it('GET /api/blood-units denies generic inventory listing to LAB_TECHNICIAN (HTTP 403 Forbidden)', async () => {
      authServiceMock.validateSession.mockResolvedValue(labTechUser);

      const response = await fetch(baseUrl + '/blood-units', {
        headers: { Authorization: 'Bearer lab.token' },
      });

      expect(response.status).toBe(403);
    });

    it('GET /api/donors denies donor registry access to LAB_TECHNICIAN (HTTP 403 Forbidden)', async () => {
      authServiceMock.validateSession.mockResolvedValue(labTechUser);

      const response = await fetch(baseUrl + '/donors', {
        headers: { Authorization: 'Bearer lab.token' },
      });

      expect(response.status).toBe(403);
    });

    it('GET /api/inventory denies general inventory access to LAB_TECHNICIAN (HTTP 403 Forbidden)', async () => {
      authServiceMock.validateSession.mockResolvedValue(labTechUser);

      const response = await fetch(baseUrl + '/inventory', {
        headers: { Authorization: 'Bearer lab.token' },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('5. Operational ADMIN Permissions', () => {
    const adminUser = {
      id: 'admin-1',
      email: 'admin@hospital.org',
      role: AdminRole.ADMIN,
    };

    it('GET /api/donors allows ADMIN (HTTP 200)', async () => {
      authServiceMock.validateSession.mockResolvedValue(adminUser);
      donorsServiceMock.findAll.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      const response = await fetch(baseUrl + '/donors', {
        headers: { Authorization: 'Bearer admin.token' },
      });

      expect(response.status).toBe(200);
    });

    it('GET /api/inventory allows ADMIN (HTTP 200)', async () => {
      authServiceMock.validateSession.mockResolvedValue(adminUser);
      inventoryServiceMock.findAll.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const response = await fetch(baseUrl + '/inventory', {
        headers: { Authorization: 'Bearer admin.token' },
      });

      expect(response.status).toBe(200);
    });

    it('GET /api/testing allows ADMIN (HTTP 200)', async () => {
      authServiceMock.validateSession.mockResolvedValue(adminUser);
      testingServiceMock.findAll.mockResolvedValue({
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });

      const response = await fetch(baseUrl + '/testing', {
        headers: { Authorization: 'Bearer admin.token' },
      });

      expect(response.status).toBe(200);
    });
  });
});