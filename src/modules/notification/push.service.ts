import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Queue } from 'bullmq';
import { REALTIME_EVENT } from '../realtime/realtime.constants';
import { OrderPushPayload, PushJobData } from './interfaces';
import {
  PUSH_JOB,
  PUSH_JOB_OPTIONS,
  PUSH_QUEUE,
} from './notification.constants';

/**
 * Boshqa modullar push bilan faqat shu service orqali gaplashadi.
 *
 * Bu yerda hech narsa yuborilmaydi — ish faqat **navbatga yoziladi**.
 * WebSocket bilan farqi: WebSocket ilova **ochiq** boʻlganda ishlaydi,
 * push esa ilova yopiq boʻlganda ham telefonni jiringlatadi. Shuning uchun
 * ikkisi birga chaqiriladi, biri ikkinchisining oʻrnini bosmaydi.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectQueue(PUSH_QUEUE) private readonly queue: Queue<PushJobData>,
  ) {}

  /** Yangi buyurtma — oshxona tayyorlaydi, ofitsiant olib boradi */
  orderCreated(branchId: number, order: OrderPushPayload): void {
    this.enqueue({
      branchId,
      roles: [Role.KITCHEN, Role.WAITER],
      title: 'Yangi buyurtma',
      body: `${order.table.number}-stol buyurtma berdi.`,
      data: { event: REALTIME_EVENT.ORDER_CREATED, orderId: String(order.id) },
    });
  }

  /** Ovqatlanish davomida qoʻshilgan taom */
  orderItemAdded(branchId: number, order: OrderPushPayload): void {
    this.enqueue({
      branchId,
      roles: [Role.KITCHEN, Role.WAITER],
      title: 'Qoʻshimcha buyurtma',
      body: `${order.table.number}-stol taom qoʻshdi.`,
      data: {
        event: REALTIME_EVENT.ORDER_ITEM_ADDED,
        orderId: String(order.id),
      },
    });
  }

  /** Hisob soʻraldi — oshxonaga kerak emas, kassir va ofitsiantga kerak */
  orderBillRequested(branchId: number, order: OrderPushPayload): void {
    this.enqueue({
      branchId,
      roles: [Role.WAITER, Role.CASHIER],
      title: 'Hisob soʻraldi',
      body: `${order.table.number}-stol hisob soʻradi.`,
      data: {
        event: REALTIME_EVENT.ORDER_BILL_REQUESTED,
        orderId: String(order.id),
      },
    });
  }

  /**
   * Navbatga yozish ham Redis'ga murojaat — u ham kutilmaydi.
   * Navbat ishlamay qolsa buyurtma baribir qabul qilinadi: push yoʻqolgani
   * uchun mehmonni "xato" bilan qaytarib yuborish notoʻgʻri boʻlardi.
   */
  private enqueue(data: PushJobData): void {
    void this.queue
      .add(PUSH_JOB, data, PUSH_JOB_OPTIONS)
      .catch((error: Error) =>
        this.logger.error(`Navbatga qoʻshilmadi: ${error.message}`),
      );
  }
}
