import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { AuthUser } from '../../common/interfaces';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, LoginPinDto, RefreshTokenDto } from './dto';
import { HashService } from './hash.service';
import { AuthTokens, JwtPayload } from './interfaces';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

// Planshetdagi xodimlar roʻyxati ochiq endpointdan qaytadi — ortiqcha maydon chiqmasin
const STAFF_SELECT = {
  id: true,
  name: true,
  role: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly hashService: HashService,
    private readonly configService: ConfigService,
  ) {}

  /** Email + parol — OWNER, MANAGER, SUPER_ADMIN */
  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // `password` boʻsh boʻlsa — bu PIN bilan kiradigan xodim, unga bu yoʻl yopiq
    if (!user?.password) {
      throw new UnauthorizedException('Email yoki parol notoʻgʻri.');
    }

    const isMatch = await this.hashService.compareSecret(
      dto.password,
      user.password,
    );

    if (!isMatch) {
      throw new UnauthorizedException('Email yoki parol notoʻgʻri.');
    }

    this.assertActive(user);

    return this.issueTokens(user);
  }

  /** PIN loginning 1-bosqichi: planshet filialdagi xodimlarni koʻrsatadi */
  async getBranchStaff(branchId: number) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException('Filial topilmadi.');
    }

    return this.prisma.user.findMany({
      where: { branchId, isActive: true, pinCode: { not: null } },
      select: STAFF_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  /** PIN loginning 2-bosqichi — WAITER, CASHIER, KITCHEN */
  async loginWithPin(dto: LoginPinDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user?.pinCode) {
      throw new UnauthorizedException('Xodim yoki PIN-kod notoʻgʻri.');
    }

    const isMatch = await this.hashService.compareSecret(
      dto.pinCode,
      user.pinCode,
    );

    if (!isMatch) {
      throw new UnauthorizedException('Xodim yoki PIN-kod notoʻgʻri.');
    }

    this.assertActive(user);

    return this.issueTokens(user);
  }

  /** Token yangilash: eskisi bekor qilinadi, yangi juftlik beriladi (rotatsiya) */
  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    const tokenHash = this.hashService.hashRefreshToken(dto.refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Refresh token yaroqsiz yoki muddati tugagan.',
      );
    }

    this.assertActive(stored.user);

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user);
  }

  /** Chiqish — qator oʻchirilmaydi, faqat `revokedAt` bilan yopiladi */
  async logout(dto: RefreshTokenDto): Promise<void> {
    const tokenHash = this.hashService.hashRefreshToken(dto.refreshToken);

    // updateMany — notanish token uchun ham xatolik bermaydi (idempotent)
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    // JWT payload ataylab faqat `{ sub }` — qolgani har soʻrovda bazadan oʻqiladi
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
    } satisfies JwtPayload);

    const refreshToken = this.hashService.generateRefreshToken();
    const expiresDays = this.configService.getOrThrow<number>(
      'REFRESH_TOKEN_EXPIRES_DAYS',
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashService.hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + expiresDays * MS_IN_DAY),
      },
    });

    return { accessToken, refreshToken, user: this.toAuthUser(user) };
  }

  private assertActive(user: User): void {
    if (!user.isActive) {
      throw new UnauthorizedException('Hisobingiz faol emas.');
    }
  }

  /** `password`/`pinCode` javobga hech qachon chiqmasligining kafolati */
  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
    };
  }
}
