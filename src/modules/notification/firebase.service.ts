import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import {
  getMessaging,
  Messaging,
  SendResponse,
} from 'firebase-admin/messaging';
import {
  DEAD_TOKEN_ERROR_CODES,
  FCM_BATCH_LIMIT,
  INVALID_ARGUMENT_CODE,
  INVALID_TOKEN_MESSAGE,
} from './notification.constants';

/** Qurilmaga koʻrinadigan xabar */
export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
}

/**
 * FCM transporti — faqat "yuborish" ishi. Kimga yuborish kerakligini
 * bilmaydi, bazaga tegmaydi.
 *
 * Firebase sozlanmagan boʻlsa ilova **baribir koʻtariladi**: push — qulaylik,
 * asosiy kanal WebSocket. Kalit yoʻqligi uchun restoran toʻxtab qolmasin.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private messaging: Messaging | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    // Joi uchalasini birga talab qiladi, shuning uchun bittasini tekshirish
    // yetarli — qolgani faqat TypeScript'ni tinchlantirish uchun
    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase sozlanmagan — push oʻchiq rejimda.');
      return;
    }

    const app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            // Kalit .env'da bitta qatorda yotadi
            privateKey: privateKey.replace(/\n/g, '\n'),
          }),
        });

    this.messaging = getMessaging(app);
    this.logger.log(`FCM tayyor: ${projectId}`);
  }

  get isEnabled(): boolean {
    return this.messaging !== null;
  }

  /**
   * Tokenlarga xabar yuboradi va **oʻlik** tokenlarni qaytaradi.
   *
   * FCM qisman muvaffaqiyatni qaytaradi: 10 ta tokendan 8 tasi ketib,
   * 2 tasi yiqilishi normal. Ilova oʻchirilgan qurilmaning tokeni shu
   * yerda bilinadi — uni bazadan oʻchirmasak, har safar behuda urinamiz.
   */
  async send(tokens: string[], message: PushMessage): Promise<string[]> {
    if (!this.messaging) {
      return [];
    }

    const dead: string[] = [];

    for (let from = 0; from < tokens.length; from += FCM_BATCH_LIMIT) {
      const chunk = tokens.slice(from, from + FCM_BATCH_LIMIT);

      const result = await this.messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title: message.title, body: message.body },
        data: message.data,
      });

      result.responses.forEach((response, index) => {
        if (response.success) {
          return;
        }

        if (this.isDeadToken(response)) {
          dead.push(chunk[index]);
        } else {
          this.logger.warn(
            `Push yetmadi: ${response.error?.code ?? 'nomaʼlum'}`,
          );
        }
      });
    }

    return dead;
  }

  private isDeadToken(response: SendResponse): boolean {
    const code = response.error?.code ?? '';
    const message = response.error?.message ?? '';

    if (DEAD_TOKEN_ERROR_CODES.some((dead) => dead === code)) {
      return true;
    }

    return (
      code === INVALID_ARGUMENT_CODE && message.includes(INVALID_TOKEN_MESSAGE)
    );
  }
}
