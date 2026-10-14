import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MonthlyPayrollRun,
  MonthlyPayrollRunDocument,
} from '../schemas/monthly-payroll-run.schema';
import {
  SalarySlip,
  SalarySlipDocument,
} from '../schemas/salary-slip.schema';
import {
  SalaryDisbursement,
  SalaryDisbursementDocument,
} from '../schemas/salary-disbursement.schema';
import { Employee, EmployeeDocument } from '../schemas/employee.schema';
import {
  SalaryStructure,
  SalaryStructureDocument,
} from '../schemas/salary-structure.schema';
import {
  GeneratePayrollRunDto,
  ApprovePayrollRunDto,
  DisburseSalarySlipDto,
  BatchDisbursePayrollDto,
  QueryPayrollRunsDto,
  DirectPayEmployeeDto,
  QueryPayrollRosterDto,
} from '../dto/payroll-run.dto';
import {
  PayrollRunStatus,
  SalarySlipPaymentStatus,
  EmployeeStatus,
} from '../constants/payroll.constants';
import { CurrencyUtil } from '../../../common/utils/currency.util';

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(MonthlyPayrollRun.name)
    private readonly runModel: Model<MonthlyPayrollRunDocument>,
    @InjectModel(SalarySlip.name)
    private readonly slipModel: Model<SalarySlipDocument>,
    @InjectModel(SalaryDisbursement.name)
    private readonly disbursementModel: Model<SalaryDisbursementDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(SalaryStructure.name)
    private readonly structureModel: Model<SalaryStructureDocument>,
  ) {}

  /**
   * Generates a monthly payroll batch for an accounting period (YYYY-MM).
   */
  async generateMonthlyPayroll(
    dto: GeneratePayrollRunDto,
    adminUser: { id: string; fullName: string },
  ): Promise<MonthlyPayrollRunDocument> {
    const period = dto.payrollPeriod.trim();

    // 1. Guard against duplicate monthly run
    const existingRun = await this.runModel.findOne({ payrollPeriod: period });
    if (existingRun) {
      throw new ConflictException(
        `Payroll run for period ${period} already exists (${existingRun.runCode}).`,
      );
    }

    // 2. Compute date boundaries
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const periodStartDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const periodEndDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

    // 3. Find eligible employees
    const eligibleEmployees = await this.employeeModel.find({
      status: { $in: [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION] },
      dateOfJoining: { $lte: periodEndDate },
      $or: [
        { dateOfLeaving: { $exists: false } },
        { dateOfLeaving: null },
        { dateOfLeaving: { $gte: periodStartDate } },
      ],
    }).sort({ employeeCode: 1 });

    if (eligibleEmployees.length === 0) {
      throw new BadRequestException(
        `No eligible active employees found for payroll period ${period}.`,
      );
    }

    // 4. Validate all eligible employees have active salary structures
    const employeeIds = eligibleEmployees.map((e) => e._id);
    const activeStructures = await this.structureModel.find({
      employeeId: { $in: employeeIds },
      isActive: true,
    });

    const structureMap = new Map<string, SalaryStructureDocument>();
    for (const struct of activeStructures) {
      structureMap.set(struct.employeeId.toString(), struct);
    }

    const missingStructures = eligibleEmployees.filter(
      (emp) => !structureMap.has(emp._id.toString()),
    );

    if (missingStructures.length > 0) {
      const names = missingStructures
        .map((m) => `${m.fullName} (${m.employeeCode})`)
        .join(', ');
      throw new BadRequestException(
        `Cannot generate payroll: the following ${missingStructures.length} employee(s) do not have an active salary structure: ${names}. Please define their salary structures first.`,
      );
    }

    // 5. Build run metadata and slips
    const dateTag = `${year}${monthStr}`;
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const runCode = `RUN-${dateTag}-${randomSuffix}`;

    let totalGrossPaise = 0;
    let totalDeductionsPaise = 0;
    let totalNetPayablePaise = 0;

    const runId = new Types.ObjectId();
    const slipsToInsert: any[] = [];

    for (let i = 0; i < eligibleEmployees.length; i++) {
      const emp = eligibleEmployees[i];
      const struct = structureMap.get(emp._id.toString())!;

      const slipNumber = `SLIP-${dateTag}-${(i + 1).toString().padStart(4, '0')}`;

      const basicPaise = struct.basicSalaryPaise;
      const hraPaise = struct.hraPaise || 0;
      const allowancesPaise = struct.allowancesPaise || 0;
      const grossPaise = struct.grossSalaryPaise;

      const pfPaise = struct.pfDeductionPaise || 0;
      const taxPaise = struct.taxDeductionPaise || 0;
      const otherPaise = struct.otherDeductionsPaise || 0;
      const deductionsPaise = struct.pfDeductionPaise + struct.taxDeductionPaise + struct.otherDeductionsPaise;

      const netPaise = struct.netSalaryPaise;

      totalGrossPaise += grossPaise;
      totalDeductionsPaise += deductionsPaise;
      totalNetPayablePaise += netPaise;

      slipsToInsert.push({
        slipNumber,
        payrollRunId: runId,
        employeeId: emp._id,
        payPeriod: period,
        employeeSnapshot: {
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          designation: emp.designation,
          department: emp.department,
          bankName: emp.bankDetails?.bankName || 'N/A',
          accountNumber: emp.bankDetails?.accountNumber || 'N/A',
          ifscCode: emp.bankDetails?.ifscCode || 'N/A',
          panNumber: emp.bankDetails?.panNumber || '',
        },
        daysInMonth,
        payableDays: daysInMonth,
        lossOfPayDays: 0,
        // Earnings
        basicPaise,
        basic: CurrencyUtil.toInr(basicPaise),
        hraPaise,
        hra: CurrencyUtil.toInr(hraPaise),
        allowancesPaise,
        allowances: CurrencyUtil.toInr(allowancesPaise),
        grossEarningsPaise: grossPaise,
        grossEarnings: CurrencyUtil.toInr(grossPaise),
        // Deductions
        pfDeductionPaise: pfPaise,
        pfDeduction: CurrencyUtil.toInr(pfPaise),
        taxDeductionPaise: taxPaise,
        taxDeduction: CurrencyUtil.toInr(taxPaise),
        otherDeductionsPaise: otherPaise,
        otherDeductions: CurrencyUtil.toInr(otherPaise),
        totalDeductionsPaise: deductionsPaise,
        totalDeductions: CurrencyUtil.toInr(deductionsPaise),
        // Net
        netPayablePaise: netPaise,
        netPayable: CurrencyUtil.toInr(netPaise),
        // Progress
        paidAmountPaise: 0,
        paidAmount: 0,
        remainingPaise: netPaise,
        remaining: CurrencyUtil.toInr(netPaise),
        paymentStatus: SalarySlipPaymentStatus.UNPAID,
      });
    }

    const run = new this.runModel({
      _id: runId,
      payrollPeriod: period,
      runCode,
      periodStartDate,
      periodEndDate,
      status: PayrollRunStatus.DRAFT,
      totalEmployees: eligibleEmployees.length,
      totalGrossPaise,
      totalGross: CurrencyUtil.toInr(totalGrossPaise),
      totalDeductionsPaise,
      totalDeductions: CurrencyUtil.toInr(totalDeductionsPaise),
      totalNetPayablePaise,
      totalNetPayable: CurrencyUtil.toInr(totalNetPayablePaise),
      totalDisbursedPaise: 0,
      totalDisbursed: 0,
      totalOutstandingPaise: totalNetPayablePaise,
      totalOutstanding: CurrencyUtil.toInr(totalNetPayablePaise),
      generatedBy: new Types.ObjectId(adminUser.id),
      generatedByName: adminUser.fullName,
      notes: dto.notes,
    });

    const savedRun = await run.save();
    await this.slipModel.insertMany(slipsToInsert);

    return savedRun;
  }

  /**
   * Super Admin approval of a DRAFT payroll run.
   */
  async approvePayrollRun(
    runId: string,
    dto: ApprovePayrollRunDto,
    adminUser: { id: string; fullName: string },
  ): Promise<MonthlyPayrollRunDocument> {
    const run = await this.runModel.findById(runId);
    if (!run) {
      throw new NotFoundException(`Payroll run with ID ${runId} not found.`);
    }

    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT payroll runs can be approved. Current status: ${run.status}.`,
      );
    }

    run.status = PayrollRunStatus.APPROVED;
    run.approvedBy = new Types.ObjectId(adminUser.id);
    run.approvedByName = adminUser.fullName;
    run.approvedAt = new Date();
    if (dto.notes) {
      run.notes = run.notes ? `${run.notes}\n[Approved]: ${dto.notes}` : dto.notes;
    }

    return await run.save();
  }

  /**
   * Disburses payment for an individual salary slip.
   */
  async disburseSalarySlip(
    slipId: string,
    dto: DisburseSalarySlipDto,
    adminUser: { id: string; fullName: string },
  ): Promise<{ slip: SalarySlipDocument; disbursement: SalaryDisbursementDocument; run: MonthlyPayrollRunDocument }> {
    const slip = await this.slipModel.findById(slipId);
    if (!slip) {
      throw new NotFoundException(`Salary slip with ID ${slipId} not found.`);
    }

    const run = await this.runModel.findById(slip.payrollRunId);
    if (!run) {
      throw new NotFoundException(`Linked payroll run ${slip.payrollRunId} not found.`);
    }

    if (
      run.status !== PayrollRunStatus.APPROVED &&
      run.status !== PayrollRunStatus.PARTIALLY_DISBURSED
    ) {
      if (run.status === PayrollRunStatus.COMPLETED && slip.remainingPaise > 0) {
        run.status = PayrollRunStatus.PARTIALLY_DISBURSED;
        await run.save();
      } else {
        throw new BadRequestException(
          `Payroll run must be APPROVED or PARTIALLY_DISBURSED before salary can be disbursed. Current status: ${run.status}.`,
        );
      }
    }

    if (slip.remainingPaise <= 0 || slip.paymentStatus === SalarySlipPaymentStatus.PAID) {
      throw new BadRequestException(`Salary slip ${slip.slipNumber} is already fully paid.`);
    }

    const amountPaise = dto.amount !== undefined ? CurrencyUtil.toPaise(dto.amount) : slip.remainingPaise;
    if (amountPaise <= 0) {
      throw new BadRequestException('Disbursement amount must be greater than ₹0.');
    }
    if (amountPaise > slip.remainingPaise) {
      throw new BadRequestException(
        `Disbursement amount (₹${CurrencyUtil.toInr(amountPaise)}) exceeds remaining slip balance (₹${CurrencyUtil.toInr(slip.remainingPaise)}).`,
      );
    }

    const dateTag = slip.payPeriod.replace('-', '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const disbursementNumber = `DISB-${dateTag}-${randomSuffix}`;

    const disbursement = new this.disbursementModel({
      disbursementNumber,
      salarySlipId: slip._id,
      payrollRunId: run._id,
      employeeId: slip.employeeId,
      amountPaise,
      amount: CurrencyUtil.toInr(amountPaise),
      paymentMethod: dto.paymentMethod,
      transactionReference: dto.transactionReference.trim(),
      paymentDate: new Date(),
      recipientBankName: slip.employeeSnapshot.bankName,
      recipientAccountNumber: slip.employeeSnapshot.accountNumber,
      recipientIfscCode: slip.employeeSnapshot.ifscCode,
      disbursedBy: new Types.ObjectId(adminUser.id),
      disbursedByName: adminUser.fullName,
      notes: dto.notes,
      receiptDocumentRef: dto.receiptDocumentRef,
    });

    const savedDisbursement = await disbursement.save();

    // Update slip
    slip.paidAmountPaise += amountPaise;
    slip.paidAmount = CurrencyUtil.toInr(slip.paidAmountPaise);
    slip.remainingPaise -= amountPaise;
    slip.remaining = CurrencyUtil.toInr(slip.remainingPaise);
    slip.paymentStatus = slip.remainingPaise === 0
      ? SalarySlipPaymentStatus.PAID
      : SalarySlipPaymentStatus.PARTIALLY_PAID;
    slip.disbursedAt = new Date();
    await slip.save();

    // Update run
    run.totalDisbursedPaise += amountPaise;
    run.totalDisbursed = CurrencyUtil.toInr(run.totalDisbursedPaise);
    run.totalOutstandingPaise -= amountPaise;
    run.totalOutstanding = CurrencyUtil.toInr(run.totalOutstandingPaise);
    run.status = run.totalOutstandingPaise === 0
      ? PayrollRunStatus.COMPLETED
      : PayrollRunStatus.PARTIALLY_DISBURSED;
    await run.save();

    return { slip, disbursement: savedDisbursement, run };
  }

  /**
   * Batch disburses all pending slips in an approved payroll run.
   */
  async batchDisburseRun(
    runId: string,
    dto: BatchDisbursePayrollDto,
    adminUser: { id: string; fullName: string },
  ): Promise<{ run: MonthlyPayrollRunDocument; processedCount: number; totalDisbursed: number }> {
    const run = await this.runModel.findById(runId);
    if (!run) {
      throw new NotFoundException(`Payroll run with ID ${runId} not found.`);
    }

    if (
      run.status !== PayrollRunStatus.APPROVED &&
      run.status !== PayrollRunStatus.PARTIALLY_DISBURSED
    ) {
      throw new BadRequestException(
        `Only APPROVED or PARTIALLY_DISBURSED payroll runs can be batch disbursed. Current status: ${run.status}.`,
      );
    }

    const pendingSlips = await this.slipModel.find({
      payrollRunId: run._id,
      paymentStatus: { $ne: SalarySlipPaymentStatus.PAID },
    });

    if (pendingSlips.length === 0) {
      throw new BadRequestException('No pending salary slips found to disburse in this run.');
    }

    let batchDisbursedPaise = 0;

    for (let i = 0; i < pendingSlips.length; i++) {
      const slip = pendingSlips[i];
      const slipAmountPaise = slip.remainingPaise;
      if (slipAmountPaise <= 0) continue;

      const txRef = `${dto.transactionReferencePrefix.trim()}-${slip.employeeSnapshot.employeeCode}`;
      await this.disburseSalarySlip(
        slip._id.toString(),
        {
          paymentMethod: dto.paymentMethod,
          transactionReference: txRef,
          notes: dto.notes,
        },
        adminUser,
      );

      batchDisbursedPaise += slipAmountPaise;
    }

    const updatedRun = await this.runModel.findById(runId);

    return {
      run: updatedRun!,
      processedCount: pendingSlips.length,
      totalDisbursed: CurrencyUtil.toInr(batchDisbursedPaise),
    };
  }

  /**
   * Retrieves single payroll run by ID or runCode.
   */
  async getPayrollRunById(runId: string): Promise<MonthlyPayrollRunDocument> {
    let run: any = null;
    if (Types.ObjectId.isValid(runId)) {
      run = await this.runModel.findById(runId);
    }
    if (!run) {
      run = await this.runModel.findOne({ runCode: runId });
    }
    if (!run) {
      throw new NotFoundException(`Payroll run with ID or code ${runId} not found.`);
    }
    return run;
  }

  /**
   * Lists monthly payroll runs with optional status/period filters.
   */
  async listPayrollRuns(query: QueryPayrollRunsDto): Promise<any[]> {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.payrollPeriod) filter.payrollPeriod = query.payrollPeriod;

    return await this.runModel.find(filter).sort({ payrollPeriod: -1 }).lean().exec();
  }

  /**
   * Retrieves all salary slips belonging to a specific payroll run.
   */
  async getSalarySlipsForRun(runId: string): Promise<any[]> {
    let actualRunId = runId;
    if (!Types.ObjectId.isValid(runId)) {
      const run = await this.runModel.findOne({ runCode: runId });
      if (run) {
        actualRunId = run._id.toString();
      }
    }

    if (!Types.ObjectId.isValid(actualRunId)) {
      return [];
    }

    return await this.slipModel
      .find({ payrollRunId: new Types.ObjectId(actualRunId) })
      .sort({ 'employeeSnapshot.employeeCode': 1 })
      .lean()
      .exec();
  }

  /**
   * Retrieves a single salary slip by ID.
   */
  async getSalarySlipById(slipId: string): Promise<SalarySlipDocument> {
    const slip = await this.slipModel.findById(slipId);
    if (!slip) {
      throw new NotFoundException(`Salary slip with ID ${slipId} not found.`);
    }
    return slip;
  }

  /**
   * Retrieves all disbursements made for a specific salary slip.
   */
  async getDisbursementsForSlip(slipId: string): Promise<any[]> {
    return await this.disbursementModel
      .find({ salarySlipId: new Types.ObjectId(slipId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  /**
   * Payroll financial analytics for Super Admin overview dashboard.
   */
  async getPayrollSummary(): Promise<any> {
    const runs = await this.runModel.find().lean().exec();

    let totalPayrollOutflowPaise = 0;
    let totalOutstandingLiabilityPaise = 0;
    let draftRunsCount = 0;
    let approvedRunsCount = 0;
    let completedRunsCount = 0;

    for (const r of runs) {
      totalPayrollOutflowPaise += r.totalDisbursedPaise || 0;
      totalOutstandingLiabilityPaise += r.totalOutstandingPaise || 0;
      if (r.status === PayrollRunStatus.DRAFT) draftRunsCount++;
      if (r.status === PayrollRunStatus.APPROVED) approvedRunsCount++;
      if (r.status === PayrollRunStatus.COMPLETED) completedRunsCount++;
    }

    const totalActiveEmployees = await this.employeeModel.countDocuments({
      status: { $in: [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION] },
    });

    return {
      totalActiveEmployees,
      totalPayrollOutflow: CurrencyUtil.toInr(totalPayrollOutflowPaise),
      totalOutstandingLiability: CurrencyUtil.toInr(totalOutstandingLiabilityPaise),
      draftRunsCount,
      approvedRunsCount,
      completedRunsCount,
      totalRunsCount: runs.length,
    };
  }

  /**
   * Retrieves a consolidated roster of employees with their active salary structures,
   * monthly payout status, and summary metrics for the requested period (YYYY-MM).
   */
  async getDashboardRoster(query: QueryPayrollRosterDto): Promise<any> {
    const period = query.period || new Date().toISOString().slice(0, 7);

    // 1. Fetch active / probationary employees
    const empFilter: any = {
      status: { $in: [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION] },
    };
    if (query.department) {
      empFilter.department = query.department;
    }
    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      empFilter.$or = [
        { fullName: searchRegex },
        { employeeCode: searchRegex },
        { designation: searchRegex },
        { email: searchRegex },
      ];
    }

    const employees = await this.employeeModel
      .find(empFilter)
      .sort({ employeeCode: 1 })
      .lean()
      .exec();

    const empIds = employees.map((e) => e._id);

    // 2. Fetch active salary structures for these employees
    const activeStructures = await this.structureModel
      .find({ employeeId: { $in: empIds }, isActive: true })
      .lean()
      .exec();

    const structureMap = new Map<string, any>();
    for (const s of activeStructures) {
      structureMap.set(s.employeeId.toString(), s);
    }

    // 3. Fetch salary slips for this period if any exist
    const slips = await this.slipModel
      .find({
        employeeId: { $in: empIds },
        payPeriod: period,
      })
      .lean()
      .exec();

    const slipMap = new Map<string, any>();
    for (const slip of slips) {
      slipMap.set(slip.employeeId.toString(), slip);
    }

    // 4. Build items and calculate aggregates
    let employeesWithSalaryCount = 0;
    let employeesPaidCount = 0;
    let employeesPartiallyPaidCount = 0;
    let employeesUnpaidCount = 0;

    let totalPayrollBudgetPaise = 0;
    let totalPaidPaise = 0;
    let totalPendingPaise = 0;

    const items = employees.map((emp) => {
      const structure = structureMap.get(emp._id.toString()) || null;
      const slip = slipMap.get(emp._id.toString()) || null;

      let paymentStatus: string = 'NO_STRUCTURE';
      let remaining = 0;
      let paid = 0;

      if (structure) {
        employeesWithSalaryCount++;
        totalPayrollBudgetPaise += structure.netSalaryPaise;

        if (slip) {
          paymentStatus = slip.paymentStatus;
          paid = slip.paidAmount;
          remaining = slip.remaining;
          totalPaidPaise += slip.paidAmountPaise || 0;
          totalPendingPaise += slip.remainingPaise || 0;

          if (slip.paymentStatus === SalarySlipPaymentStatus.PAID) {
            employeesPaidCount++;
          } else if (slip.paymentStatus === SalarySlipPaymentStatus.PARTIALLY_PAID) {
            employeesPartiallyPaidCount++;
          } else {
            employeesUnpaidCount++;
          }
        } else {
          paymentStatus = SalarySlipPaymentStatus.UNPAID;
          remaining = structure.netSalary;
          paid = 0;
          totalPendingPaise += structure.netSalaryPaise;
          employeesUnpaidCount++;
        }
      }

      return {
        employee: emp,
        salaryStructure: structure,
        slip,
        paymentStatus,
        netSalary: structure ? structure.netSalary : 0,
        paidAmount: paid,
        remainingAmount: remaining,
        isPaid: paymentStatus === SalarySlipPaymentStatus.PAID,
      };
    });

    return {
      period,
      summary: {
        totalEmployees: employees.length,
        employeesWithSalaryCount,
        employeesPaidCount,
        employeesPartiallyPaidCount,
        employeesUnpaidCount,
        totalPayrollBudget: CurrencyUtil.toInr(totalPayrollBudgetPaise),
        totalPaidAmount: CurrencyUtil.toInr(totalPaidPaise),
        totalPendingAmount: CurrencyUtil.toInr(totalPendingPaise),
      },
      items,
    };
  }

  /**
   * Directly disburses an employee's salary for the specified period from the unified dashboard,
   * automatically ensuring/creating the underlying period payroll run and slip if needed.
   */
  async directPayEmployee(
    employeeId: string,
    dto: DirectPayEmployeeDto,
    adminUser: { id: string; fullName: string },
  ): Promise<any> {
    const employee = await this.employeeModel.findById(employeeId);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found.`);
    }

    const structure = await this.structureModel.findOne({
      employeeId: employee._id,
      isActive: true,
    });
    if (!structure) {
      throw new BadRequestException(
        `Cannot pay ${employee.fullName}: No active salary structure configured. Please set their salary first.`,
      );
    }

    const period = dto.period || new Date().toISOString().slice(0, 7);
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;

    // 1. Ensure or find MonthlyPayrollRun
    let run = await this.runModel.findOne({ payrollPeriod: period });
    if (!run) {
      const dateTag = `${yearStr}${monthStr}`;
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      run = new this.runModel({
        payrollPeriod: period,
        runCode: `RUN-${dateTag}-${randomSuffix}`,
        periodStartDate: new Date(year, month, 1),
        periodEndDate: new Date(year, month + 1, 0, 23, 59, 59, 999),
        status: PayrollRunStatus.APPROVED,
        totalEmployees: 0,
        totalGrossPaise: 0,
        totalGross: 0,
        totalDeductionsPaise: 0,
        totalDeductions: 0,
        totalNetPayablePaise: 0,
        totalNetPayable: 0,
        totalDisbursedPaise: 0,
        totalDisbursed: 0,
        totalOutstandingPaise: 0,
        totalOutstanding: 0,
        generatedBy: new Types.ObjectId(adminUser.id),
        generatedByName: adminUser.fullName,
        approvedBy: new Types.ObjectId(adminUser.id),
        approvedByName: adminUser.fullName,
        approvedAt: new Date(),
        notes: `Direct payout batch for ${period}`,
      });
      await run.save();
    } else if (
      run.status === PayrollRunStatus.DRAFT ||
      run.status === PayrollRunStatus.COMPLETED
    ) {
      run.status = PayrollRunStatus.APPROVED;
      if (!run.approvedAt) {
        run.approvedBy = new Types.ObjectId(adminUser.id);
        run.approvedByName = adminUser.fullName;
        run.approvedAt = new Date();
      }
      await run.save();
    }

    // 2. Ensure or find SalarySlip for this employee & period
    let slip = await this.slipModel.findOne({
      employeeId: employee._id,
      payPeriod: period,
    });

    if (!slip) {
      const count = await this.slipModel.countDocuments({ payrollRunId: run._id });
      const slipNumber = `SLIP-${period.replace('-', '')}-${(count + 1).toString().padStart(4, '0')}`;
      const totalDeductionsPaise =
        (structure.pfDeductionPaise || 0) +
        (structure.taxDeductionPaise || 0) +
        (structure.otherDeductionsPaise || 0);

      slip = new this.slipModel({
        slipNumber,
        payrollRunId: run._id,
        employeeId: employee._id,
        payPeriod: period,
        employeeSnapshot: {
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          designation: employee.designation,
          department: employee.department,
          bankName: employee.bankDetails.bankName,
          accountNumber: employee.bankDetails.accountNumber,
          ifscCode: employee.bankDetails.ifscCode,
          panNumber: employee.bankDetails.panNumber,
        },
        daysInMonth: 30,
        payableDays: 30,
        lossOfPayDays: 0,
        basicPaise: structure.basicSalaryPaise,
        basic: structure.basicSalary,
        hraPaise: structure.hraPaise || 0,
        hra: structure.hra || 0,
        allowancesPaise: structure.allowancesPaise || 0,
        allowances: structure.allowances || 0,
        grossEarningsPaise: structure.grossSalaryPaise,
        grossEarnings: structure.grossSalary,
        pfDeductionPaise: structure.pfDeductionPaise || 0,
        pfDeduction: structure.pfDeduction || 0,
        taxDeductionPaise: structure.taxDeductionPaise || 0,
        taxDeduction: structure.taxDeduction || 0,
        otherDeductionsPaise: structure.otherDeductionsPaise || 0,
        otherDeductions: structure.otherDeductions || 0,
        totalDeductionsPaise,
        totalDeductions: CurrencyUtil.toInr(totalDeductionsPaise),
        netPayablePaise: structure.netSalaryPaise,
        netPayable: structure.netSalary,
        paidAmountPaise: 0,
        paidAmount: 0,
        remainingPaise: structure.netSalaryPaise,
        remaining: structure.netSalary,
        paymentStatus: SalarySlipPaymentStatus.UNPAID,
      });
      await slip.save();

      // Update run totals
      run.totalEmployees += 1;
      run.totalGrossPaise += structure.grossSalaryPaise;
      run.totalGross = CurrencyUtil.toInr(run.totalGrossPaise);
      run.totalDeductionsPaise += totalDeductionsPaise;
      run.totalDeductions = CurrencyUtil.toInr(run.totalDeductionsPaise);
      run.totalNetPayablePaise += structure.netSalaryPaise;
      run.totalNetPayable = CurrencyUtil.toInr(run.totalNetPayablePaise);
      run.totalOutstandingPaise += structure.netSalaryPaise;
      run.totalOutstanding = CurrencyUtil.toInr(run.totalOutstandingPaise);
      await run.save();
    }

    // 3. Disburse the slip using the standard disbursement engine
    const result = await this.disburseSalarySlip(
      slip._id.toString(),
      {
        amount: dto.amount || slip.remaining,
        paymentMethod: dto.paymentMethod,
        transactionReference: dto.transactionReference,
        notes: dto.notes,
        receiptDocumentRef: dto.receiptDocumentRef,
      },
      adminUser,
    );

    return {
      message: `Salary of ₹${dto.amount || slip.remaining} successfully paid to ${employee.fullName}`,
      employee: {
        id: employee._id,
        code: employee.employeeCode,
        fullName: employee.fullName,
      },
      slip: result.slip,
      disbursement: result.disbursement,
      run: result.run,
    };
  }
}
