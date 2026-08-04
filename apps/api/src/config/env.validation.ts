import { z } from "zod";

/** متغیر خالی ("") در .env یعنی تنظیم‌نشده — معادل undefined */
const emptyAsUndefined = (value: unknown) => (value === "" ? undefined : value);

// P0-E1-F2-T4 — a 16-character minimum let an obvious placeholder like
// "change-me-access-secret" (24 chars, sitting verbatim in apps/api/.env.example
// as the "example" value developers copy) pass validation silently. Raising
// the length alone doesn't catch that specific failure mode — a placeholder
// can be long — so this also rejects common give-it-away substrings.
// A real secret generated via `openssl rand -hex 32` is pure hex ([0-9a-f]),
// which cannot contain any of these words, so this never produces a false
// positive against an actual random secret.
const PLACEHOLDER_PATTERNS = [
  /change[-_]?me/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /placeholder/i,
  /\btodo\b/i,
  /\bexample\b/i,
  /your[-_]?.*here/i,
];

const jwtSecret = z
  .string()
  .min(32, "باید حداقل ۳۲ کاراکتر باشه (openssl rand -hex 32)")
  .refine(
    (value) => !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value)),
    "این مقدار یک Placeholder شناخته‌شده به‌نظر می‌رسه، نه یک رمز واقعی — با openssl rand -hex 32 یک مقدار تازه بساز",
  );

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL الزامیه"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN الزامیه"),
  JWT_ACCESS_SECRET: jwtSecret,
  JWT_ACCESS_TTL: z.string().min(1).default("15m"),
  JWT_REFRESH_SECRET: jwtSecret,
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
