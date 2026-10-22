import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

/**
 * Faza 6 — real-time transport qatlami.
 *
 * `AuthModule` handshake'dagi tokenni tekshirish uchun `JwtService` beradi.
 * Tashqariga faqat `RealtimeService` chiqadi: boshqa modullar Socket.IO
 * haqida hech narsa bilmasligi kerak.
 */
@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
