import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BloodIssueTariff,
  BloodIssueTariffDocument,
} from '../schemas/blood-issue-tariff.schema';
import { BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';
import {
  DEFAULT_TARIFF_PAISE,
} from '../constants/billing.constants';
import { UpdateTariffDto, BulkUpdateTariffsDto } from '../dto/tariff.dto';
import { CurrencyUtil } from '../../../common/utils/currency.util';

@Injectable()
export class TariffsService implements OnModuleInit {
  private readonly logger = new Logger(TariffsService.name);

  constructor(
    @InjectModel(BloodIssueTariff.name)
    private readonly tariffModel: Model<BloodIssueTariffDocument>,
  ) {}

  /**
   * Automatically seed standard regulatory processing fee defaults on startup if empty.
   */
  async onModuleInit() {
    await this.seedDefaultTariffs();
  }

  async seedDefaultTariffs() {
    for (const [componentKey, defaults] of Object.entries(DEFAULT_TARIFF_PAISE)) {
      const exists = await this.tariffModel.findOne({
        componentType: componentKey as BloodUnitComponent,
      });

      if (!exists) {
        await this.tariffModel.create({
          componentType: componentKey as BloodUnitComponent,
          processingFeePaise: defaults.processingFeePaise,
          processingFee: CurrencyUtil.toInr(defaults.processingFeePaise),
          crossmatchFeePaise: defaults.crossmatchFeePaise,
          crossmatchFee: CurrencyUtil.toInr(defaults.crossmatchFeePaise),
          description: `Standard regulatory cost-recovery fee for ${componentKey}`,
          isActive: true,
        });
        this.logger.log(`Seeded default processing fee for ${componentKey}`);
      }
    }
  }

  async findAll() {
    const tariffs = await this.tariffModel.find().sort({ componentType: 1 }).exec();
    return tariffs.map((t) => ({
      _id: (t._id as any).toString(),
      componentType: t.componentType,
      processingFeePaise: t.processingFeePaise,
      processingFee: t.processingFee,
      crossmatchFeePaise: t.crossmatchFeePaise,
      crossmatchFee: t.crossmatchFee,
      description: t.description || null,
      isActive: t.isActive,
      updatedAt: t.updatedAt,
      updatedByName: t.updatedByName || null,
    }));
  }

  async findByComponent(componentType: BloodUnitComponent) {
    const tariff = await this.tariffModel.findOne({ componentType }).exec();
    if (!tariff) {
      // Fallback to default constant if not yet persisted
      const defaults = DEFAULT_TARIFF_PAISE[componentType] || {
        processingFeePaise: 145000,
        crossmatchFeePaise: 0,
      };
      return {
        componentType,
        processingFeePaise: defaults.processingFeePaise,
        processingFee: CurrencyUtil.toInr(defaults.processingFeePaise),
        crossmatchFeePaise: defaults.crossmatchFeePaise,
        crossmatchFee: CurrencyUtil.toInr(defaults.crossmatchFeePaise),
        isActive: true,
      };
    }
    return {
      _id: (tariff._id as any).toString(),
      componentType: tariff.componentType,
      processingFeePaise: tariff.processingFeePaise,
      processingFee: tariff.processingFee,
      crossmatchFeePaise: tariff.crossmatchFeePaise,
      crossmatchFee: tariff.crossmatchFee,
      description: tariff.description || null,
      isActive: tariff.isActive,
    };
  }

  async updateTariff(
    dto: UpdateTariffDto,
    user: { id?: string; email?: string; fullName?: string },
  ) {
    const processingFeePaise = CurrencyUtil.toPaise(dto.processingFee);
    const crossmatchFeePaise =
      dto.crossmatchFee !== undefined
        ? CurrencyUtil.toPaise(dto.crossmatchFee)
        : 0;

    const updated = await this.tariffModel.findOneAndUpdate(
      { componentType: dto.componentType },
      {
        $set: {
          processingFeePaise,
          processingFee: CurrencyUtil.toInr(processingFeePaise),
          crossmatchFeePaise,
          crossmatchFee: CurrencyUtil.toInr(crossmatchFeePaise),
          description: dto.description,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
          updatedBy: user.id ? new Types.ObjectId(user.id) : undefined,
          updatedByName: user.fullName || user.email || 'Super Admin',
        },
      },
      { new: true, upsert: true },
    );

    return {
      _id: (updated._id as any).toString(),
      componentType: updated.componentType,
      processingFeePaise: updated.processingFeePaise,
      processingFee: updated.processingFee,
      crossmatchFeePaise: updated.crossmatchFeePaise,
      crossmatchFee: updated.crossmatchFee,
      description: updated.description || null,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
      updatedByName: updated.updatedByName || null,
    };
  }

  async bulkUpdateTariffs(
    dto: BulkUpdateTariffsDto,
    user: { id?: string; email?: string; fullName?: string },
  ) {
    const results = [];
    for (const item of dto.tariffs) {
      const res = await this.updateTariff(item, user);
      results.push(res);
    }
    return results;
  }
}
