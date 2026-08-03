-- ============================================================
-- فاز ۳ — شمارنده اتمیک شماره داخلی استعلام (INQ-YYYY-NNNN)
-- erp-schema.sql برای استعلام شمارنده نداره؛ همون الگوی letter_counters
-- سال میلادی (تصمیم تأییدشده — شماره در ایمیل RFQ به تأمین‌کننده خارجی ارجاع می‌شه)
-- تولید شماره باید در تراکنش اتمیک (SELECT ... FOR UPDATE سپس UPDATE) انجام بشه
-- ============================================================

CREATE TABLE inquiry_counters (
    year        INTEGER PRIMARY KEY,
    last_serial INTEGER NOT NULL DEFAULT 0
);
