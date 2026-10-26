import { IsNotEmpty, IsString } from 'class-validator';

export class CancelCrossmatchDto {
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  @IsString()
  reason: string;
}
