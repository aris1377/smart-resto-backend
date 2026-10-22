import { SubscriptionStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListTenantsDto {
  // Query parametrlari har doim satr bo'lib keladi — songa o'tkazish kerak
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  /** Restoran nomi, egasining ismi yoki telefoni bo'yicha */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Oxirgi obunasining holati bo'yicha filtr */
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  /** Tarif bo'yicha filtr */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId?: number;

  /**
   * Shartnoma holati — "Bloklangan" filtri shu.
   * Obuna holatidan alohida: bloklangan restoranning obunasi faol bo'lishi
   * mumkin, lekin u baribir tizimga kira olmaydi.
   */
  @IsOptional()
  @Transform(({ value }): unknown => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
