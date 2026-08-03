-- فاز ۵۶ — بازخورد کاربر (باگ واقعی): وقتی کارشناس زمان تحویل رو با واحد «هفته» وارد می‌کنه
-- (DeliveryTimeInput)، فقط عدد تبدیل‌شده به روز ذخیره می‌شد و خودِ واحد هیچ‌جا نگه داشته
-- نمی‌شد — پس فایل خروجی همیشه به روز نمایش می‌داد، حتی وقتی کاربر صراحتاً هفته انتخاب کرده بود.
-- این ستون واحد نمایشی انتخابی رو روی خود نسخه‌ی پیشنهاد نگه می‌داره؛ عدد ذخیره‌شده
-- (delivery_days / delivery_time_estimate_days) همچنان همیشه به روزه — فقط نمایش در سند/UI
-- بر اساس این واحد محاسبه می‌شه.

ALTER TABLE financial_proposals ADD COLUMN delivery_days_unit VARCHAR(10) NOT NULL DEFAULT 'day'
    CHECK (delivery_days_unit IN ('day', 'week'));

ALTER TABLE technical_proposals ADD COLUMN delivery_days_unit VARCHAR(10) NOT NULL DEFAULT 'day'
    CHECK (delivery_days_unit IN ('day', 'week'));

-- Rollback:
-- ALTER TABLE financial_proposals DROP COLUMN delivery_days_unit;
-- ALTER TABLE technical_proposals DROP COLUMN delivery_days_unit;
