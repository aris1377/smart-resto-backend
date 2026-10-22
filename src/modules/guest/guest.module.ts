import { Module } from '@nestjs/common';
import { BranchModule } from '../branch/branch.module';
import { MenuModule } from '../menu/menu.module';
import { NotificationModule } from '../notification/notification.module';
import { PlatformModule } from '../platform/platform.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { GuestMenuController } from './guest-menu.controller';
import { GuestMenuService } from './guest-menu.service';
import { GuestOrderController } from './guest-order.controller';
import { GuestOrderService } from './guest-order.service';
import { GuestTableService } from './guest-table.service';

/**
 * A qatlam — QR orqali kelgan mehmon (`/api/v1/public/*`).
 *
 * - `MenuModule`     — menyu (`MenuService.buildForBranch`)
 * - `BranchModule`   — stol statusi (`TableStatusService`)
 * - `PlatformModule` — restoran obunasi (`SubscriptionService.assertActive`)
 * - `RealtimeModule` — buyurtma hodisasini oshxona va ofitsiantga yetkazish
 * - `NotificationModule` — ilova yopiq bo'lsa, o'sha hodisani push bilan
 */
@Module({
  imports: [
    MenuModule,
    BranchModule,
    PlatformModule,
    RealtimeModule,
    NotificationModule,
  ],
  controllers: [GuestMenuController, GuestOrderController],
  providers: [GuestTableService, GuestMenuService, GuestOrderService],
})
export class GuestModule {}
