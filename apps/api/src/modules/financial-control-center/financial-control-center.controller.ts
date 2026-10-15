import {
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { FinancialControlCenterService } from './services/financial-control-center.service';
import { FinancialExportService } from './services/financial-export.service';
import { QueryFinancialKpiDto } from './dto/query-financial-kpi.dto';
import { QueryFinancialLedgerDto } from './dto/query-financial-ledger.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';

@Roles(AdminRole.SUPER_ADMIN)
@Controller('financial-control-center')
export class FinancialControlCenterController {
  constructor(
    private readonly controlCenterService: FinancialControlCenterService,
    private readonly exportService: FinancialExportService,
  ) {}

  /**
   * Super Admin operation: Authoritative financial KPI summary across all business modules.
   * GET /api/financial-control-center/kpi
   */
  @Get('kpi')
  async getKpiSummary(@Query() dto: QueryFinancialKpiDto) {
    const data = await this.controlCenterService.getFinancialKpiSummary(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Financial KPI summary retrieved successfully',
      data,
    };
  }

  /**
   * Super Admin operation: Unified, searchable, paginated Central Financial Transaction Ledger.
   * GET /api/financial-control-center/ledger
   */
  @Get('ledger')
  async getLedger(@Query() dto: QueryFinancialLedgerDto) {
    const data = await this.controlCenterService.getFinancialLedger(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Financial ledger retrieved successfully',
      data: data.items,
      meta: {
        total: data.total,
        page: data.page,
        limit: data.limit,
        totalPages: data.totalPages,
        period: data.period,
      },
    };
  }

  /**
   * Super Admin operation: Inflows vs Outflows timeline trends for charting.
   * GET /api/financial-control-center/trends
   */
  @Get('trends')
  async getTrends(@Query() dto: QueryFinancialKpiDto) {
    const data = await this.controlCenterService.getFinancialTrends(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Financial timeline trends retrieved successfully',
      data,
    };
  }

  /**
   * Super Admin operation: Export formula-sanitized CSV matching filtered ledger.
   * GET /api/financial-control-center/export/csv
   */
  @Get('export/csv')
  async exportCsv(@Query() dto: QueryFinancialLedgerDto, @Res() res: Response) {
    const { filename, csv } = await this.exportService.generateLedgerCsv(dto);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).send(csv);
  }
}
