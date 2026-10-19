import {
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from '../platform/subscription.service';

const TABLE_CONTEXT_SELECT = {
  id: true,
  tableNumber: true,
  status: true,
  hall: {
    select: {
      name: true,
      branch: {
        select: {
          id: true,
          name: true,
          address: true,
          tenant: { select: { id: true, name: true, logoUrl: true } },
        },
      },
    },
  },
} satisfies Prisma.TableSelect;

export type TableContext = Prisma.TableGetPayload<{
  select: typeof TABLE_CONTEXT_SELECT;
}>;

/**
 * QR token -> stol, filial va restoran.
 *
 * Mijoz oqimida foydalanuvchi va token yo'q, shuning uchun filial doirasi
 * `BranchScopeService` dan emas, aynan shu token orqali aniqlanadi.
 */
@Injectable()
export class GuestTableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async findByToken(token: string): Promise<TableContext> {
    const table = await this.prisma.table.findUnique({
      where: { qrCodeToken: token },
      select: TABLE_CONTEXT_SELECT,
    });

    if (!table) {
      throw new NotFoundException(
        'Stol topilmadi. QR kodni qaytadan skanerlang.',
      );
    }

    return table;
  }

  /**
   * Restoran onlayn buyurtma qabul qiladimi (shartnoma va obuna).
   *
   * `assertActive()` xodim uchun yozilgan xabar beradi ("to'lovni amalga
   * oshiring"). Mehmonga restoranning platforma bilan hisob-kitobi
   * ko'rinmasligi kerak, shuning uchun xabar umumiy 503 ga almashtiriladi.
   */
  async assertAcceptsOrders(tenantId: number): Promise<void> {
    try {
      await this.subscriptionService.assertActive(tenantId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw new ServiceUnavailableException(
          'Restoran hozircha onlayn buyurtma qabul qilmaydi. Ofitsiantni chaqiring.',
        );
      }

      throw error;
    }
  }
}
