import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class MonthlyStatsDto {
  /** Nechta oy qaytarilsin — shu oy ham shu songa kiradi */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months: number = 12;
}
