-- Migration 0047_move_pricing_options_to_inquiry — اصلاح معماری فاز ۶۰ طبق بازخورد کاربر:
-- «تعیین حاشیه سود به تفکیک ترم تحویل باید فقط در مرحله انتخاب نهایی و قیمت‌گذاری اتفاق بیفته»
-- (نه در تب «پیشنهاد به مشتری»). چون financial_proposal_delivery_options/financial_proposal_items
-- (فاز ۶۰ اولیه، migration 0046) به financial_proposals وصل بودن و یک FinancialProposal فقط
-- بعد از selection_locked_at ساخته می‌شه (ProposalService.assertLocked)، مدیریت اصلاً امکان
-- تعیین مارک‌آپ رو قبل از قفل شدن انتخاب نهایی نداشت — این migration قیمت‌گذاری بازرگانی رو
-- از سطح «نسخه‌ی پیشنهاد» به سطح «خودِ استعلام» منتقل می‌کنه، دقیقاً هم‌سطح inquiry_delivery_options
-- و inquiry_pricing_costs که از قبل درست در همین سطح بودن.

-- ------------------------------------------------------------
-- ۱) جداول جدید Inquiry-scoped
-- ------------------------------------------------------------
CREATE TABLE inquiry_pricing_options (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id                  UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    delivery_term               VARCHAR(10) NOT NULL,
    incoterm_location           VARCHAR(200),
    shipping_method             VARCHAR(100),
    delivery_days               INTEGER NOT NULL,
    delivery_days_unit          VARCHAR(10) NOT NULL DEFAULT 'day' CHECK (delivery_days_unit IN ('day','week')),
    payment_terms               TEXT,
    currency_code                VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    exchange_rate_from_currency VARCHAR(3),
    exchange_rate_value         NUMERIC(18,6),
    margin_base_amount          NUMERIC(18,4) NOT NULL DEFAULT 0,
    default_markup_percent      NUMERIC(6,3),
    is_primary                  BOOLEAN NOT NULL DEFAULT false,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (inquiry_id, delivery_term)
);
CREATE INDEX idx_inquiry_pricing_options_inquiry ON inquiry_pricing_options(inquiry_id);

CREATE TABLE inquiry_pricing_option_items (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_id                   UUID NOT NULL REFERENCES inquiry_pricing_options(id) ON DELETE CASCADE,
    inquiry_item_id              UUID NOT NULL REFERENCES inquiry_items(id),
    purchase_price               NUMERIC(18,4),
    markup_percent               NUMERIC(6,3) NOT NULL DEFAULT 0,
    commercial_calculated_price  NUMERIC(18,4),
    commercial_priced_by         UUID REFERENCES users(id),
    commercial_priced_at         TIMESTAMPTZ,
    sales_adjustment_amount      NUMERIC(18,4) NOT NULL DEFAULT 0,
    sales_adjustment_reason_code VARCHAR(50),
    sales_adjustment_note        TEXT,
    sales_adjusted_by            UUID REFERENCES users(id),
    sales_adjusted_at            TIMESTAMPTZ,
    final_sale_price             NUMERIC(18,4) NOT NULL DEFAULT 0,
    margin_base_cost_snapshot    JSONB,
    UNIQUE (option_id, inquiry_item_id)
);
CREATE INDEX idx_inquiry_pricing_option_items_option ON inquiry_pricing_option_items(option_id);

-- ------------------------------------------------------------
-- ۲) بک‌فیل از داده‌ی موجود (اگر باشه — فقط از نسخه‌ی «current» هر پیشنهاد، چون این جدول
--    جدید دیگه Versioned نیست؛ نسخه‌های superseded تاریخی دست‌نخورده در جدول قدیمی می‌مونن)
-- ------------------------------------------------------------
INSERT INTO inquiry_pricing_options (
    id, inquiry_id, delivery_term, incoterm_location, shipping_method,
    delivery_days, delivery_days_unit, payment_terms, currency_code,
    exchange_rate_from_currency, exchange_rate_value, margin_base_amount,
    default_markup_percent, is_primary, created_at, updated_at
)
SELECT
    fpdo.id, fp.inquiry_id, fpdo.delivery_term, fpdo.incoterm_location, fpdo.shipping_method,
    fpdo.delivery_days, fpdo.delivery_days_unit, fpdo.payment_terms, fpdo.currency_code,
    fpdo.exchange_rate_from_currency, fpdo.exchange_rate_value, fpdo.margin_base_amount,
    fpdo.default_markup_percent, fpdo.is_primary, fpdo.created_at, fpdo.updated_at
FROM financial_proposal_delivery_options fpdo
JOIN financial_proposals fp ON fp.id = fpdo.financial_proposal_id AND fp.status = 'current'
ON CONFLICT (inquiry_id, delivery_term) DO NOTHING;

INSERT INTO inquiry_pricing_option_items (
    id, option_id, inquiry_item_id, purchase_price, markup_percent,
    commercial_calculated_price, commercial_priced_by, commercial_priced_at,
    sales_adjustment_amount, sales_adjustment_reason_code, sales_adjustment_note,
    sales_adjusted_by, sales_adjusted_at, final_sale_price, margin_base_cost_snapshot
)
SELECT
    fpi.id, fpi.financial_proposal_delivery_option_id, fpi.inquiry_item_id, fpi.purchase_price, fpi.markup_percent,
    fpi.commercial_calculated_price, fpi.commercial_priced_by, fpi.commercial_priced_at,
    fpi.sales_adjustment_amount, fpi.sales_adjustment_reason_code, fpi.sales_adjustment_note,
    fpi.sales_adjusted_by, fpi.sales_adjusted_at, fpi.final_sale_price, fpi.margin_base_cost_snapshot
FROM financial_proposal_items fpi
WHERE fpi.financial_proposal_delivery_option_id IN (SELECT id FROM inquiry_pricing_options)
ON CONFLICT (option_id, inquiry_item_id) DO NOTHING;

-- ------------------------------------------------------------
-- ۲-ب) ردیف‌های financial_proposal_items که به یک گزینه‌ی ترم تحویل وصل بودن (option_id NOT NULL)
--       دیتاشون همین بالا به inquiry_pricing_option_items منتقل شد — خودِ این ردیف‌ها الان زائدن
--       (کنار ردیف «تخت»/legacy همون قلم که option_id نداشت) و باید قبل از بازگردوندن Unique
--       قدیمی (financial_proposal_id, inquiry_item_id) حذف بشن، وگرنه تناقض دو ردیف برای یک قلم
-- ------------------------------------------------------------
DELETE FROM financial_proposal_items WHERE financial_proposal_delivery_option_id IS NOT NULL;

-- ------------------------------------------------------------
-- ۳) گردش تأیید کاهش قیمت — از قلم پیشنهاد به قلم گزینه‌ی قیمت‌گذاری استعلام منتقل می‌شه.
--    درخواست‌های یتیم (قلمشون تازه بک‌فیل نشده، عملاً روی این دیتابیس خالی رخ نمی‌ده) پاک می‌شن.
-- ------------------------------------------------------------
DELETE FROM financial_proposal_price_change_requests
WHERE financial_proposal_item_id NOT IN (SELECT id FROM inquiry_pricing_option_items);

ALTER TABLE financial_proposal_price_change_requests
    RENAME COLUMN financial_proposal_item_id TO pricing_option_item_id;
ALTER TABLE financial_proposal_price_change_requests
    DROP CONSTRAINT financial_proposal_price_change_financial_proposal_item_id_fkey;
ALTER TABLE financial_proposal_price_change_requests
    ADD CONSTRAINT financial_proposal_price_change_requests_pricing_option_item_fkey
    FOREIGN KEY (pricing_option_item_id) REFERENCES inquiry_pricing_option_items(id) ON DELETE CASCADE;

-- ------------------------------------------------------------
-- ۴) برداشتن ساختارهای فاز ۶۰ اولیه (دقیقاً طبق بخش ROLLBACK خودِ migration 0046)
-- ------------------------------------------------------------
ALTER TABLE technical_proposal_items
    DROP CONSTRAINT uq_tp_item_delivery_option_inquiry_item;
ALTER TABLE technical_proposal_items
    ADD CONSTRAINT technical_proposal_items_technical_proposal_id_inquiry_item_key UNIQUE (technical_proposal_id, inquiry_item_id);

ALTER TABLE financial_proposal_items
    DROP CONSTRAINT uq_fp_item_delivery_option_inquiry_item;
ALTER TABLE financial_proposal_items
    ADD CONSTRAINT financial_proposal_items_financial_proposal_id_inquiry_item_key UNIQUE (financial_proposal_id, inquiry_item_id);

ALTER TABLE technical_proposal_items DROP COLUMN technical_proposal_delivery_option_id;
ALTER TABLE financial_proposal_items
    DROP COLUMN financial_proposal_delivery_option_id,
    DROP COLUMN commercial_calculated_price,
    DROP COLUMN commercial_priced_by,
    DROP COLUMN commercial_priced_at,
    DROP COLUMN sales_adjustment_amount,
    DROP COLUMN sales_adjustment_reason_code,
    DROP COLUMN sales_adjustment_note,
    DROP COLUMN sales_adjusted_by,
    DROP COLUMN sales_adjusted_at,
    DROP COLUMN margin_base_cost_snapshot;

DROP TABLE technical_proposal_delivery_options;
DROP TABLE financial_proposal_delivery_options;

-- ============================================================================
-- ROLLBACK (دستی، این پروژه ابزار Down-Migration نداره):
--   -- بازگردوندن ستون‌ها/جداول فاز ۶۰ اولیه از سرِ نو لازمه (نگاه کنید به 0046)، سپس:
--   ALTER TABLE financial_proposal_price_change_requests DROP CONSTRAINT financial_proposal_price_change_requests_pricing_option_item_fkey;
--   ALTER TABLE financial_proposal_price_change_requests RENAME COLUMN pricing_option_item_id TO financial_proposal_item_id;
--   ALTER TABLE financial_proposal_price_change_requests ADD CONSTRAINT financial_proposal_price_change_requests_financial_proposal__fkey FOREIGN KEY (financial_proposal_item_id) REFERENCES financial_proposal_items(id) ON DELETE CASCADE;
--   DROP TABLE inquiry_pricing_option_items;
--   DROP TABLE inquiry_pricing_options;
-- ============================================================================
