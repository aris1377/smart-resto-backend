import { randomUUID } from 'node:crypto';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Ruxsat etilgan rasm turlari va ularning kengaytmasi */
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_MIME = Object.keys(ALLOWED_TYPES);

/**
 * S3 ga mos obyekt-xotira (lokalda MinIO, prodda S3 yoki boshqa provayder).
 * Faqat "faylni qo'y / o'chir" biladi — qaysi mahsulotga tegishli ekani
 * chaqiruvchi modulning ishi.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    this.publicUrl = this.configService
      .getOrThrow<string>('S3_PUBLIC_URL')
      .replace(/\/+$/, '');

    this.client = new S3Client({
      endpoint: this.configService.getOrThrow<string>('S3_ENDPOINT'),
      region: this.configService.getOrThrow<string>('S3_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.configService.getOrThrow<string>('S3_SECRET_KEY'),
      },
      // MinIO virtual-host uslubidagi manzillarni qo'llab-quvvatlamaydi
      forcePathStyle: true,
    });
  }

  /** Ilova ko'tarilganda bucket bor-yo'qligini tekshiradi, bo'lmasa yaratadi */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket tayyor: ${this.bucket}`);
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        await this.makeBucketPublic();
        this.logger.log(`Bucket yaratildi: ${this.bucket}`);
      } catch (error) {
        // Xotira ko'tarilmagan bo'lsa ham ilova ishlashda davom etadi —
        // faqat rasm yuklash endpointi xato beradi
        this.logger.error(
          `Bucket tayyorlanmadi (${this.bucket}): ${(error as Error).message}`,
        );
      }
    }
  }

  isAllowedType(mimeType: string): boolean {
    return mimeType in ALLOWED_TYPES;
  }

  /**
   * Faylni saqlaydi va uning ochiq havolasini qaytaradi.
   * Nom serverda generatsiya qilinadi — mijozdan kelgan fayl nomiga
   * hech qachon ishonilmaydi (yo'l bilan hiyla qilish mumkin).
   */
  async uploadImage(
    file: Express.Multer.File,
    prefix: string,
  ): Promise<string> {
    const extension = ALLOWED_TYPES[file.mimetype];
    const key = `${prefix}/${randomUUID()}.${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return `${this.publicUrl}/${this.bucket}/${key}`;
  }

  /** Eski rasmni o'chiradi. Xatolik asosiy amalni to'xtatmasligi kerak. */
  async deleteByUrl(url: string | null): Promise<void> {
    const key = this.extractKey(url);

    if (!key) {
      return;
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      this.logger.warn(`Rasm o'chmadi (${key}): ${(error as Error).message}`);
    }
  }

  /** Havoladan obyekt kalitini ajratadi; begona havola bo'lsa — null */
  private extractKey(url: string | null): string | null {
    if (!url) {
      return null;
    }

    const prefix = `${this.publicUrl}/${this.bucket}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }

  /** Rasm brauzerdan ochilishi uchun bucket'ga ochiq o'qish huquqi */
  private async makeBucketPublic(): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        },
      ],
    };

    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: this.bucket,
        Policy: JSON.stringify(policy),
      }),
    );
  }
}
