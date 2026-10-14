import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  Min,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExternalSourceType } from '../constants/blood-acquisition.constants';
import { BloodGroup } from '../../donors/constants/donor.constants';
import { BloodUnitComponent } from '../../blood-units/constants/blood-unit.constants';

export class BloodAcquisitionItemDto {
  @IsEnum(BloodGroup, {
    message: `bloodGroup must be a valid blood group: ${Object.values(BloodGroup).join(', ')}`,
  })
  bloodGroup: BloodGroup;

  @IsEnum(BloodUnitComponent, {
    message: `componentType must be one of: ${Object.values(BloodUnitComponent).join(', ')}`,
  })
  componentType: BloodUnitComponent;

  /** Formal quantity billed by supplier on invoice */
  @IsInt({ message: 'invoicedQuantity must be an integer' })
  @Min(1, { message: 'invoicedQuantity must be at least 1' })
  invoicedQuantity: number;

  /** Units physically delivered at the intake dock */
  @IsInt({ message: 'receivedQuantity must be an integer' })
  @Min(0, { message: 'receivedQuantity must be non-negative' })
  receivedQuantity: number;

  /** Units awaiting inspection - must be 0 before committing unit creation */
  @IsOptional()
  @IsInt({ message: 'pendingInspectionQuantity must be an integer' })
  @Min(0, { message: 'pendingInspectionQuantity must be non-negative' })
  pendingInspectionQuantity?: number;

  /** Units passing intake physical inspection (canonical count) */
  @IsInt({ message: 'acceptedQuantity must be an integer' })
  @Min(0, { message: 'acceptedQuantity must be non-negative' })
  acceptedQuantity: number;

  /** Units damaged, clotted, hemolyzed, or expired upon arrival */
  @IsOptional()
  @IsInt({ message: 'rejectedQuantity must be an integer' })
  @Min(0, { message: 'rejectedQuantity must be non-negative' })
  rejectedQuantity?: number;

  /** Legacy / compatibility quantity field (must equal acceptedQuantity) */
  @IsOptional()
  @IsInt({ message: 'quantity must be an integer' })
  @Min(0, { message: 'quantity must be non-negative' })
  quantity?: number;

  /** Price per unit in INR */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'unitCost must be a valid monetary number' })
  @Min(0, { message: 'unitCost must be non-negative' })
  @Type(() => Number)
  unitCost?: number;

  @IsBoolean({ message: 'testingRequired must be a boolean (true or false)' })
  testingRequired: boolean;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'volumePerUnit must be at least 1 mL' })
  volumePerUnit?: number;

  @IsOptional()
  @IsDateString({}, { message: 'expiryDate must be a valid ISO date string' })
  expiryDate?: string;

  @IsOptional()
  @IsString()
  storageLocation?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  itemNotes?: string;
}

export class CreateBloodAcquisitionDto {
  @IsEnum(ExternalSourceType, {
    message: `sourceType must be one of: ${Object.values(ExternalSourceType).join(', ')}`,
  })
  sourceType: ExternalSourceType;

  @IsString()
  @IsNotEmpty({ message: 'sourceName is required' })
  sourceName: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsDateString({}, { message: 'receivedDate must be a valid ISO date string' })
  receivedDate: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray({ message: 'items must be an array of blood entries' })
  @ArrayMinSize(1, { message: 'At least one blood entry is required' })
  @ValidateNested({ each: true })
  @Type(() => BloodAcquisitionItemDto)
  items: BloodAcquisitionItemDto[];

  // Financial & Phase 3 Integration
  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  transportCharges?: number;

  // Medical Clearance for Direct Intake
  @IsOptional()
  @IsString()
  clearanceCertificateNumber?: string;

  @IsOptional()
  @IsBoolean()
  sourceTestingCertified?: boolean;

  @IsOptional()
  @IsBoolean()
  hasDiscrepancy?: boolean;

  @IsOptional()
  @IsString()
  reconciliationNotes?: string;
}
