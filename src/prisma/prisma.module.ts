import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Boshqa modullar ishlatishi uchun export qilamiz
})
export class PrismaModule {}