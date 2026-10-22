import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  CORS_ORIGINS: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: Joi.number().integer().min(1).default(7),

  ADMIN_API_KEY: Joi.string().optional(),

  // Global rate-limit. Yuk testi va prod sozlamasi uchun env'dan boshqariladi.
  THROTTLE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),

  // Fayl saqlash (MinIO / S3). Lokalda docker-compose.yml dagi MinIO.
  S3_ENDPOINT: Joi.string().uri().default('http://localhost:9200'),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_ACCESS_KEY: Joi.string().default('minioadmin'),
  S3_SECRET_KEY: Joi.string().default('minioadmin'),
  S3_BUCKET: Joi.string().default('smart-resto'),
  // Rasm havolasi shu manzil orqali quriladi (prodda CDN bo'lishi mumkin)
  S3_PUBLIC_URL: Joi.string().uri().default('http://localhost:9200'),

  // Stol QR kodi shu manzilga ishora qiladi: <QR_BASE_URL>/<qrCodeToken>.
  // Prodda bu mijozga ko'rinadigan sayt bo'ladi (Faza 5 dagi QR oqimi).
  QR_BASE_URL: Joi.string()
    .uri()
    .default('http://localhost:3000/api/v1/public/qr'),

  // Socket.IO xonalari va BullMQ navbati shu Redis'da (Faza 6).
  // Redis ishlamasa ilova ko'tarilmaydi.
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),

  // FCM push (Faza 6). Service account kaliti.
  // Berilmasa push o'chiq rejimda ishlaydi — ilova baribir ko'tariladi,
  // chunki push qulaylik, WebSocket esa asosiy kanal.
  FIREBASE_PROJECT_ID: Joi.string().optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().email().optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().optional(),
})
  // Yarim sozlangan Firebase — eng yomon holat: push jimgina ishlamaydi.
  // Shuning uchun uchtasi birga bo'ladi yoki umuman bo'lmaydi.
  .and('FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY');
