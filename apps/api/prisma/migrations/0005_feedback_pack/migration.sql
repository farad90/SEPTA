-- ============================================================
-- بسته اصلاحات بازخورد کاربر (همراه فاز ۵)
-- شرکت‌ها، رابطین، کالاها، استعلام‌ها
-- ============================================================

-- ------------------------------------------------------------
-- شرکت‌ها: چند تلفن، فکس، تاریخ ثبت، لوگو، داخلی/خارجی
-- ------------------------------------------------------------
ALTER TABLE business_partners
    ADD COLUMN phones JSONB,                 -- آرایه شماره تلفن‌ها (جایگزین عملی phone تکی؛ phone برای سازگاری می‌مونه)
    ADD COLUMN fax VARCHAR(30),
    ADD COLUMN registration_date DATE,       -- تاریخ ثبت شرکت
    ADD COLUMN logo_url TEXT,                -- لوگوی شرکت (FilesModule)
    ADD COLUMN is_foreign BOOLEAN NOT NULL DEFAULT false;  -- داخلی/خارجی — تعیین زبان لیست کشورها در UI

-- ------------------------------------------------------------
-- رابطین: نوع «خرید»، شماره داخلی، تصویر، ملاحظات
-- ------------------------------------------------------------
ALTER TABLE partner_contacts DROP CONSTRAINT partner_contacts_contact_type_check;
ALTER TABLE partner_contacts
    ADD CONSTRAINT partner_contacts_contact_type_check
    CHECK (contact_type IN ('technical', 'financial', 'commercial', 'purchasing', 'other'));

ALTER TABLE partner_contacts
    ADD COLUMN extension VARCHAR(20),        -- شماره داخلی
    ADD COLUMN photo_url TEXT,               -- تصویر شخص
    ADD COLUMN notes TEXT;                   -- ملاحظات/سایر اطلاعات

-- ------------------------------------------------------------
-- کالاها: پارت نامبر به‌عنوان فیلد اصلی + کد سیستمی + واحدهای اندازه‌گیری
-- ------------------------------------------------------------
ALTER TABLE item_catalog ADD COLUMN part_number VARCHAR(200);
-- داده‌های موجود: کد فعلی در واقع پارت نامبر بوده
UPDATE item_catalog SET part_number = item_code WHERE part_number IS NULL;
ALTER TABLE item_catalog ALTER COLUMN part_number SET NOT NULL;
CREATE INDEX idx_item_catalog_part_number ON item_catalog USING gin (part_number gin_trgm_ops);

-- شمارنده کد سیستمی کالا (ITM-NNNNNN) — کد دستی هم مجازه (UNIQUE بودن PK کافیه)
CREATE TABLE catalog_counters (
    id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_serial INTEGER NOT NULL DEFAULT 0
);
INSERT INTO catalog_counters (id, last_serial) VALUES (1, 0);

-- واحدهای اندازه‌گیری از پیش تعریف‌شده — افزودن با دسترسی catalog.manage_units
CREATE TABLE measurement_units (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_name   VARCHAR(50) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO measurement_units (unit_name) VALUES
    ('عدد'), ('کیلوگرم'), ('گرم'), ('تن'), ('متر'), ('سانتی‌متر'), ('مترمربع'),
    ('لیتر'), ('دست'), ('بسته'), ('رول'), ('شاخه'), ('ورق'), ('جفت'), ('کارتن');

-- ------------------------------------------------------------
-- استعلام‌ها: حذف نرم (سطل بازیافت با دسترسی حذف قطعی/بازگردانی)
-- ------------------------------------------------------------
ALTER TABLE inquiries
    ADD COLUMN deleted_at TIMESTAMPTZ,
    ADD COLUMN deleted_by UUID REFERENCES users(id);
