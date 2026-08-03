-- ============================================================
-- فاز ۳۱ — مرکز اقدامات (Action Center)، طبق SPEC-PHASE-31:
-- گسترش activities موجود (نه جدول جدید) + یک لایهٔ تجمیع Read-Only در سطح
-- اپلیکیشن روی سیستم‌های تأیید پراکندهٔ موجود (بدون جابه‌جایی داده).
-- ============================================================

-- 'in_progress' به چرخهٔ عمر دستی اضافه می‌شه (طبق مرحلهٔ ۲ سند) — بین
-- 'open' و 'waiting'/'scheduled'؛ 'overdue' هنوز به‌عنوان وضعیت Cron باقی
-- می‌مونه (تبدیل کامل به Flag محاسبه‌شده به فاز بعد موکول شد تا رفتار
-- فعلی Cron/فیلترها را نشکنه؛ فقط این تغییر افزودنی امن است)
ALTER TABLE activities DROP CONSTRAINT activities_status_check;
ALTER TABLE activities ADD CONSTRAINT activities_status_check
    CHECK (status IN ('open','in_progress','scheduled','waiting','overdue','completed','cancelled'));

-- توضیح «منتظر چی/کی؟» وقتی status='waiting' — طبق نکتهٔ بهبود مرحلهٔ ۱ سند
ALTER TABLE activities ADD COLUMN waiting_reason TEXT;
