import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string>('CORS_ORIGINS');

  app.use(helmet());
  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  //Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });

  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port);

  logger.log(`🚀 connected: http://localhost:${port}/api/v1`);
}
bootstrap().catch((error) => {
  new Logger('Bootstrap').error('❌', error);
  process.exit(1);
});
