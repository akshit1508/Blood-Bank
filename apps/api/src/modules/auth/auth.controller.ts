import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto, CreateAdminDto } from './dto/admin-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  @Get('me')
  async getMe(@Headers('authorization') authHeader?: string) {
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

  @Post('create-admin')
  async createAdmin(@Body() createDto: CreateAdminDto) {
    const result = await this.authService.createOrUpdateAdmin(createDto);
    return {
      success: true,
      data: result,
    };
  }
}
