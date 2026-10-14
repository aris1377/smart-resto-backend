import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { BranchModule } from './modules/branch/branch.module';
import { MenuModule } from './modules/menu/menu.module';
import { SubscriptionGuard } from './modules/platform/guards/subscription.guard';
import { PlatformModule } from './modules/platform/platform.module';
import { StorageModule } from './modules/storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    // Limit env'dan olinadi: prodda boshqa qiymat, yuk testida esa
    // cheklov umuman xalaqit bermasligi uchun kattalashtiriladi
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: seconds(config.get<number>('THROTTLE_TTL_SECONDS', 60)),
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),
    // Obuna muddatini har kuni tekshiruvchi cron uchun
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    StorageModule,
    AuthModule,
    PlatformModule,
    BranchModule,
    MenuModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Tartib muhim: rate-limit -> autentifikatsiya -> rol -> obuna.
    // Endpoint ochiq boʻlishi uchun @Public() yozilishi shart.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: SubscriptionGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
