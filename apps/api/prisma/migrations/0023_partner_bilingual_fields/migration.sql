-- ============================================================
-- فاز ۳۷ — فیلدهای دوزبانه شرکت‌ها/رابطین (پیش‌نیاز پیشنهاد/پیش‌فاکتور دوزبانه، فاز ۳۸)
-- ============================================================

ALTER TABLE business_partners ADD COLUMN company_name_en VARCHAR(300);
ALTER TABLE business_partners ADD COLUMN address_en        TEXT;

ALTER TABLE partner_contacts ADD COLUMN contact_name_en VARCHAR(200);
