import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTableDto {
  /**
   * Stol zalga bog'lanadi, filialga emas — filial zal orqali aniqlanadi.
   * Shuning uchun bu yerda `branchId` yo'q: ikki manba ziddiyat berardi.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  hallId: number;

  /** "12", "A-3", "VIP-1" — shuning uchun son emas, matn */
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  tableNumber: string;
}
