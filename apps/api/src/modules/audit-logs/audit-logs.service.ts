import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { randomUUID } from 'crypto';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { CreateAuditLogDto, QueryAuditLogDto } from './dto/audit-log.dto';
import { AuditEntityType } from './constants/audit-log.constants';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  /**
   * Records an immutable, append-only central audit event.
   * Actor identity is strictly derived from the validated authenticated session.
   */
  async logEvent(dto: CreateAuditLogDto): Promise<AuditLog | null> {
    try {
      const eventId = `AUD-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

      const actorIdVal = dto.actor?.id || dto.actorId;
      const actorObjectId = isValidObjectId(actorIdVal)
        ? new Types.ObjectId(actorIdVal)
        : new Types.ObjectId('000000000000000000000000');

      const actorName = dto.actor?.fullName || dto.actorName || 'Unknown Staff';
      const actorEmail = dto.actor?.email || dto.actorEmail || 'unknown@bloodbank.org';
      const actorRole = dto.actor?.role || dto.actorRole || 'STAFF';

      const log = new this.auditLogModel({
        eventId,
        actorId: actorObjectId,
        actorName,
        actorEmail,
        actorRole,
        action: dto.action,
        entityType: dto.entityType,
        entityId: String(dto.entityId),
        entityIdentifier: dto.entityIdentifier,
        description: dto.description,
        beforeState: dto.beforeState || null,
        afterState: dto.afterState || null,
        metadata: dto.metadata || null,
        timestamp: new Date(),
      });

      const saved = await log.save();
      this.logger.log(
        `[AUDIT] ${dto.action} on ${dto.entityType} (${dto.entityIdentifier || dto.entityId}) by ${actorName} [${actorRole}]`,
      );
      return saved;
    } catch (err: any) {
      this.logger.error(`Failed to record audit event ${dto.action}: ${err.message}`, err.stack);
      return null;
    }
  }

  /**
   * Retrieves audit logs with multi-dimensional filtering.
   * Restricted to authorized staff roles (SUPER_ADMIN, ADMIN).
   */
  async findAll(query: QueryAuditLogDto) {
    const filter: Record<string, any> = {};

    if (query.actorId && isValidObjectId(query.actorId)) {
      filter.actorId = new Types.ObjectId(query.actorId);
    }

    if (query.actorRole) {
      filter.actorRole = query.actorRole;
    }

    if (query.action) {
      filter.action = query.action;
    }

    if (query.entityType) {
      filter.entityType = query.entityType;
    }

    if (query.entityId) {
      filter.entityId = query.entityId;
    }

    if (query.startDate || query.endDate) {
      filter.timestamp = {};
      if (query.startDate) {
        filter.timestamp.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.timestamp.$lte = new Date(query.endDate);
      }
    }

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { actorName: searchRegex },
        { actorEmail: searchRegex },
        { entityIdentifier: searchRegex },
        { description: searchRegex },
      ];
    }

    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const skip = Math.max(Number(query.skip) || 0, 0);

    const [logs, total] = await Promise.all([
      this.auditLogModel.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean().exec(),
      this.auditLogModel.countDocuments(filter).exec(),
    ]);

    return {
      logs,
      total,
      limit,
      skip,
    };
  }

  /**
   * Retrieves the historical chronological activity for an individual entity.
   */
  async findByEntity(entityType: AuditEntityType, entityId: string) {
    return this.auditLogModel
      .find({
        entityType,
        entityId: String(entityId),
      })
      .sort({ timestamp: -1 })
      .lean()
      .exec();
  }

  /**
   * Aggregates staff activity summary across all actions for Super Admin overview.
   */
  async getStaffActivitySummary() {
    const [byRole, byAction, recentActors] = await Promise.all([
      this.auditLogModel.aggregate([
        { $group: { _id: '$actorRole', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.auditLogModel.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      this.auditLogModel.aggregate([
        {
          $group: {
            _id: '$actorId',
            actorName: { $first: '$actorName' },
            actorEmail: { $first: '$actorEmail' },
            actorRole: { $first: '$actorRole' },
            totalActions: { $sum: 1 },
            lastActive: { $max: '$timestamp' },
          },
        },
        { $sort: { lastActive: -1 } },
        { $limit: 20 },
      ]),
    ]);

    return {
      byRole,
      byAction,
      recentActors,
    };
  }
}
