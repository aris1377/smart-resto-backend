import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlanService } from './plan.service';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionCron } from './subscription.cron';

@Module({
  // HashService uchun — OWNER paroli auth'dagi bir xil qoida bilan hashlanadi
  imports: [AuthModule],
  controllers: [PlatformController, SubscriptionController],
  providers: [
    PlatformService,
    SubscriptionService,
    SubscriptionCron,
    PlanService,
  ],
  // SubscriptionGuard (APP_GUARD) va Faza 5 dagi QR oqimi shundan foydalanadi
  exports: [SubscriptionService],
})
export class PlatformModule {}
