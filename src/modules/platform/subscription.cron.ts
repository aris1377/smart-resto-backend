import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const WARN_BEFORE_DAYS = 3;

/**
 * Har kuni tunda obunalarni ko'zdan kechiradi.
 *
 * ⚠️ Prodda bir nechta instansiya ishlasa, bu vazifa har birida bajariladi.
 * Faza 12 da lock yoki alohida worker bilan hal qilinadi.
 */
@Injectable()
export class SubscriptionCron {
  private readonly logger = new Logger(SubscriptionCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async reviewSubscriptions(): Promise<void> {
    const now = new Date();

    // 1. Muddati o'tganlarni EXPIRED qilamiz.
    // Guard sanani ham tekshiradi, ya'ni bu yozuvni tartibga solish uchun:
    // hisobotlar va filtrlar status bo'yicha ishlaydi.
    const { count } = await this.prisma.subscription.updateMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { lte: now },
      },
      data: { status: SubscriptionStatus.EXPIRED },
    });

    if (count > 0) {
      this.logger.warn(`${count} ta obuna muddati tugadi`);
    }

    // 2. Tugashiga 3 kun qolganlar — hozircha logga, Faza 6 da push/email
    const soon = new Date(now.getTime() + WARN_BEFORE_DAYS * DAY_MS);
    const expiring = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { gt: now, lte: soon },
      },
      select: {
        expiresAt: true,
        tenant: { select: { id: true, name: true } },
      },
    });

    for (const subscription of expiring) {
      this.logger.warn(
        `Obuna tugayapti: ${subscription.tenant.name} (id=${subscription.tenant.id}) — ${subscription.expiresAt.toISOString()}`,
      );
    }
  }
}
