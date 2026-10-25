import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BloodUnitExpiryRule,
  BloodUnitExpiryRuleDocument,
} from '../schemas/blood-unit-expiry-rule.schema';
import {
  BloodUnit,
  BloodUnitDocument,
} from '../../blood-units/schemas/blood-unit.schema';
import { BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';
import {
  UpdateExpiryRuleDto,
  BulkUpdateExpiryRulesDto,
} from '../dto/expiry-rule.dto';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import {
  AuditActionType,
  AuditEntityType,
} from '../../audit-logs/constants/audit-log.constants';

export const DEFAULT_EXPIRY_RULES: Record<
  BloodUnitComponent,
  { shelfLifeDays: number; storageTemperature: string; description: string }
> = {
  [BloodUnitComponent.WHOLE_BLOOD]: {
    shelfLifeDays: 35,
    storageTemperature: '2°C to 6°C',
    description: 'Whole human blood stored in CPDA-1 preservative solution',
  },
  [BloodUnitComponent.PRBC]: {
    shelfLifeDays: 42,
    storageTemperature: '2°C to 6°C',
    description: 'Packed Red Blood Cells in SAGM additive preservation solution',
  },
  [BloodUnitComponent.FFP]: {
    shelfLifeDays: 365,
    storageTemperature: '-18°C or colder',
    description: 'Fresh Frozen Plasma separated and frozen within 8 hours of phlebotomy',
  },
  [BloodUnitComponent.PLATELETS]: {
    shelfLifeDays: 5,
    storageTemperature: '20°C to 24°C with continuous agitation',
    description: 'Platelet concentrate in gas-permeable bags under continuous gentle agitation',
  },
  [BloodUnitComponent.CRYOPRECIPITATE]: {
    shelfLifeDays: 365,
    storageTemperature: '-18°C or colder',
    description: 'Cryoprecipitated antihemophilic factor prepared by thawing FFP at 2°C to 6°C',
  },
};

@Injectable()
export class ExpiryRulesService implements OnModuleInit {
  private readonly logger = new Logger(ExpiryRulesService.name);

  constructor(
    @InjectModel(BloodUnitExpiryRule.name)
    private readonly ruleModel: Model<BloodUnitExpiryRuleDocument>,
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel: Model<BloodUnitDocument>,
    @Optional()
    private readonly auditLogsService?: AuditLogsService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultRules();
  }

  async seedDefaultRules() {
    for (const [componentKey, defaults] of Object.entries(DEFAULT_EXPIRY_RULES)) {
      const componentType = componentKey as BloodUnitComponent;
      const exists = await this.ruleModel.findOne({ componentType });

      if (!exists) {
        await this.ruleModel.create({
          componentType,
          shelfLifeDays: defaults.shelfLifeDays,
          storageTemperature: defaults.storageTemperature,
          description: defaults.description,
          isActive: true,
        });
        this.logger.log(`Seeded default expiry rule for ${componentType}: ${defaults.shelfLifeDays} days`);
      }
    }
  }

  async findAll() {
    const rules = await this.ruleModel.find().sort({ componentType: 1 }).exec();
    return rules.map((r) => ({
      _id: (r._id as any).toString(),
      componentType: r.componentType,
      shelfLifeDays: r.shelfLifeDays,
      storageTemperature: r.storageTemperature || '2°C to 6°C',
      description: r.description || null,
      isActive: r.isActive,
      updatedAt: r.updatedAt,
      updatedByName: r.updatedByName || null,
      updatedByRole: r.updatedByRole || null,
    }));
  }

  async findByComponent(componentType: BloodUnitComponent) {
    const rule = await this.ruleModel.findOne({ componentType, isActive: true }).exec();
    if (rule) {
      return rule;
    }
    const fallback = DEFAULT_EXPIRY_RULES[componentType] || {
      shelfLifeDays: 35,
      storageTemperature: '2°C to 6°C',
      description: 'Default blood component expiry policy',
    };
    return {
      componentType,
      shelfLifeDays: fallback.shelfLifeDays,
      storageTemperature: fallback.storageTemperature,
      description: fallback.description,
      isActive: true,
    };
  }

  async calculateExpiryDate(
    collectionDate: Date,
    componentType: BloodUnitComponent,
  ): Promise<Date> {
    const rule = await this.findByComponent(componentType);
    const days = rule.shelfLifeDays || 35;
    return new Date(collectionDate.getTime() + days * 24 * 60 * 60 * 1000);
  }

  async update(dto: UpdateExpiryRuleDto, actor?: any) {
    const beforeRule = await this.ruleModel
      .findOne({ componentType: dto.componentType })
      .exec();

    const updateData: any = {
      shelfLifeDays: dto.shelfLifeDays,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    };

    if (dto.storageTemperature !== undefined) {
      updateData.storageTemperature = dto.storageTemperature.trim();
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description.trim();
    }

    if (actor && actor.id) {
      updateData.updatedBy = new Types.ObjectId(actor.id);
      updateData.updatedByName = actor.fullName || actor.name || 'Super Admin';
      updateData.updatedByRole = actor.role || 'SUPER_ADMIN';
    }

    const updated = await this.ruleModel
      .findOneAndUpdate({ componentType: dto.componentType }, updateData, {
        new: true,
        upsert: true,
      })
      .exec();

    if (this.auditLogsService && actor) {
      await this.auditLogsService.logEvent({
        actor,
        action: AuditActionType.INVENTORY_STATUS_CHANGED,
        entityType: AuditEntityType.INVENTORY,
        entityId: (updated._id as any).toString(),
        entityIdentifier: `EXPIRY-RULE-${dto.componentType}`,
        description: `Super Admin updated shelf-life expiry rule for ${dto.componentType}: ${dto.shelfLifeDays} days (previously ${beforeRule?.shelfLifeDays ?? 'default'} days)`,
        beforeState: beforeRule ? beforeRule.toObject() : undefined,
        afterState: updated.toObject(),
      });
    }

    return {
      _id: (updated._id as any).toString(),
      componentType: updated.componentType,
      shelfLifeDays: updated.shelfLifeDays,
      storageTemperature: updated.storageTemperature || '2°C to 6°C',
      description: updated.description || null,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
      updatedByName: updated.updatedByName || null,
    };
  }

  async bulkUpdate(dto: BulkUpdateExpiryRulesDto, actor?: any) {
    const results = [];
    for (const ruleDto of dto.rules) {
      const res = await this.update(ruleDto, actor);
      results.push(res);
    }
    return results;
  }

  /**
   * Recalculate expiry dates for existing blood units in the database.
   * Super Admin can trigger this to backfill any legacy blood units missing an expiry date,
   * or update existing units when regulatory shelf-life rules are modified.
   */
  async recalculateExistingUnits(actor?: any): Promise<{ updatedCount: number; message: string }> {
    const rules = await this.ruleModel.find({ isActive: true }).exec();
    const ruleMap = new Map<string, number>();

    for (const r of rules) {
      ruleMap.set(r.componentType, r.shelfLifeDays);
    }

    // Default fallbacks
    for (const [comp, defs] of Object.entries(DEFAULT_EXPIRY_RULES)) {
      if (!ruleMap.has(comp)) {
        ruleMap.set(comp, defs.shelfLifeDays);
      }
    }

    // Find blood units that either don't have an expiryDate or have an expiryDate: null
    const units = await this.bloodUnitModel.find({
      $or: [{ expiryDate: null }, { expiryDate: { $exists: false } }],
    }).exec();

    let updatedCount = 0;
    for (const unit of units) {
      const colDate = unit.collectionDate || (unit as any).createdAt || new Date();
      const comp = unit.componentType || BloodUnitComponent.WHOLE_BLOOD;
      const days = ruleMap.get(comp) || 35;
      const newExpiry = new Date(new Date(colDate).getTime() + days * 24 * 60 * 60 * 1000);

      unit.expiryDate = newExpiry;
      await unit.save();
      updatedCount++;
    }

    if (this.auditLogsService && actor) {
      await this.auditLogsService.logEvent({
        actor,
        action: AuditActionType.INVENTORY_STATUS_CHANGED,
        entityType: AuditEntityType.INVENTORY,
        entityId: 'RECALCULATE_EXPIRIES',
        entityIdentifier: 'INVENTORY_EXPIRY_RECALCULATION',
        description: `Super Admin executed blood unit expiry date recalculation across inventory (${updatedCount} units updated)`,
      });
    }

    return {
      updatedCount,
      message: `Successfully updated ${updatedCount} blood units with calculated expiry dates based on active shelf-life rules.`,
    };
  }
}
