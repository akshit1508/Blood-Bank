import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  AdminLoginDto,
  CreateAdminDto,
  UpdateAdminDto,
  UpdateAdminStatusDto,
  QueryAdminDto,
} from './dto/admin-auth.dto';
import { AdminRole } from './schemas/admin-user.schema';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { CurrentAdmin } from './decorators/current-admin.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Public administrative login endpoint to issue session token.
   * POST /api/auth/login
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: AdminLoginDto) {
    const result = await this.authService.login(loginDto);
    return {
      success: true,
      data: result,
      message: 'Admin logged in successfully',
    };
  }

  /**
   * Validates active admin session and returns administrator profile.
   * GET /api/auth/me
   */
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN, AdminRole.FINANCE_RECEPTIONIST)
  @Get('me')
  async getMe(
    @CurrentAdmin() currentAdmin?: any,
    @Headers('authorization') authHeader?: string,
  ) {
    if (currentAdmin) {
      return {
        success: true,
        data: currentAdmin,
      };
    }

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing.');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const admin = await this.authService.validateSession(token);
    return {
      success: true,
      data: admin,
    };
  }

  /**
   * Retrieves all staff accounts (sanitized, zero password hashes).
   * Supports search queries by name/email/designation and role/status filtering.
   * Restricted to SUPER_ADMIN.
   * GET /api/auth/admins
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Get('admins')
  async getAdmins(@Query() query: QueryAdminDto) {
    const admins = await this.authService.findAllAdmins(query);
    return {
      success: true,
      data: admins,
    };
  }

  /**
   * Provisions a staff account under any allowed role.
   * Restricted strictly to SUPER_ADMIN.
   * POST /api/auth/create-admin
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Post('create-admin')
  async createAdmin(
    @Body() createDto: CreateAdminDto,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const result = await this.authService.createOrUpdateAdmin(createDto, currentAdmin);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Updates a staff account's full name, designation, role, status, or resets password.
   * Restricted strictly to SUPER_ADMIN.
   * PATCH /api/auth/admins/:id
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Patch('admins/:id')
  async updateAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const result = await this.authService.updateAdmin(id, dto, currentAdmin);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Toggles active/deactivated status of a staff account. Restricted to SUPER_ADMIN.
   * PATCH /api/auth/admins/:id/status
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Patch('admins/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAdminStatusDto,
    @CurrentAdmin() currentAdmin: any,
  ) {
    const result = await this.authService.updateAdminStatus(
      id,
      dto.isActive,
      currentAdmin?.id || currentAdmin?._id,
    );
    return {
      success: true,
      data: result,
    };
  }
}
