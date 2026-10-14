import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto';

/** Oxirgi obunani ko'rsatuvchi qism — ro'yxat va detalda bir xil ishlatiladi */
export const CURRENT_SUBSCRIPTION = {
  orderBy: { expiresAt: 'desc' },
  take: 1,
  select: {
    id: true,
    status: true,
    startsAt: true,
    expiresAt: true,
    plan: { select: { id: true, name: true, priceMonthly: true } },
  },
} satisfies Prisma.Tenant$subscriptionsArgs;

const MS_IN_DAY = 24 * 60 * 60 * 1000;

/**
 * Oyni to'g'ri qo'shadi: 31-yanvarga 1 oy qo'shilsa JS 3-martga sakraydi,
 * biz esa oyning oxirgi kuniga qaytaramiz (28-fevral).
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);

  if (result.getDate() !== day) {
    result.setDate(0);
  }

  return result;
}

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Yagona tekshiruv nuqtasi. `SubscriptionGuard` shuni chaqiradi;
   * Faza 5 dagi QR oqimi ham (u yerda `req.user` bo'lmaydi) shuni chaqiradi.
   */
  async assertActive(tenantId: number): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        isActive: true,
        subscriptions: {
          orderBy: { expiresAt: 'desc' },
          take: 1,
          select: { status: true, expiresAt: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restoran topilmadi.');
    }

    // Shartnoma bekor qilingan — bu to'lov masalasi emas, shuning uchun 403
    if (!tenant.isActive) {
      throw new ForbiddenException(
        'Restoran bloklangan. Platforma bilan bogʻlaning.',
      );
    }

    const current = tenant.subscriptions[0];
    const isValid =
      current &&
      current.status === SubscriptionStatus.ACTIVE &&
      current.expiresAt > new Date();

    if (!isValid) {
      throw new HttpException(
        'Obuna muddati tugagan. Tizimdan foydalanish uchun toʻlovni amalga oshiring.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  /**
   * Tarifdagi filial chegarasi. Yangi filial ochishdan oldin chaqiriladi.
   *
   * Chegara `Plan` da yozilgan, lekin tekshiruv shu yerda — qoida obuna
   * ma'lumotining yonida tursin, filial moduli esa uni bilmasin.
   */
  async assertCanAddBranch(tenantId: number): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { expiresAt: 'desc' },
      select: { plan: { select: { name: true, maxBranches: true } } },
    });

    // Obunasi yo'q restoran bu yergacha yetib kelmaydi (SubscriptionGuard
    // 402 beradi), lekin servis o'zi ham himoyalangan bo'lsin
    if (!subscription) {
      throw new ConflictException('Faol obuna topilmadi.');
    }

    const branches = await this.prisma.branch.count({ where: { tenantId } });

    if (branches >= subscription.plan.maxBranches) {
      throw new ConflictException(
        `"${subscription.plan.name}" tarifida ${subscription.plan.maxBranches} ta filial mumkin. Yangisini ochish uchun tarifni yangilang.`,
      );
    }
  }

  /**
   * Restoranning o'z obunasi — OWNER/MANAGER uchun.
   * Obuna tugagan bo'lsa ham javob beradi: foydalanuvchi nima bo'layotganini
   * va nima qilish kerakligini ko'rishi shart.
   */
  async getCurrentForTenant(tenantId: number) {
    const [subscription, branches, users] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: { tenantId },
        orderBy: { expiresAt: 'desc' },
        select: {
          status: true,
          startsAt: true,
          expiresAt: true,
          priceMonthly: true,
          plan: {
            select: {
              id: true,
              name: true,
              priceMonthly: true,
              maxBranches: true,
              maxUsers: true,
              features: true,
            },
          },
        },
      }),
      this.prisma.branch.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
    ]);

    // maxBranches `assertCanAddBranch()` da tekshiriladi, maxUsers Faza 10 da
    const usage = { branches, users };

    if (!subscription) {
      return {
        isActive: false,
        status: null,
        plan: null,
        startsAt: null,
        expiresAt: null,
        priceMonthly: null,
        daysLeft: 0,
        usage,
        limits: null,
      };
    }

    const now = new Date();
    const isActive =
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.expiresAt > now;

    const msLeft = subscription.expiresAt.getTime() - now.getTime();
    const daysLeft = msLeft > 0 ? Math.ceil(msLeft / MS_IN_DAY) : 0;

    const { plan, ...rest } = subscription;

    return {
      isActive,
      status: rest.status,
      plan: { id: plan.id, name: plan.name, features: plan.features },
      startsAt: rest.startsAt,
      expiresAt: rest.expiresAt,
      // Amaldagi narx: kelishilgani bo'lmasa — tarif narxi
      priceMonthly: rest.priceMonthly ?? plan.priceMonthly,
      daysLeft,
      usage,
      limits: { maxBranches: plan.maxBranches, maxUsers: plan.maxUsers },
    };
  }

  /**
   * Obuna berish yoki uzaytirish. Har safar yangi qator yaratiladi —
   * eskisi yangilanmaydi, chunki bu restoranning to'lov tarixi.
   */
  async grant(tenantId: number, dto: CreateSubscriptionDto) {
    const [tenant, plan] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      }),
      this.prisma.plan.findUnique({ where: { id: dto.planId } }),
    ]);

    if (!tenant) {
      throw new NotFoundException('Restoran topilmadi.');
    }

    if (!plan) {
      throw new NotFoundException('Tarif topilmadi.');
    }

    if (!plan.isActive) {
      throw new BadRequestException('Bu tarif sotuvdan olingan.');
    }

    const now = new Date();
    const current = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { expiresAt: 'desc' },
      select: {
        status: true,
        expiresAt: true,
        planId: true,
        priceMonthly: true,
      },
    });

    // Amaldagi obuna tugamagan bo'lsa — yangi davr o'shanining tugashidan boshlanadi
    const isCurrentValid =
      current &&
      current.status === SubscriptionStatus.ACTIVE &&
      current.expiresAt > now;

    const startsAt = isCurrentValid ? current.expiresAt : now;
    const expiresAt = addMonths(startsAt, dto.months);

    // Narx uch manbadan, shu tartibda:
    // 1) hozir kelishilgani, 2) shu tarifdagi oldingi kelishuv, 3) tarif narxi.
    // Ikkinchisi muhim: "sizga 100 mingga kelishganmiz" deb aytilgan restoran
    // uzaytirilganda jimgina to'liq narxga o'tib ketmasligi kerak.
    const carriedOver =
      current?.planId === plan.id ? current.priceMonthly : null;
    const negotiated = dto.priceMonthly ?? carriedOver;
    const monthlyPrice = new Prisma.Decimal(negotiated ?? plan.priceMonthly);
    const amount = monthlyPrice.mul(dto.months);

    // Obuna va hisob-faktura — ajralmas juftlik, bittasi yiqilsa ikkalasi ham bekor
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          startsAt,
          expiresAt,
          status: SubscriptionStatus.ACTIVE,
          // Faqat kelishilgan narx yoziladi; bo'sh bo'lsa — tarif narxi amalda
          priceMonthly: negotiated,
        },
      });

      const invoice = await tx.tenantInvoice.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          amount,
          periodFrom: startsAt,
          periodTo: expiresAt,
          // Obunani SUPER_ADMIN pul kelgandan keyin beradi
          status: InvoiceStatus.PAID,
          paidAt: now,
        },
      });

      return { subscription, invoice };
    });
  }
}
