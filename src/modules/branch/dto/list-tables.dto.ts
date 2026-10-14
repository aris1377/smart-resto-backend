import { TableStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { BranchScopeQueryDto } from '../../../common/dto';

export class ListTablesDto extends BranchScopeQueryDto {
  /** Bitta zal bo'yicha filtr — planshetda zal tanlanganda */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  hallId?: number;

  /** "Bo'sh stollar" ko'rinishi uchun */
  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus;
}
