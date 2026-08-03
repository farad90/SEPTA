-- Migration 0032_site_settings — تنظیمات سراسری سامانه (فعلاً فقط پس‌زمینه صفحه ورود)
-- الگوی تک‌ردیفی (singleton) دقیقاً کپی catalog_counters — سرویس بک‌اند ردیف id=1 رو
-- به‌صورت لِیزی upsert می‌کنه، نیازی به INSERT اولیه در همین migration نیست.
-- Rollback: DROP TABLE site_settings;

CREATE TABLE site_settings (
    id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    login_background_url  TEXT,
    updated_by            UUID REFERENCES users(id),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
