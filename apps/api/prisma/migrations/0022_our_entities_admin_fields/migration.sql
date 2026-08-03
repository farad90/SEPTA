-- ============================================================
-- فاز ۳۶ — بخش مدیریتی «شرکت‌های ما» (جایگزین seed ثابت)
-- ============================================================

-- entity_name_en برای پیشنهاد/پیش‌فاکتور دوزبانه (فاز ۳۷)؛ بقیه فیلدها برای سربرگ/تماس
ALTER TABLE our_entities ADD COLUMN entity_name_en VARCHAR(200);
ALTER TABLE our_entities ADD COLUMN address        TEXT;
ALTER TABLE our_entities ADD COLUMN phone           VARCHAR(30);
ALTER TABLE our_entities ADD COLUMN email           VARCHAR(200);
ALTER TABLE our_entities ADD COLUMN website          VARCHAR(200);
ALTER TABLE our_entities ADD COLUMN logo_url          TEXT;
