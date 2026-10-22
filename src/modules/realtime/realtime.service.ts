import { Injectable } from '@nestjs/common';
import { REALTIME_EVENT, ROOM } from './realtime.constants';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Hodisa bilan yuboriladigan maʼlumot.
 *
 * Mehmonga HTTP javobida ketgan shaklning oʻzi ishlatiladi — ya'ni ichki
 * maydonlar (`guestSessionId`, `branchId`) bu yerda ham yoʻq. Qaysi xonaga
 * yuborish kerakligi `branchId` orqali hal qilinadi, lekin u yuklamaga
 * **qoʻshilmaydi**.
 */
export interface OrderEventPayload {
  id: number;
  status: string;
  table: { number: string };
}

/**
 * Boshqa modullar real-time bilan faqat shu service orqali gaplashadi.
 *
 * Qoida: hodisa **tranzaksiya yopilgandan keyin** chiqariladi. Tranzaksiya
 * ichida yuborilsa va u bekor boʻlsa, oshxona boʻlmagan buyurtmani koʻrardi.
 *
 * Yuborish `await` qilinmaydi: xabar oʻz serverimiz ichida tarqaladi va
 * mehmonning HTTP javobini kutib turishi shart emas.
 */
@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  /** Yangi buyurtma: oshxona tayyorlaydi, ofitsiant olib boradi, egasi koʻradi */
  orderCreated(
    branchId: number,
    order: OrderEventPayload,
    guestSessionId?: string,
  ): void {
    this.emit(REALTIME_EVENT.ORDER_CREATED, order, [
      ROOM.kitchen(branchId),
      ROOM.waiters(branchId),
      ROOM.dashboard(branchId),
      ...this.guestRoom(guestSessionId),
    ]);
  }

  /** Ovqatlanish davomida qoʻshilgan taom */
  orderItemAdded(
    branchId: number,
    order: OrderEventPayload,
    guestSessionId?: string,
  ): void {
    this.emit(REALTIME_EVENT.ORDER_ITEM_ADDED, order, [
      ROOM.kitchen(branchId),
      ROOM.waiters(branchId),
      ROOM.dashboard(branchId),
      ...this.guestRoom(guestSessionId),
    ]);
  }

  /** Hisob soʻraldi — oshxonaga kerak emas, kassir va ofitsiantga kerak */
  orderBillRequested(
    branchId: number,
    order: OrderEventPayload,
    guestSessionId?: string,
  ): void {
    this.emit(REALTIME_EVENT.ORDER_BILL_REQUESTED, order, [
      ROOM.waiters(branchId),
      ROOM.dashboard(branchId),
      ...this.guestRoom(guestSessionId),
    ]);
  }

  /**
   * Mehmonning oʻz xonasi: u sahifani ikkinchi qurilmada ochgan boʻlsa,
   * u ham yangilanadi. Sessiya boʻlmasa (POS buyurtmasi) — xona yoʻq.
   */
  private guestRoom(guestSessionId?: string): string[] {
    return guestSessionId ? [ROOM.guest(guestSessionId)] : [];
  }

  /**
   * Bir nechta xonaga bitta chaqiriqda yuboriladi: Socket.IO ikki xonada
   * turgan ulanishga xabarni ikki marta bermaydi.
   */
  private emit(event: string, payload: unknown, rooms: string[]): void {
    this.gateway.server.to(rooms).emit(event, payload);
  }
}
