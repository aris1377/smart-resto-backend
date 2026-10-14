import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/interfaces';
import { SubscriptionService } from '../platform/subscription.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';

/** Mijozga qaytadigan maydonlar — bir joyda turgani ma'qul */
const BRANCH_SELECT = {
  id: true,
  name: true,
  address: true,
  phone: true,
  taxId: true,
  createdAt: true,
  _count: { select: { halls: true, users: true } },
} satisfies Prisma.BranchSelect;

/**
 * Filial — restoranning jismoniy nuqtasi. Zal, menyu, stol va order
 * shunga bog'lanadi, shuning uchun tizimdagi deyarli hamma narsa
 * filialdan boshlanadi.
 *
 * Bu yerda `BranchScopeService` ishlatilmaydi: u filial **ichidagi**
 * ma'lumot uchun. Bu modul filialning o'zini boshqaradi, ya'ni doira
 * bir pog'ona yuqori — restoran (`tenantId`).
 */
@Injectable()
export class BranchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * OWNER barcha filiallarini ko'radi, MANAGER esa faqat o'zinikini.
   * Filiallar sanoqli (tarifda eng ko'pi 50 ta), shuning uchun pagination yo'q.
   */
  async list(user: AuthUser) {
    const tenantId = this.requireTenant(user);

    return this.prisma.branch.findMany({
      where: {
        tenantId,
        // Menejer tokenida filial bor — boshqa filiallarni ko'rmasligi kerak
        ...(user.branchId ? { id: user.branchId } : {}),
      },
      orderBy: { name: 'asc' },
      select: BRANCH_SELECT,
    });
  }

  async getOne(user: AuthUser, id: number) {
    await this.findInTenantOrFail(user, id);

    return this.prisma.branch.findUnique({
      where: { id },
      select: BRANCH_SELECT,
    });
  }

  /**
   * Yangi filial. Tarifdagi chegara shu yerda tekshiriladi — boshqa
   * joyda filial yaratilmaydi, ya'ni chegarani chetlab o'tib bo'lmaydi.
   */
  async create(user: AuthUser, dto: CreateBranchDto) {
    const tenantId = this.requireTenant(user);

    await this.subscriptionService.assertCanAddBranch(tenantId);
    await this.assertNameFree(tenantId, dto.name);

    return this.prisma.branch.create({
      data: {
        tenantId,
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        taxId: dto.taxId,
      },
      select: BRANCH_SELECT,
    });
  }

  async update(user: AuthUser, id: number, dto: UpdateBranchDto) {
    const branch = await this.findInTenantOrFail(user, id);

    if (dto.name && dto.name !== branch.name) {
      await this.assertNameFree(branch.tenantId, dto.name);
    }

    return this.prisma.branch.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        taxId: dto.taxId,
      },
      select: BRANCH_SELECT,
    });
  }

  /**
   * O'chirish faqat filialda birorta order bo'lmasa.
   *
   * Sxemada `Order -> Branch` bog'lanishi `Cascade`: ishlagan filialni
   * o'chirish uning butun savdo tarixini ham olib ketardi. Zal va menyu
   * esa sozlama — ular bilan birga o'chishi normal.
   */
  async remove(user: AuthUser, id: number) {
    await this.findInTenantOrFail(user, id);

    const orders = await this.prisma.order.count({ where: { branchId: id } });

    if (orders > 0) {
      throw new ConflictException(
        `Filialda ${orders} ta buyurtma tarixi bor, shuning uchun oʻchirib boʻlmaydi.`,
      );
    }

    await this.prisma.branch.delete({ where: { id } });

    return { id };
  }

  /**
   * Filial shu foydalanuvchining restoraniga tegishliligini tekshiradi.
   * Begona filial uchun 404 — 403 bersak, o'sha id'li filial borligini
   * tasdiqlagan bo'lardik.
   */
  private async findInTenantOrFail(user: AuthUser, id: number) {
    const tenantId = this.requireTenant(user);

    // Menejer o'z filialidan boshqasiga umuman kira olmaydi
    if (user.branchId && user.branchId !== id) {
      throw new NotFoundException('Filial topilmadi.');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
      select: { id: true, tenantId: true, name: true },
    });

    if (!branch) {
      throw new NotFoundException('Filial topilmadi.');
    }

    return branch;
  }

  /** Bir restoranda bir xil nomli ikki filial chalkashlik keltiradi */
  private async assertNameFree(tenantId: number, name: string) {
    const existing = await this.prisma.branch.findFirst({
      where: { tenantId, name },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Bu nomli filial allaqachon bor.');
    }
  }

  /** SUPER_ADMIN hech qaysi restoranga tegishli emas */
  private requireTenant(user: AuthUser): number {
    if (!user.tenantId) {
      throw new ForbiddenException(
        user.role === Role.SUPER_ADMIN
          ? 'Platforma admini filiallarni boshqarmaydi.'
          : 'Foydalanuvchi restoranga bogʻlanmagan.',
      );
    }

    return user.tenantId;
  }
}
