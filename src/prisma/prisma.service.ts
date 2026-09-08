import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('PrismaService');

  async onModuleInit() {
    try {
      // NestJS ishga tushganda PostgreSQL bazasiga ulanadi
      await this.$connect();
      this.logger.log('✅ connect to PostgreSQL!');
    } catch (error) {
      this.logger.error('❌ disconnect from PostgreSQL:', error);
    }
  }

  async onModuleDestroy() {
    // NestJS to'xtatilganda ulanishni xavfsiz uzadi
    await this.$disconnect();
    this.logger.log('🛑 disconnect from PostgreSQL.');
  }
}
