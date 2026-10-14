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

  // Faza 6 (Redis) da majburiy bo'ladi, hozircha default bilan
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
});
