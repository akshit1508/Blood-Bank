import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto, CreateAdminDto, UpdateAdminStatusDto } from './dto/admin-auth.dto';
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
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.LAB_TECHNICIAN)
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
   * Restricted to SUPER_ADMIN.
   * GET /api/auth/admins
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Get('admins')
  async getAdmins() {
    const admins = await this.authService.findAllAdmins();
    return {
      success: true,
      data: admins,
    };
  }

  /**
   * Provisions a staff account (ADMIN or LAB_TECHNICIAN). Restricted strictly to SUPER_ADMIN.
   * POST /api/auth/create-admin
   */
  @Roles(AdminRole.SUPER_ADMIN)
  @Post('create-admin')
  async createAdmin(@Body() createDto: CreateAdminDto) {
    const result = await this.authService.createOrUpdateAdmin(createDto);
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
