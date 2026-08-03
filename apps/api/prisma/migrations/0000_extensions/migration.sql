-- ============================================================
-- Extensionهای موردنیاز — باید قبل از 0001_baseline اجرا بشه
-- (0001 ایندکس gin_trgm_ops می‌سازه ولی خودش فقط pgcrypto رو نصب می‌کنه)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
