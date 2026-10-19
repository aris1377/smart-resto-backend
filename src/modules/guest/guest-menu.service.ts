import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MenuService } from '../menu/menu.service';
import { OPEN_ORDER_STATUSES } from './guest.constants';
import { GuestTableService } from './guest-table.service';

/** QR skanerlanganda ochiladigan sahifa: restoran, stol va menyu */
@Injectable()
export class GuestMenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestTables: GuestTableService,
    private readonly menuService: MenuService,
  ) {}

  /**
   * @param guestSessionId  bo'lsa — shu brauzerning shu stoldagi ochiq
   *   buyurtmasi qaytariladi (sahifa yangilanganda buyurtma yo'qolmasin)
   */
  async getByToken(token: string, guestSessionId?: string) {
    const table = await this.guestTables.findByToken(token);
    const { branch } = table.hall;

    await this.guestTables.assertAcceptsOrders(branch.tenant.id);

    const [menu, activeOrder] = await Promise.all([
      this.menuService.buildForBranch(branch.id),
      guestSessionId
        ? this.prisma.order.findFirst({
            where: {
              tableId: table.id,
              guestSessionId,
              status: { in: OPEN_ORDER_STATUSES },
            },
            select: { id: true },
          })
        : null,
    ]);

    return {
      restaurant: { name: branch.tenant.name, logoUrl: branch.tenant.logoUrl },
      branch: { name: branch.name, address: branch.address },
      table: {
        number: table.tableNumber,
        hall: table.hall.name,
        status: table.status,
      },
      activeOrderId: activeOrder?.id ?? null,
      categories: menu.categories,
    };
  }
}
