// config/env.ts
import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]),
  DATABASE_URL: z.string().url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error("Invalid env variables");
}

export const env = parsed.data;
