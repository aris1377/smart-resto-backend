import { SetMetadata } from '@nestjs/common';

export const ALLOW_EXPIRED_KEY = 'allowExpired';

/**
 * Obunasi tugagan restoran ham chaqira oladigan endpoint.
 * Zaldagi mehmon tuzoqqa tushmasligi uchun: ochiq orderni yopish va
 * to'lov qabul qilish (Faza 7-8) shu dekorator bilan ochiladi.
 */
export const AllowExpired = () => SetMetadata(ALLOW_EXPIRED_KEY, true);
