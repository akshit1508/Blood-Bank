import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SalaryStructure,
  SalaryStructureDocument,
} from '../schemas/salary-structure.schema';
import { Employee, EmployeeDocument } from '../schemas/employee.schema';
import { CreateSalaryStructureDto } from '../dto/salary-structure.dto';
import { CurrencyUtil } from '../../../common/utils/currency.util';

@Injectable()
export class SalaryStructuresService {
  constructor(
    @InjectModel(SalaryStructure.name)
    private readonly salaryStructureModel: Model<SalaryStructureDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  /**
   * Sets or revises an employee's salary structure with effective dating and integer paise calculations.
   */
  async createSalaryStructure(
    employeeId: string,
    dto: CreateSalaryStructureDto,
    adminUser: { id: string; fullName: string },
  ): Promise<SalaryStructureDocument> {
    const employee = await this.employeeModel.findById(employeeId);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found.`);
    }

    const effectiveFromDate = new Date(dto.effectiveFrom);
    if (isNaN(effectiveFromDate.getTime())) {
      throw new BadRequestException('Invalid effectiveFrom date provided.');
    }

    // Convert all amounts to integer paise
    const basicSalaryPaise = CurrencyUtil.toPaise(dto.basicSalary);
    const hraPaise = dto.hra ? CurrencyUtil.toPaise(dto.hra) : 0;
    const allowancesPaise = dto.allowances ? CurrencyUtil.toPaise(dto.allowances) : 0;

    const pfDeductionPaise = dto.pfDeduction ? CurrencyUtil.toPaise(dto.pfDeduction) : 0;
    const taxDeductionPaise = dto.taxDeduction ? CurrencyUtil.toPaise(dto.taxDeduction) : 0;
    const otherDeductionsPaise = dto.otherDeductions ? CurrencyUtil.toPaise(dto.otherDeductions) : 0;

    const grossSalaryPaise = basicSalaryPaise + hraPaise + allowancesPaise;
    const totalDeductionsPaise = pfDeductionPaise + taxDeductionPaise + otherDeductionsPaise;

    if (totalDeductionsPaise > grossSalaryPaise) {
      throw new BadRequestException(
        `Total deductions (₹${CurrencyUtil.toInr(totalDeductionsPaise)}) cannot exceed gross salary (₹${CurrencyUtil.toInr(grossSalaryPaise)}).`,
      );
    }

    const netSalaryPaise = grossSalaryPaise - totalDeductionsPaise;

    // Deactivate previous active structure and calculate next revision number
    const previousActive = await this.salaryStructureModel.findOne({
      employeeId: new Types.ObjectId(employeeId),
      isActive: true,
    });

    let nextRevision = 1;
    if (previousActive) {
      nextRevision = (previousActive.revisionNumber || 1) + 1;
      previousActive.isActive = false;
      previousActive.effectiveTo = effectiveFromDate;
      await previousActive.save();
    } else {
      // Find highest revision number so far if any
      const highestRevision = await this.salaryStructureModel
        .findOne({ employeeId: new Types.ObjectId(employeeId) })
        .sort({ revisionNumber: -1 })
        .lean()
        .exec();
      if (highestRevision?.revisionNumber) {
        nextRevision = highestRevision.revisionNumber + 1;
      }
    }

    const structure = new this.salaryStructureModel({
      employeeId: new Types.ObjectId(employeeId),
      revisionNumber: nextRevision,
      isActive: true,
      effectiveFrom: effectiveFromDate,
      // Earnings
      basicSalaryPaise,
      basicSalary: CurrencyUtil.toInr(basicSalaryPaise),
      hraPaise,
      hra: CurrencyUtil.toInr(hraPaise),
      allowancesPaise,
      allowances: CurrencyUtil.toInr(allowancesPaise),
      grossSalaryPaise,
      grossSalary: CurrencyUtil.toInr(grossSalaryPaise),
      // Deductions
      pfDeductionPaise,
      pfDeduction: CurrencyUtil.toInr(pfDeductionPaise),
      taxDeductionPaise,
      taxDeduction: CurrencyUtil.toInr(taxDeductionPaise),
      otherDeductionsPaise,
      otherDeductions: CurrencyUtil.toInr(otherDeductionsPaise),
      // Net
      netSalaryPaise,
      netSalary: CurrencyUtil.toInr(netSalaryPaise),
      createdBy: new Types.ObjectId(adminUser.id),
      createdByName: adminUser.fullName,
      notes: dto.notes,
    });

    return await structure.save();
  }

  /**
   * Retrieves the current active salary structure for an employee.
   */
  async getActiveStructure(employeeId: string): Promise<SalaryStructureDocument | null> {
    return await this.salaryStructureModel.findOne({
      employeeId: new Types.ObjectId(employeeId),
      isActive: true,
    });
  }

  /**
   * Retrieves all historical revisions for an employee.
   */
  async getStructureHistory(employeeId: string): Promise<any[]> {
    return await this.salaryStructureModel
      .find({ employeeId: new Types.ObjectId(employeeId) })
      .sort({ effectiveFrom: -1, revisionNumber: -1 })
      .lean()
      .exec();
  }
}
