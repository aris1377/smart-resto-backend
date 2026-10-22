import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchScopeService } from '../../common/services/branch-scope.service';
import { AuthUser } from '../../common/interfaces';
import {
  BranchScopeQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
  ) {}

  /**
   * Kategoriyalar sanoqli (bir menyuda o'nlab), UI esa ularni har doim to'liq
   * ko'rsatadi — shuning uchun pagination yo'q, oddiy ro'yxat qaytadi.
   */
  async list(user: AuthUser, query: BranchScopeQueryDto) {
    const branchId = await this.branchScope.resolve(user, query.branchId);

    return this.prisma.category.findMany({
      where: { branchId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
        _count: { select: { products: true } },
      },
    });
  }

  async create(user: AuthUser, dto: CreateCategoryDto) {
    const branchId = await this.branchScope.resolve(user, dto.branchId);
    await this.assertNameFree(branchId, dto.name);

    return this.prisma.category.create({
      data: { branchId, name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async update(user: AuthUser, id: number, dto: UpdateCategoryDto) {
    const category = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, category.branchId);

    if (dto.name && dto.name !== category.name) {
      await this.assertNameFree(category.branchId, dto.name);
    }

    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name, sortOrder: dto.sortOrder },
    });
  }

  /**
   * O'chirish faqat kategoriya bo'sh bo'lsa.
   * Sxemada `Product -> Category` bog'lanishi `onDelete: Cascade`, ya'ni
   * to'la kategoriyani o'chirish mahsulotlarni, ular esa `OrderItem` larni
   * yechib yuborardi — o'tgan oy hisoboti buzilardi.
   */
  async remove(user: AuthUser, id: number) {
    const category = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, category.branchId);

    const products = await this.prisma.product.findMany({
      where: { categoryId: id },
      select: {
        id: true,
        isActive: true,
        _count: { select: { orderItems: true } },
      },
    });

    const active = products.filter((product) => product.isActive);

    if (active.length > 0) {
      throw new ConflictException(
        `Kategoriyada ${active.length} ta faol mahsulot bor. Avval ularni boshqa kategoriyaga oʻtkazing yoki menyudan olib qoʻying.`,
      );
    }

    // Menyudan olib qoʻyilgan, lekin sotilgan taom — order tarixining bir qismi.
    // `OrderItem -> Product` bogʻlanishi `Cascade`, ya'ni uni oʻchirish eski
    // cheklardan taom qatorini ham yulib olardi.
    const sold = products.filter((product) => product._count.orderItems > 0);

    if (sold.length > 0) {
      throw new ConflictException(
        `Kategoriyadagi ${sold.length} ta taom buyurtma tarixida bor. Kategoriyani oʻchirish uchun avval ularni boshqa kategoriyaga oʻtkazing.`,
      );
    }

    // Qolgani — menyudan olib qoʻyilgan va hech qachon sotilmagan taomlar.
    // Ular kategoriya bilan birga oʻchadi (`Cascade`): yoʻqoladigan tarix yoʻq,
    // aks holda bir marta taom qoʻshilgan kategoriyani umrbod oʻchirib
    // boʻlmasdi (mahsulot hech qachon hard delete qilinmaydi).
    await this.prisma.category.delete({ where: { id } });

    return { id, removedProducts: products.length };
  }

  private async findOrFail(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, branchId: true, name: true },
    });

    if (!category) {
      throw new NotFoundException('Kategoriya topilmadi.');
    }

    return category;
  }

  /** Bir filial ichida bir xil nomli ikki kategoriya chalkashlik keltiradi */
  private async assertNameFree(branchId: number, name: string) {
    const existing = await this.prisma.category.findFirst({
      where: { branchId, name },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Bu filialda shunday nomli kategoriya bor.');
    }
  }
}
