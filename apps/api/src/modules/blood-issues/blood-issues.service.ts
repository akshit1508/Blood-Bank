import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession, isValidObjectId } from 'mongoose';
import { BloodIssue, BloodIssueDocument } from './schemas/blood-issue.schema';
import { BloodIssueStatus } from './constants/blood-issue.constants';
import { CreateBloodIssueDto } from './dto/create-blood-issue.dto';
import { QueryBloodIssuesDto } from './dto/query-blood-issues.dto';
import {
  Reservation,
  ReservationDocument,
} from '../reservations/schemas/reservation.schema';
import { ReservationStatus } from '../reservations/constants/reservation.constants';
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
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AuditActionType,
  AuditEntityType,
} from '../audit-logs/constants/audit-log.constants';
import { UnitIssueValidationService } from '../inventory/services/unit-issue-validation.service';
import {
  CrossmatchRecord,
  CrossmatchRecordDocument,
} from '../crossmatching/schemas/crossmatch-record.schema';
import {
  CrossmatchStatus,
  CrossmatchResult,
} from '../crossmatching/constants/crossmatching.constants';
import {
  ReplacementDonation,
  ReplacementDonationDocument,
} from '../replacement-donations/schemas/replacement-donation.schema';

@Injectable()
export class BloodIssuesService {
  constructor(
    @InjectModel(BloodIssue.name)
    private readonly bloodIssueModel: Model<BloodIssueDocument>,
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
    @Optional()
    private readonly auditLogsService?: AuditLogsService,
    @Optional()
    private readonly unitIssueValidationService?: UnitIssueValidationService,
    @Optional()
    @InjectModel(CrossmatchRecord.name)
    private readonly crossmatchModel?: Model<CrossmatchRecordDocument>,
    @Optional()
    @InjectModel(ReplacementDonation.name)
    private readonly replacementModel?: Model<ReplacementDonationDocument>,
  ) {}

  /**
   * Generates a unique tracking issue code.
   * Format: ISS-YYYYMMDD-XXXX (e.g. ISS-20261008-C7A2)
   */
  private generateIssueCode(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ISS-${datePart}-${randomPart}`;
  }

  /**
   * Issues reserved blood units against an approved/reserved blood request.
   *
   * Medical & Operational Rules Enforced (Phase 6C):
   * 1. Reservation must exist and be in ACTIVE status.
   * 2. Blood request must exist and be in RESERVED status.
   * 3. Inventory units must exist, be in RESERVED status, and belong to the reservation.
   * 4. Direct issue of AVAILABLE units is strictly prohibited (must reserve first).
   * 5. Physical blood units must be laboratory APPROVED and not expired.
   * 6. Blood unit status remains APPROVED (physical unit not discarded).
   * 7. Double-issue prevention:
   *    - Check reservation not already COMPLETED.
   *    - Atomic conditional status update on reservation (ACTIVE -> COMPLETED).
   *    - Atomic conditional status update on inventory items (RESERVED -> ISSUED).
   *    - Database unique indexes on reservationId, inventoryIds, and bloodUnitIds.
   * 8. Blood request status transitions from RESERVED -> ISSUED.
   * 9. Audit trail in inventory_history (RESERVED -> ISSUED).
   */
  async issueReservation(
    reservationIdentifier: string,
    createDto?: CreateBloodIssueDto,
    actor?: any,
  ) {
    // 1. Locate reservation by ObjectId or reservationCode
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

    // 2. Validate Reservation status
    if (reservation.status === ReservationStatus.COMPLETED) {
      throw new ConflictException({
        message: `Reservation '${reservation.reservationCode}' has already been issued.`,
        code: 'RESERVATION_ALREADY_ISSUED',
      });
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException({
        message: `Reservation '${reservation.reservationCode}' is in status '${reservation.status}' and cannot be issued. Only ACTIVE reservations can be issued.`,
        code: 'RESERVATION_NOT_ACTIVE',
      });
    }

    // Check if an issue record already exists for this reservation
    const existingIssue = await this.bloodIssueModel
      .findOne({ reservationId: reservation._id })
      .exec();
    if (existingIssue) {
      throw new ConflictException({
        message: `Blood issue record '${existingIssue.issueCode}' already exists for reservation '${reservation.reservationCode}'.`,
        code: 'RESERVATION_ALREADY_ISSUED',
      });
    }

    // 3. Locate and validate Blood Request
    const bloodRequest = await this.bloodRequestModel
      .findById(reservation.bloodRequestId)
      .exec();

    if (!bloodRequest) {
      throw new NotFoundException({
        message: `Associated blood request '${reservation.requestCode}' was not found.`,
        code: 'BLOOD_REQUEST_NOT_FOUND',
      });
    }

    // Clinical alignment: If blood request is APPROVED but has an authorized crossmatch linked to this reservation,
    // auto-align request status to RESERVED so the reserved blood can be issued to ward
    if (bloodRequest.status === BloodRequestStatus.APPROVED && this.crossmatchModel) {
      const linkedCrossmatch = await this.crossmatchModel
        .findOne({
          $or: [
            { reservationId: reservation._id },
            { reservationCode: reservation.reservationCode },
          ],
        })
        .exec();

      if (linkedCrossmatch) {
        bloodRequest.status = BloodRequestStatus.RESERVED;
        bloodRequest.statusUpdatedAt = new Date();
        await bloodRequest.save();
      }
    }

    if (bloodRequest.status !== BloodRequestStatus.RESERVED) {
      throw new BadRequestException({
        message: `Blood request '${bloodRequest.requestCode}' must be in RESERVED status to issue blood. Current status is '${bloodRequest.status}'.`,
        code: 'REQUEST_NOT_IN_RESERVED_STATUS',
      });
    }

    // 3.5. Clinical Safety & Crossmatch Enforcement:
    // Blood units cannot be sent/issued to a patient without completed, authorized compatible crossmatch and reservation
    if (this.crossmatchModel) {
      const crossmatch = await this.crossmatchModel
        .findOne({
          $or: [
            { reservationId: reservation._id },
            { reservationCode: reservation.reservationCode },
            {
              bloodRequestId: bloodRequest._id,
              'selectedUnit.inventoryId': { $in: reservation.inventoryIds },
            },
          ],
        })
        .exec();

      if (!crossmatch) {
        throw new BadRequestException({
          message: `Blood unit(s) cannot be issued for request '${bloodRequest.requestCode}' without laboratory crossmatching. Please complete crossmatch testing and authorization first.`,
          code: 'CROSSMATCH_REQUIRED_FOR_ISSUE',
        });
      }

      const validCrossmatchStatuses = [
        CrossmatchStatus.RESERVED,
        CrossmatchStatus.AUTHORIZED_COMPATIBLE,
        CrossmatchStatus.ISSUED,
      ];

      if (!validCrossmatchStatuses.includes(crossmatch.status)) {
        throw new BadRequestException({
          message: `Crossmatch record '${crossmatch.crossmatchCode}' is currently in status '${crossmatch.status}'. Blood units can only be issued after crossmatching is clinically authorized as COMPATIBLE and RESERVED.`,
          code: 'CROSSMATCH_NOT_AUTHORIZED_OR_RESERVED',
        });
      }

      if (crossmatch.laboratoryTest?.crossmatchResult === CrossmatchResult.INCOMPATIBLE) {
        throw new BadRequestException({
          message: `Crossmatch record '${crossmatch.crossmatchCode}' has an INCOMPATIBLE result. Incompatible blood units cannot be issued under any circumstances.`,
          code: 'CROSSMATCH_INCOMPATIBLE_ISSUE_BLOCKED',
        });
      }
    }

    // 4. Validate all inventory units and physical blood units
    const now = new Date();
    const inventoryDocs: InventoryDocument[] = [];
    const bloodUnitDocs: BloodUnitDocument[] = [];

    for (const invId of reservation.inventoryIds) {
      if (this.unitIssueValidationService) {
        const valRes = await this.unitIssueValidationService.validateUnitForAllocation({
          inventoryId: invId,
          expectedBloodGroup: bloodRequest.bloodGroup,
          expectedComponentType: bloodRequest.componentType,
          isIssue: true,
          expectedReservationId: reservation._id,
        });
        inventoryDocs.push(valRes.inventory);
        bloodUnitDocs.push(valRes.bloodUnit);
      } else {
        const inv = await this.inventoryModel
          .findById(invId)
          .populate('bloodUnitId')
          .exec();

        if (!inv) {
          throw new NotFoundException({
            message: `Inventory unit '${invId}' was not found.`,
            code: 'INVENTORY_NOT_FOUND',
          });
        }

        if (inv.status === InventoryStatus.AVAILABLE) {
          throw new BadRequestException({
            message: `Inventory unit '${invId}' is in status 'AVAILABLE'. Direct issuance without reservation is prohibited.`,
            code: 'UNIT_NOT_RESERVED',
          });
        }

        if (inv.status === InventoryStatus.ISSUED) {
          throw new ConflictException({
            message: `Inventory unit '${invId}' has already been issued.`,
            code: 'UNIT_ALREADY_ISSUED',
          });
        }

        if (inv.status !== InventoryStatus.RESERVED) {
          throw new BadRequestException({
            message: `Inventory unit '${invId}' is in status '${inv.status}' and cannot be issued.`,
            code: 'CANNOT_ISSUE_UNAVAILABLE_UNIT',
          });
        }

        const unit = inv.bloodUnitId as BloodUnitDocument | any;
        if (!unit) {
          throw new BadRequestException({
            message: `Inventory unit '${invId}' has no physical blood unit attached.`,
            code: 'BLOOD_UNIT_MISSING',
          });
        }

        if (unit.status !== BloodUnitStatus.APPROVED) {
          throw new BadRequestException({
            message: `Blood unit '${unit.unitCode}' is not laboratory approved (status: '${unit.status}').`,
            code: 'CANNOT_ISSUE_UNAPPROVED_UNIT',
          });
        }

        if (unit.expiryDate && new Date(unit.expiryDate) < now) {
          throw new BadRequestException({
            message: `Blood unit '${unit.unitCode}' has passed its expiration date (${new Date(unit.expiryDate).toISOString()}) and cannot be issued.`,
            code: 'CANNOT_ISSUE_EXPIRED_UNIT',
          });
        }

        inventoryDocs.push(inv);
        bloodUnitDocs.push(unit);
      }
    }

    // 5. ACID Transactional Issue Execution
    let session: ClientSession | null = null;
    try {
      session = await this.connection.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    try {
      // Generate unique issue code
      let issueCode = this.generateIssueCode();
      let attempts = 0;
      while (await this.bloodIssueModel.exists({ issueCode })) {
        issueCode = this.generateIssueCode();
        attempts++;
        if (attempts > 5) {
          issueCode = `ISS-${Date.now()}`;
          break;
        }
      }

      // Atomic reservation transition ACTIVE -> COMPLETED
      const updatedReservation = await this.reservationModel.findOneAndUpdate(
        { _id: reservation._id, status: ReservationStatus.ACTIVE },
        { $set: { status: ReservationStatus.COMPLETED } },
        { new: true, session: session || undefined },
      );

      if (!updatedReservation) {
        throw new ConflictException({
          message: `Reservation '${reservation.reservationCode}' is no longer active or was issued concurrently.`,
          code: 'RESERVATION_ALREADY_ISSUED',
        });
      }

      const issuedUnits: Array<{
        inventoryId: Types.ObjectId;
        bloodUnitId: Types.ObjectId;
        unitCode: string;
        bloodGroup: string;
        componentType: string;
        volume?: number;
        status: string;
      }> = [];

      // Atomic transition of each inventory item: RESERVED -> ISSUED
      for (const inv of inventoryDocs) {
        const updatedInv = await this.inventoryModel.findOneAndUpdate(
          { _id: inv._id, status: InventoryStatus.RESERVED },
          { $set: { status: InventoryStatus.ISSUED } },
          { new: true, session: session || undefined },
        );

        if (!updatedInv) {
          throw new ConflictException({
            message: `Inventory unit '${inv._id}' was modified or issued concurrently.`,
            code: 'UNIT_ALREADY_ISSUED',
          });
        }

        const unit = inv.bloodUnitId as any;
        issuedUnits.push({
          inventoryId: inv._id as Types.ObjectId,
          bloodUnitId: unit._id as Types.ObjectId,
          unitCode: unit.unitCode,
          bloodGroup: unit.bloodGroup,
          componentType: unit.componentType,
          volume: unit.volume,
          status: 'ISSUED',
        });

        // Record audit trail in inventory_history
        await this.inventoryHistoryModel.create(
          [
            {
              inventoryId: inv._id,
              fromStatus: InventoryStatus.RESERVED,
              toStatus: InventoryStatus.ISSUED,
              reason: `Issued for blood request ${bloodRequest.requestCode} (Reservation: ${reservation.reservationCode}, Issue: ${issueCode})${
                createDto?.remarks ? `. Remarks: ${createDto.remarks}` : ''
              }`,
              changedBy: actor?._id || actor?.id ? new Types.ObjectId(actor._id || actor.id) : undefined,
              changedByName: actor?.fullName || actor?.name || undefined,
              changedByRole: actor?.role || undefined,
            },
          ],
          { session: session || undefined },
        );
      }

      // Transition blood request status: RESERVED -> ISSUED
      await this.bloodRequestModel.findByIdAndUpdate(
        bloodRequest._id,
        {
          $set: {
            status: BloodRequestStatus.ISSUED,
            statusReason: `Blood units issued via issue record ${issueCode}`,
            statusUpdatedAt: new Date(),
          },
        },
        { session: session || undefined },
      );

      // Create BloodIssue document
      const [bloodIssue] = await this.bloodIssueModel.create(
        [
          {
            issueCode,
            bloodRequestId: bloodRequest._id,
            requestCode: bloodRequest.requestCode,
            reservationId: reservation._id,
            reservationCode: reservation.reservationCode,
            inventoryIds: reservation.inventoryIds,
            bloodUnitIds: reservation.bloodUnitIds,
            issuedUnits,
            status: BloodIssueStatus.COMPLETED,
            issuedAt: new Date(),
            issuedBy: actor?.fullName || actor?.name || createDto?.issuedBy?.trim() || createDto?.recipientName?.trim() || undefined,
            issuedByStaffId: actor?._id || actor?.id ? new Types.ObjectId(actor._id || actor.id) : undefined,
            issuedByName: actor?.fullName || actor?.name || undefined,
            issuedByRole: actor?.role || undefined,
            remarks: createDto?.remarks?.trim() || createDto?.notes?.trim() || undefined,
          },
        ],
        { session: session || undefined },
      );

      if (session) {
        await session.commitTransaction();
      }

      // Synchronize crossmatch record status to ISSUED
      if (this.crossmatchModel) {
        try {
          const crossmatchToUpdate = await this.crossmatchModel
            .findOne({
              $or: [
                { reservationId: reservation._id },
                { reservationCode: reservation.reservationCode },
                {
                  bloodRequestId: bloodRequest._id,
                  'selectedUnit.inventoryId': { $in: reservation.inventoryIds },
                },
              ],
            })
            .exec();

          if (crossmatchToUpdate && crossmatchToUpdate.status !== CrossmatchStatus.ISSUED) {
            const prevStatus = crossmatchToUpdate.status;
            crossmatchToUpdate.status = CrossmatchStatus.ISSUED;
            crossmatchToUpdate.issuedAt = new Date();
            crossmatchToUpdate.issueCode = bloodIssue.issueCode;
            crossmatchToUpdate.timeline.push({
              fromStatus: prevStatus,
              toStatus: CrossmatchStatus.ISSUED,
              actorId: actor?._id || actor?.id,
              actorName: actor?.fullName || actor?.name || 'Staff',
              actorRole: actor?.role || 'STAFF',
              action: 'UNIT_ISSUED',
              timestamp: new Date(),
              notes: `Issued under ${bloodIssue.issueCode} against reservation ${reservation.reservationCode}`,
            } as any);
            await crossmatchToUpdate.save();
          }
        } catch {
          // Non-blocking sync
        }
      }

      // Synchronize associated replacement donation tracking cases
      // Multi-case safety: Link each issued unit 1-to-1 to unlinked active replacement cases.
      // Do not indiscriminately link the same issued unit to multiple replacement cases.
      if (this.replacementModel) {
        try {
          const activeReplacements = await this.replacementModel
            .find({
              bloodRequestId: bloodRequest._id,
              status: { $ne: 'CANCELLED' as any },
            })
            .sort({ createdAt: 1 })
            .exec();

          const unlinkedReplacements = activeReplacements.filter(
            (rep) => !rep.issuedBloodUnitId,
          );

          let unitIdx = 0;
          for (const rep of unlinkedReplacements) {
            if (unitIdx >= issuedUnits.length) {
              break;
            }
            const unitToLink = issuedUnits[unitIdx];

            rep.bloodIssueId = bloodIssue._id;
            rep.issueCode = bloodIssue.issueCode;
            rep.issuedBloodUnitId = unitToLink.bloodUnitId;
            rep.issuedUnitCode = unitToLink.unitCode;
            rep.timeline.push({
              event: 'PATIENT_UNIT_ISSUED',
              status: rep.status,
              description: `Patient received unit ${unitToLink.unitCode} (${unitToLink.bloodGroup} ${unitToLink.componentType}) under issue record ${bloodIssue.issueCode}. (Independent of relative donation ${rep.donorCode})`,
              actorId: actor?._id || actor?.id ? String(actor._id || actor.id) : undefined,
              actorName: actor?.fullName || actor?.name || 'Staff',
              actorRole: actor?.role || 'STAFF',
              timestamp: new Date(),
            } as any);
            await rep.save();
            unitIdx++;
          }
        } catch {
          // Non-blocking sync for replacement records
        }
      }

      if (this.auditLogsService) {
        await this.auditLogsService.logEvent({
          actorId: actor?._id || actor?.id,
          actorName: actor?.fullName || actor?.name,
          actorEmail: actor?.email,
          actorRole: actor?.role,
          action: AuditActionType.BLOOD_ISSUED,
          entityType: AuditEntityType.BLOOD_ISSUE,
          entityId: bloodIssue._id.toString(),
          entityIdentifier: bloodIssue.issueCode,
          description: `Issued ${issuedUnits.length} unit(s) for blood request ${bloodRequest.requestCode} (Reservation ${reservation.reservationCode})`,
          afterState: {
            issueCode: bloodIssue.issueCode,
            requestCode: bloodRequest.requestCode,
            reservationCode: reservation.reservationCode,
            issuedUnitsCount: issuedUnits.length,
          },
          metadata: { units: issuedUnits.map((u) => u.unitCode) },
        });
      }

      return {
        _id: (bloodIssue._id as any).toString(),
        issueCode: bloodIssue.issueCode,
        bloodRequestId: (bloodIssue.bloodRequestId as any).toString(),
        requestCode: bloodIssue.requestCode,
        reservationId: (bloodIssue.reservationId as any).toString(),
        reservationCode: bloodIssue.reservationCode,
        status: bloodIssue.status,
        issuedUnits: bloodIssue.issuedUnits.map((u) => ({
          inventoryId: u.inventoryId.toString(),
          bloodUnitId: u.bloodUnitId.toString(),
          unitCode: u.unitCode,
          bloodGroup: u.bloodGroup,
          componentType: u.componentType,
          volume: u.volume,
          status: u.status,
        })),
        issuedAt: bloodIssue.issuedAt,
        issuedBy: bloodIssue.issuedBy || null,
        issuedByStaffId: bloodIssue.issuedByStaffId || null,
        issuedByName: bloodIssue.issuedByName || null,
        issuedByRole: bloodIssue.issuedByRole || null,
        remarks: bloodIssue.remarks || null,
        createdAt: bloodIssue.createdAt,
      };
    } catch (err: any) {
      if (session) {
        await session.abortTransaction();
      }
      if (err.code === 11000) {
        throw new ConflictException({
          message: 'One or more blood units have already been issued.',
          code: 'UNIT_ALREADY_ISSUED',
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
   * Retrieves all blood issue records with optional filters.
   */
  async findAll(query?: QueryBloodIssuesDto) {
    const filter: any = {};
    if (query?.bloodRequestId && isValidObjectId(query.bloodRequestId)) {
      filter.bloodRequestId = new Types.ObjectId(query.bloodRequestId);
    }
    if (query?.requestCode?.trim()) {
      filter.requestCode = query.requestCode.trim().toUpperCase();
    }
    if (query?.reservationCode?.trim()) {
      filter.reservationCode = query.reservationCode.trim().toUpperCase();
    }
    if (query?.issueCode?.trim()) {
      filter.issueCode = query.issueCode.trim().toUpperCase();
    }

    const issues = await this.bloodIssueModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    return issues.map((item) => ({
      _id: (item._id as any).toString(),
      issueCode: item.issueCode,
      bloodRequestId: (item.bloodRequestId as any).toString(),
      requestCode: item.requestCode,
      reservationId: (item.reservationId as any).toString(),
      reservationCode: item.reservationCode,
      status: item.status,
      issuedUnits: item.issuedUnits.map((u) => ({
        inventoryId: u.inventoryId.toString(),
        bloodUnitId: u.bloodUnitId.toString(),
        unitCode: u.unitCode,
        bloodGroup: u.bloodGroup,
        componentType: u.componentType,
        volume: u.volume,
        status: u.status,
      })),
      issuedAt: item.issuedAt,
      issuedBy: item.issuedBy || null,
      remarks: item.remarks || null,
      createdAt: item.createdAt,
    }));
  }

  /**
   * Retrieves a single blood issue record by Mongo ID or issueCode.
   */
  async findOne(identifier: string) {
    let issue: BloodIssueDocument | null = null;
    if (isValidObjectId(identifier)) {
      issue = await this.bloodIssueModel.findById(identifier).exec();
    }
    if (!issue) {
      issue = await this.bloodIssueModel
        .findOne({ issueCode: identifier.toUpperCase() })
        .exec();
    }

    if (!issue) {
      throw new NotFoundException({
        message: `Blood issue record '${identifier}' was not found.`,
        code: 'BLOOD_ISSUE_NOT_FOUND',
      });
    }

    return {
      _id: (issue._id as any).toString(),
      issueCode: issue.issueCode,
      bloodRequestId: (issue.bloodRequestId as any).toString(),
      requestCode: issue.requestCode,
      reservationId: (issue.reservationId as any).toString(),
      reservationCode: issue.reservationCode,
      status: issue.status,
      issuedUnits: issue.issuedUnits.map((u) => ({
        inventoryId: u.inventoryId.toString(),
        bloodUnitId: u.bloodUnitId.toString(),
        unitCode: u.unitCode,
        bloodGroup: u.bloodGroup,
        componentType: u.componentType,
        volume: u.volume,
        status: u.status,
      })),
      issuedAt: issue.issuedAt,
      issuedBy: issue.issuedBy || null,
      remarks: issue.remarks || null,
      createdAt: issue.createdAt,
    };
  }

  /**
   * Retrieves all blood issue records for a given blood request.
   */
  async findByRequestId(requestId: string) {
    let reqObjectId: Types.ObjectId | null = null;
    if (isValidObjectId(requestId)) {
      reqObjectId = new Types.ObjectId(requestId);
    } else {
      const req = await this.bloodRequestModel
        .findOne({ requestCode: requestId.toUpperCase() })
        .exec();
      if (req) {
        reqObjectId = req._id as Types.ObjectId;
      }
    }

    if (!reqObjectId) {
      throw new NotFoundException({
        message: `Blood request '${requestId}' was not found.`,
        code: 'BLOOD_REQUEST_NOT_FOUND',
      });
    }

    const issues = await this.bloodIssueModel
      .find({ bloodRequestId: reqObjectId })
      .sort({ createdAt: -1 })
      .exec();

    return issues.map((item) => ({
      _id: (item._id as any).toString(),
      issueCode: item.issueCode,
      bloodRequestId: (item.bloodRequestId as any).toString(),
      requestCode: item.requestCode,
      reservationId: (item.reservationId as any).toString(),
      reservationCode: item.reservationCode,
      status: item.status,
      issuedUnits: item.issuedUnits.map((u) => ({
        inventoryId: u.inventoryId.toString(),
        bloodUnitId: u.bloodUnitId.toString(),
        unitCode: u.unitCode,
        bloodGroup: u.bloodGroup,
        componentType: u.componentType,
        volume: u.volume,
        status: u.status,
      })),
      issuedAt: item.issuedAt,
      issuedBy: item.issuedBy || null,
      remarks: item.remarks || null,
      createdAt: item.createdAt,
    }));
  }
}
