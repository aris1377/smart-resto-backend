import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../interfaces';

/**
 * "Bu soʻrov qaysi filial haqida?" degan savolga yagona javob beradi.
 *
 * Roadmapdagi qoida: har bir soʻrov `branchId` boʻyicha filtrlanadi.
 * Lekin `branchId` ikki xil manbadan keladi:
 *   - xodim (MANAGER/WAITER/CASHIER/KITCHEN) — tokendan, u bitta filialga biriktirilgan;
 *   - OWNER — tokenda `branchId` yoʻq (u butun biznes egasi), shuning uchun
 *     soʻrovda koʻrsatadi va biz uning haqiqatan shu tenantniki ekanini tekshiramiz.
 *
 * Shu tekshiruv bitta joyda turishi shart: unutilgan bitta joy — bir restoran
 * boshqasining maʼlumotini koʻradi degani.
 */
@Injectable()
export class BranchScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Soʻrov ishlaydigan filial id sini qaytaradi.
   * @param requestedBranchId  `?branchId=` yoki body'dagi qiymat (ixtiyoriy)
   */
  async resolve(user: AuthUser, requestedBranchId?: number): Promise<number> {
    // 1. Filialga biriktirilgan xodim — tokendagi filialdan chiqa olmaydi
    if (user.branchId) {
      if (requestedBranchId && requestedBranchId !== user.branchId) {
        throw new ForbiddenException(
          'Siz faqat oʻz filialingiz bilan ishlaysiz.',
        );
      }

      return user.branchId;
    }

    // 2. Tenantga bogʻlanmagan (SUPER_ADMIN) — bu endpointlar unga emas
    if (!user.tenantId) {
      throw new ForbiddenException('Foydalanuvchi restoranga bogʻlanmagan.');
    }

    // 3. OWNER — qaysi filial ekanini oʻzi aytishi kerak
    if (!requestedBranchId) {
      throw new BadRequestException(
        'branchId koʻrsatilishi kerak: sizda bir nechta filial boʻlishi mumkin.',
      );
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: requestedBranchId, tenantId: user.tenantId },
      select: { id: true },
    });

    // Boshqa tenantning filiali soʻralsa ham 404 — "bunday filial bor, lekin
    // sizniki emas" degan maʼlumotni ham bermaymiz
    if (!branch) {
      throw new NotFoundException('Filial topilmadi.');
    }

    return branch.id;
  }

  /**
   * Mavjud yozuv ustida ishlashdan oldin: shu filial foydalanuvchiga ochiqmi?
   *
   * `resolve()` dan farqi — bu yerda filial soʻrovdan emas, **yozuvning oʻzidan**
   * keladi (masalan `PATCH /categories/5` da kategoriyaning filiali).
   * Shuning uchun OWNER dan `branchId` soʻralmaydi.
   */
  async assertAccess(user: AuthUser, branchId: number): Promise<void> {
    if (user.branchId) {
      if (user.branchId !== branchId) {
        // Begona filialdagi yozuv "yoʻq" deb koʻrsatiladi
        throw new NotFoundException('Maʼlumot topilmadi.');
      }

      return;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Foydalanuvchi restoranga bogʻlanmagan.');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId: user.tenantId },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException('Maʼlumot topilmadi.');
    }
  }
}
