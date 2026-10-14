import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchScopeService } from '../../common/services/branch-scope.service';
import { BranchScopeQueryDto } from '../../common/dto';
import { AuthUser } from '../../common/interfaces';
import { CreateHallDto, UpdateHallDto } from './dto';

const HALL_SELECT = {
  id: true,
  branchId: true,
  name: true,
  _count: { select: { tables: true } },
} satisfies Prisma.HallSelect;

/**
 * Zal — filial ichidagi bo'linma ("Birinchi qavat", "Yozgi maydon").
 * Ofitsiant planshetda stollarni aynan shu guruhlar bo'yicha ko'radi,
 * shuning uchun stol to'g'ridan-to'g'ri filialga emas, zalga bog'lanadi.
 */
@Injectable()
export class HallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
  ) {}

  /** Zallar sanoqli — pagination kerak emas */
  async list(user: AuthUser, query: BranchScopeQueryDto) {
    const branchId = await this.branchScope.resolve(user, query.branchId);

    return this.prisma.hall.findMany({
      where: { branchId },
      orderBy: { name: 'asc' },
      select: HALL_SELECT,
    });
  }

  async create(user: AuthUser, dto: CreateHallDto) {
    const branchId = await this.branchScope.resolve(user, dto.branchId);
    await this.assertNameFree(branchId, dto.name);

    return this.prisma.hall.create({
      data: { branchId, name: dto.name },
      select: HALL_SELECT,
    });
  }

  async update(user: AuthUser, id: number, dto: UpdateHallDto) {
    const hall = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, hall.branchId);

    if (dto.name && dto.name !== hall.name) {
      await this.assertNameFree(hall.branchId, dto.name);
    }

    return this.prisma.hall.update({
      where: { id },
      data: { name: dto.name },
      select: HALL_SELECT,
    });
  }

  /**
   * O'chirish faqat zal bo'sh bo'lsa.
   * `Table -> Hall` bog'lanishi `Cascade`: to'la zalni o'chirish stollarni,
   * ular bilan birga chop etilgan QR kodlarni ham kuchsiz qilardi.
   */
  async remove(user: AuthUser, id: number) {
    const hall = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, hall.branchId);

    const tables = await this.prisma.table.count({ where: { hallId: id } });

    if (tables > 0) {
      throw new ConflictException(
        `Zalda ${tables} ta stol bor. Avval ularni boshqa zalga oʻtkazing yoki oʻchiring.`,
      );
    }

    await this.prisma.hall.delete({ where: { id } });

    return { id };
  }

  private async findOrFail(id: number) {
    const hall = await this.prisma.hall.findUnique({
      where: { id },
      select: { id: true, branchId: true, name: true },
    });

    if (!hall) {
      throw new NotFoundException('Zal topilmadi.');
    }

    return hall;
  }

  private async assertNameFree(branchId: number, name: string) {
    const existing = await this.prisma.hall.findFirst({
      where: { branchId, name },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Bu filialda shunday nomli zal bor.');
    }
  }
}
