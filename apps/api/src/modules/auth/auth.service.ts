import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { AdminUser, AdminUserDocument, AdminRole } from './schemas/admin-user.schema';
import { AdminLoginDto, CreateAdminDto } from './dto/admin-auth.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(AdminUser.name)
    private readonly adminModel: Model<AdminUserDocument>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultAdminIfEmpty();
  }

  /**
   * Retrieves the cryptographically secure signing secret from environment configuration.
   * Fails safe with an informative fatal error if no secret is configured.
   * In production, blocks startup if an insecure, default, or short secret is detected.
   */
  getSecretKey(): string {
    let secret =
      this.configService.get<string>('AUTH_SESSION_SECRET') ||
      this.configService.get<string>('JWT_SECRET');

    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    if (!secret || secret.trim() === '') {
      if (isProd) {
        throw new Error(
          'FATAL AUTHENTICATION ERROR: Neither AUTH_SESSION_SECRET nor JWT_SECRET is configured. ' +
          'Please define AUTH_SESSION_SECRET in your environment before starting the application.',
        );
      }
      secret = 'blood-bank-admin-secure-auth-secret-key-2026';
    }

    if (isProd) {
      if (
        secret === 'super-secret-jwt-key-replace-in-production' ||
        secret === 'blood-bank-admin-secure-auth-secret-key-2026' ||
        secret.length < 32
      ) {
        throw new Error(
          'FATAL SECURITY CONFIGURATION ERROR: Production environment detected with an insecure, default, or short signing secret. ' +
          'Configure a cryptographically random secret of at least 32 characters in AUTH_SESSION_SECRET.',
        );
      }
    }

    return secret.trim();
  }

  /**
   * Automatically bootstrap initial accounts into MongoDB without overwriting existing accounts.
   * - INITIAL_SUPER_ADMIN_EMAIL / INITIAL_SUPER_ADMIN_PASSWORD -> SUPER_ADMIN
   * - INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD -> ADMIN
   * - INITIAL_LAB_TECH_EMAIL / INITIAL_LAB_TECH_PASSWORD -> LAB_TECHNICIAN
   * Never overwrites or resets an existing administrator.
   * Requires explicit environment credentials and never logs passwords.
   */
  async seedDefaultAdminIfEmpty() {
    try {
      const isProd = this.configService.get<string>('NODE_ENV') === 'production';

      // 1. Initial Super Admin Provisioning
      const superAdminEmail = (
        this.configService.get<string>('INITIAL_SUPER_ADMIN_EMAIL') ||
        this.configService.get<string>('INITIAL_ADMIN_EMAIL') ||
        'superadmin@bloodbank.org'
      ).toLowerCase().trim();

      const existingSuperAdmin = await this.adminModel.findOne({ email: superAdminEmail });
      const hasAnySuperAdmin = (await this.adminModel.countDocuments({ role: AdminRole.SUPER_ADMIN })) > 0;

      if (!existingSuperAdmin && !hasAnySuperAdmin) {
        const superAdminPassword =
          this.configService.get<string>('INITIAL_SUPER_ADMIN_PASSWORD') ||
          this.configService.get<string>('INITIAL_ADMIN_PASSWORD');

        if (!superAdminPassword || superAdminPassword.trim() === '') {
          if (isProd) {
            throw new Error(
              'FATAL SECURITY ERROR: INITIAL_SUPER_ADMIN_PASSWORD must be configured in production when no SUPER_ADMIN exists.',
            );
          } else {
            this.logger.warn(
              'INITIAL_SUPER_ADMIN_PASSWORD is not set. Super admin initial bootstrap skipped.',
            );
          }
        } else {
          const { hash, salt } = this.hashPassword(superAdminPassword.trim());
          await this.adminModel.create({
            email: superAdminEmail,
            passwordHash: hash,
            passwordSalt: salt,
            fullName: 'Super Administrator',
            designation: 'Director of Blood Bank & Operations',
            role: AdminRole.SUPER_ADMIN,
            isActive: true,
            lastLoginAt: null,
          });
          this.logger.log(`Initial Super Administrator provisioned: ${superAdminEmail}`);
        }
      }

      // 2. Initial Admin Provisioning (if configured and not already existing)
      const adminEmail = this.configService.get<string>('INITIAL_ADMIN_EMAIL')?.toLowerCase().trim();
      const adminPassword = this.configService.get<string>('INITIAL_ADMIN_PASSWORD')?.trim();

      if (adminEmail && adminPassword && adminEmail !== superAdminEmail) {
        const existingAdmin = await this.adminModel.findOne({ email: adminEmail });
        if (!existingAdmin) {
          const { hash, salt } = this.hashPassword(adminPassword);
          await this.adminModel.create({
            email: adminEmail,
            passwordHash: hash,
            passwordSalt: salt,
            fullName: 'Operations Administrator',
            designation: 'Blood Bank Officer',
            role: AdminRole.ADMIN,
            isActive: true,
            lastLoginAt: null,
          });
          this.logger.log(`Initial Administrator provisioned: ${adminEmail}`);
        }
      }

      // 3. Initial Lab Technician Provisioning (if configured and not already existing)
      const labEmail = this.configService.get<string>('INITIAL_LAB_TECH_EMAIL')?.toLowerCase().trim();
      const labPassword = this.configService.get<string>('INITIAL_LAB_TECH_PASSWORD')?.trim();

      if (labEmail && labPassword) {
        const existingLab = await this.adminModel.findOne({ email: labEmail });
        if (!existingLab) {
          const { hash, salt } = this.hashPassword(labPassword);
          await this.adminModel.create({
            email: labEmail,
            passwordHash: hash,
            passwordSalt: salt,
            fullName: 'Chief Laboratory Technician',
            designation: 'Senior Screening Technologist',
            role: AdminRole.LAB_TECHNICIAN,
            isActive: true,
            lastLoginAt: null,
          });
          this.logger.log(`Initial Lab Technician provisioned: ${labEmail}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Administrator initialization failed: ${err.message}`);
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw err;
      }
    }
  }

  /**
   * Hashes a password with cryptographically secure salt using Node native scrypt.
   */
  hashPassword(
    password: string,
    salt: string = crypto.randomBytes(16).toString('hex'),
  ): { hash: string; salt: string } {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
  }

  /**
   * Verifies password against saved hash and salt using timing-safe comparison.
   */
  verifyPassword(password: string, hash: string, salt: string): boolean {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(hash, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Authenticates admin with email and password from MongoDB admins collection.
   */
  async login(loginDto: AdminLoginDto) {
    const { email, password } = loginDto;
    const admin = await this.adminModel.findOne({ email: email.toLowerCase().trim() });

    if (!admin) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('Admin account has been deactivated. Please contact the system administrator.');
    }

    const isValid = this.verifyPassword(password, admin.passwordHash, admin.passwordSalt);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Update lastLoginAt
    admin.lastLoginAt = new Date();
    await admin.save();

    // Generate lightweight signed token (base64 payload + hmac signature)
    const token = this.generateSessionToken(admin._id.toString(), admin.email, admin.role);

    return {
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        fullName: admin.fullName,
        designation: admin.designation,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
      },
    };
  }

  /**
   * Validates token and returns current admin profile from database.
   */
  async validateSession(token: string) {
    const payload = this.verifySessionToken(token);
    if (!payload || !payload.id) {
      throw new UnauthorizedException('Session is invalid or expired.');
    }

    const admin = await this.adminModel.findById(payload.id);
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Admin account not found or deactivated.');
    }

    return {
      id: admin._id,
      email: admin.email,
      fullName: admin.fullName,
      designation: admin.designation,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt,
    };
  }

  /**
   * Retrieves all staff accounts excluding sensitive password hashes and salts.
   * Restricted to SUPER_ADMIN.
   */
  async findAllAdmins() {
    return this.adminModel
      .find({})
      .select('-passwordHash -passwordSalt')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Creates a new staff account (ADMIN or LAB_TECHNICIAN only).
   * Restricted to SUPER_ADMIN.
   */
  async createOrUpdateAdmin(createDto: CreateAdminDto) {
    const email = createDto.email.toLowerCase().trim();
    const existing = await this.adminModel.findOne({ email });

    if (existing) {
      throw new BadRequestException({
        statusCode: 409,
        message: `An account with email '${email}' already exists in the system.`,
        error: 'Conflict',
      });
    }

    // Explicitly reject SUPER_ADMIN creation
    if ((createDto.role as any) === AdminRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot create Super Admin accounts through staff management.');
    }

    const { hash, salt } = this.hashPassword(createDto.password);

    const created = await this.adminModel.create({
      email,
      passwordHash: hash,
      passwordSalt: salt,
      fullName: createDto.fullName,
      designation: createDto.designation || (createDto.role === AdminRole.LAB_TECHNICIAN ? 'Laboratory Technician' : 'Blood Bank Officer'),
      role: createDto.role,
      isActive: true,
      lastLoginAt: null,
    });

    return {
      id: created._id,
      email: created.email,
      fullName: created.fullName,
      designation: created.designation,
      role: created.role,
      isActive: created.isActive,
      message: `Staff account '${email}' created successfully as ${createDto.role}.`,
    };
  }

  /**
   * Toggles active status of a staff account with self-deactivation and last-admin guards.
   * Restricted to SUPER_ADMIN.
   */
  async updateAdminStatus(targetId: string, isActive: boolean, currentAdminId: string) {
    if (String(targetId).trim() === String(currentAdminId).trim()) {
      throw new BadRequestException('Security violation: You cannot deactivate your own active account.');
    }

    const target = await this.adminModel.findById(targetId);
    if (!target) {
      throw new BadRequestException('Staff account not found.');
    }

    // If deactivating a SUPER_ADMIN, ensure at least one other active SUPER_ADMIN remains
    if (target.role === AdminRole.SUPER_ADMIN && !isActive) {
      const activeSuperAdmins = await this.adminModel.countDocuments({
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
      });

      if (activeSuperAdmins <= 1) {
        throw new BadRequestException(
          'Security violation: Cannot deactivate the last remaining active Super Administrator.',
        );
      }
    }

    target.isActive = isActive;
    await target.save();

    return {
      id: target._id,
      email: target.email,
      fullName: target.fullName,
      role: target.role,
      isActive: target.isActive,
      message: `Account '${target.email}' status updated to ${isActive ? 'ACTIVE' : 'DEACTIVATED'}.`,
    };
  }

  generateSessionToken(id: string, email: string, role: string = AdminRole.ADMIN): string {
    const payload = JSON.stringify({
      id,
      email,
      role,
      iat: Date.now(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    const b64Payload = Buffer.from(payload).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.getSecretKey())
      .update(b64Payload)
      .digest('base64url');
    return `${b64Payload}.${signature}`;
  }

  verifySessionToken(token: string): any {
    try {
      const [b64Payload, signature] = token.split('.');
      if (!b64Payload || !signature) return null;

      const expectedSignature = crypto
        .createHmac('sha256', this.getSecretKey())
        .update(b64Payload)
        .digest('base64url');

      if (signature !== expectedSignature) return null;

      const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
      if (payload.exp && Date.now() > payload.exp) return null;

      return payload;
    } catch {
      return null;
    }
  }
}
