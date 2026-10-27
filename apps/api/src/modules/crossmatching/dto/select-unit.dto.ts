import { IsArray, IsOptional, IsString } from 'class-validator';

export class SelectUnitDto {
  @IsOptional()
  @IsString()
  inventoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inventoryIds?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
