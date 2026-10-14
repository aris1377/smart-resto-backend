import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchScopeService } from '../../common/services/branch-scope.service';
import { AuthUser } from '../../common/interfaces';
import { CreateTableDto, ListTablesDto, UpdateTableDto } from './dto';

const TABLE_SELECT = {
  id: true,
  hallId: true,
  tableNumber: true,
  // QR chop etish uchun kerak; faqat xodimga ko'rinadi
  qrCodeToken: true,
  status: true,
  hall: { select: { id: true, name: true, branchId: true } },
} satisfies Prisma.TableSelect;

/**
 * Stol — buyurtmaning manzili. Har bir stolning o'zgarmas QR tokeni bor:
 * mijoz QR o'qiganda (Faza 5) tizim aynan shu token orqali qaysi restoran,
 * qaysi filial va qaysi stol ekanini aniqlaydi.
 *
 * Stolning filiali **zali orqali** aniqlanadi, xuddi mahsulotning filiali
 * kategoriyasi orqali aniqlangani kabi.
 */
@Injectable()
export class TableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
  ) {}

  /**
   * Stollar bir filialda o'nlab — POS ekrani hammasini birdan ko'rsatadi,
   * shuning uchun pagination yo'q.
   */
  async list(user: AuthUser, query: ListTablesDto) {
    const branchId = await this.branchScope.resolve(user, query.branchId);

    return this.prisma.table.findMany({
      where: {
        hall: { branchId },
        hallId: query.hallId,
        status: query.status,
      },
      orderBy: [{ hall: { name: 'asc' } }, { tableNumber: 'asc' }],
      select: TABLE_SELECT,
    });
  }

  async getOne(user: AuthUser, id: number) {
    const table = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, table.hall.branchId);

    return table;
  }

  async create(user: AuthUser, dto: CreateTableDto) {
    const hall = await this.findHallOrFail(dto.hallId);
    await this.branchScope.assertAccess(user, hall.branchId);
    await this.assertNumberFree(dto.hallId, dto.tableNumber);

    return this.prisma.table.create({
      data: {
        hallId: dto.hallId,
        tableNumber: dto.tableNumber,
        // Token serverda yaratiladi va boshqa hech qachon o'zgarmaydi:
        // u allaqachon stolga yopishtirilgan QR kodda chop etilgan
        qrCodeToken: randomUUID(),
      },
      select: TABLE_SELECT,
    });
  }

  async update(user: AuthUser, id: number, dto: UpdateTableDto) {
    const table = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, table.hall.branchId);

    const targetHallId = dto.hallId ?? table.hallId;

    // Zal almashtirilsa — u ham shu filialda bo'lishi shart, aks holda
    // stol jimgina boshqa filialga ko'chib ketardi
    if (dto.hallId && dto.hallId !== table.hallId) {
      const target = await this.findHallOrFail(dto.hallId);

      if (target.branchId !== table.hall.branchId) {
        throw new BadRequestException('Zal boshqa filialga tegishli.');
      }
    }

    const numberChanged =
      dto.tableNumber !== undefined && dto.tableNumber !== table.tableNumber;

    if (numberChanged || targetHallId !== table.hallId) {
      await this.assertNumberFree(
        targetHallId,
        dto.tableNumber ?? table.tableNumber,
        id,
      );
    }

    return this.prisma.table.update({
      where: { id },
      data: { hallId: dto.hallId, tableNumber: dto.tableNumber },
      select: TABLE_SELECT,
    });
  }

  /**
   * O'chirish faqat stolda buyurtma tarixi bo'lmasa.
   * `Order -> Table` bog'lanishi `Cascade` — ishlagan stolni o'chirish
   * o'sha stoldagi barcha buyurtmalarni hisobotdan yechib yuborardi.
   */
  async remove(user: AuthUser, id: number) {
    const table = await this.findOrFail(id);
    await this.branchScope.assertAccess(user, table.hall.branchId);

    const orders = await this.prisma.order.count({ where: { tableId: id } });

    if (orders > 0) {
      throw new ConflictException(
        `Stolda ${orders} ta buyurtma tarixi bor, shuning uchun oʻchirib boʻlmaydi.`,
      );
    }

    await this.prisma.table.delete({ where: { id } });

    return { id };
  }

  /** Stolni zali bilan birga oladi — filial doirasi shundan aniqlanadi */
  private async findOrFail(id: number) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      select: TABLE_SELECT,
    });

    if (!table) {
      throw new NotFoundException('Stol topilmadi.');
    }

    return table;
  }

  private async findHallOrFail(hallId: number) {
    const hall = await this.prisma.hall.findUnique({
      where: { id: hallId },
      select: { id: true, branchId: true },
    });

    if (!hall) {
      throw new NotFoundException('Zal topilmadi.');
    }

    return hall;
  }

  /**
   * Zal ichida stol raqami takrorlanmasin. Bazada ham `@@unique` bor —
   * bu tekshiruv foydalanuvchiga tushunarli xabar berish uchun.
   */
  private async assertNumberFree(
    hallId: number,
    tableNumber: string,
    exceptId?: number,
  ) {
    const existing = await this.prisma.table.findFirst({
      where: {
        hallId,
        tableNumber,
        id: exceptId ? { not: exceptId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Bu zalda shunday raqamli stol bor.');
    }
  }
}
