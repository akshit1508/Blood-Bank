import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession, isValidObjectId } from 'mongoose';
import * as crypto from 'crypto';
import {
  BloodIssueCollection,
  BloodIssueCollectionDocument,
} from '../schemas/blood-issue-collection.schema';
import {
  BloodIssueInvoice,
  BloodIssueInvoiceDocument,
} from '../schemas/blood-issue-invoice.schema';
import {
  InvoiceStatus,
  CollectionPaymentMethod,
} from '../constants/billing.constants';
import {
  RecordCollectionDto,
  ReverseCollectionDto,
} from '../dto/collection.dto';
import { QueryCollectionsDto } from '../dto/query-billing.dto';
import { CurrencyUtil } from '../../../common/utils/currency.util';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectModel(BloodIssueCollection.name)
    private readonly collectionModel: Model<BloodIssueCollectionDocument>,
    @InjectModel(BloodIssueInvoice.name)
    private readonly invoiceModel: Model<BloodIssueInvoiceDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  /**
   * Generates a unique money receipt voucher number.
   * Format: REC-YYYYMMDD-XXXX (e.g. REC-20261014-E4F5)
   */
  private generateReceiptNumber(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REC-${datePart}-${randomPart}`;
  }

  /**
   * Computes a canonical SHA-256 fingerprint of critical business fields for idempotency validation.
   */
  private computePayloadHash(
    invoiceId: string,
    amountPaise: number,
    paymentMethod: string,
    referenceNumber: string,
  ): string {
    const canonical = JSON.stringify({
      invoiceId: invoiceId.toString(),
      amountPaise,
      paymentMethod,
      referenceNumber: referenceNumber.trim().toUpperCase(),
    });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Records a payment collection against an invoice with ACID race-condition protection and idempotency.
   */
  async recordCollection(
    invoiceIdentifier: string,
    dto: RecordCollectionDto,
    user: { id?: string; email?: string; fullName?: string },
  ) {
    const amountPaise = CurrencyUtil.toPaise(dto.amount);
    if (amountPaise <= 0) {
      throw new BadRequestException({
        message: 'Collection amount must be greater than zero.',
        code: 'INVALID_COLLECTION_AMOUNT',
      });
    }

    // 1. Locate Invoice
    let invoice: BloodIssueInvoiceDocument | null = null;
    if (isValidObjectId(invoiceIdentifier)) {
      invoice = await this.invoiceModel.findById(invoiceIdentifier).exec();
    }
    if (!invoice) {
      invoice = await this.invoiceModel
        .findOne({ invoiceNumber: invoiceIdentifier.toUpperCase() })
        .exec();
    }

    if (!invoice) {
      throw new NotFoundException({
        message: `Invoice '${invoiceIdentifier}' was not found.`,
        code: 'INVOICE_NOT_FOUND',
      });
    }

    // 2. Validate Invoice status
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException({
        message: `Invoice '${invoice.invoiceNumber}' is CANCELLED. Collections cannot be received.`,
        code: 'INVOICE_CANCELLED',
      });
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException({
        message: `Invoice '${invoice.invoiceNumber}' is already PAID in full. Outstanding balance is ₹0.`,
        code: 'INVOICE_ALREADY_PAID',
      });
    }

    // 3. Check for Idempotency
    const idempotencyKey = dto.idempotencyKey?.trim();
    if (!idempotencyKey) {
      throw new BadRequestException({
        message: 'idempotencyKey is required to guarantee duplicate collection prevention.',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      });
    }

    const payloadHash = this.computePayloadHash(
      (invoice._id as any).toString(),
      amountPaise,
      dto.paymentMethod,
      dto.referenceNumber,
    );

    const existingCollection = await this.collectionModel
      .findOne({ idempotencyKey })
      .exec();

    if (existingCollection) {
      if (existingCollection.requestPayloadHash !== payloadHash) {
        throw new ConflictException({
          message: `Idempotency key '${idempotencyKey}' was already used with different payment details.`,
          code: 'IDEMPOTENCY_KEY_COLLISION',
        });
      }
      // Replay existing receipt idempotently
      return this.mapCollectionToDto(existingCollection);
    }

    // 4. Validate amount does not exceed outstanding balance
    if (amountPaise > invoice.outstandingPaise) {
      throw new BadRequestException({
        message: `Payment amount ₹${dto.amount.toFixed(2)} exceeds remaining outstanding balance ₹${invoice.outstandingAmount.toFixed(2)}.`,
        code: 'OVER_COLLECTION_NOT_ALLOWED',
        outstandingAmount: invoice.outstandingAmount,
      });
    }

    // 5. ACID Transactional Update
    let session: ClientSession | null = null;
    try {
      session = await this.connection.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    try {
      // Atomic conditional update on invoice balance
      const newCollectedPaise = invoice.collectedPaise + amountPaise;
      const newOutstandingPaise = Math.max(0, invoice.netPayablePaise - newCollectedPaise);
      const nextStatus =
        newOutstandingPaise === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_COLLECTED;

      const updatedInvoice = await this.invoiceModel.findOneAndUpdate(
        {
          _id: invoice._id,
          outstandingPaise: { $gte: amountPaise },
          status: { $ne: InvoiceStatus.CANCELLED },
        },
        {
          $set: {
            collectedPaise: newCollectedPaise,
            collectedAmount: CurrencyUtil.toInr(newCollectedPaise),
            outstandingPaise: newOutstandingPaise,
            outstandingAmount: CurrencyUtil.toInr(newOutstandingPaise),
            status: nextStatus,
          },
        },
        { new: true, session: session || undefined },
      );

      if (!updatedInvoice) {
        throw new ConflictException({
          message: 'Invoice balance was modified concurrently or payment exceeds remaining balance.',
          code: 'CONCURRENT_COLLECTION_CONFLICT',
        });
      }

      // Generate receipt number
      let receiptNumber = this.generateReceiptNumber();
      let attempts = 0;
      while (await this.collectionModel.exists({ receiptNumber })) {
        receiptNumber = this.generateReceiptNumber();
        attempts++;
        if (attempts > 5) {
          receiptNumber = `REC-${Date.now()}`;
          break;
        }
      }

      const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

      const [collection] = await this.collectionModel.create(
        [
          {
            receiptNumber,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            amountPaise,
            amount: CurrencyUtil.toInr(amountPaise),
            paymentMethod: dto.paymentMethod,
            referenceNumber: dto.referenceNumber.trim(),
            paymentDate,
            idempotencyKey,
            requestPayloadHash: payloadHash,
            collectedBy: user?.id ? new Types.ObjectId(user.id) : new Types.ObjectId(),
            collectedByName: user?.fullName || user?.email || 'Cashier',
            notes: dto.notes?.trim() || undefined,
            isReversed: false,
          },
        ],
        { session: session || undefined },
      );

      if (session) {
        await session.commitTransaction();
      }

      return this.mapCollectionToDto(collection);
    } catch (err: any) {
      if (session) {
        await session.abortTransaction();
      }
      if (err.code === 11000) {
        throw new ConflictException({
          message: 'A duplicate collection was detected with this idempotency key or receipt number.',
          code: 'DUPLICATE_COLLECTION',
        });
      }
      throw err;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  async findAll(query?: QueryCollectionsDto) {
    const filter: any = {};

    if (query?.paymentMethod) {
      filter.paymentMethod = query.paymentMethod;
    }
    if (query?.invoiceId && isValidObjectId(query.invoiceId)) {
      filter.invoiceId = new Types.ObjectId(query.invoiceId);
    }
    if (query?.invoiceNumber?.trim()) {
      filter.invoiceNumber = query.invoiceNumber.trim().toUpperCase();
    }
    if (query?.search?.trim()) {
      const s = query.search.trim();
      filter.$or = [
        { receiptNumber: new RegExp(s, 'i') },
        { invoiceNumber: new RegExp(s, 'i') },
        { referenceNumber: new RegExp(s, 'i') },
        { collectedByName: new RegExp(s, 'i') },
      ];
    }
    if (query?.startDate || query?.endDate) {
      filter.paymentDate = {};
      if (query.startDate) {
        filter.paymentDate.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.paymentDate.$lte = end;
      }
    }

    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 20));
    const skip = (page - 1) * limit;

    const [collections, total] = await Promise.all([
      this.collectionModel
        .find(filter)
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.collectionModel.countDocuments(filter).exec(),
    ]);

    return {
      data: collections.map((col) => this.mapCollectionToDto(col)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(identifier: string) {
    let collection: BloodIssueCollectionDocument | null = null;
    if (isValidObjectId(identifier)) {
      collection = await this.collectionModel.findById(identifier).exec();
    }
    if (!collection) {
      collection = await this.collectionModel
        .findOne({ receiptNumber: identifier.toUpperCase() })
        .exec();
    }

    if (!collection) {
      throw new NotFoundException({
        message: `Collection receipt '${identifier}' was not found.`,
        code: 'COLLECTION_NOT_FOUND',
      });
    }

    return this.mapCollectionToDto(collection);
  }

  async findByInvoiceId(invoiceIdentifier: string) {
    let invObjectId: Types.ObjectId | null = null;
    if (isValidObjectId(invoiceIdentifier)) {
      invObjectId = new Types.ObjectId(invoiceIdentifier);
    } else {
      const inv = await this.invoiceModel
        .findOne({ invoiceNumber: invoiceIdentifier.toUpperCase() })
        .exec();
      if (inv) {
        invObjectId = inv._id as Types.ObjectId;
      }
    }

    if (!invObjectId) {
      return [];
    }

    const collections = await this.collectionModel
      .find({ invoiceId: invObjectId })
      .sort({ paymentDate: -1 })
      .exec();

    return collections.map((col) => this.mapCollectionToDto(col));
  }

  private mapCollectionToDto(col: BloodIssueCollectionDocument | any) {
    return {
      _id: (col._id as any).toString(),
      receiptNumber: col.receiptNumber,
      invoiceId: col.invoiceId?.toString(),
      invoiceNumber: col.invoiceNumber,
      amountPaise: col.amountPaise,
      amount: col.amount,
      paymentMethod: col.paymentMethod,
      referenceNumber: col.referenceNumber,
      paymentDate: col.paymentDate,
      idempotencyKey: col.idempotencyKey,
      collectedByName: col.collectedByName,
      notes: col.notes || null,
      isReversed: col.isReversed || false,
      reversedAt: col.reversedAt || null,
      reversalReason: col.reversalReason || null,
      createdAt: col.createdAt,
    };
  }
}
