-- Migration 0037_batch_feature_requests — دسته‌ای از درخواست‌های کاربر بعد از استقرار روی VPS:
-- کد اختصاری لاتین شرکت، وضعیت «رد شد» استعلام، فیلدهای Incoterm/روش حمل روی هر دو پیشنهاد،
-- ردیابی نرخ تبدیل ارز پیشنهاد مالی، و شمارنده شماره پیشنهاد بر مبنای کد مشتری (نه شرکت ما).
-- Rollback: هر بخش زیر با ALTER TABLE...DROP COLUMN / DROP TABLE / برگردوندن CHECK قدیمی.

-- ------------------------------------------------------------
-- شرکت‌ها: کد اختصاری لاتین (دستی یا خودکار از حروف اول company_name_en)
-- ------------------------------------------------------------
ALTER TABLE business_partners ADD COLUMN short_code_en VARCHAR(20);

-- ------------------------------------------------------------
-- استعلام: وضعیت «رد شد توسط بازرگانی در مرحله اول» — مجزا از cancelled (که لغو توسط مشتریه)
-- ------------------------------------------------------------
ALTER TABLE inquiries DROP CONSTRAINT inquiries_status_check;
ALTER TABLE inquiries ADD CONSTRAINT inquiries_status_check
    CHECK (status IN ('in_progress', 'won', 'lost', 'partially_won', 'cancelled', 'suspended', 'declined'));

-- ------------------------------------------------------------
-- پیشنهاد مالی/فنی: Incoterm + محل، روش حمل — هر دو سند مستقل نگه می‌دارن
-- (هم‌الگوی delivery_time_estimate_days که از قبل جدا از financial_proposals روی
-- technical_proposals نگه‌داری می‌شه، طبق یادداشت erp-database-design.md دامنه ۴)
-- ------------------------------------------------------------
ALTER TABLE financial_proposals ADD COLUMN incoterm_location VARCHAR(200);
ALTER TABLE financial_proposals ADD COLUMN shipping_method VARCHAR(100);

ALTER TABLE technical_proposals ADD COLUMN chosen_delivery_term VARCHAR(10);
ALTER TABLE technical_proposals ADD COLUMN incoterm_location VARCHAR(200);
ALTER TABLE technical_proposals ADD COLUMN shipping_method VARCHAR(100);

-- ------------------------------------------------------------
-- پیشنهاد مالی: ردیابی نرخ تبدیل ارز — وقتی نسخه جدید با ارزی متفاوت از نسخه قبلی
-- ساخته می‌شه، نرخ وارد‌شده توسط کارشناس فروش اینجا ذخیره می‌شه (Nullable — فقط
-- نسخه‌هایی که واقعاً از تبدیل ارز اومدن این سه ستون رو پر دارن)
-- ------------------------------------------------------------
ALTER TABLE financial_proposals ADD COLUMN exchange_rate_from_currency VARCHAR(3);
ALTER TABLE financial_proposals ADD COLUMN exchange_rate_to_currency VARCHAR(3);
ALTER TABLE financial_proposals ADD COLUMN exchange_rate_value NUMERIC(18,6);

-- ------------------------------------------------------------
-- شمارنده شماره پیشنهاد بر مبنای مشتری (جایگزین proposal_global_counters که سال‌محور
-- و بدون کد شرکت بود — هر دو جدول قدیمی dead می‌مونن، طبق قاعده Rollback-پذیری پروژه)
-- ------------------------------------------------------------
CREATE TABLE proposal_client_counters (
    year             INTEGER NOT NULL,
    buyer_partner_id UUID NOT NULL REFERENCES business_partners(id),
    last_serial      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (year, buyer_partner_id)
);
