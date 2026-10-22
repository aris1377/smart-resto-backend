import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsNonNegativeDecimal } from '../../../common/decorators/is-non-negative-decimal.decorator';

export class CreateSubscriptionDto {
  @IsInt()
  @Min(1)
  planId: number;

  /** Necha oyga beriladi. Amaldagi obuna bo'lsa, uning ustiga qo'shiladi */
  @IsInt()
  @Min(1)
  @Max(36)
  months: number;

  /**
   * Kelishilgan oylik narx (chegirma yoki maxsus shartnoma).
   * Yuborilmasa: o'sha tarifdagi oldingi kelishuv, u ham bo'lmasa tarif narxi.
   */
  @IsOptional()
  @IsNonNegativeDecimal('Narx manfiy boʻlmagan matn boʻlsin, masalan "100000".')
  priceMonthly?: string;
}
