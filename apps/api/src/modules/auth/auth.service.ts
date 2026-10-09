import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
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
  ) {}

  async onModuleInit() {
    await this.seedDefaultAdminIfEmpty();
  }

  /**
   * Automatically bootstrap initial administrator into MongoDB if no admin exists.
   */
  async seedDefaultAdminIfEmpty() {
    try {
      const count = await this.adminModel.countDocuments();
      if (count === 0) {
        this.logger.log('No admins found in database. Seeding default system administrator...');
        const defaultEmail = 'admin@bloodbank.org';
        const defaultPassword = 'Admin@123456';
        const { hash, salt } = this.hashPassword(defaultPassword);

        await this.adminModel.create({
          email: defaultEmail.toLowerCase(),
          passwordHash: hash,
          passwordSalt: salt,
          fullName: 'Admin',
          designation: 'Chief Lab & Blood Bank Administrator',
          role: AdminRole.SUPER_ADMIN,
          isActive: true,
          lastLoginAt: null,
        });

        this.logger.log(`Default administrator seeded successfully into MongoDB: ${defaultEmail}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to seed default admin: ${err.message}`);
    }
  }

  /**
   * Hashes a password with cryptographically secure salt using Node native scrypt.
   */
  hashPassword(password: string, salt: string = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
  }

  /**
   * Verifies password against saved hash and salt.
   */
  verifyPassword(password: string, hash: string, salt: string): boolean {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return testHash === hash;
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
    const token = this.generateSessionToken(admin._id.toString(), admin.email);

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
   * Validates token and returns current admin profile.
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
      lastLoginAt: admin.lastLoginAt,
    };
  }

  /**
   * Creates or updates admin directly in MongoDB.
   */
  async createOrUpdateAdmin(createDto: CreateAdminDto) {
    const email = createDto.email.toLowerCase().trim();
    const existing = await this.adminModel.findOne({ email });
    const { hash, salt } = this.hashPassword(createDto.password);

    if (existing) {
      existing.passwordHash = hash;
      existing.passwordSalt = salt;
      existing.fullName = createDto.fullName;
      if (createDto.designation) existing.designation = createDto.designation;
      existing.isActive = true;
      await existing.save();
      return { message: `Admin ${email} updated successfully in database.` };
    }

    await this.adminModel.create({
      email,
      passwordHash: hash,
      passwordSalt: salt,
      fullName: createDto.fullName,
      designation: createDto.designation || 'Blood Bank Officer',
      role: AdminRole.ADMIN,
      isActive: true,
      lastLoginAt: null,
    });

    return { message: `Admin ${email} created successfully in database.` };
  }

  private getSecretKey(): string {
    // Stable secret derived for HMAC session token validation
    return 'blood-bank-admin-secure-auth-secret-key-2026';
  }

  private generateSessionToken(id: string, email: string): string {
    const payload = JSON.stringify({
      id,
      email,
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

  private verifySessionToken(token: string): any {
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
