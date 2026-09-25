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
import { CreateTenantDto, ListTenantsDto, UpdateTenantStatusDto } from './dto';
import { CURRENT_SUBSCRIPTION } from './subscription.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 3;

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: HashService,
  ) {}

  /** Restoranlar roʻyxati — oxirgi obunasi bilan, pagination majburiy */
  async listTenants(query: ListTenantsDto) {
    const { page, limit, search, status } = query;
    const where = this.buildTenantFilter(search, status);

    // Roʻyxat va umumiy son — parallel
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          isActive: true,
          createdAt: true,
          // take: 1 bilan Prisma buni bitta qoʻshimcha soʻrovda oladi (N+1 yoʻq)
          subscriptions: CURRENT_SUBSCRIPTION,
          _count: { select: { branches: true, users: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      items: items.map((tenant) => this.flattenSubscription(tenant)),
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
        id: true,
        name: true,
        logoUrl: true,
        isActive: true,
        createdAt: true,
        subscriptions: CURRENT_SUBSCRIPTION,
        branches: { select: { id: true, name: true, address: true } },
        _count: { select: { users: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restoran topilmadi.');
    }

    return this.flattenSubscription(tenant);
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
        data: { name: dto.name, logoUrl: dto.logoUrl },
        select: { id: true, name: true, logoUrl: true, isActive: true },
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

  /** Shartnoma bekor qilinsa yoki qayta tiklansa */
  async setTenantStatus(id: number, dto: UpdateTenantStatusDto) {
    await this.getTenant(id);

    return this.prisma.tenant.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: { id: true, name: true, isActive: true },
    });
  }

  /** Platforma dashboardi uchun umumiy raqamlar */
  async getStats() {
    const now = new Date();
    const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY_MS);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeFilter: Prisma.SubscriptionWhereInput = {
      status: SubscriptionStatus.ACTIVE,
      expiresAt: { gt: now },
    };

    const [
      totalTenants,
      activeTenants,
      activeSubscriptions,
      expiringSoon,
      expiredSubscriptions,
      revenueTotal,
      revenueThisMonth,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.subscription.count({ where: activeFilter }),
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { gt: now, lte: soon },
        },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.EXPIRED },
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

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        blocked: totalTenants - activeTenants,
      },
      subscriptions: {
        active: activeSubscriptions,
        expiringSoon,
        expired: expiredSubscriptions,
      },
      revenue: {
        // Decimal JSONda matn boʻlib chiqadi — aniqlik yoʻqolmasligi uchun
        total: revenueTotal._sum.amount ?? 0,
        thisMonth: revenueThisMonth._sum.amount ?? 0,
      },
    };
  }

  private buildTenantFilter(
    search?: string,
    status?: SubscriptionStatus,
  ): Prisma.TenantWhereInput {
    const where: Prisma.TenantWhereInput = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (!status) {
      return where;
    }

    const validNow: Prisma.SubscriptionWhereInput = {
      status: SubscriptionStatus.ACTIVE,
      expiresAt: { gt: new Date() },
    };

    // ACTIVE = hozir amal qilayotgan obunasi bor;
    // EXPIRED = shundayi yoʻq; SUSPENDED = qoʻlda toʻxtatilgani bor
    if (status === SubscriptionStatus.ACTIVE) {
      where.subscriptions = { some: validNow };
    } else if (status === SubscriptionStatus.EXPIRED) {
      where.subscriptions = { none: validNow };
    } else {
      where.subscriptions = { some: { status: SubscriptionStatus.SUSPENDED } };
    }

    return where;
  }

  /** `subscriptions: [x]` massivini bitta `subscription` maydoniga aylantiradi */
  private flattenSubscription<T extends { subscriptions: unknown[] }>(
    tenant: T,
  ) {
    const { subscriptions, ...rest } = tenant;
    return { ...rest, subscription: subscriptions[0] ?? null };
  }
}
