import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ReceptionistService } from './receptionist.service';
import {
  ReceptionistDashboardQueryDto,
  AttachDocumentDto,
  VerifyDocumentsDto,
} from './dto/receptionist-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';

@Roles(
  AdminRole.SUPER_ADMIN,
  AdminRole.ADMIN,
  AdminRole.FINANCE_RECEPTIONIST,
)
@Controller('receptionist')
export class ReceptionistController {
  constructor(private readonly receptionistService: ReceptionistService) {}

  /**
   * Retrieves live operational and financial dashboard metrics for the Finance Receptionist.
   * GET /api/receptionist/dashboard
   */
  @Get('dashboard')
  async getDashboard(@Query() query: ReceptionistDashboardQueryDto) {
    const data = await this.receptionistService.getDashboardMetrics(query);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Searches for existing patients across blood requests by name, phone, or case number.
   * GET /api/receptionist/patients/search?q=...
   */
  @Get('patients/search')
  async searchPatients(@Query('q') q: string) {
    const data = await this.receptionistService.searchPatients(q || '');
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  /**
   * Attaches a verified supporting document to a patient's blood request.
   * POST /api/receptionist/requests/:id/documents
   */
  @Post('requests/:id/documents')
  @HttpCode(HttpStatus.CREATED)
  async attachDocument(
    @Param('id') id: string,
    @Body() dto: AttachDocumentDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.receptionistService.attachDocument(id, dto, admin);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Supporting document attached successfully',
      data,
    };
  }

  /**
   * Verifies all patient documents and advances blood request status from REQUESTED -> VERIFIED.
   * POST /api/receptionist/requests/:id/verify-documents
   */
  @Post('requests/:id/verify-documents')
  @HttpCode(HttpStatus.OK)
  async verifyDocuments(
    @Param('id') id: string,
    @Body() dto: VerifyDocumentsDto,
    @CurrentAdmin() admin: any,
  ) {
    const data = await this.receptionistService.verifyDocuments(id, dto, admin);
    return {
      statusCode: HttpStatus.OK,
      message: `Documents marked ${dto.status}`,
      data,
    };
  }
}
