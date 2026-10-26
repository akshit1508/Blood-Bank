import { IsNotEmpty, IsString } from 'class-validator';

export class RepeatCrossmatchDto {
  @IsNotEmpty({ message: 'Reason for ordering repeat or confirmatory crossmatch is required' })
  @IsString()
  repeatReason: string;
}
