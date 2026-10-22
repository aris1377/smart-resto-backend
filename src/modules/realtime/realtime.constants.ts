/**
 * Socket.IO xonalari.
 *
 * Xona — ulanishlar guruhiga berilgan nom. "Shu xonaga yubor" deyilsa, xabar
 * barcha aʼzolariga boradi. Filial boʻyicha ajratilgani muhim: Chilonzor
 * oshxonasi Yunusobod buyurtmasini koʻrmasligi kerak. Ya'ni bu — HTTP
 * oqimidagi `where: { branchId }` qoidasining real-time'dagi koʻrinishi.
 */
export const ROOM = {
  /** OWNER, MANAGER, CASHIER — filialning umumiy manzarasi */
  dashboard: (branchId: number) => `branch:${branchId}:dashboard`,
  /** Oshxona ekrani (KDS) */
  kitchen: (branchId: number) => `branch:${branchId}:kitchen`,
  /** Filialdagi barcha ofitsiantlar */
  waiters: (branchId: number) => `branch:${branchId}:waiters`,
  /** Bitta xodim — faqat oʻziga biriktirilgan ish (Faza 7 da ishlatiladi) */
  user: (userId: number) => `user:${userId}`,
  /** QR orqali kelgan mehmon — faqat oʻz buyurtmasi */
  guest: (guestSessionId: string) => `guest:${guestSessionId}`,
} as const;

/**
 * Hodisa nomlari — mijoz tomoni aynan shu nomlarga "tinglaydi".
 * Faza 7-9 da `order.status.changed`, `payment.completed` va `stock.low`
 * shu yerga qoʻshiladi (hozir ularni chiqaradigan kod yoʻq).
 */
export const REALTIME_EVENT = {
  ORDER_CREATED: 'order.created',
  ORDER_ITEM_ADDED: 'order.item.added',
  ORDER_BILL_REQUESTED: 'order.bill.requested',
  /** Ulanish rad etilganda sabab shu nom bilan yuboriladi */
  CONNECTION_ERROR: 'connection.error',
} as const;

/**
 * Handshake'dagi `auth` obyektining maydonlari — mijoz tomoni bilan shartnoma.
 *
 * Brauzerning WebSocket API'si maxsus sarlavha yubora olmaydi, shuning uchun
 * token `Authorization` sarlavhasida emas, ulanish paytida bir marta shu
 * obyekt ichida keladi va ulanishga "yopishtiriladi".
 */
export const HANDSHAKE = {
  /** Xodim: access token */
  TOKEN: 'token',
  /** OWNER: tokenida filial yoʻq, shuning uchun qaysi filial ekanini aytadi */
  BRANCH_ID: 'branchId',
  /** Mehmon: brauzer UUID'si (`X-Guest-Session` ning socket varianti) */
  GUEST_SESSION: 'guestSession',
} as const;
