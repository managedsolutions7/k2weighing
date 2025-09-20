// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_SECRET: z.string().min(10),
  INVOICE_SIGNATURE_SECRET: z.string().min(32).optional(),
  INVOICE_PDF_ENGINE: z.enum(['pdfkit', 'html']).optional().default('pdfkit'),
  ENTRY_PDF_ENGINE: z.enum(['pdfkit', 'html']).optional().default('pdfkit'),
  CACHE_LOGGING: z
    .string()
    .optional()
    .transform((val) => (val ? val.toLowerCase() === 'true' : false)),
  // S3 settings
  AWS_REGION: z.string().optional(),
  S3_UPLOADS_BUCKET: z.string().optional(),
  S3_UPLOADS_PREFIX: z.string().optional(),
  S3_KMS_KEY_ID: z.string().optional(),
  // CORS
  ALLOWED_ORIGIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid env variables');
}

export const env = parsed.data;
