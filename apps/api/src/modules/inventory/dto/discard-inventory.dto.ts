import { IsNotEmpty, IsString } from 'class-validator';

export class DiscardInventoryDto {
  @IsNotEmpty({ message: 'Discard reason is mandatory.' })
  @IsString({ message: 'Discard reason must be a valid string.' })
  reason: string;
}
