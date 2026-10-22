import { Matches } from 'class-validator';

/** "0", "25000", "25000.50" — ha; "-5", "1.005", "abc", "" — yoʻq */
const NON_NEGATIVE_DECIMAL = /^\d+(\.\d{1,2})?$/;

/**
 * Pul va miqdor maydonlari uchun.
 *
 * `@IsDecimal()` ning oʻrniga: u "-5" ni **toʻgʻri** oʻnlik son deb biladi,
 * ya'ni manfiy narxni oʻtkazib yuborardi. Bu yerda shaklning oʻzi tekshiriladi.
 *
 * Qiymat baribir **matn** boʻlib qoladi — `Decimal` ga aylantirish servisning
 * ishi, DTO faqat shaklni kafolatlaydi.
 */
export function IsNonNegativeDecimal(message: string): PropertyDecorator {
  return Matches(NON_NEGATIVE_DECIMAL, { message });
}
