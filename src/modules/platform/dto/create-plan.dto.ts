import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsNonNegativeDecimal } from '../../../common/decorators/is-non-negative-decimal.decorator';

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  /**
   * Pul matn koʻrinishida qabul qilinadi va Decimal boʻlib saqlanadi.
   * JS `number` ishlatilmaydi — yaxlitlash xatosi pulga tegmasligi kerak.
   */
  @IsNonNegativeDecimal(
    'Narx manfiy boʻlmagan matn boʻlsin, masalan "300000" yoki "300000.50".',
  )
  priceMonthly: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  maxBranches: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  maxUsers: number;

  /** Ixtiyoriy bayroqlar: {"inventory": true, "reports": false} */
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;
}
