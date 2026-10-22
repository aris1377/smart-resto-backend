import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { FirebaseService } from './firebase.service';
import { PUSH_QUEUE } from './notification.constants';
import { PushProcessor } from './push.processor';
import { PushService } from './push.service';

/**
 * Faza 6 — push bildirishnomalar.
 *
 * Tashqariga faqat `PushService` chiqadi: boshqa modullar FCM ham, BullMQ
 * ham koʻrmasligi kerak (`RealtimeModule` Socket.IO'ni yashirgani kabi).
 */
@Module({
  imports: [BullModule.registerQueue({ name: PUSH_QUEUE })],
  controllers: [DeviceController],
  providers: [DeviceService, FirebaseService, PushService, PushProcessor],
  exports: [PushService],
})
export class NotificationModule {}
