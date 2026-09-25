import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto';

@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin hammasini koʻradi — sotuvdan olinganlari ham */
  findAll() {
    return this.prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
  }

  async create(dto: CreatePlanDto) {
    const existing = await this.prisma.plan.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Bunday nomli tarif allaqachon bor.');
    }

    return this.prisma.plan.create({
      data: {
        name: dto.name,
        priceMonthly: dto.priceMonthly,
        maxBranches: dto.maxBranches,
        maxUsers: dto.maxUsers,
        features: dto.features as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Narx oʻzgarishi faqat **keyingi** obunalarga taʼsir qiladi:
   * berilgan obunaning narxi `Subscription.priceMonthly` da, toʻlangan summa esa
   * `TenantInvoice.amount` da nusxa boʻlib turadi.
   * Eski mijozlarni eski narxda qoldirish kerak boʻlsa — yangi tarif yarating,
   * eskisini `isActive: false` qiling.
   */
  async update(id: number, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });

    if (!plan) {
      throw new NotFoundException('Tarif topilmadi.');
    }

    if (dto.name && dto.name !== plan.name) {
      const duplicate = await this.prisma.plan.findUnique({
        where: { name: dto.name },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException('Bunday nomli tarif allaqachon bor.');
      }
    }

    return this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name,
        priceMonthly: dto.priceMonthly,
        maxBranches: dto.maxBranches,
        maxUsers: dto.maxUsers,
        features: dto.features as Prisma.InputJsonValue,
        isActive: dto.isActive,
      },
    });
  }
}
