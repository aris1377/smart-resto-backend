import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateHallDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** OWNER uchun majburiy, xodim uchun e'tiborsiz */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;
}
