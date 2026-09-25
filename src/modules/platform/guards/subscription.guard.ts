import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { ALLOW_EXPIRED_KEY } from '../../../common/decorators/allow-expired.decorator';
import { AuthUser } from '../../../common/interfaces';
import { SubscriptionService } from '../subscription.service';

/**
 * Obunasi tugagan restoranni to'sadi (402).
 *
 * Guardlar zanjirida OXIRGI turadi, chunki `req.user` ga muhtoj.
 * QR oqimi (`@Public()`) bu yerda tekshirilmaydi — u yerda foydalanuvchi yo'q,
 * tenant esa QR token orqali topiladi, shuning uchun tekshiruv service ichida
 * `SubscriptionService.assertActive()` bilan qilinadi (Faza 5).
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowExpired = this.reflector.getAllAndOverride<boolean>(
      ALLOW_EXPIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Ochiq orderni yopish va to'lov qabul qilish obunasiz ham ishlaydi
    if (allowExpired) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    // @Public() endpoint — JwtAuthGuard o'tkazib yuborgan, user yo'q
    if (!user) {
      return true;
    }

    // Platforma egasi obunadan yuqorida turadi
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // Tenantga bog'lanmagan foydalanuvchida tekshiradigan obuna ham yo'q
    if (!user.tenantId) {
      return true;
    }

    await this.subscriptionService.assertActive(user.tenantId);

    return true;
  }
}
