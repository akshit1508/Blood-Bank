import {
  IsOptional,
  IsString,
} from 'class-validator';

export class AuthorizeTestingDto {
  @IsString()
  @IsOptional()
  authorizationRemarks?: string;
}
