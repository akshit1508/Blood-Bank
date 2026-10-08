import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession, isValidObjectId } from 'mongoose';
import {
  Reservation,
  ReservationDocument,
} from './schemas/reservation.schema';
import { ReservationStatus } from './constants/reservation.constants';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { QueryReservationsDto } from './dto/query-reservations.dto';
import {
  BloodRequest,
  BloodRequestDocument,
} from '../../blood-requests/schemas/blood-request.schema';
import { BloodRequestStatus } from '../../blood-requests/blood-request.constants';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
import {
  InventoryHistory,
  InventoryHistoryDocument,
} from '../inventory/schemas/inventory-history.schema';
import { InventoryStatus } from '../inventory/constants/inventory.constants';
import {
  BloodUnit,
  BloodUnitDocument,
} from '../blood-units/schemas/blood-unit.schema';
import { BloodUnitStatus } from '../blood-units/constants/blood-unit.constants';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectModel(Reservation.name)
    private readonly reservationModel: Model<ReservationDocument>,
    @InjectModel(BloodRequest.name)
    private readonly bloodRequestModel: Model<BloodRequestDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(InventoryHistory.name)
    private readonly inventoryHistoryModel: Model<InventoryHistoryDocument>,
    @InjectModel(BloodUnit.name)
    private readonly bloodUnitModel: Model<BloodUnitDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  /**
   * Generates a high-entropy, unique reservation tracking code.
   * Format: RES-YYYYMMDD-XXXX (e.g. RES-20261008-B8A1)
   */
  private generateReservationCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RES-${datePart}-${randomPart}`;
  }

  /**
   * Creates a reservation committing specified AVAILABLE inventory units to an APPROVED blood request.
   *
   * Rigorous Medical & Operational Guardrails (Phase 6B):
   * 1. Blood request must exist and be in APPROVED status.
   * 2. Cannot exceed requested quantity.
   * 3. Inventory units must exist, be in AVAILABLE status, and match requested blood group and component.
   * 4. Blood units must be laboratory APPROVED and not expired.
   * 5. Double-reservation protection: atomic conditional updates + partial unique index + ACID transaction.
   * 6. Transition request status to RESERVED when all required units are reserved.
   * 7. Audit log transition in inventory_history.
   */
  async createReservation(
    bloodRequestId: string,
    createDto: CreateReservationDto,
  ) {
    // Step 1: Find and validate blood request
    let request: BloodRequestDocument | null = null;
    if (isValidObjectId(bloodRequestId)) {
      request = await this.bloodRequestModel.findById(bloodRequestId).exec();
    }
    if (!request) {
      request = await this.bloodRequestModel
        .findOne({ requestCode: bloodRequestId.toUpperCase() })
        .exec();
    }

    if (!request) {
      throw new NotFoundException({
        message: `Blood request with identifier '${bloodRequestId}' was not found.`,
        code: 'BLOOD_REQUEST_NOT_FOUND',
      });
    }

    // Step 2: Validate blood request status eligibility
    if (request.status !== BloodRequestStatus.APPROVED) {
      throw new BadRequestException({
        message: `Blood request '${request.requestCode}' must be in APPROVED status to reserve units. Current status is '${request.status}'.`,
        code: 'REQUEST_NOT_ELIGIBLE_FOR_RESERVATION',
      });
    }

    // Step 3: Check currently active reservations for this request
    const existingActive = await this.reservationModel
      .find({ bloodRequestId: request._id, status: ReservationStatus.ACTIVE })
      .exec();
    const alreadyReservedUnitsCount = existingActive.reduce(
      (sum, r) => sum + r.inventoryIds.length,
      0,
    );
    const remainingUnitsNeeded = request.unitsRequested - alreadyReservedUnitsCount;

    if (remainingUnitsNeeded <= 0) {
      throw new BadRequestException({
        message: `Blood request '${request.requestCode}' is already fully reserved (${request.unitsRequested} unit(s)).`,
        code: 'REQUEST_ALREADY_FULLY_RESERVED',
      });
    }

    const requestedIds = createDto.inventoryIds;
    const uniqueIds = Array.from(new Set(requestedIds));
    if (uniqueIds.length !== requestedIds.length) {
      throw new BadRequestException({
        message: 'Duplicate inventory IDs provided in reservation request.',
        code: 'DUPLICATE_INVENTORY_IDS_IN_REQUEST',
      });
    }

    if (uniqueIds.length > remainingUnitsNeeded) {
      throw new BadRequestException({
        message: `Cannot reserve ${uniqueIds.length} units. Request requires ${request.unitsRequested} units (${alreadyReservedUnitsCount} already reserved, ${remainingUnitsNeeded} remaining needed).`,
        code: 'RESERVATION_QUANTITY_EXCEEDED',
      });
    }

    // Step 4: Pre-validate each inventory item against eligibility rules
    const now = new Date();
    for (const invId of uniqueIds) {
      if (!isValidObjectId(invId)) {
        throw new BadRequestException({
          message: `Invalid inventory ID format: '${invId}'.`,
          code: 'INVALID_INVENTORY_ID',
        });
      }

      const inv = await this.inventoryModel
        .findById(invId)
        .populate('bloodUnitId')
        .exec();

      if (!inv) {
        throw new NotFoundException({
          message: `Inventory record with ID '${invId}' was not found.`,
          code: 'INVENTORY_NOT_FOUND',
        });
      }

      // Status check
      if (inv.status === InventoryStatus.RESERVED) {
        throw new ConflictException({
          message: `Inventory unit '${invId}' is already reserved.`,
          code: 'UNIT_ALREADY_RESERVED',
        });
      }
      if (inv.status === InventoryStatus.EXPIRED) {
        throw new BadRequestException({
          message: `Cannot reserve expired inventory unit '${invId}'.`,
          code: 'CANNOT_RESERVE_EXPIRED_UNIT',
        });
      }
      if (inv.status === InventoryStatus.DISCARDED) {
        throw new BadRequestException({
          message: `Cannot reserve discarded inventory unit '${invId}'.`,
          code: 'CANNOT_RESERVE_DISCARDED_UNIT',
        });
      }
      if (inv.status !== InventoryStatus.AVAILABLE) {
        throw new BadRequestException({
          message: `Inventory unit '${invId}' is not available (status: '${inv.status}').`,
          code: 'INVENTORY_NOT_AVAILABLE',
        });
      }

      const unit = inv.bloodUnitId as BloodUnitDocument | any;
      if (!unit) {
        throw new BadRequestException({
          message: `Inventory unit '${invId}' has no associated physical blood unit record.`,
          code: 'BLOOD_UNIT_MISSING',
        });
      }

      // Quality checks on physical blood unit
      if (unit.status === BloodUnitStatus.TESTING) {
        throw new BadRequestException({
          message: `Cannot reserve blood unit '${unit.unitCode}' while testing is in progress.`,
          code: 'CANNOT_RESERVE_TESTING_UNIT',
        });
      }
      if (unit.status === BloodUnitStatus.REJECTED) {
        throw new BadRequestException({
          message: `Cannot reserve rejected blood unit '${unit.unitCode}'.`,
          code: 'CANNOT_RESERVE_REJECTED_UNIT',
        });
      }
      if (unit.status !== BloodUnitStatus.APPROVED) {
        throw new BadRequestException({
          message: `Blood unit '${unit.unitCode}' is not laboratory approved (status: '${unit.status}').`,
          code: 'CANNOT_RESERVE_UNAPPROVED_UNIT',
        });
      }

      // Expiry check
      if (unit.expiryDate && new Date(unit.expiryDate) < now) {
        throw new BadRequestException({
          message: `Blood unit '${unit.unitCode}' has passed its expiration date.`,
          code: 'CANNOT_RESERVE_EXPIRED_UNIT',
        });
      }

      // Blood group exact match
      if (unit.bloodGroup !== request.bloodGroup) {
        throw new BadRequestException({
          message: `Blood group mismatch: Request requires '${request.bloodGroup}', unit '${unit.unitCode}' is '${unit.bloodGroup}'.`,
          code: 'BLOOD_GROUP_MISMATCH',
        });
      }

      // Component type exact match
      if (unit.componentType !== request.componentType) {
        throw new BadRequestException({
          message: `Component type mismatch: Request requires '${request.componentType}', unit '${unit.unitCode}' is '${unit.componentType}'.`,
          code: 'COMPONENT_TYPE_MISMATCH',
        });
      }
    }

    // Step 5: Concurrency-Safe Atomic Transaction Execution
    let session: ClientSession | null = null;
    try {
      session = await this.connection.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    try {
      let reservationCode = this.generateReservationCode();
      let attempts = 0;
      while (await this.reservationModel.exists({ reservationCode })) {
        reservationCode = this.generateReservationCode();
        attempts++;
        if (attempts > 5) {
          reservationCode = `RES-${Date.now()}`;
          break;
        }
      }

      const reservedUnits: Array<{
        inventoryId: Types.ObjectId;
        bloodUnitId: Types.ObjectId;
        unitCode: string;
        bloodGroup: string;
        componentType: string;
        status: string;
      }> = [];
      const inventoryObjectIds: Types.ObjectId[] = [];
      const bloodUnitObjectIds: Types.ObjectId[] = [];

      for (const invId of uniqueIds) {
        const objId = new Types.ObjectId(invId);

        // Atomic conditional transition AVAILABLE -> RESERVED
        const updatedInv = await this.inventoryModel
          .findOneAndUpdate(
            { _id: objId, status: InventoryStatus.AVAILABLE },
            { $set: { status: InventoryStatus.RESERVED } },
            { new: true, session: session || undefined },
          )
          .populate('bloodUnitId');

        if (!updatedInv) {
          throw new ConflictException({
            message: `Blood unit '${invId}' is no longer available or was reserved concurrently.`,
            code: 'UNIT_ALREADY_RESERVED',
          });
        }

        const u = updatedInv.bloodUnitId as any;
        inventoryObjectIds.push(updatedInv._id);
        bloodUnitObjectIds.push(u._id);
        reservedUnits.push({
          inventoryId: updatedInv._id,
          bloodUnitId: u._id,
          unitCode: u.unitCode,
          bloodGroup: u.bloodGroup,
          componentType: u.componentType,
          status: 'RESERVED',
        });

        // Record audit history
        await this.inventoryHistoryModel.create(
          [
            {
              inventoryId: updatedInv._id,
              fromStatus: InventoryStatus.AVAILABLE,
              toStatus: InventoryStatus.RESERVED,
              reason: `Reserved for blood request ${request.requestCode} (${reservationCode})`,
            },
          ],
          { session: session || undefined },
        );
      }

      // Persist reservation document
      const [reservation] = await this.reservationModel.create(
        [
          {
            reservationCode,
            bloodRequestId: request._id,
            requestCode: request.requestCode,
            inventoryIds: inventoryObjectIds,
            bloodUnitIds: bloodUnitObjectIds,
            reservedUnits,
            status: ReservationStatus.ACTIVE,
            reservedAt: new Date(),
            expiresAt: null,
          },
        ],
        { session: session || undefined },
      );

      // Advance BloodRequest status if full requested quantity is reached
      const newTotalReserved = alreadyReservedUnitsCount + uniqueIds.length;
      if (newTotalReserved >= request.unitsRequested) {
        await this.bloodRequestModel.findByIdAndUpdate(
          request._id,
          {
            $set: {
              status: BloodRequestStatus.RESERVED,
              statusReason: `Fully reserved via reservation ${reservationCode}`,
              statusUpdatedAt: new Date(),
            },
          },
          { session: session || undefined },
        );
      }

      if (session) {
        await session.commitTransaction();
      }

      return {
        reservationCode: reservation.reservationCode,
        bloodRequestId: (request._id as any).toString(),
        requestCode: reservation.requestCode,
        status: reservation.status,
        reservedUnits: reservation.reservedUnits.map((item) => ({
          inventoryId: item.inventoryId ? item.inventoryId.toString() : '',
          bloodUnitId: item.bloodUnitId ? item.bloodUnitId.toString() : '',
          unitCode: item.unitCode,
          bloodGroup: item.bloodGroup,
          componentType: item.componentType,
          status: item.status,
        })),
        reservedAt: reservation.reservedAt,
        expiresAt: reservation.expiresAt || null,
      };
    } catch (err: any) {
      if (session) {
        await session.abortTransaction();
      }
      if (err.code === 11000) {
        throw new ConflictException({
          message: 'One or more blood units are already actively reserved.',
          code: 'UNIT_ALREADY_RESERVED',
        });
      }
      throw err;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Cancels an active reservation, releasing held units back to AVAILABLE inventory.
   *
   * Guardrails:
   * 1. Reservation must exist and be in ACTIVE status.
   * 2. Cannot cancel an already CANCELLED or EXPIRED reservation.
   * 3. Inventory units transition from RESERVED -> AVAILABLE.
   * 4. Audit history is created for each unit.
   * 5. If BloodRequest was RESERVED and is now under-reserved, reverts to APPROVED.
   */
  async cancelReservation(
    reservationIdentifier: string,
    cancelDto: CancelReservationDto,
  ) {
    let reservation: ReservationDocument | null = null;
    if (isValidObjectId(reservationIdentifier)) {
      reservation = await this.reservationModel
        .findById(reservationIdentifier)
        .exec();
    }
    if (!reservation) {
      reservation = await this.reservationModel
        .findOne({ reservationCode: reservationIdentifier.toUpperCase() })
        .exec();
    }

    if (!reservation) {
      throw new NotFoundException({
        message: `Reservation '${reservationIdentifier}' was not found.`,
        code: 'RESERVATION_NOT_FOUND',
      });
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException({
        message: `Reservation '${reservation.reservationCode}' is already '${reservation.status}' and cannot be cancelled.`,
        code: 'RESERVATION_NOT_ACTIVE',
      });
    }

    let session: ClientSession | null = null;
    try {
      session = await this.connection.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    try {
      const cancellationReason =
        cancelDto.reason?.trim() || 'Cancelled by staff';

      // Mark reservation CANCELLED
      const updatedReservation = await this.reservationModel.findByIdAndUpdate(
        reservation._id,
        {
          $set: {
            status: ReservationStatus.CANCELLED,
            cancelledAt: new Date(),
            cancellationReason,
          },
        },
        { new: true, session: session || undefined },
      );

      // Release inventory units RESERVED -> AVAILABLE
      for (const invId of reservation.inventoryIds) {
        await this.inventoryModel.findByIdAndUpdate(
          invId,
          { $set: { status: InventoryStatus.AVAILABLE } },
          { session: session || undefined },
        );

        await this.inventoryHistoryModel.create(
          [
            {
              inventoryId: invId,
              fromStatus: InventoryStatus.RESERVED,
              toStatus: InventoryStatus.AVAILABLE,
              reason: `Reservation ${reservation.reservationCode} cancelled: ${cancellationReason}`,
            },
          ],
          { session: session || undefined },
        );
      }

      // Check and update BloodRequest lifecycle state
      const request = await this.bloodRequestModel
        .findById(reservation.bloodRequestId)
        .session(session || null)
        .exec();

      if (request && request.status === BloodRequestStatus.RESERVED) {
        const remainingActive = await this.reservationModel
          .find({
            bloodRequestId: request._id,
            _id: { $ne: reservation._id },
            status: ReservationStatus.ACTIVE,
          })
          .session(session || null)
          .exec();

        const remainingCount = remainingActive.reduce(
          (sum, r) => sum + r.inventoryIds.length,
          0,
        );

        if (remainingCount < request.unitsRequested) {
          await this.bloodRequestModel.findByIdAndUpdate(
            request._id,
            {
              $set: {
                status: BloodRequestStatus.APPROVED,
                statusReason: `Reservation ${reservation.reservationCode} cancelled. Reverted to APPROVED for future fulfillment.`,
                statusUpdatedAt: new Date(),
              },
            },
            { session: session || undefined },
          );
        }
      }

      if (session) {
        await session.commitTransaction();
      }

      return {
        reservationCode: updatedReservation!.reservationCode,
        bloodRequestId: (updatedReservation!.bloodRequestId as any).toString(),
        requestCode: updatedReservation!.requestCode,
        status: updatedReservation!.status,
        cancelledAt: updatedReservation!.cancelledAt,
        cancellationReason: updatedReservation!.cancellationReason,
        reservedUnits: updatedReservation!.reservedUnits.map((item) => ({
          inventoryId: item.inventoryId ? item.inventoryId.toString() : '',
          bloodUnitId: item.bloodUnitId ? item.bloodUnitId.toString() : '',
          unitCode: item.unitCode,
          bloodGroup: item.bloodGroup,
          componentType: item.componentType,
          status: 'AVAILABLE',
        })),
      };
    } catch (err) {
      if (session) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Retrieves paginated or filtered reservations list.
   */
  async findAll(query?: QueryReservationsDto) {
    const filter: any = {};
    if (query?.status) {
      filter.status = query.status;
    }
    if (query?.bloodRequestId && isValidObjectId(query.bloodRequestId)) {
      filter.bloodRequestId = new Types.ObjectId(query.bloodRequestId);
    }
    if (query?.requestCode?.trim()) {
      filter.requestCode = query.requestCode.trim().toUpperCase();
    }
    if (query?.reservationCode?.trim()) {
      filter.reservationCode = query.reservationCode.trim().toUpperCase();
    }

    const reservations = await this.reservationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    return reservations.map((r) => ({
      _id: (r._id as any).toString(),
      reservationCode: r.reservationCode,
      bloodRequestId: (r.bloodRequestId as any).toString(),
      requestCode: r.requestCode,
      status: r.status,
      reservedUnits: r.reservedUnits.map((u) => ({
        inventoryId: u.inventoryId.toString(),
        bloodUnitId: u.bloodUnitId.toString(),
        unitCode: u.unitCode,
        bloodGroup: u.bloodGroup,
        componentType: u.componentType,
        status: u.status,
      })),
      reservedAt: r.reservedAt,
      expiresAt: r.expiresAt || null,
      cancelledAt: r.cancelledAt || null,
      cancellationReason: r.cancellationReason || null,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Retrieves single reservation by MongoDB ID or reservation tracking code.
   */
  async findOne(identifier: string) {
    let reservation: ReservationDocument | null = null;
    if (isValidObjectId(identifier)) {
      reservation = await this.reservationModel.findById(identifier).exec();
    }
    if (!reservation) {
      reservation = await this.reservationModel
        .findOne({ reservationCode: identifier.toUpperCase() })
        .exec();
    }

    if (!reservation) {
      throw new NotFoundException({
        message: `Reservation '${identifier}' was not found.`,
        code: 'RESERVATION_NOT_FOUND',
      });
    }

    return {
      _id: (reservation._id as any).toString(),
      reservationCode: reservation.reservationCode,
      bloodRequestId: (reservation.bloodRequestId as any).toString(),
      requestCode: reservation.requestCode,
      status: reservation.status,
      reservedUnits: reservation.reservedUnits.map((u) => ({
        inventoryId: u.inventoryId.toString(),
        bloodUnitId: u.bloodUnitId.toString(),
        unitCode: u.unitCode,
        bloodGroup: u.bloodGroup,
        componentType: u.componentType,
        status: u.status,
      })),
      reservedAt: reservation.reservedAt,
      expiresAt: reservation.expiresAt || null,
      cancelledAt: reservation.cancelledAt || null,
      cancellationReason: reservation.cancellationReason || null,
      createdAt: reservation.createdAt,
    };
  }

  /**
   * Retrieves all reservations (including active and historical) for a specific blood request.
   */
  async findByBloodRequestId(bloodRequestId: string) {
    let reqObjectId: Types.ObjectId | null = null;
    if (isValidObjectId(bloodRequestId)) {
      reqObjectId = new Types.ObjectId(bloodRequestId);
    } else {
      const req = await this.bloodRequestModel
        .findOne({ requestCode: bloodRequestId.toUpperCase() })
        .exec();
      if (req) {
        reqObjectId = req._id as Types.ObjectId;
      }
    }

    if (!reqObjectId) {
      throw new NotFoundException({
        message: `Blood request with identifier '${bloodRequestId}' was not found.`,
        code: 'BLOOD_REQUEST_NOT_FOUND',
      });
    }

    const reservations = await this.reservationModel
      .find({ bloodRequestId: reqObjectId })
      .sort({ createdAt: -1 })
      .exec();

    return reservations.map((r) => ({
      _id: (r._id as any).toString(),
      reservationCode: r.reservationCode,
      bloodRequestId: (r.bloodRequestId as any).toString(),
      requestCode: r.requestCode,
      status: r.status,
      reservedUnits: r.reservedUnits.map((u) => ({
        inventoryId: u.inventoryId.toString(),
        bloodUnitId: u.bloodUnitId.toString(),
        unitCode: u.unitCode,
        bloodGroup: u.bloodGroup,
        componentType: u.componentType,
        status: u.status,
      })),
      reservedAt: r.reservedAt,
      expiresAt: r.expiresAt || null,
      cancelledAt: r.cancelledAt || null,
      cancellationReason: r.cancellationReason || null,
      createdAt: r.createdAt,
    }));
  }
}
