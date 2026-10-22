import {
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { isUUID } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { BranchScopeService } from '../../common/services/branch-scope.service';
import { AuthUser } from '../../common/interfaces';
import { JwtPayload } from '../auth/interfaces';
import { PrismaService } from '../../prisma/prisma.service';
import { HANDSHAKE, REALTIME_EVENT, ROOM } from './realtime.constants';

/**
 * WebSocket ulanishlarini qabul qiladi va har birini kerakli xonalarga qoʻshadi.
 *
 * HTTP oqimidagi `JwtAuthGuard` + `RolesGuard` ishini shu yerda qaytadan
 * qilish kerak: guardlar HTTP soʻroviga bogʻlangan, WebSocket'da esa soʻrov
 * bitta — ulanish paytidagi handshake. Shuning uchun tekshiruv **bir marta**
 * shu yerda oʻtadi va natijasi ulanishga yopishib qoladi.
 *
 * Xabar yuborish bu faylda yoʻq — u `RealtimeService` da.
 */
@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  readonly server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const rooms = await this.resolveRooms(client);
      await client.join(rooms);

      this.logger.log(`Ulandi ${client.id} -> ${rooms.join(', ')}`);
    } catch (error) {
      // WebSocket'da HTTP status kodi yoʻq. Sababni bir marta aytib,
      // ulanishni yopamiz — mijoz qayta urinib yurmasligi uchun
      const message =
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
          ? error.message
          : 'Ulanish rad etildi.';

      client.emit(REALTIME_EVENT.CONNECTION_ERROR, { message });
      client.disconnect(true);

      this.logger.warn(`Rad etildi ${client.id}: ${message}`);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Uzildi ${client.id}`);
  }

  /** Ulanish qaysi xonalarga tegishli ekanini aniqlaydi */
  private async resolveRooms(client: Socket): Promise<string[]> {
    const auth = client.handshake.auth as Record<string, unknown>;

    // 1. Mehmon — tokeni yoʻq, faqat brauzer UUID'si.
    //    Bu shaxsni aniqlamaydi, lekin UUID v4 ni taxmin qilib boʻlmaydi.
    const guestSession = auth[HANDSHAKE.GUEST_SESSION];

    if (guestSession !== undefined) {
      if (typeof guestSession !== 'string' || !isUUID(guestSession, 4)) {
        throw new UnauthorizedException('guestSession UUID v4 boʻlishi kerak.');
      }

      return [ROOM.guest(guestSession.toLowerCase())];
    }

    // 2. Xodim — access token
    const token = auth[HANDSHAKE.TOKEN];

    if (typeof token !== 'string') {
      throw new UnauthorizedException('Token yuborilmadi.');
    }

    const user = await this.authenticate(token);
    const branchId = await this.branchScope.resolve(
      user,
      this.readBranchId(auth[HANDSHAKE.BRANCH_ID]),
    );

    return this.roomsForRole(user, branchId);
  }

  /**
   * Tokenni tekshiradi va foydalanuvchini bazadan oʻqiydi.
   *
   * `JwtPayload` da faqat `sub` bor (rol va filial ataylab yozilmagan),
   * shuning uchun HTTP oqimidagi `JwtStrategy` kabi bazaga murojaat qilinadi.
   */
  private async authenticate(token: string): Promise<AuthUser> {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token yaroqsiz yoki muddati tugagan.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Foydalanuvchi topilmadi yoki faol emas.',
      );
    }

    const { isActive, ...authUser } = user;

    return authUser;
  }

  /** Rol xonani belgilaydi: oshxonaga ofitsiantning xabari kerak emas */
  private roomsForRole(user: AuthUser, branchId: number): string[] {
    switch (user.role) {
      case Role.KITCHEN:
        return [ROOM.kitchen(branchId)];

      case Role.WAITER:
        return [ROOM.waiters(branchId), ROOM.user(user.id)];

      case Role.OWNER:
      case Role.MANAGER:
      case Role.CASHIER:
        return [ROOM.dashboard(branchId)];

      default:
        // SUPER_ADMIN filialga bogʻlanmagan — u `BranchScopeService` da
        // allaqachon toʻxtatiladi, bu yer faqat himoya uchun
        throw new ForbiddenException('Bu rol real-time kanalga ulanmaydi.');
    }
  }

  /** Handshake'dan kelgan qiymat JSON boʻlib keladi — ishonchsiz */
  private readBranchId(value: unknown): number | undefined {
    const branchId = Number(value);

    return Number.isInteger(branchId) && branchId > 0 ? branchId : undefined;
  }
}
