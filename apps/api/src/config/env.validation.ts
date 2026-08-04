import { z } from "zod";

/** متغیر خالی ("") در .env یعنی تنظیم‌نشده — معادل undefined */
const emptyAsUndefined = (value: unknown) => (value === "" ? undefined : value);

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL الزامیه"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN الزامیه"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET باید حداقل ۱۶ کاراکتر باشه"),
  JWT_ACCESS_TTL: z.string().min(1).default("15m"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET باید حداقل ۱۶ کاراکتر باشه"),
  JWT_REFRESH_TTL: z.string().min(1).default("7d"),
  // خالی یعنی بدون Domain attribute (لازم برای دسترسی با IP خام، بدون دامنه)
  COOKIE_DOMAIN: z.preprocess(emptyAsUndefined, z.string().optional()),
  // مستقل از NODE_ENV — چون قبل از داشتن دامنه/HTTPS، اگه Secure=true باشه مرورگر
  // کوکی Refresh Token رو روی HTTP ساده اصلاً ذخیره/ارسال نمی‌کنه و لاگین بی‌صدا می‌شکنه
  COOKIE_SECURE: z.preprocess(emptyAsUndefined, z.enum(["true", "false"]).optional()),
  // برای ساخت لینک بازیابی رمز عبور در ایمیل (بدون این، لینک نسبی/نامعتبر می‌شه)
  FRONTEND_URL: z.string().min(1).default("http://localhost:5173"),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  // SMTP — اختیاری؛ بدون این‌ها ارسال RFQ در حالت Fallback (کپی دستی متن) کار می‌کنه
  SMTP_HOST: z.preprocess(emptyAsUndefined, z.string().optional()),
  SMTP_PORT: z.preprocess(emptyAsUndefined, z.coerce.number().int().positive().optional()),
  SMTP_USER: z.preprocess(emptyAsUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(emptyAsUndefined, z.string().optional()),
  SMTP_FROM: z.preprocess(emptyAsUndefined, z.string().optional()),
  RFQ_RESPONSE_DUE_DAYS: z.coerce.number().int().positive().default(7),
  // P1-E3-F1-T1 — Redis (cache/queue/pub-sub infrastructure introduced in
  // this phase; not yet used for anything beyond the health check).
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`پیکربندی محیط نامعتبره — ${message}`);
  }
  return result.data;
}
