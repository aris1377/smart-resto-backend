import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Controller yoki Metodga qo'yilgan @Roles(...) dekoratorini o'qiymiz
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Agar endpointga hech qanday rol cheklovi qo'yilmagan bo'lsa, o'tkazib yuboramiz
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Foydalanuvchi tizmga kirganini va roli borligini tekshiramiz
    if (!user || !user.role) {
      throw new ForbiddenException(
        'Sizda ushbu resursdan foydalanish huquqi yoʻq.',
      );
    }

    // Foydalanuvchi roli talab qilingan rollar ichida bormi?
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        'Ushbu amallarni bajarish uchun sizning rolingiz yetarli emas.',
      );
    }

    return true;
  }
}
