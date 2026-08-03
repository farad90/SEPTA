-- ============================================================
-- فاز ۱ — افزودن فیلدهای احراز هویت
-- erp-schema.sql (migration 0001) دست‌نخورده می‌مونه؛ این migration فقط اضافه می‌کنه
-- ============================================================

-- رمز عبور کاربر — چون دیتابیس تازه‌ست (بدون رکورد موجود)، NOT NULL بدون Backfill امنه
ALTER TABLE users
    ADD COLUMN password_hash TEXT NOT NULL;

-- بازیابی رمز عبور فراموش‌شده
ALTER TABLE users
    ADD COLUMN password_reset_token VARCHAR(255),
    ADD COLUMN password_reset_token_expires_at TIMESTAMPTZ;

-- فیلد «واحد سازمانی» فرم ثبت‌نام (auth-pages-mockup.jsx) — صرفاً راهنمای متنی
-- برای مدیر تأییدکننده هنگام تعیین permission_group_id؛ هیچ قانون کسب‌وکاری
-- خودکاری به این فیلد وصل نیست.
ALTER TABLE users
    ADD COLUMN requested_department VARCHAR(50);

-- ------------------------------------------------------------
-- Refresh Token — پشتیبان استراتژی JWT access+refresh
-- ------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL,      -- هش SHA-256 توکن؛ خود توکن هرگز ذخیره نمی‌شه
    user_agent      TEXT,
    ip_address      VARCHAR(64),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
