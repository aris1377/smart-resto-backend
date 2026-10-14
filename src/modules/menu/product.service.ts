import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchScopeService } from '../../common/services/branch-scope.service';
import { AuthUser } from '../../common/interfaces';
import { MAX_IMAGE_BYTES, StorageService } from '../storage/storage.service';
import { CreateProductDto, ListProductsDto, UpdateProductDto } from './dto';

/** Mijozga qaytadigan maydonlar — bir joyda turgani ma'qul */
const PRODUCT_SELECT = {
  id: true,
  categoryId: true,
  name: true,
  description: true,
  price: true,
  unit: true,
  unitValue: true,
  imageUrl: true,
  isActive: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly storage: StorageService,
  ) {}

  async list(user: AuthUser, query: ListProductsDto) {
    const branchId = await this.branchScope.resolve(user, query.branchId);

    // Mahsulotning filiali kategoriyasi orqali aniqlanadi
    const where: Prisma.ProductWhereInput = {
      category: { branchId },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
        select: PRODUCT_SELECT,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getOne(user: AuthUser, id: number) {
    const product = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, product.category.branchId);

    return this.prisma.product.findUnique({
      where: { id },
      select: PRODUCT_SELECT,
    });
  }

  async create(user: AuthUser, dto: CreateProductDto) {
    const category = await this.findCategoryOrFail(dto.categoryId);
    await this.branchScope.assertAccess(user, category.branchId);

    return this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        unit: dto.unit,
        unitValue: dto.unitValue,
      },
      select: PRODUCT_SELECT,
    });
  }

  async update(user: AuthUser, id: number, dto: UpdateProductDto) {
    const product = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, product.category.branchId);

    // Kategoriya almashtirilsa — u ham shu filialda bo'lishi shart,
    // aks holda mahsulot jimgina boshqa filialga ko'chib ketardi
    if (dto.categoryId && dto.categoryId !== product.categoryId) {
      const target = await this.findCategoryOrFail(dto.categoryId);

      if (target.branchId !== product.category.branchId) {
        throw new BadRequestException('Kategoriya boshqa filialga tegishli.');
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        unit: dto.unit,
        unitValue: dto.unitValue,
        isActive: dto.isActive,
      },
      select: PRODUCT_SELECT,
    });
  }

  /**
   * "O'chirish" — aslida menyudan olib qo'yish.
   * Haqiqiy DELETE `OrderItem` larni ham yechib yuborardi (Cascade),
   * ya'ni sotilgan taom tarixdan yo'qolardi.
   */
  async deactivate(user: AuthUser, id: number) {
    const product = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, product.category.branchId);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      select: PRODUCT_SELECT,
    });
  }

  async setImage(user: AuthUser, id: number, file?: Express.Multer.File) {
    const product = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, product.category.branchId);

    if (!file) {
      throw new BadRequestException('Rasm fayli yuborilmagan.');
    }

    if (!this.storage.isAllowedType(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        'Faqat JPEG, PNG yoki WebP rasm qabul qilinadi.',
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new PayloadTooLargeException('Rasm hajmi 5 MB dan oshmasin.');
    }

    const imageUrl = await this.storage.uploadImage(file, `products/${id}`);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { imageUrl },
      select: PRODUCT_SELECT,
    });

    // Yangisi yozilgach eskisini tozalaymiz — tartib muhim: agar
    // avval o'chirsak va yozish yiqilsa, mahsulot rasmsiz qolardi
    await this.storage.deleteByUrl(product.imageUrl);

    return updated;
  }

  async removeImage(user: AuthUser, id: number) {
    const product = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, product.category.branchId);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { imageUrl: null },
      select: PRODUCT_SELECT,
    });

    await this.storage.deleteByUrl(product.imageUrl);

    return updated;
  }

  private async findOrFail(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        categoryId: true,
        imageUrl: true,
        category: { select: { branchId: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Mahsulot topilmadi.');
    }

    return product;
  }

  private async findCategoryOrFail(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });

    if (!category) {
      throw new NotFoundException('Kategoriya topilmadi.');
    }

    return category;
  }
}
