import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DeviceService } from './device.service';
import { FirebaseService } from './firebase.service';
import { PushJobData } from './interfaces';
import { PUSH_QUEUE } from './notification.constants';

/**
 * Navbatdagi ishni bajaradi: kimga yuborish kerakligini aniqlaydi,
 * FCM'ga beradi va oʻlik tokenlarni tozalaydi.
 *
 * Bu kod HTTP soʻrovdan tashqarida ishlaydi — shuning uchun sekin boʻlsa
 * ham mehmonga sezilmaydi. Xato boʻlsa BullMQ qayta urinadi.
 */
@Processor(PUSH_QUEUE)
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly devices: DeviceService,
  ) {
    super();
  }

  async process(job: Job<PushJobData>): Promise<void> {
    const { branchId, roles, title, body, data } = job.data;

    if (!this.firebase.isEnabled) {
      return;
    }

    const tokens = await this.devices.findBranchTokens(branchId, roles);

    if (tokens.length === 0) {
      return;
    }

    const dead = await this.firebase.send(tokens, { title, body, data });
    await this.devices.deactivate(dead);

    this.logger.log(
      `"${title}" -> ${tokens.length} qurilma (${dead.length} oʻlik token oʻchirildi)`,
    );
  }
}
