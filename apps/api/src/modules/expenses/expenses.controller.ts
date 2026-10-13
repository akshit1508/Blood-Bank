import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ExpensesService } from './expenses.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  SubmitExpenseDto,
  ResubmitExpenseDto,
  ApproveExpenseDto,
  RejectExpenseDto,
  QueryExpensesDto,
} from './dto/expense.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  /**
   * Internal operation: Create a new draft expense.
   * POST /api/expenses
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateExpenseDto,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const data = await this.expensesService.createExpense(dto, currentAdmin);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Expense draft created successfully',
      data,
    };
  }

  /**
   * Internal operation: List & filter expenses with pagination.
   * GET /api/expenses
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get()
  async findAll(@Query() query: QueryExpensesDto) {
    const result = await this.expensesService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Expenses retrieved successfully',
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Internal operation: Aggregate financial KPI summary metrics.
   * GET /api/expenses/summary
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get('summary')
  async getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.expensesService.getSummary(startDate, endDate);
    return {
      statusCode: HttpStatus.OK,
      message: 'Expense financial summary retrieved successfully',
      data,
    };
  }

  /**
   * Internal operation: Check for duplicate invoice numbers for a given vendor.
   * GET /api/expenses/check-invoice
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get('check-invoice')
  async checkInvoice(
    @Query('vendorName') vendorName: string,
    @Query('invoiceNumber') invoiceNumber: string,
    @Query('excludeId') excludeId?: string,
  ) {
    const data = await this.expensesService.checkDuplicateInvoice(
      vendorName,
      invoiceNumber,
      excludeId,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Duplicate invoice check completed',
      data,
    };
  }

  /**
   * Internal operation: Get single expense with audit history.
   * GET /api/expenses/:id
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get(':id')
  async findById(@Param('id') id: string) {
    const data = await this.expensesService.findById(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Expense details retrieved successfully',
      data,
    };
  }

  /**
   * Internal operation: Update draft or rejected expense.
   * PATCH /api/expenses/:id
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const data = await this.expensesService.updateExpense(id, dto, currentAdmin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Expense updated successfully',
      data,
    };
  }

  /**
   * Internal operation: Soft-delete draft expense.
   * DELETE /api/expenses/:id
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const result = await this.expensesService.deleteExpense(id, currentAdmin);
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Internal operation: Upload and attach bill/receipt document.
   * POST /api/expenses/:id/receipt
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post(':id/receipt')
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentAdmin() currentAdmin: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required for receipt upload.');
    }
    const data = await this.expensesService.uploadReceipt(id, file, currentAdmin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Receipt document uploaded and verified successfully',
      data,
    };
  }

  /**
   * Internal operation: Stream attached private receipt securely.
   * GET /api/expenses/:id/receipt
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Get(':id/receipt')
  async streamReceipt(@Param('id') id: string, @Res() res: Response) {
    const { stream, originalName, mimeType, sizeBytes } =
      await this.expensesService.getReceiptStream(id);

    res.set({
      'Content-Type': mimeType,
      'Content-Length': sizeBytes,
      'Content-Disposition': `inline; filename="${encodeURIComponent(originalName)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-transform, max-age=3600',
    });

    stream.pipe(res);
  }

  /**
   * Internal operation: Remove attached receipt from draft/rejected expense.
   * DELETE /api/expenses/:id/receipt
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Delete(':id/receipt')
  async removeReceipt(
    @Param('id') id: string,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const data = await this.expensesService.removeReceipt(id, currentAdmin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Receipt removed successfully',
      data,
    };
  }

  /**
   * Internal operation: Submit draft expense for Super Admin review.
   * POST /api/expenses/:id/submit
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post(':id/submit')
  async submit(
    @Param('id') id: string,
    @Body() dto: SubmitExpenseDto,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const data = await this.expensesService.submitExpense(id, dto, currentAdmin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Expense submitted for Super Admin review successfully',
      data,
    };
  }

  /**
   * Internal operation: Resubmit rejected expense with corrections.
   * POST /api/expenses/:id/resubmit
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post(':id/resubmit')
  async resubmit(
    @Param('id') id: string,
    @Body() dto: ResubmitExpenseDto,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const data = await this.expensesService.resubmitExpense(id, dto, currentAdmin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Expense resubmitted with corrections successfully',
      data,
    };
  }

  /**
   * Internal operation: Approve submitted expense.
   * Enforces segregation of duties (Super Admin cannot approve own submitted expense).
   * POST /api/expenses/:id/approve
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveExpenseDto,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const data = await this.expensesService.approveExpense(id, dto, currentAdmin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Expense approved successfully',
      data,
    };
  }

  /**
   * Internal operation: Reject submitted expense with mandatory reason.
   * Enforces segregation of duties (Super Admin cannot reject own submitted expense).
   * POST /api/expenses/:id/reject
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectExpenseDto,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const data = await this.expensesService.rejectExpense(id, dto, currentAdmin);
    return {
      statusCode: HttpStatus.OK,
      message: 'Expense rejected and returned to operator for correction',
      data,
    };
  }
}
