import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  Prisma,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HashService } from '../auth/hash.service';
import {
  CreateTenantDto,
  ListInvoicesDto,
  ListTenantsDto,
  MonthlyStatsDto,
  UpdateTenantDto,
  UpdateTenantStatusDto,
} from './dto';
import {
  CURRENT_SUBSCRIPTION,
  CurrentSubscription,
  daysLeftUntil,
  validSubscriptionNow,
} from './subscription.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 3;

/**
 * Sana -> "2026-10". Oy serverning mahalliy vaqti boʻyicha olinadi —
 * `getStats` dagi `thisMonth` ham shunday hisoblanadi, ikki raqam bir-biriga
 * mos kelishi uchun.
 */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Restoranning egasi — ro'yxatdagi "Egasi" ustuni.
 *
 * Bir restoranda bir nechta OWNER bo'lishi mumkin (hamkorlar), shuning uchun
 * birinchisi — eng eskisi — olinadi: u restoranni ochgan odam.
 */
const TENANT_OWNER = {
  where: { role: Role.OWNER },
  orderBy: { id: 'asc' },
  take: 1,
  select: { id: true, name: true, phone: true, email: true },
} satisfies Prisma.Tenant$usersArgs;

/**
 * "Restoranlar" roʻyxatidagi bitta kartochka.
 *
 * `GET tenants` va `GET tenants/:id` **bir xil shakl** qaytarishi kerak
 * (frontend ikkalasini bitta tipga soladi), shuning uchun select bitta joyda.
 * Bitta restoran sahifasi buning ustiga faqat `branches` ni qoʻshadi.
 */
const TENANT_CARD = {
  id: true,
  name: true,
  city: true,
  logoUrl: true,
  isActive: true,
  createdAt: true,
  // take: 1 bilan Prisma buni bitta qoʻshimcha soʻrovda oladi (N+1 yoʻq)
  users: TENANT_OWNER,
  subscriptions: CURRENT_SUBSCRIPTION,
  _count: { select: { branches: true, users: true } },
} satisfies Prisma.TenantSelect;

/** `getStats` da MRR hisoblanadigan qator */
interface ActiveSubscriptionRow {
  tenantId: number;
  expiresAt: Date;
  priceMonthly: Prisma.Decimal | null;
  plan: { priceMonthly: Prisma.Decimal };
}

/** `getMonthlyStats` dagi bitta oy — toʻldirilgandan keyin javobga aylanadi */
interface MonthBucket {
  month: string;
  start: Date;
  revenue: Prisma.Decimal;
  paidInvoices: number;
  newTenants: number;
  totalTenants: number;
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: HashService,
  ) {}

  /** Restoranlar roʻyxati — egasi va oxirgi obunasi bilan */
  async listTenants(query: ListTenantsDto) {
    const { page, limit } = query;
    const where = await this.buildTenantFilter(query);

    // Roʻyxat va umumiy son — parallel
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: TENANT_CARD,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      items: items.map(({ users, subscriptions, ...tenant }) => ({
        ...tenant,
        owner: users[0] ?? null,
        subscription: this.describeSubscription(subscriptions[0]),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTenant(id: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        ...TENANT_CARD,
        // Roʻyxatda yoʻq, bitta restoran sahifasida kerak
        branches: { select: { id: true, name: true, address: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restoran topilmadi.');
    }

    const { users, subscriptions, ...rest } = tenant;

    return {
      ...rest,
      owner: users[0] ?? null,
      subscription: this.describeSubscription(subscriptions[0]),
    };
  }

  /**
   * Yangi restoran + uning birinchi OWNER hisobi, bitta tranzaksiyada:
   * egasisiz restoran paydo boʻlib qolmasin.
   * Filial bu yerda ochilmaydi — u egasining ishi (Faza 4).
   */
  async createTenant(dto: CreateTenantDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.owner.email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Bu email allaqachon band.');
    }

    // Hash tranzaksiyadan TASHQARIDA: bcrypt ~200ms, shuncha vaqt
    // tranzaksiyani ochiq ushlab turishning maʼnosi yoʻq
    const passwordHash = await this.hashService.hashSecret(dto.owner.password);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.name, city: dto.city, logoUrl: dto.logoUrl },
        select: {
          id: true,
          name: true,
          city: true,
          logoUrl: true,
          isActive: true,
        },
      });

      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          // OWNER butun biznesga tegishli, bitta filialga qamalmaydi
          branchId: null,
          name: dto.owner.name,
          email: dto.owner.email,
          phone: dto.owner.phone,
          password: passwordHash,
          role: Role.OWNER,
        },
        select: { id: true, name: true, email: true, role: true },
      });

      return { tenant, owner };
    });
  }

  /** Restoran kartochkasi — nomi, shahri, logotipi */
  async updateTenant(id: number, dto: UpdateTenantDto) {
    await this.getTenant(id);

    return this.prisma.tenant.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        city: true,
        logoUrl: true,
        isActive: true,
      },
    });
  }

  /** Shartnoma bekor qilinsa yoki qayta tiklansa */
  async setTenantStatus(id: number, dto: UpdateTenantStatusDto) {
    await this.getTenant(id);

    return this.prisma.tenant.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: { id: true, name: true, isActive: true },
    });
  }

  /**
   * Platforma dashboardi uchun raqamlar.
   *
   * Restoranlar uch holatga **bo'linadi** va yig'indisi `total` ga teng:
   * bloklangan / amaldagi obunasi bor / obunasi tugagan. Shuning uchun
   * obuna qatorlari emas, **restoranlar** sanaladi — uzaytirilgan
   * restoranda bir vaqtda ikkita amaldagi obuna bo'ladi.
   */
  async getStats() {
    const now = new Date();
    const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY_MS);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      total,
      blocked,
      activeSubscriptions,
      revenueTotal,
      revenueThisMonth,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: false } }),
      // Amaldagi obunalar narxi bilan: MRR ham, restoranlar soni ham shundan.
      // Qatorlar soni restoranlar sonidan ikki barobardan oshmaydi.
      this.prisma.subscription.findMany({
        where: { ...validSubscriptionNow(), tenant: { isActive: true } },
        orderBy: { expiresAt: 'desc' },
        select: {
          tenantId: true,
          expiresAt: true,
          priceMonthly: true,
          plan: { select: { priceMonthly: true } },
        },
      }),
      this.prisma.tenantInvoice.aggregate({
        where: { status: InvoiceStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.tenantInvoice.aggregate({
        where: { status: InvoiceStatus.PAID, paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
    ]);

    const active = this.summarizeActive(activeSubscriptions, soon);

    return {
      tenants: {
        total,
        // Amaldagi obunasi bor va bloklanmagan
        active: active.tenants,
        // Qolganlari — obunasi tugagan yoki umuman berilmagan
        expired: total - blocked - active.tenants,
        blocked,
      },
      subscriptions: { expiringSoon: active.expiringSoon },
      revenue: {
        // Oylik takrorlanuvchi tushum — amaldagi obunalarning oylik narxlari.
        // `thisMonth` dan farqi: bu prognoz, u esa kassaga tushgan pul.
        mrr: active.mrr,
        // Decimal JSONda matn boʻlib chiqadi — aniqlik yoʻqolmasligi uchun
        total: revenueTotal._sum.amount ?? 0,
        thisMonth: revenueThisMonth._sum.amount ?? 0,
      },
    };
  }

  /**
   * Statistika ekranidagi grafiklar: oylar boʻyicha tushum va restoranlar
   * oʻsishi. Oxirgi `months` oy qaytadi, oxirgisi — shu oy (hali toʻlmagan).
   *
   * Guruhlash SQL'da emas, shu yerda qilinadi: `date_trunc` oyni UTC boʻyicha
   * kesardi, ilovaning qolgan qismi esa mahalliy vaqt bilan ishlaydi — oyning
   * birinchi kunidagi toʻlov oldingi oyga tushib qolishi mumkin edi. Oyna
   * eng koʻpi bilan 24 oy, ya'ni oʻqiladigan qatorlar soni cheklangan.
   */
  async getMonthlyStats(query: MonthlyStatsDto) {
    const { months } = query;
    const buckets = this.buildMonthBuckets(months, new Date());
    const from = buckets[0].start;

    const [invoices, newTenants, tenantsBefore] = await Promise.all([
      this.prisma.tenantInvoice.findMany({
        where: { status: InvoiceStatus.PAID, paidAt: { gte: from } },
        select: { paidAt: true, amount: true },
      }),
      this.prisma.tenant.findMany({
        where: { createdAt: { gte: from } },
        select: { createdAt: true },
      }),
      // Oynadan oldingilari: oʻsish chizigʻi noldan emas, shu joydan boshlanadi
      this.prisma.tenant.count({ where: { createdAt: { lt: from } } }),
    ]);

    const byMonth = new Map(buckets.map((bucket) => [bucket.month, bucket]));

    for (const invoice of invoices) {
      const bucket = byMonth.get(monthKey(invoice.paidAt));
      if (bucket) {
        bucket.revenue = bucket.revenue.add(invoice.amount);
        bucket.paidInvoices++;
      }
    }

    for (const tenant of newTenants) {
      const bucket = byMonth.get(monthKey(tenant.createdAt));
      if (bucket) {
        bucket.newTenants++;
      }
    }

    // Jami restoranlar — oydan oyga yigʻilib boradi
    let running = tenantsBefore;
    for (const bucket of buckets) {
      running += bucket.newTenants;
      bucket.totalTenants = running;
    }

    return {
      months,
      items: buckets.map(({ start, ...bucket }) => bucket),
    };
  }

  /** Soʻnggi `months` oy: eng eskisidan hozirgisigacha, boʻsh oylar ham bor */
  private buildMonthBuckets(months: number, now: Date): MonthBucket[] {
    const buckets: MonthBucket[] = [];

    for (let back = months - 1; back >= 0; back--) {
      // Oy manfiy boʻlsa `Date` oʻzi oldingi yilga oʻtadi
      const start = new Date(now.getFullYear(), now.getMonth() - back, 1);

      buckets.push({
        month: monthKey(start),
        start,
        revenue: new Prisma.Decimal(0),
        paidInvoices: 0,
        newTenants: 0,
        totalTenants: 0,
      });
    }

    return buckets;
  }
  /**
   * Amaldagi obunalardan restoranlar sonini, MRR ni va tez orada
   * tugaydiganlarni hisoblaydi.
   *
   * Uzaytirilgan restoranda ikkita amaldagi obuna bo'ladi: joriysi va
   * oldindan to'langani. Ikkalasini sanash MRR ni ikki barobar ko'tarib
   * yuborardi, shuning uchun har restorandan faqat bittasi — eng kech
   * tugaydigani — olinadi (ro'yxat shunga qarab tartiblangan).
   */
  private summarizeActive(
    subscriptions: ActiveSubscriptionRow[],
    soon: Date,
  ): { tenants: number; mrr: Prisma.Decimal; expiringSoon: number } {
    const counted = new Set<number>();
    let mrr = new Prisma.Decimal(0);
    let expiringSoon = 0;

    for (const subscription of subscriptions) {
      if (counted.has(subscription.tenantId)) {
        continue;
      }

      counted.add(subscription.tenantId);
      // Amaldagi narx: kelishilgani bo'lmasa — tarif narxi
      mrr = mrr.add(
        subscription.priceMonthly ?? subscription.plan.priceMonthly,
      );

      if (subscription.expiresAt <= soon) {
        expiringSoon++;
      }
    }

    return { tenants: counted.size, mrr, expiringSoon };
  }

  /** Yon menyudagi "Hisob-fakturalar" bo'limi */
  async listInvoices(query: ListInvoicesDto) {
    const { page, limit, tenantId, status } = query;
    const where: Prisma.TenantInvoiceWhereInput = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      this.prisma.tenantInvoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          periodFrom: true,
          periodTo: true,
          status: true,
          paidAt: true,
          createdAt: true,
          tenant: { select: { id: true, name: true, city: true } },
          subscription: {
            select: { plan: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.tenantInvoice.count({ where }),
    ]);

    return {
      // Obuna o'chirilsa hisob-faktura qoladi (onDelete: SetNull),
      // shuning uchun tarif bo'sh bo'lishi mumkin
      items: items.map(({ subscription, ...invoice }) => ({
        ...invoice,
        plan: subscription?.plan ?? null,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async buildTenantFilter(
    query: ListTenantsDto,
  ): Promise<Prisma.TenantWhereInput> {
    const { search, status, planId, isActive } = query;
    const conditions: Prisma.TenantWhereInput[] = [];

    if (search) {
      conditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          {
            users: {
              some: {
                role: Role.OWNER,
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { phone: { contains: search } },
                ],
              },
            },
          },
        ],
      });
    }

    if (status) {
      conditions.push(this.subscriptionFilter(status));
    }

    if (planId) {
      conditions.push({
        id: { in: await this.tenantIdsWithCurrentPlan(planId) },
      });
    }

    if (isActive !== undefined) {
      conditions.push({ isActive });
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  /**
   * ACTIVE = hozir amal qilayotgan obunasi bor;
   * EXPIRED = shundayi yoʻq; SUSPENDED = qoʻlda toʻxtatilgani bor.
   */
  /**
   * Joriy tarifi `planId` boʻlgan restoranlarning id'lari.
   *
   * `subscriptions: { some: { planId } }` **tarix** boʻyicha qidirardi: tarifi
   * almashgan restoran eski tarif ostida ham chiqib qolardi, roʻyxatdagi
   * "Tarif" ustuni esa joriy obunani koʻrsatadi — filtr va ustun bir-biriga
   * zid boʻlardi.
   *
   * "Joriy" bu yerda ham `CURRENT_SUBSCRIPTION` dagi qoida: eng kech
   * tugaydigan obuna. Prisma `some` ichida "eng kechi" ni ifodalay olmaydi,
   * shuning uchun har restorandan bittasi `DISTINCT ON` bilan olinadi.
   * Tenglik boʻlsa kattaroq `id` ustun — natija barqaror boʻlsin.
   */
  private async tenantIdsWithCurrentPlan(planId: number): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<{ tenant_id: number }[]>`
      SELECT "tenant_id" FROM (
        SELECT DISTINCT ON ("tenant_id") "tenant_id", "plan_id"
        FROM "subscriptions"
        ORDER BY "tenant_id", "expires_at" DESC, "id" DESC
      ) AS current_plan
      WHERE "plan_id" = ${planId}
    `;

    return rows.map((row) => row.tenant_id);
  }

  private subscriptionFilter(
    status: SubscriptionStatus,
  ): Prisma.TenantWhereInput {
    if (status === SubscriptionStatus.ACTIVE) {
      return { subscriptions: { some: validSubscriptionNow() } };
    }

    if (status === SubscriptionStatus.EXPIRED) {
      return { subscriptions: { none: validSubscriptionNow() } };
    }

    return {
      subscriptions: { some: { status: SubscriptionStatus.SUSPENDED } },
    };
  }

  /**
   * Obunani roʻyxat uchun toʻldiradi.
   *
   * `priceMonthly` — **amaldagi** narx: kelishilgani boʻlmasa tarifniki
   * (`GET /subscription/me` dagi qoidaning aynan oʻzi). Tarifning oʻz narxi
   * `plan.priceMonthly` da qoladi, ya'ni chegirma koʻrinib turadi.
   */
  private describeSubscription(subscription?: CurrentSubscription) {
    if (!subscription) {
      return null;
    }

    const { priceMonthly, ...rest } = subscription;

    return {
      ...rest,
      priceMonthly: priceMonthly ?? rest.plan.priceMonthly,
      isNegotiated: priceMonthly !== null,
      daysLeft: daysLeftUntil(rest.expiresAt),
    };
  }
}
