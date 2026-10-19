import { minutes } from '@nestjs/throttler';

/** Mijoz brauzeri o'z UUID'sini shu sarlavhada yuboradi */
export const GUEST_SESSION_HEADER = 'x-guest-session';

/**
 * `Order.status` va `Order.source` hozircha `String` (Faza 7 da enumga
 * o'tadi), shuning uchun qiymatlar shu yerda bir joyda turadi.
 */
export const ORDER_STATUS = {
  NEW: 'new',
  COOKING: 'cooking',
  SERVED: 'served',
} as const;

/** Yopilmagan buyurtma — unga taom qo'shish va hisob so'rash mumkin */
export const OPEN_ORDER_STATUSES: string[] = Object.values(ORDER_STATUS);

export const ORDER_SOURCE_QR = 'qr_customer';

/** Order item statusi — oshxona uni Faza 7 da o'zgartiradi */
export const ORDER_ITEM_STATUS_PENDING = 'pending';

/** Bitta so'rovdagi taomlar va bitta taom soni chegarasi */
export const MAX_ITEMS_PER_REQUEST = 30;
export const MAX_ITEM_QUANTITY = 50;

/**
 * Ochiq endpointlar uchun alohida rate-limit (IP bo'yicha).
 * Restoran Wi-Fi'da hamma mehmon bitta IP'dan chiqishi mumkin, shuning uchun
 * o'qish limiti juda past emas; yozish esa qattiqroq.
 */
export const GUEST_READ_THROTTLE = { default: { limit: 60, ttl: minutes(1) } };
export const GUEST_WRITE_THROTTLE = { default: { limit: 20, ttl: minutes(1) } };
