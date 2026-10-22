import { AuditActionType, AuditEntityType } from '../constants/audit-log.constants';

export interface CreateAuditLogDto {
  actor?: {
    id: any;
    fullName: string;
    email?: string;
    role: string;
  };
  actorId?: any;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  action: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  entityIdentifier?: string;
  description: string;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export interface QueryAuditLogDto {
  actorId?: string;
  actorRole?: string;
  action?: AuditActionType;
  entityType?: AuditEntityType;
  entityId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  skip?: number;
}
