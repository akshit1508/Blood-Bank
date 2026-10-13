import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

export interface StoredFileMetadata {
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storedPath: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private storageDir: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const configuredDir =
      this.configService.get<string>('RECEIPT_STORAGE_DIR') ||
      path.resolve(process.cwd(), 'storage/receipts');

    this.storageDir = path.resolve(configuredDir);

    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    if (isProd) {
      this.logger.log(`[STORAGE] Production storage directory verified: ${this.storageDir}`);
    }

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      this.logger.log(`Created receipt storage directory at: ${this.storageDir}`);
    }
  }

  /**
   * Validates file mime-type and magic bytes for PDF and images.
   */
  validateFileMagicBytes(buffer: Buffer, mimeType: string): boolean {
    if (!buffer || buffer.length < 4) return false;

    // PDF signature: %PDF (25 50 44 46)
    if (mimeType === 'application/pdf') {
      return (
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
      );
    }

    // JPEG signature: FF D8 FF
    if (mimeType === 'image/jpeg') {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    // PNG signature: 89 50 4E 47
    if (mimeType === 'image/png') {
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    }

    // WEBP signature: RIFF....WEBP
    if (mimeType === 'image/webp') {
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }

    return false;
  }

  async saveReceipt(file: Express.Multer.File, fileId: string): Promise<StoredFileMetadata> {
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        message: 'Invalid receipt file type. Only PDF, JPEG, PNG, and WEBP documents are allowed.',
        code: 'INVALID_FILE_TYPE',
      });
    }

    const isValidMagic = this.validateFileMagicBytes(file.buffer, file.mimetype);
    if (!isValidMagic) {
      throw new BadRequestException({
        message: 'Receipt file signature does not match declared MIME type.',
        code: 'FILE_SIGNATURE_MISMATCH',
      });
    }

    // Max 10MB
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException({
        message: 'Receipt file size exceeds maximum limit of 10 MB.',
        code: 'FILE_TOO_LARGE',
      });
    }

    const safeFilename = `receipt_${fileId}.bin`;
    const targetPath = path.join(this.storageDir, safeFilename);

    await fs.promises.writeFile(targetPath, file.buffer);

    return {
      fileId,
      originalName: file.originalname || 'receipt',
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storedPath: targetPath,
    };
  }

  getReceiptStream(fileId: string): { stream: Readable; exists: boolean } {
    const safeFilename = `receipt_${fileId}.bin`;
    const targetPath = path.join(this.storageDir, safeFilename);

    if (!fs.existsSync(targetPath)) {
      return { stream: null as any, exists: false };
    }

    const stream = fs.createReadStream(targetPath);
    return { stream, exists: true };
  }

  async deleteReceipt(fileId: string): Promise<boolean> {
    const safeFilename = `receipt_${fileId}.bin`;
    const targetPath = path.join(this.storageDir, safeFilename);

    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
      return true;
    }
    return false;
  }
}
