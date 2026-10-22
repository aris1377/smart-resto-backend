import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDeviceDto } from './dto';

/**
 * Qurilma tokenlari — "kimga push yuborish mumkin" roʻyxati.
 *
 * Token **qurilmaga** tegishli, foydalanuvchiga emas: bitta planshetda
 * ofitsiant chiqib kassir kirsa, oʻsha token yangi egasiga oʻtishi kerak,
 * aks holda kassir ofitsiantning xabarlarini olib yuradi.
 */
@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ilova ishga tushganda chaqiriladi. Takror chaqirilsa xato bermaydi */
  async register(userId: number, dto: RegisterDeviceDto) {
    const device = await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { userId, platform: dto.platform, isActive: true },
      select: { id: true, platform: true, isActive: true, createdAt: true },
    });

    return { message: 'Qurilma roʻyxatdan oʻtdi.', data: device };
  }

  /**
   * Chiqishda (logout) chaqiriladi.
   * `updateMany` — begona token berilsa ham 404 emas, jim oʻtadi:
   * chiqish jarayoni xatoga uchramasligi kerak (logout bilan bir xil uslub).
   */
  async unregister(userId: number, token: string) {
    await this.prisma.deviceToken.updateMany({
      where: { token, userId },
      data: { isActive: false },
    });

    return { message: 'Qurilma oʻchirildi.' };
  }

  /**
   * Filialdagi kerakli roldagi **faol** xodimlarning qurilmalari.
   *
   * Filial boʻyicha ajratish shu yerda ham amal qiladi: Chilonzor buyurtmasi
   * Yunusobod ofitsiantining telefoniga bormaydi.
   */
  async findBranchTokens(branchId: number, roles: Role[]): Promise<string[]> {
    const devices = await this.prisma.deviceToken.findMany({
      where: {
        isActive: true,
        user: { branchId, role: { in: roles }, isActive: true },
      },
      select: { token: true },
    });

    return devices.map((device) => device.token);
  }

  /** FCM "bu token endi mavjud emas" degan qurilmalarni oʻchiradi */
  async deactivate(tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      return;
    }

    await this.prisma.deviceToken.updateMany({
      where: { token: { in: tokens } },
      data: { isActive: false },
    });
  }
}
