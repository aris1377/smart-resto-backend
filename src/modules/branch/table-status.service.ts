import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TableStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchScopeService } from '../../common/services/branch-scope.service';
import { AuthUser } from '../../common/interfaces';

/**
 * Xodim qo'lda qo'ya oladigan statuslar.
 * `OCCUPIED` va `BILL_REQUESTED` ro'yxatda yo'q — ular ortida har doim
 * haqiqiy buyurtma turishi kerak, shuning uchun ularni faqat order
 * oqimi qo'yadi (Faza 5 va 7).
 */
const MANUAL_STATUSES: TableStatus[] = [TableStatus.FREE, TableStatus.RESERVED];

/**
 * Yopilmagan buyurtma statuslari.
 * `Order.status` hozircha `String` (Faza 7 da enumga o'tadi), shuning uchun
 * qiymatlar shu yerda bitta joyda yozilgan.
 */
const OPEN_ORDER_STATUSES = ['new', 'cooking', 'served'];

/**
 * Stol statusining yagona boshqaruv nuqtasi.
 *
 * Statusni ikki tomon o'zgartiradi: xodim (bron qilish, bo'shatish) va
 * order oqimi (buyurtma ochildi, hisob so'raldi, to'landi). Qoidalar ikki
 * joyda yozilsa, ular albatta bir-biridan ajralib ketadi — shuning uchun
 * ikkalasi ham shu servisdan o'tadi.
 */
@Injectable()
export class TableStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
  ) {}

  /** Xodim qo'lda o'zgartirganda (`PATCH /tables/:id/status`) */
  async setManually(user: AuthUser, tableId: number, status: TableStatus) {
    const table = await this.findOrFail(tableId);
    await this.branchScope.assertAccess(user, table.hall.branchId);

    if (!MANUAL_STATUSES.includes(status)) {
      throw new BadRequestException(
        'Bu statusni qoʻlda qoʻyib boʻlmaydi — u buyurtma bilan birga oʻzgaradi.',
      );
    }

    // Ochiq buyurtmasi bor stolni "bo'sh" deb belgilash mumkin emas:
    // mijoz hali hisobni to'lamagan, QR oqimi esa bo'sh stolga yangi
    // buyurtma ochib yuborardi
    if (status === TableStatus.FREE) {
      await this.assertNoOpenOrder(tableId);
    }

    return this.prisma.table.update({
      where: { id: tableId },
      data: { status },
      select: { id: true, tableNumber: true, status: true },
    });
  }

  /**
   * Order oqimi chaqiradigan metod (Faza 5 va 7).
   * `tx` — chaqiruvchi tranzaksiya ichida bo'lsa, o'sha mijoz uzatiladi,
   * aks holda status alohida yozilib, tranzaksiya qaytsa ham qolib ketardi.
   */
  async applyOrderEvent(
    tableId: number,
    status: TableStatus,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.table.update({ where: { id: tableId }, data: { status } });
  }

  private async assertNoOpenOrder(tableId: number) {
    const open = await this.prisma.order.count({
      where: { tableId, status: { in: OPEN_ORDER_STATUSES } },
    });

    if (open > 0) {
      throw new BadRequestException(
        'Stolda yopilmagan buyurtma bor. Avval hisobni yoping.',
      );
    }
  }

  private async findOrFail(id: number) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      select: { id: true, hall: { select: { branchId: true } } },
    });

    if (!table) {
      throw new NotFoundException('Stol topilmadi.');
    }

    return table;
  }
}
