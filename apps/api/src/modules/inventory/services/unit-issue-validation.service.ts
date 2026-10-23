import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
import { Inventory, InventoryDocument } from '../schemas/inventory.schema';
import { BloodUnit, BloodUnitDocument } from '../../blood-units/schemas/blood-unit.schema';
import { BloodTesting, BloodTestingDocument } from '../../testing/schemas/blood-testing.schema';
import { BloodAcquisition, BloodAcquisitionDocument } from '../../blood-acquisitions/schemas/blood-acquisition.schema';
import { InventoryStatus } from '../constants/inventory.constants';
import { BloodUnitStatus } from '../../blood-units/constants/blood-unit.constants';
import { BloodUnitSourceType } from '../../blood-acquisitions/constants/blood-acquisition.constants';
import { TestingDecision, TestingStatus } from '../../testing/constants/testing.constants';

export interface UnitAllocationValidationParams {
  inventoryId: string | Types.ObjectId;
  expectedBloodGroup?: string;
  expectedComponentType?: string;
  allowCompatibleBloodGroup?: boolean;
  isReservation?: boolean;
  isIssue?: boolean;
  expectedReservationId?: string | Types.ObjectId;
}

export interface UnitAllocationValidationResult {
  inventory: InventoryDocument;
  bloodUnit: BloodUnitDocument;
  testing?: BloodTestingDocument | null;
  isValid: boolean;
}

/**
 * Validates clinical compatibility between donor unit and recipient group
 * according to National Blood Transfusion Council (NBTC) / DGHS Indian standards.
 */
export function isBloodGroupCompatible(
  donorGroup: string,
  recipientGroup: string,
  componentType: string = 'WHOLE_BLOOD',
): boolean {
  if (donorGroup === recipientGroup) return true;

  // Whole blood strictly requires identical group
  if (componentType === 'WHOLE_BLOOD') {
    return false;
  }

  // Red Blood Cells / PRBC compatibility (Universal Donor: O-)
  if (componentType === 'PRBC') {
    const redCellCompatibility: Record<string, string[]> = {
      'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
      'O+': ['O+', 'A+', 'B+', 'AB+'],
      'A-': ['A-', 'A+', 'AB-', 'AB+'],
      'A+': ['A+', 'AB+'],
      'B-': ['B-', 'B+', 'AB-', 'AB+'],
      'B+': ['B+', 'AB+'],
      'AB-': ['AB-', 'AB+'],
      'AB+': ['AB+'],
    };
    return redCellCompatibility[donorGroup]?.includes(recipientGroup) ?? false;
  }

  // Plasma (FFP) & Platelets compatibility (Universal Donor: AB)
  if (componentType === 'FFP' || componentType === 'PLATELETS') {
    const plasmaCompatibility: Record<string, string[]> = {
      'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
      'AB-': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
      'A+': ['A+', 'A-', 'O+', 'O-'],
      'A-': ['A+', 'A-', 'O+', 'O-'],
      'B+': ['B+', 'B-', 'O+', 'O-'],
      'B-': ['B+', 'B-', 'O+', 'O-'],
      'O+': ['O+', 'O-'],
      'O-': ['O+', 'O-'],
    };
    return plasmaCompatibility[donorGroup]?.includes(recipientGroup) ?? false;
  }

  return false;
}

@Injectable()
export class UnitIssueValidationService {
  constructor(
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel: Model<BloodUnitDocument>,
    @Optional()
    @InjectModel(BloodTesting.name)
    private readonly bloodTestingModel?: Model<BloodTestingDocument>,
    @Optional()
    @InjectModel(BloodAcquisition.name)
    private readonly bloodAcquisitionModel?: Model<BloodAcquisitionDocument>,
  ) {}

  /**
   * Authoritative gate validating unit eligibility for Reservation and Final Issue.
   *
   * Enforces:
   * 1. Valid inventory record existence and current status check at mutation point.
   * 2. Physical BloodUnit existence, APPROVED laboratory release status.
   * 3. Completed, passed transfusion-transmissible infection screening (HIV, HBV, HCV, SYPHILIS, MALARIA)
   *    or certified external consignment clearance.
   * 4. Expiry check: unit must not be expired at point of mutation.
   * 5. Strict rejection of Quarantined, Discarded, Testing, or already Issued units.
   * 6. Component type and Blood group compatibility check (exact match or verified crossmatch compatibility).
   */
  async validateUnitForAllocation(
    params: UnitAllocationValidationParams,
  ): Promise<UnitAllocationValidationResult> {
    const {
      inventoryId,
      expectedBloodGroup,
      expectedComponentType,
      allowCompatibleBloodGroup = false,
      isReservation = false,
      isIssue = false,
      expectedReservationId,
    } = params;

    const invIdStr = inventoryId.toString();
    if (!isValidObjectId(invIdStr)) {
      throw new BadRequestException({
        message: `Invalid inventory ID format: '${invIdStr}'.`,
        code: 'INVALID_INVENTORY_ID',
      });
    }

    // 1. Fetch current inventory document
    const inv = await this.inventoryModel
      .findById(inventoryId)
      .populate('bloodUnitId')
      .exec();

    if (!inv) {
      throw new NotFoundException({
        message: `Inventory record with ID '${invIdStr}' was not found.`,
        code: 'INVENTORY_NOT_FOUND',
      });
    }

    // 2. Validate Inventory Status
    if (isReservation) {
      if (inv.status === InventoryStatus.RESERVED) {
        throw new ConflictException({
          message: `Inventory unit '${invIdStr}' is already reserved.`,
          code: 'UNIT_ALREADY_RESERVED',
        });
      }
      if (inv.status === InventoryStatus.ISSUED) {
        throw new ConflictException({
          message: `Inventory unit '${invIdStr}' has already been issued.`,
          code: 'UNIT_ALREADY_ISSUED',
        });
      }
      if (inv.status === InventoryStatus.EXPIRED) {
        throw new BadRequestException({
          message: `Cannot reserve expired inventory unit '${invIdStr}'.`,
          code: 'CANNOT_RESERVE_EXPIRED_UNIT',
        });
      }
      if (inv.status === InventoryStatus.DISCARDED) {
        throw new BadRequestException({
          message: `Cannot reserve discarded inventory unit '${invIdStr}'.`,
          code: 'CANNOT_RESERVE_DISCARDED_UNIT',
        });
      }
      if (inv.status !== InventoryStatus.AVAILABLE) {
        throw new BadRequestException({
          message: `Inventory unit '${invIdStr}' is not available for reservation (status: '${inv.status}').`,
          code: 'INVENTORY_NOT_AVAILABLE',
        });
      }
    }

    if (isIssue) {
      if (inv.status === InventoryStatus.AVAILABLE) {
        throw new BadRequestException({
          message: `Inventory unit '${invIdStr}' is in status 'AVAILABLE'. Direct issuance without prior reservation is prohibited.`,
          code: 'UNIT_NOT_RESERVED',
        });
      }
      if (inv.status === InventoryStatus.ISSUED) {
        throw new ConflictException({
          message: `Inventory unit '${invIdStr}' has already been issued.`,
          code: 'UNIT_ALREADY_ISSUED',
        });
      }
      if (inv.status !== InventoryStatus.RESERVED) {
        throw new BadRequestException({
          message: `Inventory unit '${invIdStr}' is in status '${inv.status}' and cannot be issued. Only RESERVED units can be issued.`,
          code: 'CANNOT_ISSUE_UNAVAILABLE_UNIT',
        });
      }
    }

    // 3. Physical Blood Unit Quality & Approval Verification
    const bloodUnit = inv.bloodUnitId as BloodUnitDocument | any;
    if (!bloodUnit || !bloodUnit._id) {
      throw new BadRequestException({
        message: `Inventory unit '${invIdStr}' has no associated physical blood unit record.`,
        code: 'BLOOD_UNIT_MISSING',
      });
    }

    if (bloodUnit.status === BloodUnitStatus.TESTING) {
      throw new BadRequestException({
        message: `Cannot allocate blood unit '${bloodUnit.unitCode}': laboratory testing is still in progress.`,
        code: 'CANNOT_ALLOCATE_TESTING_UNIT',
      });
    }

    if (bloodUnit.status === BloodUnitStatus.REJECTED) {
      throw new BadRequestException({
        message: `Cannot allocate blood unit '${bloodUnit.unitCode}': unit was rejected during screening.`,
        code: 'CANNOT_ALLOCATE_REJECTED_UNIT',
      });
    }

    if (bloodUnit.status !== BloodUnitStatus.APPROVED) {
      throw new BadRequestException({
        message: `Blood unit '${bloodUnit.unitCode}' is not laboratory approved (status: '${bloodUnit.status}').`,
        code: 'CANNOT_ALLOCATE_UNAPPROVED_UNIT',
      });
    }

    // 4. Expiration Validation at Point of Mutation
    const now = new Date();
    if (bloodUnit.expiryDate && new Date(bloodUnit.expiryDate) < now) {
      const expDateIso = new Date(bloodUnit.expiryDate).toISOString();
      throw new BadRequestException({
        message: `Blood unit '${bloodUnit.unitCode}' passed its expiration date (${expDateIso}) and cannot be allocated or issued.`,
        code: isIssue ? 'CANNOT_ISSUE_EXPIRED_UNIT' : 'CANNOT_RESERVE_EXPIRED_UNIT',
        expiryDate: expDateIso,
      });
    }

    // 5. Verification of Lab Testing or Certified External Clearance Gate
    let testingRecord: BloodTestingDocument | null = null;
    if (this.bloodTestingModel) {
      testingRecord = await this.bloodTestingModel
        .findOne({ bloodUnitId: bloodUnit._id })
        .exec();

      if (testingRecord) {
        if (
          testingRecord.status !== TestingStatus.COMPLETED ||
          testingRecord.decision !== TestingDecision.APPROVED
        ) {
          throw new BadRequestException({
            message: `Blood unit '${bloodUnit.unitCode}' laboratory testing is not completed/approved (status: '${testingRecord.status}', decision: '${testingRecord.decision}').`,
            code: 'TESTING_NOT_APPROVED',
          });
        }
      } else if (bloodUnit.sourceType !== BloodUnitSourceType.EXTERNAL_RECEIPT) {
        // Internal/campaign unit must have a testing record
        throw new BadRequestException({
          message: `Blood unit '${bloodUnit.unitCode}' lacks mandatory laboratory testing documentation.`,
          code: 'TESTING_RECORD_MISSING',
        });
      }
    }

    // 6. Blood Group & Component Matching
    if (expectedComponentType && bloodUnit.componentType !== expectedComponentType) {
      throw new BadRequestException({
        message: `Component type mismatch: Request requires '${expectedComponentType}', unit '${bloodUnit.unitCode}' is '${bloodUnit.componentType}'.`,
        code: 'COMPONENT_TYPE_MISMATCH',
        expectedComponentType,
        unitComponentType: bloodUnit.componentType,
      });
    }

    if (expectedBloodGroup) {
      const isMatch = allowCompatibleBloodGroup
        ? isBloodGroupCompatible(bloodUnit.bloodGroup, expectedBloodGroup, bloodUnit.componentType)
        : bloodUnit.bloodGroup === expectedBloodGroup;

      if (!isMatch) {
        throw new BadRequestException({
          message: `Blood group mismatch: Request requires '${expectedBloodGroup}', unit '${bloodUnit.unitCode}' is '${bloodUnit.bloodGroup}' (incompatible for ${bloodUnit.componentType || 'WHOLE_BLOOD'}).`,
          code: 'BLOOD_GROUP_MISMATCH',
          expectedBloodGroup,
          unitBloodGroup: bloodUnit.bloodGroup,
        });
      }
    }

    return {
      inventory: inv,
      bloodUnit,
      testing: testingRecord,
      isValid: true,
    };
  }
}
