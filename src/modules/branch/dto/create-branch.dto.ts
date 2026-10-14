import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /** STIR — chek va fiskal hujjatlarda ishlatiladi (Faza 8) */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxId?: string;
}
