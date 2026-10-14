import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchScopeService } from '../../common/services/branch-scope.service';
import { AuthUser } from '../../common/interfaces';
import { BranchScopeQueryDto, SetStopListDto } from './dto';

/**
 * Stop-list — "taom hozir tugadi" belgisi.
 *
 * Mahsulotning `isActive` idan farqi: `isActive: false` — taom menyudan
 * butunlay olib tashlandi; stop-list esa **vaqtinchalik** va **filialga xos**.
 * Bitta taom Sergelida tugab, Chilonzorda bo'lishi mumkin.
 */
@Injectable()
export class StopListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
  ) {}

  /** Hozir to'xtatilgan taomlar */
  async list(user: AuthUser, query: BranchScopeQueryDto) {
    const branchId = await this.branchScope.resolve(user, query.branchId);

    return this.prisma.stopList.findMany({
      where: { branchId, isAvailable: false },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        productId: true,
        product: { select: { id: true, name: true, categoryId: true } },
      },
    });
  }

  /**
   * Taomni to'xtatish yoki qaytarish.
   * Filial so'rovdan olinmaydi — mahsulot o'z kategoriyasi orqali
   * allaqachon bitta filialga tegishli.
   */
  async set(user: AuthUser, productId: number, dto: SetStopListDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        category: { select: { branchId: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Mahsulot topilmadi.');
    }

    const branchId = product.category.branchId;
    await this.branchScope.assertAccess(user, branchId);

    // @@unique([branchId, productId]) tufayli upsert xavfsiz:
    // ikki ofitsiant bir vaqtda bossa ham bitta yozuv qoladi
    const record = await this.prisma.stopList.upsert({
      where: { branchId_productId: { branchId, productId } },
      create: { branchId, productId, isAvailable: dto.isAvailable },
      update: { isAvailable: dto.isAvailable },
      select: { id: true, branchId: true, productId: true, isAvailable: true },
    });

    return {
      message: dto.isAvailable
        ? `"${product.name}" yana mavjud.`
        : `"${product.name}" stop-listga qoʻyildi.`,
      data: record,
    };
  }
}
