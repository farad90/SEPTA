-- Migration 0034_proposal_global_numbering — بازخورد کاربر: شماره پیشنهاد مالی/فنی باید بر
-- مبنای سال میلادی باشه و هیچ حرفی داخلش نباشه. جایگزین شمارش قبلی بر مبنای شرکت گروه صادرکننده
-- (فاز ۴۰-ب، جدول proposal_counters که شماره‌ها رو با short_code شرکت — فارسی یا لاتین —
-- می‌ساخت) با یک شمارنده‌ی سراسری سالانه، هم‌الگوی inquiry_counters/rfq_counters.
-- ⚠️ جدول proposal_counters طبق قاعده‌ی Rollback-پذیری پروژه حذف نشد — فقط دیگه خونده/نوشته نمی‌شه.

CREATE TABLE proposal_global_counters (
    year        INTEGER PRIMARY KEY,
    last_serial INTEGER NOT NULL DEFAULT 0
);
