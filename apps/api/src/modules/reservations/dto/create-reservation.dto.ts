import { IsArray, ArrayMinSize, IsMongoId } from 'class-validator';

export class CreateReservationDto {
  @IsArray({ message: 'inventoryIds must be an array of inventory IDs' })
  @ArrayMinSize(1, { message: 'At least one inventory ID must be provided for reservation' })
  @IsMongoId({ each: true, message: 'Each inventory ID must be a valid MongoDB ObjectId' })
  inventoryIds: string[];
}
