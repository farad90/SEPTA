-- ============================================================
-- فاز ۳۸ — فیلدهای فوتر سند پیشنهاد (کد پستی، شماره ثبت شرکت گروه)
-- ============================================================

ALTER TABLE our_entities ADD COLUMN postal_code         VARCHAR(20);
ALTER TABLE our_entities ADD COLUMN registration_number  VARCHAR(50);
