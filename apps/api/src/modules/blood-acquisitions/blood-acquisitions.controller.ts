import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { BloodAcquisitionsService } from './blood-acquisitions.service';
import { CreateBloodAcquisitionDto } from './dto/create-blood-acquisition.dto';
import { RecordAcquisitionAdjustmentDto } from './dto/record-adjustment.dto';
import { QueryBloodAcquisitionsDto } from './dto/query-blood-acquisitions.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

/**
 * Controller for managing External Blood Acquisitions / Receipts and Costing.
 */
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller('blood-acquisitions')
export class BloodAcquisitionsController {
  constructor(
    private readonly bloodAcquisitionsService: BloodAcquisitionsService,
  ) {}

  /**
   * Records a new external blood receipt event with bulk entries,
   * generates individual Blood Units, and adds pre-cleared units to inventory.
   * POST /api/blood-acquisitions
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateBloodAcquisitionDto,
    @CurrentAdmin() currentAdmin: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const result = await this.bloodAcquisitionsService.create(
      createDto,
      currentAdmin,
      idempotencyKey,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: `External blood receipt '${result.receipt.receiptCode}' registered successfully with ${result.totalUnitsCreated} units created.`,
      data: result,
    };
  }

  /**
   * Retrieves summary metrics for acquisition dashboard stat cards.
   * GET /api/blood-acquisitions/summary
   */
  @Get('summary')
  async getSummary() {
    const stats = await this.bloodAcquisitionsService.getSummary();
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood acquisition summary retrieved successfully',
      data: stats,
    };
  }

  /**
   * Lists external receipts with filtering and pagination.
   * GET /api/blood-acquisitions
   */
  @Get()
  async findAll(@Query() query: QueryBloodAcquisitionsDto) {
    const result = await this.bloodAcquisitionsService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood acquisition receipts retrieved successfully',
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Retrieves a single receipt by ID or human-readable receiptCode.
   * GET /api/blood-acquisitions/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const receipt = await this.bloodAcquisitionsService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Blood acquisition receipt details retrieved successfully',
      data: receipt,
    };
  }

  /**
   * Retrieves all individual Blood Units generated from a specific receipt.
   * GET /api/blood-acquisitions/:id/units
   */
  @Get(':id/units')
  async findUnits(@Param('id') id: string) {
    const units = await this.bloodAcquisitionsService.findUnitsByReceiptId(id);
    return {
      statusCode: HttpStatus.OK,
      message: `Blood units for receipt retrieved successfully (${units.length} units)`,
      data: units,
    };
  }

  /**
   * Records a supplier credit note / adjustment against an acquisition receipt.
   * POST /api/blood-acquisitions/:id/adjustments
   */
  @Post(':id/adjustments')
  async recordAdjustment(
    @Param('id') id: string,
    @Body() dto: RecordAcquisitionAdjustmentDto,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const receipt = await this.bloodAcquisitionsService.recordAdjustment(
      id,
      dto,
      currentAdmin,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Credit adjustment recorded successfully',
      data: receipt,
    };
  }

  /**
   * Uploads and attaches invoice/bill document for an acquisition receipt.
   * POST /api/blood-acquisitions/:id/invoice
   */
  @Post(':id/invoice')
  @UseInterceptors(FileInterceptor('file'))
  async uploadInvoice(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentAdmin() currentAdmin: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required for invoice upload.');
    }
    const receipt = await this.bloodAcquisitionsService.attachInvoiceDocument(
      id,
      file,
      currentAdmin,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Acquisition invoice uploaded and verified successfully',
      data: receipt,
    };
  }

  /**
   * Uploads and attaches medical clearance certificate document for an acquisition receipt.
   * POST /api/blood-acquisitions/:id/certificate
   */
  @Post(':id/certificate')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCertificate(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentAdmin() currentAdmin: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required for certificate upload.');
    }
    const receipt = await this.bloodAcquisitionsService.attachCertificateDocument(
      id,
      file,
      currentAdmin,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Clearance certificate uploaded and verified successfully',
      data: receipt,
    };
  }

  /**
   * Streams attached acquisition invoice securely.
   * GET /api/blood-acquisitions/:id/invoice-file
   */
  @Get(':id/invoice-file')
  async streamInvoice(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, fileId } = await this.bloodAcquisitionsService.getDocumentStream(
      id,
      'invoice',
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice_${fileId}.bin"`,
      'X-Content-Type-Options': 'nosniff',
    });
    stream.pipe(res);
  }

  /**
   * Streams attached clearance certificate securely.
   * GET /api/blood-acquisitions/:id/certificate-file
   */
  @Get(':id/certificate-file')
  async streamCertificate(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, fileId } = await this.bloodAcquisitionsService.getDocumentStream(
      id,
      'certificate',
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="clearance_${fileId}.bin"`,
      'X-Content-Type-Options': 'nosniff',
    });
    stream.pipe(res);
  }
}
