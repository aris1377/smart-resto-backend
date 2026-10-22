import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server, ServerOptions } from 'socket.io';

/**
 * Socket.IO xonalarini Redis orqali bir nechta instansiyaga ulashadi.
 *
 * Socket.IO xonalarni protsess xotirasida saqlaydi. Ikki instansiya ishlasa,
 * #2 ga tushgan buyurtma #1 ga ulangan oshxonaga yetib bormaydi — xabar
 * jimgina yoʻqoladi. Redis adapter xabarni hamma instansiyaga tarqatadi.
 *
 * Hozir bitta instansiya ishlaydi, lekin bu keyin qoʻshiladigan narsa emas:
 * kod yozilib boʻlgandan keyin transportni almashtirish ancha qimmat.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private corsOrigins: string[] | boolean = true;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  /** `app.listen()` dan oldin chaqiriladi: Redis'ga ulanadi */
  async connect(): Promise<void> {
    const config = this.app.get(ConfigService);
    const host = config.getOrThrow<string>('REDIS_HOST');
    const port = config.getOrThrow<number>('REDIS_PORT');

    // Socket.IO adapteri ikkita ulanish talab qiladi: biri yozish, ikkinchisi
    // oʻqish uchun — Redis'da bitta ulanish ikkisini birga qila olmaydi
    const pubClient = new Redis({ host, port });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.ping(), subClient.ping()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);

    const origins = config.get<string>('CORS_ORIGINS');
    this.corsOrigins = origins
      ? origins.split(',').map((origin) => origin.trim())
      : true;

    this.logger.log(`Redis adapter ulandi: ${host}:${port}`);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    // Socket.IO o'z CORS'ini talab qiladi: `app.enableCors()` unga tegmaydi
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigins, credentials: true },
    }) as Server;

    server.adapter(this.adapterConstructor);

    return server;
  }
}
