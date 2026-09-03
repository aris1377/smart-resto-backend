import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: number; // User ID
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super_secret_key_12345',
    });
  }

  async validate(payload: JwtPayload) {
    // Tokendagi user bazada rostdan ham bormi-yo'qligini tekshiramiz
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi yoki token yaroqsiz.');
    }

    // req.user ga tushadigan ma'lumot (parolni qaytarmaymiz)
    const { password, ...result } = user;
    return result;
  }
}