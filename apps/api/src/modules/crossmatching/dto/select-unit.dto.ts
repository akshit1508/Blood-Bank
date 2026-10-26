import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SelectUnitDto {
  @IsNotEmpty({ message: 'inventoryId is required to select candidate unit' })
  @IsString()
  inventoryId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
