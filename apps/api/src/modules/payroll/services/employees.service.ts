import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Employee, EmployeeDocument } from '../schemas/employee.schema';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  QueryEmployeesDto,
} from '../dto/employee.dto';
import {
  SalaryStructure,
  SalaryStructureDocument,
} from '../schemas/salary-structure.schema';
import { EmployeeStatus, EmploymentType } from '../constants/payroll.constants';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(SalaryStructure.name)
    private readonly structureModel: Model<SalaryStructureDocument>,
  ) {}

  /**
   * Safely parses standard ISO, JS Date, or DD-MM-YYYY / DD/MM/YYYY dates.
   */
  private parseDateSafely(dateStr: string | Date | undefined): Date | undefined {
    if (!dateStr) return undefined;
    if (dateStr instanceof Date) {
      return isNaN(dateStr.getTime()) ? undefined : dateStr;
    }
    const str = String(dateStr).trim();
    if (!str) return undefined;

    // Direct Date parsing (handles ISO YYYY-MM-DD or full timestamp)
    let d = new Date(str);
    if (!isNaN(d.getTime())) return d;

    // Handle DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    const parts = str.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        // DD-MM-YYYY
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      } else if (parts[0].length === 4) {
        // YYYY-MM-DD
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }

    return undefined;
  }

  /**
   * Generates next sequential employee code: EMP-0001, EMP-0002...
   */
  private async generateEmployeeCode(): Promise<string> {
    const latestEmployee = await this.employeeModel
      .findOne({}, { employeeCode: 1 })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    let nextNumber = 1;
    if (latestEmployee?.employeeCode) {
      const match = latestEmployee.employeeCode.match(/EMP-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Pad to 4 digits
    return `EMP-${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Creates a new employee record.
   */
  async createEmployee(dto: CreateEmployeeDto): Promise<EmployeeDocument> {
    // Check if email already exists
    const existing = await this.employeeModel.findOne({
      email: dto.email.toLowerCase().trim(),
    });
    if (existing) {
      throw new ConflictException(`Employee with email ${dto.email} already exists.`);
    }

    let code = await this.generateEmployeeCode();
    // Ensure code uniqueness in case of race condition
    let attempts = 0;
    while ((await this.employeeModel.findOne({ employeeCode: code })) && attempts < 1000) {
      attempts++;
      const num = parseInt(code.replace('EMP-', ''), 10) + 1;
      code = `EMP-${(isNaN(num) ? attempts : num).toString().padStart(4, '0')}`;
    }

    const fullName = `${dto.firstName.trim()} ${dto.lastName.trim()}`;

    // Robust date parsing
    const dateOfJoining = this.parseDateSafely(dto.dateOfJoining);
    if (!dateOfJoining) {
      throw new BadRequestException(`Invalid date of joining: ${dto.dateOfJoining}`);
    }

    // Sanitize optional emergencyContact: omit if empty or blank
    let emergencyContact: any = undefined;
    if (
      dto.emergencyContact &&
      dto.emergencyContact.name?.trim() &&
      dto.emergencyContact.phone?.trim()
    ) {
      emergencyContact = {
        name: dto.emergencyContact.name.trim(),
        phone: dto.emergencyContact.phone.trim(),
        relationship: dto.emergencyContact.relationship?.trim() || 'Other',
      };
    }

    // Sanitize bank details: trim and handle optional panNumber
    const bankDetails = {
      bankName: dto.bankDetails.bankName.trim(),
      accountNumber: dto.bankDetails.accountNumber.trim(),
      ifscCode: dto.bankDetails.ifscCode.trim().toUpperCase(),
      accountHolderName: dto.bankDetails.accountHolderName.trim(),
      panNumber: dto.bankDetails.panNumber?.trim()
        ? dto.bankDetails.panNumber.trim().toUpperCase()
        : undefined,
    };

    const newEmployee = new this.employeeModel({
      employeeCode: code,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      fullName,
      email: dto.email.toLowerCase().trim(),
      phone: dto.phone.trim(),
      designation: dto.designation.trim(),
      department: dto.department,
      employmentType: dto.employmentType || EmploymentType.PERMANENT,
      status: dto.status || EmployeeStatus.ACTIVE,
      dateOfJoining,
      bankDetails,
      emergencyContact,
      notes: dto.notes?.trim() || undefined,
      adminUserId: dto.adminUserId ? new Types.ObjectId(dto.adminUserId) : undefined,
    });

    try {
      return await newEmployee.save();
    } catch (err: any) {
      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors || {})
          .map((e: any) => e.message)
          .join(', ');
        throw new BadRequestException(messages || 'Validation failed on employee record');
      }
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {})[0] || 'field';
        throw new ConflictException(`An employee with this ${field} already exists.`);
      }
      throw err;
    }
  }

  /**
   * Updates an existing employee profile.
   */
  async updateEmployee(
    id: string,
    dto: UpdateEmployeeDto,
  ): Promise<EmployeeDocument> {
    const employee = await this.employeeModel.findById(id);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }

    if (dto.email && dto.email.toLowerCase().trim() !== employee.email) {
      const existing = await this.employeeModel.findOne({
        email: dto.email.toLowerCase().trim(),
        _id: { $ne: employee._id },
      });
      if (existing) {
        throw new ConflictException(`Email ${dto.email} is already in use by another employee.`);
      }
      employee.email = dto.email.toLowerCase().trim();
    }

    if (dto.firstName || dto.lastName) {
      const firstName = dto.firstName ? dto.firstName.trim() : employee.firstName;
      const lastName = dto.lastName ? dto.lastName.trim() : employee.lastName;
      employee.firstName = firstName;
      employee.lastName = lastName;
      employee.fullName = `${firstName} ${lastName}`;
    }

    if (dto.phone) employee.phone = dto.phone.trim();
    if (dto.designation) employee.designation = dto.designation.trim();
    if (dto.department) employee.department = dto.department;
    if (dto.employmentType) employee.employmentType = dto.employmentType;
    if (dto.status) employee.status = dto.status;

    if (dto.dateOfJoining) {
      const parsedJoining = this.parseDateSafely(dto.dateOfJoining);
      if (!parsedJoining) {
        throw new BadRequestException(`Invalid date of joining: ${dto.dateOfJoining}`);
      }
      employee.dateOfJoining = parsedJoining;
    }

    if (dto.dateOfLeaving) {
      const parsedLeaving = this.parseDateSafely(dto.dateOfLeaving);
      if (!parsedLeaving) {
        throw new BadRequestException(`Invalid date of leaving: ${dto.dateOfLeaving}`);
      }
      employee.dateOfLeaving = parsedLeaving;
    }

    if (dto.notes !== undefined) employee.notes = dto.notes?.trim() || undefined;

    if (dto.emergencyContact !== undefined) {
      if (
        dto.emergencyContact &&
        dto.emergencyContact.name?.trim() &&
        dto.emergencyContact.phone?.trim()
      ) {
        employee.emergencyContact = {
          name: dto.emergencyContact.name.trim(),
          phone: dto.emergencyContact.phone.trim(),
          relationship: dto.emergencyContact.relationship?.trim() || 'Other',
        };
      } else {
        employee.emergencyContact = undefined;
      }
    }

    if (dto.bankDetails) {
      employee.bankDetails = {
        bankName: dto.bankDetails.bankName?.trim() || employee.bankDetails.bankName,
        accountNumber: dto.bankDetails.accountNumber?.trim() || employee.bankDetails.accountNumber,
        ifscCode: (dto.bankDetails.ifscCode?.trim() || employee.bankDetails.ifscCode).toUpperCase(),
        accountHolderName: dto.bankDetails.accountHolderName?.trim() || employee.bankDetails.accountHolderName,
        panNumber: dto.bankDetails.panNumber?.trim()
          ? dto.bankDetails.panNumber.trim().toUpperCase()
          : undefined,
      };
    }

    if (dto.adminUserId !== undefined) {
      employee.adminUserId = dto.adminUserId
        ? new Types.ObjectId(dto.adminUserId)
        : undefined;
    }

    try {
      return await employee.save();
    } catch (err: any) {
      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors || {})
          .map((e: any) => e.message)
          .join(', ');
        throw new BadRequestException(messages || 'Validation failed on employee update');
      }
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {})[0] || 'field';
        throw new ConflictException(`An employee with this ${field} already exists.`);
      }
      throw err;
    }
  }

  /**
   * Finds employee by ID, optionally sanitizing sensitive bank details for non-super admins.
   */
  async getEmployeeById(id: string, isSuperAdmin: boolean): Promise<any> {
    const employee = await this.employeeModel.findById(id).lean().exec();
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }

    let activeSalaryStructure: any = null;
    try {
      const q: any = this.structureModel.findOne({ employeeId: employee._id, isActive: true });
      activeSalaryStructure = typeof q?.lean === 'function' ? await q.lean().exec() : await q;
    } catch {
      activeSalaryStructure = null;
    }

    const result = {
      ...employee,
      activeSalaryStructure: activeSalaryStructure || null,
    };

    if (!isSuperAdmin) {
      // Strip bank details for non-super admin
      const { bankDetails, ...sanitized } = result as any;
      return sanitized;
    }

    return result;
  }

  /**
   * Lists employees with optional filtering, stripping bank details for non-super admins.
   */
  async listEmployees(
    query: QueryEmployeesDto,
    isSuperAdmin: boolean,
  ): Promise<any[]> {
    const filter: any = {};

    if (query.department) {
      filter.department = query.department;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.employmentType) {
      filter.employmentType = query.employmentType;
    }
    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { fullName: searchRegex },
        { employeeCode: searchRegex },
        { email: searchRegex },
        { designation: searchRegex },
        { phone: searchRegex },
      ];
    }

    const projection = isSuperAdmin ? {} : { bankDetails: 0 };
    const employees = await this.employeeModel
      .find(filter, projection)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const empIds = employees.map((e) => e._id);
    let activeStructures: any[] = [];
    try {
      const q: any = this.structureModel.find({ employeeId: { $in: empIds }, isActive: true });
      activeStructures = typeof q?.lean === 'function' ? await q.lean().exec() : await q;
    } catch {
      activeStructures = [];
    }

    const structureMap = new Map<string, any>();
    if (Array.isArray(activeStructures)) {
      for (const s of activeStructures) {
        if (s && s.employeeId) {
          structureMap.set(s.employeeId.toString(), s);
        }
      }
    }

    return employees.map((emp) => ({
      ...emp,
      activeSalaryStructure: structureMap.get(emp._id.toString()) || null,
    }));
  }

  /**
   * Marks an employee as resigned/terminated.
   */
  async terminateEmployee(
    id: string,
    status: EmployeeStatus,
    dateOfLeaving: string,
    notes?: string,
  ): Promise<EmployeeDocument> {
    if (
      status !== EmployeeStatus.RESIGNED &&
      status !== EmployeeStatus.TERMINATED
    ) {
      throw new BadRequestException('Status must be RESIGNED or TERMINATED.');
    }

    const employee = await this.employeeModel.findById(id);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }

    employee.status = status;
    const parsedLeaving = this.parseDateSafely(dateOfLeaving);
    if (!parsedLeaving) {
      throw new BadRequestException(`Invalid date of leaving: ${dateOfLeaving}`);
    }
    employee.dateOfLeaving = parsedLeaving;
    if (notes) {
      employee.notes = employee.notes ? `${employee.notes}\n${notes}` : notes;
    }

    try {
      return await employee.save();
    } catch (err: any) {
      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors || {})
          .map((e: any) => e.message)
          .join(', ');
        throw new BadRequestException(messages || 'Validation failed on employee status change');
      }
      throw err;
    }
  }
}
