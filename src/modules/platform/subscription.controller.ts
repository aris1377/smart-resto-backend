import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AllowExpired } from '../../common/decorators/allow-expired.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces';
import { SubscriptionService } from './subscription.service';

/**
 * B qatlam: restoran o'z obunasini ko'radi.
 * `/platform/*` dan farqi — bu yerda restoran o'zi haqida so'raydi,
 * `tenantId` so'rovdan emas, tokendan olinadi.
 */
@ApiBearerAuth()
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // Obuna tugaganda ham ochiq bo'lishi SHART: aks holda foydalanuvchi
  // 402 xatosidan boshqa hech narsa ko'rmaydi va nima qilishni bilmaydi
  @AllowExpired()
  @Roles(Role.OWNER, Role.MANAGER)
  @Get('me')
  getMySubscription(@CurrentUser() user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException('Foydalanuvchi restoranga bogʻlanmagan.');
    }

    return this.subscriptionService.getCurrentForTenant(user.tenantId);
  }
}
