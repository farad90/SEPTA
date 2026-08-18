-- Migration 0046_incoterm_pricing_engine — موتور قیمت‌گذاری بازرگانی مبتنی بر Incoterm
-- (چند گزینه ترم تحویل هم‌زمان در یک پیشنهاد + هزینه‌های اضافی با پرچم «داخل هزینه پایه
-- مارک‌آپ» + رکورد صریح «قیمت محاسبه‌شده بازرگانی در برابر اصلاح فروش»).
-- کاملاً افزودنی — هیچ جدول/ستون موجودی حذف نمی‌شه. فرمول مارک‌آپ موجود
-- (قیمت = هزینه × (۱ + درصد/۱۰۰)) و فیلدهای markup_percent/selection.set_markup دست‌نخورده می‌مونن.

-- ------------------------------------------------------------
-- ۱) هزینه‌های اضافی قابل‌تخصیص به قیمت‌گذاری، در سطح استعلام
-- ------------------------------------------------------------
CREATE TABLE inquiry_pricing_costs (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id             UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    description            VARCHAR(300) NOT NULL,
    amount                 NUMERIC(18,4) NOT NULL,
    currency_code          VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    include_in_margin_base BOOLEAN NOT NULL DEFAULT true,
    delivery_term          VARCHAR(10),
    created_by             UUID REFERENCES users(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inquiry_pricing_costs_inquiry ON inquiry_pricing_costs(inquiry_id);

-- ------------------------------------------------------------
-- ۲) گزینه‌های ترم تحویل هر نسخه پیشنهاد مالی («یک پیشنهاد، چند Incoterm»)
-- ------------------------------------------------------------
CREATE TABLE financial_proposal_delivery_options (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_proposal_id       UUID NOT NULL REFERENCES financial_proposals(id) ON DELETE CASCADE,
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
    UNIQUE (financial_proposal_id, delivery_term)
);
CREATE INDEX idx_fp_delivery_options_proposal ON financial_proposal_delivery_options(financial_proposal_id);

-- ------------------------------------------------------------
-- ۳) همون الگو برای پیشنهاد فنی (مستقل از مالی، طبق طراحی موجود فاز ۵۱)
-- ------------------------------------------------------------
CREATE TABLE technical_proposal_delivery_options (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technical_proposal_id       UUID NOT NULL REFERENCES technical_proposals(id) ON DELETE CASCADE,
    delivery_term               VARCHAR(10),
    incoterm_location           VARCHAR(200),
    shipping_method             VARCHAR(100),
    delivery_time_estimate_days INTEGER,
    delivery_days_unit          VARCHAR(10) NOT NULL DEFAULT 'day' CHECK (delivery_days_unit IN ('day','week')),
    is_primary                  BOOLEAN NOT NULL DEFAULT false,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (technical_proposal_id, delivery_term)
);
CREATE INDEX idx_tp_delivery_options_proposal ON technical_proposal_delivery_options(technical_proposal_id);

-- ------------------------------------------------------------
-- ۴) ستون‌های جدید روی financial_proposal_items — ارجاع به گزینه + قیمت محاسبه‌شده
--    بازرگانی در برابر اصلاح فروش (هرگز روی هم بازنویسی نمی‌شن)
-- ------------------------------------------------------------
ALTER TABLE financial_proposal_items
    ADD COLUMN financial_proposal_delivery_option_id UUID REFERENCES financial_proposal_delivery_options(id) ON DELETE CASCADE,
    ADD COLUMN commercial_calculated_price NUMERIC(18,4),
    ADD COLUMN commercial_priced_by UUID REFERENCES users(id),
    ADD COLUMN commercial_priced_at TIMESTAMPTZ,
    ADD COLUMN sales_adjustment_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN sales_adjustment_reason_code VARCHAR(50),
    ADD COLUMN sales_adjustment_note TEXT,
    ADD COLUMN sales_adjusted_by UUID REFERENCES users(id),
    ADD COLUMN sales_adjusted_at TIMESTAMPTZ,
    ADD COLUMN margin_base_cost_snapshot JSONB;
CREATE INDEX idx_fp_items_delivery_option ON financial_proposal_items(financial_proposal_delivery_option_id);

ALTER TABLE technical_proposal_items
    ADD COLUMN technical_proposal_delivery_option_id UUID REFERENCES technical_proposal_delivery_options(id) ON DELETE CASCADE;
CREATE INDEX idx_tp_items_delivery_option ON technical_proposal_items(technical_proposal_delivery_option_id);

-- ------------------------------------------------------------
-- ۵) بک‌فیل: هر نسخه پیشنهاد موجود دقیقاً یک گزینه «اصلی» (isPrimary) می‌گیره، از روی
--    همون ستون‌های تخت قدیمی؛ همه ردیف‌های آیتم موجود به همون گزینه وصل می‌شن.
--    قیمت‌گذاری تاریخی «قیمت محاسبه‌شده بازرگانی»یی جدا از «قیمت نهایی» نداشت — یعنی
--    finalSalePrice همون‌چیزیه که بازرگانی/فروش نهایتاً روش توافق کردن؛ برای این‌که
--    گزارش «Commercial vs Adjustment» تاریخی هم منطقی بمونه، همون رو commercial_calculated_price
--    می‌ذاریم و sales_adjustment_amount را صفر (یعنی «بدون اصلاح ثبت‌شده»، نه «صفر اصلاح واقعی»).
-- ------------------------------------------------------------
INSERT INTO financial_proposal_delivery_options (
    id, financial_proposal_id, delivery_term, incoterm_location, shipping_method,
    delivery_days, delivery_days_unit, payment_terms, currency_code,
    exchange_rate_from_currency, exchange_rate_value, is_primary, created_at, updated_at
)
SELECT
    gen_random_uuid(), fp.id, fp.chosen_delivery_term, fp.incoterm_location, fp.shipping_method,
    fp.delivery_days, fp.delivery_days_unit, fp.payment_terms, fp.currency_code,
    fp.exchange_rate_from_currency, fp.exchange_rate_value, true, fp.created_at, fp.created_at
FROM financial_proposals fp;

UPDATE financial_proposal_items fpi
SET financial_proposal_delivery_option_id = fpdo.id,
    commercial_calculated_price = fpi.final_sale_price
FROM financial_proposal_delivery_options fpdo
WHERE fpdo.financial_proposal_id = fpi.financial_proposal_id
  AND fpdo.is_primary = true
  AND fpi.financial_proposal_delivery_option_id IS NULL;

INSERT INTO technical_proposal_delivery_options (
    id, technical_proposal_id, delivery_term, incoterm_location, shipping_method,
    delivery_time_estimate_days, delivery_days_unit, is_primary, created_at, updated_at
)
SELECT
    gen_random_uuid(), tp.id, tp.chosen_delivery_term, tp.incoterm_location, tp.shipping_method,
    tp.delivery_time_estimate_days, tp.delivery_days_unit, true, tp.created_at, tp.created_at
FROM technical_proposals tp;

UPDATE technical_proposal_items tpi
SET technical_proposal_delivery_option_id = tpdo.id
FROM technical_proposal_delivery_options tpdo
WHERE tpdo.technical_proposal_id = tpi.technical_proposal_id
  AND tpdo.is_primary = true
  AND tpi.technical_proposal_delivery_option_id IS NULL;

-- ------------------------------------------------------------
-- ۶) یکتایی قیمت هر قلم حالا در سطح «هر گزینه ترم تحویل» معناداره، نه در سطح کل پیشنهاد
--    (همون قلم می‌تونه هم‌زمان زیر CPT و هم زیر DDP قیمت جدا داشته باشه)
-- ------------------------------------------------------------
ALTER TABLE financial_proposal_items
    DROP CONSTRAINT financial_proposal_items_financial_proposal_id_inquiry_item_key;
ALTER TABLE financial_proposal_items
    ADD CONSTRAINT uq_fp_item_delivery_option_inquiry_item UNIQUE (financial_proposal_delivery_option_id, inquiry_item_id);

ALTER TABLE technical_proposal_items
    DROP CONSTRAINT technical_proposal_items_technical_proposal_id_inquiry_item_key;
ALTER TABLE technical_proposal_items
    ADD CONSTRAINT uq_tp_item_delivery_option_inquiry_item UNIQUE (technical_proposal_delivery_option_id, inquiry_item_id);

-- ============================================================================
-- ROLLBACK (دستی، این پروژه ابزار Down-Migration نداره):
--   ALTER TABLE technical_proposal_items DROP CONSTRAINT uq_tp_item_delivery_option_inquiry_item;
--   ALTER TABLE technical_proposal_items ADD CONSTRAINT technical_proposal_items_technical_proposal_id_inquiry_item_key UNIQUE (technical_proposal_id, inquiry_item_id);
--   ALTER TABLE financial_proposal_items DROP CONSTRAINT uq_fp_item_delivery_option_inquiry_item;
--   ALTER TABLE financial_proposal_items ADD CONSTRAINT financial_proposal_items_financial_proposal_id_inquiry_item_key UNIQUE (financial_proposal_id, inquiry_item_id);
--   ALTER TABLE technical_proposal_items DROP COLUMN technical_proposal_delivery_option_id;
--   ALTER TABLE financial_proposal_items DROP COLUMN financial_proposal_delivery_option_id, DROP COLUMN commercial_calculated_price,
--       DROP COLUMN commercial_priced_by, DROP COLUMN commercial_priced_at, DROP COLUMN sales_adjustment_amount,
--       DROP COLUMN sales_adjustment_reason_code, DROP COLUMN sales_adjustment_note, DROP COLUMN sales_adjusted_by,
--       DROP COLUMN sales_adjusted_at, DROP COLUMN margin_base_cost_snapshot;
--   DROP TABLE technical_proposal_delivery_options;
--   DROP TABLE financial_proposal_delivery_options;
--   DROP TABLE inquiry_pricing_costs;
-- ============================================================================
