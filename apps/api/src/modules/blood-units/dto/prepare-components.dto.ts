import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BloodUnitComponent } from '../constants/blood-unit.constants';

export class ComponentItemDto {
  @IsEnum(BloodUnitComponent, {
    message: 'componentType must be one of: PRBC, FFP, PLATELETS, CRYOPRECIPITATE',
  })
  @IsNotEmpty({ message: 'componentType is required' })
  componentType: BloodUnitComponent;

  @IsNumber()
  @Min(10, { message: 'volume must be at least 10 mL' })
  @Max(500, { message: 'volume cannot exceed 500 mL' })
  volume: number;

  @IsString()
  @IsOptional()
  storageLocation?: string;
}

export class PrepareComponentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentItemDto)
  components: ComponentItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}
