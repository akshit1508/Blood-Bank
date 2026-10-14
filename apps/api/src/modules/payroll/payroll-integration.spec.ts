import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { EmployeesService } from './services/employees.service';
import { SalaryStructuresService } from './services/salary-structures.service';
import { PayrollService } from './services/payroll.service';
import { Employee } from './schemas/employee.schema';
import { SalaryStructure } from './schemas/salary-structure.schema';
import { MonthlyPayrollRun } from './schemas/monthly-payroll-run.schema';
import { SalarySlip } from './schemas/salary-slip.schema';
import { SalaryDisbursement } from './schemas/salary-disbursement.schema';
import {
  EmployeeDepartment,
  EmploymentType,
  EmployeeStatus,
  PayrollRunStatus,
  SalarySlipPaymentStatus,
  DisbursementPaymentMethod,
} from './constants/payroll.constants';
import { CurrencyUtil } from '../../common/utils/currency.util';

describe('Phase 6 — Employee Management & Payroll Integration Suite', () => {
  let employeesService: EmployeesService;
  let salaryStructuresService: SalaryStructuresService;
  let payrollService: PayrollService;

  let employeeStore: any[] = [];
  let structureStore: any[] = [];
  let runStore: any[] = [];
  let slipStore: any[] = [];
  let disbursementStore: any[] = [];

  const mockSuperAdmin = {
    id: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    email: 'superadmin@bloodbank.org',
    role: 'SUPER_ADMIN',
    fullName: 'Chief Operations Officer',
  };

  beforeEach(async () => {
    employeeStore = [];
    structureStore = [];
    runStore = [];
    slipStore = [];
    disbursementStore = [];

    // --- Mock Employee Model ---
    const mockEmployeeModel: any = jest.fn().mockImplementation((doc) => {
      const instance = {
        _id: doc._id || new Types.ObjectId(),
        ...doc,
        save: jest.fn().mockImplementation(async function () {
          const idx = employeeStore.findIndex((e) => e._id.toString() === this._id.toString());
          if (idx >= 0) {
            employeeStore[idx] = { ...this };
          } else {
            employeeStore.push({ ...this });
          }
          return this;
        }),
      };
      return instance;
    });

    mockEmployeeModel.find = jest.fn().mockImplementation((filter: any, projection: any) => {
      const getResults = () => {
        let res = [...employeeStore];
        if (filter?.status?.$in) {
          res = res.filter((e) => filter.status.$in.includes(e.status));
        }
        if (projection?.bankDetails === 0) {
          res = res.map(({ bankDetails, ...rest }) => rest);
        }
        return res;
      };
      return {
        sort: jest.fn().mockReturnValue({
          lean: () => ({ exec: async () => getResults() }),
          exec: async () => getResults(),
          then: (resolve: any) => resolve(getResults()),
        }),
        lean: () => ({ exec: async () => getResults() }),
        exec: async () => getResults(),
        then: (resolve: any) => resolve(getResults()),
      };
    });

    mockEmployeeModel.findOne = jest.fn().mockImplementation((query: any, projection: any) => ({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockImplementation(async () => {
            if (employeeStore.length === 0) return null;
            return employeeStore[employeeStore.length - 1];
          }),
        }),
      }),
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockImplementation(async () => {
          return employeeStore.find((e) => {
            if (query.email && e.email === query.email) return true;
            if (query.employeeCode && e.employeeCode === query.employeeCode) return true;
            return false;
          }) || null;
        }),
      }),
      then: (resolve: any) => {
        const found = employeeStore.find((e) => {
          if (query.email && e.email === query.email) {
            if (query._id?.$ne && e._id.toString() === query._id.$ne.toString()) return false;
            return true;
          }
          if (query.employeeCode && e.employeeCode === query.employeeCode) return true;
          return false;
        });
        return resolve(found ? { ...found } : null);
      },
    }));

    mockEmployeeModel.findById = jest.fn().mockImplementation((id: string) => {
      const found = employeeStore.find((e) => e._id.toString() === id.toString());
      if (!found) {
        return {
          lean: () => ({ exec: async () => null }),
          then: (res: any) => res(null),
        };
      }
      const instance = {
        ...found,
        save: jest.fn().mockImplementation(async function () {
          const idx = employeeStore.findIndex((e) => e._id.toString() === this._id.toString());
          if (idx >= 0) employeeStore[idx] = { ...this };
          return this;
        }),
      };
      return {
        ...instance,
        lean: () => ({
          exec: async () => {
            return { ...found };
          },
        }),
        then: (res: any) => res(instance),
      };
    });

    mockEmployeeModel.countDocuments = jest.fn().mockImplementation(async (filter: any) => {
      let res = [...employeeStore];
      if (filter?.status?.$in) {
        res = res.filter((e) => filter.status.$in.includes(e.status));
      }
      return res.length;
    });

    // --- Mock Salary Structure Model ---
    const mockStructureModel: any = jest.fn().mockImplementation((doc) => {
      const instance = {
        _id: doc._id || new Types.ObjectId(),
        ...doc,
        save: jest.fn().mockImplementation(async function () {
          const idx = structureStore.findIndex((s) => s._id.toString() === this._id.toString());
          if (idx >= 0) {
            structureStore[idx] = { ...this };
          } else {
            structureStore.push({ ...this });
          }
          return this;
        }),
      };
      return instance;
    });

    mockStructureModel.findOne = jest.fn().mockImplementation((query: any) => {
      const found = structureStore.find((s) => {
        if (query.employeeId && s.employeeId.toString() !== query.employeeId.toString()) return false;
        if (query.isActive !== undefined && s.isActive !== query.isActive) return false;
        return true;
      });

      if (!found) {
        return {
          sort: () => ({
            lean: () => ({ exec: async () => null }),
          }),
          then: (res: any) => res(null),
        };
      }

      const instance = {
        ...found,
        save: jest.fn().mockImplementation(async function () {
          const idx = structureStore.findIndex((s) => s._id.toString() === this._id.toString());
          if (idx >= 0) structureStore[idx] = { ...this };
          return this;
        }),
      };

      return {
        ...instance,
        sort: () => ({
          lean: () => ({ exec: async () => found }),
        }),
        then: (res: any) => res(instance),
      };
    });

    mockStructureModel.find = jest.fn().mockImplementation((query: any) => {
      let res = [...structureStore];
      if (query?.employeeId?.$in) {
        const idStrings = query.employeeId.$in.map((id: any) => id.toString());
        res = res.filter((s) => idStrings.includes(s.employeeId.toString()));
      }
      if (query?.isActive !== undefined) {
        res = res.filter((s) => s.isActive === query.isActive);
      }
      return {
        sort: () => ({
          lean: () => ({
            exec: async () => res,
          }),
          exec: async () => res,
          then: (resolve: any) => resolve(res),
        }),
        lean: () => ({
          exec: async () => res,
        }),
        exec: async () => res,
        then: (resolve: any) => resolve(res),
      };
    });

    // --- Mock Monthly Payroll Run Model ---
    const mockRunModel: any = jest.fn().mockImplementation((doc) => {
      const instance = {
        _id: doc._id || new Types.ObjectId(),
        ...doc,
        save: jest.fn().mockImplementation(async function () {
          const idx = runStore.findIndex((r) => r._id.toString() === this._id.toString());
          if (idx >= 0) {
            runStore[idx] = { ...this };
          } else {
            runStore.push({ ...this });
          }
          return this;
        }),
      };
      return instance;
    });

    mockRunModel.findOne = jest.fn().mockImplementation((query: any) => {
      const found = runStore.find((r) => r.payrollPeriod === query.payrollPeriod);
      return {
        lean: () => ({ exec: async () => found || null }),
        then: (res: any) => res(found ? { ...found } : null),
      };
    });

    mockRunModel.findById = jest.fn().mockImplementation((id: string) => {
      const found = runStore.find((r) => r._id.toString() === id.toString());
      if (!found) {
        return {
          then: (res: any) => res(null),
        };
      }
      const instance = {
        ...found,
        save: jest.fn().mockImplementation(async function () {
          const idx = runStore.findIndex((r) => r._id.toString() === this._id.toString());
          if (idx >= 0) runStore[idx] = { ...this };
          return this;
        }),
      };
      return {
        ...instance,
        then: (res: any) => res(instance),
      };
    });

    mockRunModel.find = jest.fn().mockImplementation((query: any) => ({
      sort: () => ({
        lean: () => ({
          exec: async () => [...runStore],
        }),
      }),
      lean: () => ({
        exec: async () => [...runStore],
      }),
    }));

    // --- Mock Salary Slip Model ---
    const mockSlipModel: any = jest.fn().mockImplementation((doc) => {
      const instance = {
        _id: doc._id || new Types.ObjectId(),
        ...doc,
        save: jest.fn().mockImplementation(async function () {
          const idx = slipStore.findIndex((s) => s._id.toString() === this._id.toString());
          if (idx >= 0) {
            slipStore[idx] = { ...this };
          } else {
            slipStore.push({ ...this });
          }
          return this;
        }),
      };
      return instance;
    });

    mockSlipModel.insertMany = jest.fn().mockImplementation(async (docs: any[]) => {
      for (const d of docs) {
        slipStore.push({
          _id: new Types.ObjectId(),
          ...d,
        });
      }
      return docs;
    });

    mockSlipModel.findById = jest.fn().mockImplementation((id: string) => {
      const found = slipStore.find((s) => s._id.toString() === id.toString());
      if (!found) {
        return {
          then: (res: any) => res(null),
        };
      }
      const instance = {
        ...found,
        save: jest.fn().mockImplementation(async function () {
          const idx = slipStore.findIndex((s) => s._id.toString() === this._id.toString());
          if (idx >= 0) slipStore[idx] = { ...this };
          return this;
        }),
      };
      return {
        ...instance,
        then: (res: any) => res(instance),
      };
    });

    mockSlipModel.find = jest.fn().mockImplementation((query: any) => {
      let res = [...slipStore];
      if (query.payrollRunId) {
        res = res.filter((s) => s.payrollRunId.toString() === query.payrollRunId.toString());
      }
      if (query?.paymentStatus?.$ne) {
        res = res.filter((s) => s.paymentStatus !== query.paymentStatus.$ne);
      }
      return {
        sort: () => ({
          lean: () => ({
            exec: async () => res,
          }),
        }),
        then: (resolve: any) => resolve(res),
      };
    });

    // --- Mock Salary Disbursement Model ---
    const mockDisbursementModel: any = jest.fn().mockImplementation((doc) => {
      const instance = {
        _id: doc._id || new Types.ObjectId(),
        ...doc,
        save: jest.fn().mockImplementation(async function () {
          disbursementStore.push({ ...this });
          return this;
        }),
      };
      return instance;
    });

    mockDisbursementModel.find = jest.fn().mockImplementation((query: any) => ({
      sort: () => ({
        lean: () => ({
          exec: async () => {
            return disbursementStore.filter(
              (d) => d.salarySlipId.toString() === query.salarySlipId.toString(),
            );
          },
        }),
      }),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        SalaryStructuresService,
        PayrollService,
        { provide: getModelToken(Employee.name), useValue: mockEmployeeModel },
        { provide: getModelToken(SalaryStructure.name), useValue: mockStructureModel },
        { provide: getModelToken(MonthlyPayrollRun.name), useValue: mockRunModel },
        { provide: getModelToken(SalarySlip.name), useValue: mockSlipModel },
        { provide: getModelToken(SalaryDisbursement.name), useValue: mockDisbursementModel },
      ],
    }).compile();

    employeesService = module.get<EmployeesService>(EmployeesService);
    salaryStructuresService = module.get<SalaryStructuresService>(SalaryStructuresService);
    payrollService = module.get<PayrollService>(PayrollService);
  });

  describe('1. Employee Management & Code Generation', () => {
    it('creates an employee with sequential code EMP-0001', async () => {
      const emp = await employeesService.createEmployee({
        firstName: 'Vikram',
        lastName: 'Singhania',
        email: 'vikram.s@bloodbank.org',
        phone: '9876543210',
        designation: 'Senior Medical Officer',
        department: EmployeeDepartment.MEDICAL_CLINICAL,
        employmentType: EmploymentType.PERMANENT,
        dateOfJoining: '2026-01-15',
        bankDetails: {
          bankName: 'HDFC Bank',
          accountNumber: '50100234567890',
          ifscCode: 'HDFC0001234',
          accountHolderName: 'Vikram Singhania',
          panNumber: 'ABCDE1234F',
        },
      });

      expect(emp.employeeCode).toBe('EMP-0001');
      expect(emp.fullName).toBe('Vikram Singhania');
      expect(emp.status).toBe(EmployeeStatus.ACTIVE);
    });

    it('rejects employee creation with duplicate email', async () => {
      await employeesService.createEmployee({
        firstName: 'Priya',
        lastName: 'Nair',
        email: 'priya@bloodbank.org',
        phone: '9876500001',
        designation: 'Phlebotomist',
        department: EmployeeDepartment.PHLEBOTOMY_COLLECTION,
        dateOfJoining: '2026-02-01',
        bankDetails: {
          bankName: 'ICICI Bank',
          accountNumber: '1122334455',
          ifscCode: 'ICIC0001122',
          accountHolderName: 'Priya Nair',
        },
      });

      await expect(
        employeesService.createEmployee({
          firstName: 'Another',
          lastName: 'Nair',
          email: 'priya@bloodbank.org',
          phone: '9876500002',
          designation: 'Staff',
          department: EmployeeDepartment.PHLEBOTOMY_COLLECTION,
          dateOfJoining: '2026-02-01',
          bankDetails: {
            bankName: 'ICICI Bank',
            accountNumber: '9988776655',
            ifscCode: 'ICIC0001122',
            accountHolderName: 'Priya Nair',
          },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('sanitizes bank details for non-super admin callers', async () => {
      const emp = await employeesService.createEmployee({
        firstName: 'Ananya',
        lastName: 'Roy',
        email: 'ananya@bloodbank.org',
        phone: '9811223344',
        designation: 'Lab Technician',
        department: EmployeeDepartment.LABORATORY,
        dateOfJoining: '2026-03-01',
        bankDetails: {
          bankName: 'State Bank of India',
          accountNumber: '30291827364',
          ifscCode: 'SBIN0005544',
          accountHolderName: 'Ananya Roy',
        },
      });

      // Super Admin caller sees bankDetails
      const superAdminView = await employeesService.getEmployeeById(emp._id.toString(), true);
      expect(superAdminView.bankDetails).toBeDefined();
      expect(superAdminView.bankDetails.accountNumber).toBe('30291827364');

      // Standard Admin caller has bankDetails stripped
      const standardAdminView = await employeesService.getEmployeeById(emp._id.toString(), false);
      expect(standardAdminView.bankDetails).toBeUndefined();
      expect(standardAdminView.fullName).toBe('Ananya Roy');
    });

    it('creates an employee with empty emergency contact, empty PAN, and DD-MM-YYYY date format', async () => {
      const emp = await employeesService.createEmployee({
        firstName: 'Aayush',
        lastName: 'Yadav',
        email: 'yash@gmail.com',
        phone: '9999956479',
        designation: 'Tester',
        department: EmployeeDepartment.LABORATORY,
        employmentType: EmploymentType.PERMANENT,
        dateOfJoining: '14-10-2026',
        bankDetails: {
          bankName: 'SBI',
          accountNumber: '08966594944955494',
          ifscCode: 'SBI00021',
          accountHolderName: 'Aayush',
          panNumber: '',
        },
        emergencyContact: {
          name: '',
          phone: '',
          relationship: '',
        },
      });

      expect(emp.employeeCode).toMatch(/^EMP-\d{4}$/);
      expect(emp.fullName).toBe('Aayush Yadav');
      expect(emp.bankDetails.panNumber).toBeUndefined();
      expect(emp.emergencyContact).toBeUndefined();
      expect(emp.dateOfJoining).toBeInstanceOf(Date);
      expect(emp.dateOfJoining.getFullYear()).toBe(2026);
      expect(emp.dateOfJoining.getMonth()).toBe(9); // 0-indexed month: October = 9
      expect(emp.dateOfJoining.getDate()).toBe(14);
    });

    it('rejects invalid date strings with BadRequestException', async () => {
      await expect(
        employeesService.createEmployee({
          firstName: 'Invalid',
          lastName: 'DateTest',
          email: 'invaliddate@bloodbank.org',
          phone: '9000000000',
          designation: 'Tester',
          department: EmployeeDepartment.LABORATORY,
          dateOfJoining: 'not-a-valid-date',
          bankDetails: {
            bankName: 'Bank',
            accountNumber: '123456',
            ifscCode: 'IFSC0001',
            accountHolderName: 'Invalid Date',
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Salary Structures & Integer Paise Precision', () => {
    let testEmpId: string;

    beforeEach(async () => {
      const emp = await employeesService.createEmployee({
        firstName: 'Rajesh',
        lastName: 'Kumar',
        email: 'rajesh@bloodbank.org',
        phone: '9988776655',
        designation: 'Quality Officer',
        department: EmployeeDepartment.QUALITY_ASSURANCE,
        dateOfJoining: '2026-01-01',
        bankDetails: {
          bankName: 'Axis Bank',
          accountNumber: '918020012345678',
          ifscCode: 'UTIB0000123',
          accountHolderName: 'Rajesh Kumar',
        },
      });
      testEmpId = emp._id.toString();
    });

    it('creates active salary structure with exact integer paise calculations', async () => {
      const struct = await salaryStructuresService.createSalaryStructure(
        testEmpId,
        {
          effectiveFrom: '2026-01-01',
          basicSalary: 50000, // ₹50,000 -> 5,000,000 paise
          hra: 20000,        // ₹20,000 -> 2,000,000 paise
          allowances: 10000, // ₹10,000 -> 1,000,000 paise
          pfDeduction: 6000, // ₹6,000  -> 600,000 paise
          taxDeduction: 4000,// ₹4,000  -> 400,000 paise
        },
        mockSuperAdmin,
      );

      expect(struct.revisionNumber).toBe(1);
      expect(struct.isActive).toBe(true);
      expect(struct.basicSalaryPaise).toBe(5000000);
      expect(struct.grossSalaryPaise).toBe(8000000); // 50k + 20k + 10k = 80k -> 8,000,000 paise
      expect(struct.grossSalary).toBe(80000);
      expect(struct.netSalaryPaise).toBe(7000000);   // 80k - 10k = 70k -> 7,000,000 paise
      expect(struct.netSalary).toBe(70000);
    });

    it('rejects salary structure where deductions exceed gross earnings', async () => {
      await expect(
        salaryStructuresService.createSalaryStructure(
          testEmpId,
          {
            effectiveFrom: '2026-01-01',
            basicSalary: 10000,
            pfDeduction: 8000,
            taxDeduction: 5000, // Total deductions = 13,000 > gross 10,000
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('revises salary structure by deactivating previous revision and incrementing revisionNumber', async () => {
      // Revision 1
      await salaryStructuresService.createSalaryStructure(
        testEmpId,
        {
          effectiveFrom: '2026-01-01',
          basicSalary: 50000,
        },
        mockSuperAdmin,
      );

      // Revision 2
      const rev2 = await salaryStructuresService.createSalaryStructure(
        testEmpId,
        {
          effectiveFrom: '2026-07-01',
          basicSalary: 60000,
        },
        mockSuperAdmin,
      );

      expect(rev2.revisionNumber).toBe(2);
      expect(rev2.isActive).toBe(true);
      expect(rev2.basicSalary).toBe(60000);

      // Verify revision 1 was deactivated
      const rev1 = structureStore.find((s) => s.revisionNumber === 1);
      expect(rev1.isActive).toBe(false);
      expect(rev1.effectiveTo).toBeDefined();
    });
  });

  describe('3. Monthly Payroll Generation & Super Admin Approvals', () => {
    let emp1Id: string;
    let emp2Id: string;

    beforeEach(async () => {
      const e1 = await employeesService.createEmployee({
        firstName: 'Sunil',
        lastName: 'Rao',
        email: 'sunil@bloodbank.org',
        phone: '9911223344',
        designation: 'Senior Technologist',
        department: EmployeeDepartment.LABORATORY,
        dateOfJoining: '2026-01-01',
        bankDetails: {
          bankName: 'HDFC Bank',
          accountNumber: '111122223333',
          ifscCode: 'HDFC0001111',
          accountHolderName: 'Sunil Rao',
        },
      });
      emp1Id = e1._id.toString();

      const e2 = await employeesService.createEmployee({
        firstName: 'Meena',
        lastName: 'Iyer',
        email: 'meena@bloodbank.org',
        phone: '9922334455',
        designation: 'Inventory Coordinator',
        department: EmployeeDepartment.LOGISTICS_DISPATCH,
        dateOfJoining: '2026-01-01',
        bankDetails: {
          bankName: 'SBI',
          accountNumber: '444455556666',
          ifscCode: 'SBIN0002222',
          accountHolderName: 'Meena Iyer',
        },
      });
      emp2Id = e2._id.toString();
    });

    it('blocks payroll generation if any active employee lacks a salary structure', async () => {
      // Set structure only for e1, leave e2 without one
      await salaryStructuresService.createSalaryStructure(
        emp1Id,
        { effectiveFrom: '2026-01-01', basicSalary: 40000 },
        mockSuperAdmin,
      );

      await expect(
        payrollService.generateMonthlyPayroll({ payrollPeriod: '2026-10' }, mockSuperAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('generates DRAFT payroll run with exact aggregate totals in integer paise', async () => {
      // Structure 1: Gross ₹50,000, Ded ₹5,000, Net ₹45,000
      await salaryStructuresService.createSalaryStructure(
        emp1Id,
        {
          effectiveFrom: '2026-01-01',
          basicSalary: 40000,
          hra: 10000,
          pfDeduction: 5000,
        },
        mockSuperAdmin,
      );

      // Structure 2: Gross ₹30,000, Ded ₹2,000, Net ₹28,000
      await salaryStructuresService.createSalaryStructure(
        emp2Id,
        {
          effectiveFrom: '2026-01-01',
          basicSalary: 25000,
          allowances: 5000,
          taxDeduction: 2000,
        },
        mockSuperAdmin,
      );

      const run = await payrollService.generateMonthlyPayroll(
        { payrollPeriod: '2026-10', notes: 'October 2026 Regular Payroll' },
        mockSuperAdmin,
      );

      expect(run.status).toBe(PayrollRunStatus.DRAFT);
      expect(run.totalEmployees).toBe(2);
      expect(run.totalGrossPaise).toBe(8000000);       // ₹80,000
      expect(run.totalGross).toBe(80000);
      expect(run.totalDeductionsPaise).toBe(700000);   // ₹7,000
      expect(run.totalDeductions).toBe(7000);
      expect(run.totalNetPayablePaise).toBe(7300000);  // ₹73,000
      expect(run.totalNetPayable).toBe(73000);
      expect(run.totalOutstandingPaise).toBe(7300000);
      expect(run.totalDisbursedPaise).toBe(0);

      // Slips generated
      expect(slipStore.length).toBe(2);
      expect(slipStore[0].paymentStatus).toBe(SalarySlipPaymentStatus.UNPAID);
      expect(slipStore[0].slipNumber).toMatch(/^SLIP-202610-0001$/);
    });

    it('blocks duplicate payroll run generation for same accounting period', async () => {
      await salaryStructuresService.createSalaryStructure(
        emp1Id,
        { effectiveFrom: '2026-01-01', basicSalary: 40000 },
        mockSuperAdmin,
      );
      await salaryStructuresService.createSalaryStructure(
        emp2Id,
        { effectiveFrom: '2026-01-01', basicSalary: 30000 },
        mockSuperAdmin,
      );

      await payrollService.generateMonthlyPayroll({ payrollPeriod: '2026-10' }, mockSuperAdmin);

      await expect(
        payrollService.generateMonthlyPayroll({ payrollPeriod: '2026-10' }, mockSuperAdmin),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects disbursement attempts on a DRAFT payroll run', async () => {
      await salaryStructuresService.createSalaryStructure(
        emp1Id,
        { effectiveFrom: '2026-01-01', basicSalary: 40000 },
        mockSuperAdmin,
      );
      await salaryStructuresService.createSalaryStructure(
        emp2Id,
        { effectiveFrom: '2026-01-01', basicSalary: 30000 },
        mockSuperAdmin,
      );

      const run = await payrollService.generateMonthlyPayroll(
        { payrollPeriod: '2026-10' },
        mockSuperAdmin,
      );

      const slip = slipStore[0];

      await expect(
        payrollService.disburseSalarySlip(
          slip._id.toString(),
          {
            paymentMethod: DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS,
            transactionReference: 'NEFT-12345678',
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('approves a DRAFT payroll run and transitions status to APPROVED', async () => {
      await salaryStructuresService.createSalaryStructure(
        emp1Id,
        { effectiveFrom: '2026-01-01', basicSalary: 40000 },
        mockSuperAdmin,
      );
      await salaryStructuresService.createSalaryStructure(
        emp2Id,
        { effectiveFrom: '2026-01-01', basicSalary: 30000 },
        mockSuperAdmin,
      );

      const run = await payrollService.generateMonthlyPayroll(
        { payrollPeriod: '2026-10' },
        mockSuperAdmin,
      );

      const approvedRun = await payrollService.approvePayrollRun(
        run._id.toString(),
        { notes: 'Approved for bank disbursement' },
        mockSuperAdmin,
      );

      expect(approvedRun.status).toBe(PayrollRunStatus.APPROVED);
      expect(approvedRun.approvedBy?.toString()).toBe(mockSuperAdmin.id);
      expect(approvedRun.approvedByName).toBe(mockSuperAdmin.fullName);
      expect(approvedRun.approvedAt).toBeDefined();
    });
  });

  describe('4. Salary Disbursements & Run Completion', () => {
    let approvedRunId: string;

    beforeEach(async () => {
      const e1 = await employeesService.createEmployee({
        firstName: 'Kavita',
        lastName: 'Sharma',
        email: 'kavita@bloodbank.org',
        phone: '9123456780',
        designation: 'Medical Officer',
        department: EmployeeDepartment.MEDICAL_CLINICAL,
        dateOfJoining: '2026-01-01',
        bankDetails: {
          bankName: 'Axis Bank',
          accountNumber: '9100200300',
          ifscCode: 'UTIB0001000',
          accountHolderName: 'Kavita Sharma',
        },
      });

      await salaryStructuresService.createSalaryStructure(
        e1._id.toString(),
        {
          effectiveFrom: '2026-01-01',
          basicSalary: 60000,
          hra: 15000,
          pfDeduction: 5000,
        }, // Net: 70,000
        mockSuperAdmin,
      );

      const run = await payrollService.generateMonthlyPayroll(
        { payrollPeriod: '2026-10' },
        mockSuperAdmin,
      );

      const approved = await payrollService.approvePayrollRun(
        run._id.toString(),
        {},
        mockSuperAdmin,
      );
      approvedRunId = approved._id.toString();
    });

    it('disburses individual salary slip, updates balances, and marks run as COMPLETED', async () => {
      const slip = slipStore[0];
      expect(slip.remainingPaise).toBe(7000000); // ₹70,000

      const result = await payrollService.disburseSalarySlip(
        slip._id.toString(),
        {
          amount: 70000,
          paymentMethod: DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS,
          transactionReference: 'NEFT-UTR-99887766',
          notes: 'Salary transfer via corporate banking',
        },
        mockSuperAdmin,
      );

      expect(result.disbursement.disbursementNumber).toMatch(/^DISB-202610-[A-Z0-9]{4}$/);
      expect(result.disbursement.amountPaise).toBe(7000000);
      expect(result.disbursement.amount).toBe(70000);
      expect(result.disbursement.transactionReference).toBe('NEFT-UTR-99887766');

      // Verify slip state
      expect(result.slip.paidAmountPaise).toBe(7000000);
      expect(result.slip.remainingPaise).toBe(0);
      expect(result.slip.paymentStatus).toBe(SalarySlipPaymentStatus.PAID);

      // Verify run state
      expect(result.run.totalDisbursedPaise).toBe(7000000);
      expect(result.run.totalOutstandingPaise).toBe(0);
      expect(result.run.status).toBe(PayrollRunStatus.COMPLETED);
    });

    it('rejects duplicate disbursement attempt when slip is already PAID', async () => {
      const slip = slipStore[0];
      await payrollService.disburseSalarySlip(
        slip._id.toString(),
        {
          amount: 70000,
          paymentMethod: DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS,
          transactionReference: 'NEFT-UTR-1',
        },
        mockSuperAdmin,
      );

      // Try paying again
      await expect(
        payrollService.disburseSalarySlip(
          slip._id.toString(),
          {
            amount: 70000,
            paymentMethod: DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS,
            transactionReference: 'NEFT-UTR-2',
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects disbursement amount exceeding remaining balance', async () => {
      const slip = slipStore[0];
      await expect(
        payrollService.disburseSalarySlip(
          slip._id.toString(),
          {
            amount: 75000, // Remaining is 70,000
            paymentMethod: DisbursementPaymentMethod.BANK_TRANSFER_NEFT_RTGS,
            transactionReference: 'NEFT-UTR-ERR',
          },
          mockSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
