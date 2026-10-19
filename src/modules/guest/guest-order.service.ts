import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TableStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TableStatusService } from '../branch/table-status.service';
import {
  AddOrderItemsDto,
  CreateGuestOrderDto,
  OrderItemInputDto,
} from './dto';
import {
  OPEN_ORDER_STATUSES,
  ORDER_ITEM_STATUS_PENDING,
  ORDER_SOURCE_QR,
  ORDER_STATUS,
} from './guest.constants';
import { GuestTableService } from './guest-table.service';

const ORDER_DETAIL_SELECT = {
  id: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  table: { select: { tableNumber: true, status: true } },
  orderItems: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      quantity: true,
      price: true,
      notes: true,
      status: true,
      product: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.OrderSelect;

type OrderDetail = Prisma.OrderGetPayload<{
  select: typeof ORDER_DETAIL_SELECT;
}>;

/** Bazaga yoziladigan, narxi bazadan olingan buyurtma qatori */
interface PricedLine {
  productId: number;
  quantity: Prisma.Decimal;
  price: Prisma.Decimal;
  notes?: string;
}

/**
 * QR orqali kelgan mehmonning buyurtmasi.
 *
 * Asosiy qoidalar:
 *  - narx **har doim bazadan** olinadi, mijozdan kelgan narxga ishonilmaydi;
 *  - bir stolda bir vaqtda **faqat bitta ochiq buyurtma** — buni stol qatorini
 *    qulflash (`SELECT ... FOR UPDATE`) kafolatlaydi, ikki parallel so'rov
 *    ikkita buyurtma ochib yubora olmaydi;
 *  - buyurtmani faqat uni ochgan brauzer (`guestSessionId`) ko'radi va
 *    to'ldiradi. Begona buyurtma uchun 404 — u borligini ham bildirmaymiz.
 */
@Injectable()
export class GuestOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestTables: GuestTableService,
    private readonly tableStatus: TableStatusService,
  ) {}

  /**
   * Stolda ochiq buyurtma bo'lmasa — yangisi ochiladi.
   * Ochiq buyurtma shu mehmonniki bo'lsa — taomlar unga qo'shiladi
   * (sahifa yangilanib, mijoz yana "Buyurtma berish" ni bossa ham ikkinchi
   * buyurtma ochilmaydi).
   */
  async create(dto: CreateGuestOrderDto, guestSessionId: string) {
    const table = await this.guestTables.findByToken(dto.tableToken);
    const { branch } = table.hall;

    await this.guestTables.assertAcceptsOrders(branch.tenant.id);
    const lines = await this.priceItems(branch.id, dto.items);

    const { orderId, created } = await this.prisma.$transaction(async (tx) => {
      const tableStatus = await this.lockTable(tx, table.id);

      const openOrder = await tx.order.findFirst({
        where: { tableId: table.id, status: { in: OPEN_ORDER_STATUSES } },
        select: { id: true, guestSessionId: true },
      });

      if (openOrder) {
        if (openOrder.guestSessionId !== guestSessionId) {
          throw new ConflictException(
            'Bu stolda boshqa mehmonning ochiq buyurtmasi bor. Ofitsiantni chaqiring.',
          );
        }

        await this.appendLines(tx, openOrder.id, tableStatus, lines);

        return { orderId: openOrder.id, created: false };
      }

      const order = await tx.order.create({
        data: {
          branchId: branch.id,
          tableId: table.id,
          source: ORDER_SOURCE_QR,
          status: ORDER_STATUS.NEW,
          guestSessionId,
          totalAmount: this.sum(lines),
          orderItems: {
            create: lines.map((line) => ({
              ...line,
              status: ORDER_ITEM_STATUS_PENDING,
            })),
          },
        },
        select: { id: true },
      });

      await this.tableStatus.applyOrderEvent(
        table.id,
        TableStatus.OCCUPIED,
        tx,
      );

      return { orderId: order.id, created: true };
    });

    return { created, order: await this.getOne(orderId, guestSessionId) };
  }

  /** Ovqatlanish davomida qo'shimcha buyurtma */
  async addItems(
    orderId: number,
    dto: AddOrderItemsDto,
    guestSessionId: string,
  ) {
    const order = await this.findOwnedOrFail(orderId, guestSessionId);
    this.assertOpen(order.status);

    await this.guestTables.assertAcceptsOrders(order.branch.tenantId);
    const lines = await this.priceItems(order.branchId, dto.items);

    await this.prisma.$transaction(async (tx) => {
      const tableStatus = await this.lockTable(tx, order.tableId);

      // Qulfni kutayotganda xodim buyurtmani yopib qo'ygan bo'lishi mumkin
      const current = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { status: true },
      });
      this.assertOpen(current.status);

      await this.appendLines(tx, orderId, tableStatus, lines);
    });

    return this.getOne(orderId, guestSessionId);
  }

  /** Buyurtma holati — mijoz sahifasi buni vaqti-vaqti bilan so'raydi */
  async getOne(orderId: number, guestSessionId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, guestSessionId },
      select: ORDER_DETAIL_SELECT,
    });

    if (!order) {
      throw new NotFoundException('Buyurtma topilmadi.');
    }

    return this.toResponse(order);
  }

  /**
   * "Hisobni so'rash" tugmasi. Takror bosilsa xato bermaydi.
   * Obuna tekshirilmaydi: ovqatlanib bo'lgan mehmon hisobsiz qolmasligi kerak.
   */
  async requestBill(orderId: number, guestSessionId: string) {
    const order = await this.findOwnedOrFail(orderId, guestSessionId);
    this.assertOpen(order.status);

    await this.prisma.$transaction(async (tx) => {
      const tableStatus = await this.lockTable(tx, order.tableId);

      if (tableStatus !== TableStatus.BILL_REQUESTED) {
        await this.tableStatus.applyOrderEvent(
          order.tableId,
          TableStatus.BILL_REQUESTED,
          tx,
        );
      }
    });

    return this.getOne(orderId, guestSessionId);
  }

  /**
   * Taomlarni bazadagi narx bilan to'ldiradi.
   * Taom shu filial menyusida, faol va stop-listda bo'lmasligi shart.
   */
  private async priceItems(
    branchId: number,
    items: OrderItemInputDto[],
  ): Promise<PricedLine[]> {
    const productIds = [...new Set(items.map((item) => item.productId))];

    const [products, stopped] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
          category: { branchId },
        },
        select: { id: true, price: true },
      }),
      this.prisma.stopList.findMany({
        where: { branchId, productId: { in: productIds }, isAvailable: false },
        select: { product: { select: { name: true } } },
      }),
    ]);

    const priceById = new Map(products.map((p) => [p.id, p.price]));
    const missing = productIds.filter((id) => !priceById.has(id));

    if (missing.length > 0) {
      throw new BadRequestException(
        `Menyuda yoʻq taom tanlangan (id: ${missing.join(', ')}).`,
      );
    }

    if (stopped.length > 0) {
      const names = stopped.map((row) => row.product.name).join(', ');
      throw new ConflictException(`Hozir mavjud emas: ${names}.`);
    }

    return items.map((item) => ({
      productId: item.productId,
      quantity: new Prisma.Decimal(item.quantity),
      price: priceById.get(item.productId),
      notes: item.notes,
    }));
  }

  /**
   * Mavjud ochiq buyurtmaga qo'shish. Hisob so'ralgan bo'lsa — yo'q:
   * kassir hisobni tayyorlayapti, summa uning qo'lida o'zgarib ketmasin.
   */
  private async appendLines(
    tx: Prisma.TransactionClient,
    orderId: number,
    tableStatus: TableStatus,
    lines: PricedLine[],
  ) {
    if (tableStatus === TableStatus.BILL_REQUESTED) {
      throw new ConflictException(
        'Hisob soʻralgan. Yana buyurtma berish uchun ofitsiantni chaqiring.',
      );
    }

    await tx.orderItem.createMany({
      data: lines.map((line) => ({
        ...line,
        orderId,
        status: ORDER_ITEM_STATUS_PENDING,
      })),
    });

    await tx.order.update({
      where: { id: orderId },
      data: { totalAmount: { increment: this.sum(lines) } },
    });
  }

  /**
   * Stol qatorini tranzaksiya oxirigacha qulflaydi va uning statusini qaytaradi.
   * Shu stolga kelgan boshqa so'rov qulf bo'shashini kutadi — shuning uchun
   * "ochiq buyurtma bormi?" tekshiruvi va yozuv orasiga hech kim kira olmaydi.
   */
  private async lockTable(
    tx: Prisma.TransactionClient,
    tableId: number,
  ): Promise<TableStatus> {
    const rows = await tx.$queryRaw<{ status: TableStatus }[]>`
      SELECT "status" FROM "tables" WHERE "id" = ${tableId} FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new NotFoundException('Stol topilmadi.');
    }

    return rows[0].status;
  }

  private async findOwnedOrFail(orderId: number, guestSessionId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, guestSessionId },
      select: {
        status: true,
        tableId: true,
        branchId: true,
        branch: { select: { tenantId: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Buyurtma topilmadi.');
    }

    return order;
  }

  private assertOpen(status: string) {
    if (!OPEN_ORDER_STATUSES.includes(status)) {
      throw new ConflictException('Buyurtma allaqachon yopilgan.');
    }
  }

  private sum(lines: PricedLine[]): Prisma.Decimal {
    return lines.reduce(
      (total, line) => total.add(line.price.mul(line.quantity)),
      new Prisma.Decimal(0),
    );
  }

  /** Mijozga ichki maydonlar (guestSessionId, branchId) chiqmaydi */
  private toResponse(order: OrderDetail) {
    return {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      table: {
        number: order.table.tableNumber,
        billRequested: order.table.status === TableStatus.BILL_REQUESTED,
      },
      items: order.orderItems.map((item) => ({
        id: item.id,
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes,
        status: item.status,
      })),
    };
  }
}
