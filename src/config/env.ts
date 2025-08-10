// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_SECRET: z.string().min(10),
  CACHE_LOGGING: z
    .string()
    .optional()
    .transform((val) => (val ? val.toLowerCase() === 'true' : false)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid env variables');
}

export const env = parsed.data;
