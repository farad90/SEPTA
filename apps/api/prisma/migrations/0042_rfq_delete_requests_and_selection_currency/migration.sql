-- فاز ۵۷ — دو قابلیت مستقل:
-- ۱) درخواست حذف RFQ (فقط برای RFQ بدون آفر دریافتی) + تأیید مدیریت قبل از حذف قطعی
-- ۲) ارز مبنا برای مرحله «انتخاب نهایی و قیمت‌گذاری» + نرخ تبدیل دستی هر ارز آفر به آن

-- ------------------------------------------------------------
-- ۱) درخواست حذف RFQ
-- ------------------------------------------------------------

-- ⚠️ پیش‌نیاز حذف قطعی RFQ: inquiry_discussions.source_rfq_id باید ON DELETE SET NULL باشه،
-- وگرنه حذف یک RFQ که قبلاً حتی یک لاگ فعالیت («استعلام ثبت شد» و ...) به خودش داره با خطای
-- FK Restrict مواجه می‌شه. متن پیام (که شماره RFQ داخلش هست) دست‌نخورده می‌مونه، فقط ارجاع
-- ساختاریافته null می‌شه.
ALTER TABLE inquiry_discussions DROP CONSTRAINT inquiry_discussions_source_rfq_id_fkey;
ALTER TABLE inquiry_discussions
    ADD CONSTRAINT inquiry_discussions_source_rfq_id_fkey
    FOREIGN KEY (source_rfq_id) REFERENCES supplier_rfqs(id) ON DELETE SET NULL;

CREATE TABLE rfq_delete_requests (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id       UUID NOT NULL REFERENCES supplier_rfqs(id) ON DELETE CASCADE,
    reason       TEXT NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by   UUID REFERENCES users(id),
    decided_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rfq_delete_requests_rfq ON rfq_delete_requests(rfq_id, status);

-- ------------------------------------------------------------
-- ۲) ارز مبنای انتخاب نهایی و قیمت‌گذاری
-- ------------------------------------------------------------

ALTER TABLE inquiries ADD COLUMN selection_base_currency_code VARCHAR(3) REFERENCES currencies(currency_code);

CREATE TABLE inquiry_selection_exchange_rates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id          UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    from_currency_code  VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    rate                NUMERIC(18, 6) NOT NULL,
    updated_by          UUID REFERENCES users(id),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_selection_exchange_rate_inquiry_currency UNIQUE (inquiry_id, from_currency_code)
);

-- Rollback:
-- DROP TABLE inquiry_selection_exchange_rates;
-- ALTER TABLE inquiries DROP COLUMN selection_base_currency_code;
-- DROP TABLE rfq_delete_requests;
-- ALTER TABLE inquiry_discussions DROP CONSTRAINT inquiry_discussions_source_rfq_id_fkey;
-- ALTER TABLE inquiry_discussions ADD CONSTRAINT inquiry_discussions_source_rfq_id_fkey
--     FOREIGN KEY (source_rfq_id) REFERENCES supplier_rfqs(id);
