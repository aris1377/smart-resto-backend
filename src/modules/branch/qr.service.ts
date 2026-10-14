import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';

/** Chop etilganda ham o'qiladigan o'lcham */
const QR_SIZE_PX = 512;

/**
 * Stol QR kodini rasmga aylantiradi.
 *
 * QR ichida token emas, **to'liq havola** turadi — telefon kamerasi
 * havolani o'zi ochadi. Faqat tokenni yozsak, mijoz uni qayerga
 * kiritishni bilmasdi.
 */
@Injectable()
export class QrService {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService
      .getOrThrow<string>('QR_BASE_URL')
      .replace(/\/+$/, '');
  }

  buildUrl(token: string): string {
    return `${this.baseUrl}/${token}`;
  }

  /** Chop etish uchun PNG */
  toPng(token: string): Promise<Buffer> {
    return QRCode.toBuffer(this.buildUrl(token), {
      type: 'png',
      width: QR_SIZE_PX,
      // Chop etilgan qog'oz dog' bo'lsa ham o'qilishi uchun yuqori daraja
      errorCorrectionLevel: 'H',
      margin: 2,
    });
  }
}
