import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AuditActionType, AuditEntityType } from '../constants/audit-log.constants';

export type AuditLogDocument = AuditLog & Document;

@Schema({
  collection: 'audit_logs',
  timestamps: { createdAt: 'timestamp', updatedAt: false },
})
export class AuditLog {
  @Prop({ required: true, unique: true, index: true })
  eventId: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser', required: true, index: true })
  actorId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  actorName: string;

  @Prop({ required: true, trim: true })
  actorEmail: string;

  @Prop({ required: true, trim: true, index: true })
  actorRole: string;

  @Prop({
    required: true,
    enum: Object.values(AuditActionType),
    index: true,
  })
  action: AuditActionType;

  @Prop({
    required: true,
    enum: Object.values(AuditEntityType),
    index: true,
  })
  entityType: AuditEntityType;

  @Prop({ required: true, trim: true, index: true })
  entityId: string;

  @Prop({ required: false, trim: true, index: true })
  entityIdentifier?: string; // e.g. DON-20261007-A8F3, UNIT-A1, INV-20261014-001

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ type: Object, required: false, default: null })
  beforeState?: Record<string, any> | null;

  @Prop({ type: Object, required: false, default: null })
  afterState?: Record<string, any> | null;

  @Prop({ type: Object, required: false, default: null })
  metadata?: Record<string, any> | null;

  @Prop({ required: true, default: Date.now, index: true })
  timestamp: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Compound and search indexes for high-performance audit query & filtering
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ actorRole: 1, timestamp: -1 });
