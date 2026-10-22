import { Controller, Get, Query, Param } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '../auth/schemas/admin-user.schema';
import { QueryAuditLogDto } from './dto/audit-log.dto';
import { AuditEntityType } from './constants/audit-log.constants';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async findAll(@Query() query: QueryAuditLogDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get('summary')
  @Roles(AdminRole.SUPER_ADMIN)
  async getSummary() {
    return this.auditLogsService.getStaffActivitySummary();
  }

  @Get('entity/:entityType/:entityId')
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.LAB_TECHNICIAN,
    AdminRole.FINANCE_RECEPTIONIST,
  )
  async findByEntity(
    @Param('entityType') entityType: AuditEntityType,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogsService.findByEntity(entityType, entityId);
  }
}
