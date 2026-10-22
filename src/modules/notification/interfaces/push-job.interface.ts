import { Role } from '@prisma/client';

/**
 * Navbatga yoziladigan ish.
 *
 * Bu yerda **token roʻyxati yoʻq**, faqat "qaysi filialdagi qaysi rol".
 * Sabab: ish navbatda turganda xodim smenani tugatishi yoki yangi planshet
 * ulanishi mumkin. Qurilmalar yuborish paytida — eng yangi holat boʻyicha —
 * tanlanadi.
 */
export interface PushJobData {
  branchId: number;
  roles: Role[];
  title: string;
  body: string;
  /** FCM `data` faqat matn qabul qiladi — raqamlar ham string boʻladi */
  data: Record<string, string>;
}

/** Push matnini yasash uchun kerak boʻlgan minimal buyurtma maʼlumoti */
export interface OrderPushPayload {
  id: number;
  table: { number: string };
}
