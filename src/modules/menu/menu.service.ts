import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchScopeService } from '../../common/services/branch-scope.service';
import { AuthUser } from '../../common/interfaces';
import { BranchScopeQueryDto } from './dto';

/**
 * Yig'ilgan menyu — POS ekrani va (Faza 5 da) QR sahifasi shuni oladi.
 * Ikkita so'rov bilan quriladi, shuning uchun N+1 yo'q.
 */
@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
  ) {}

  async getMenu(user: AuthUser, query: BranchScopeQueryDto) {
    const branchId = await this.branchScope.resolve(user, query.branchId);

    return this.buildForBranch(branchId);
  }

  /**
   * Faza 5 dagi QR oqimi shu metodni chaqiradi: u yerda foydalanuvchi yo'q,
   * filial QR token orqali topiladi.
   */
  async buildForBranch(branchId: number) {
    const [categories, stopped] = await Promise.all([
      this.prisma.category.findMany({
        where: { branchId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          sortOrder: true,
          products: {
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              unit: true,
              unitValue: true,
              imageUrl: true,
            },
          },
        },
      }),
      this.prisma.stopList.findMany({
        where: { branchId, isAvailable: false },
        select: { productId: true },
      }),
    ]);

    const stoppedIds = new Set(stopped.map((row) => row.productId));

    return {
      branchId,
      categories: categories.map((category) => ({
        ...category,
        products: category.products.map((product) => ({
          ...product,
          // Taom menyuda qoladi, lekin "hozir yo'q" deb belgilanadi —
          // mijoz nima borligini va nima tugaganini ko'rishi kerak
          isAvailable: !stoppedIds.has(product.id),
        })),
      })),
    };
  }
}
