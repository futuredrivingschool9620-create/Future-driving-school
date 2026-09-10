import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidates = [
  process.env.DOTENV_CONFIG_PATH,
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '.env'),
  (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'server', '.env') : null,
  (process as any).resourcesPath ? path.join((process as any).resourcesPath, '.env') : null,
].filter(Boolean) as string[];

let loaded = false;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    loaded = true;
    break;
  }
}
if (!loaded) {
  dotenv.config();
}
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().int().positive().default(7),

  // Server
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Rate Limiting
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

  // Scheduler
  SCHEDULER_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  SCHEDULER_CRON: z.string().default('0 8 * * *'),
  TIMEZONE: z.string().default('Asia/Kolkata'),

  // WhatsApp Business API
  WHATSAPP_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  WHATSAPP_API_URL: z.string().default(''),
  WHATSAPP_API_TOKEN: z.string().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),

  // SMS Gateway
  SMS_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SMS_API_URL: z.string().default(''),
  SMS_API_KEY: z.string().default(''),
  SMS_SENDER_ID: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables. Check server logs for details.');
  }

  return result.data;
}

export const env = loadEnv();
